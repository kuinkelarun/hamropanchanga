/**
 * Bulk Upload Modal Component
 * Provides tabbed interface for bulk uploading trees, members, and events
 */

import React, { useState, useEffect } from 'react';
import {
  generateTreeTemplate,
  generateMemberTemplate,
  generateEventTemplate
} from '../utils/BulkUploadTemplates';
import { parseFile, normalizeData } from '../utils/ExcelParser';
import {
  validateTreeData,
  validateMemberData,
  validateEventData
} from '../utils/BulkUploadValidation';
import {
  createTreesFromBulkUpload,
  addFamilyMembersFromBulkUpload,
  addEventsFromBulkUpload
} from '../services/BulkUploadService';
import { Trees } from './TreeBuilder/utils/firestoreTreeApi';
import { Members } from './TreeBuilder/utils/firestoreTreeApi';
import './BulkUploadModal.css';

const TABS = {
  TREES: 'trees',
  MEMBERS: 'members',
  EVENTS: 'events'
};

const BulkUploadModal = ({ isOpen, onClose, onComplete, userId, userEmail }) => {
  const [activeTab, setActiveTab] = useState(TABS.TREES);
  const [uploadFile, setUploadFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // State for fetching existing data
  const [existingTrees, setExistingTrees] = useState([]);

  // Load existing trees when modal opens
  useEffect(() => {
    if (!isOpen || !userId) {
      setExistingTrees([]);
      return;
    }

    const loadTrees = async () => {
      try {
        const all = await Trees.list(userId);
        const treeNames = (all || [])
          .filter(t => !t.deleted)
          .map(t => t.name || t.title);
        setExistingTrees(treeNames);
      } catch (err) {
        console.error('Error loading trees for validation:', err);
        // Don't throw - just log and continue with empty list
        setExistingTrees([]);
      }
    };

    loadTrees();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = async (file) => {
    setError(null);
    setValidationResult(null);
    setPreviewData(null);

    try {
      setIsLoading(true);
      const rawData = await parseFile(file);
      const normalizedData = normalizeData(rawData);

      // Validate based on active tab
      let validation;
      switch (activeTab) {
        case TABS.TREES:
          validation = validateTreeData(normalizedData, existingTrees);
          break;
        case TABS.MEMBERS:
          validation = validateMemberData(normalizedData, existingTrees);
          break;
        case TABS.EVENTS:
          // For events, also need to fetch members for validation
          const allTreesForValidation = await Trees.list(userId);
          const membersByTree = {};
          
          for (const tree of (allTreesForValidation || [])) {
            if (!tree.deleted) {
              const treeKey = tree.name || tree.title;
              membersByTree[treeKey] = [];
              
              try {
                const members = await Members.list(tree.id);
                membersByTree[treeKey] = (members || []).map(m => m.name);
              } catch (err) {
                console.warn(`Could not fetch members for tree ${treeKey}:`, err);
              }
            }
          }
          
          validation = validateEventData(normalizedData, existingTrees, membersByTree);
          break;
        default:
          validation = { isValid: false, errors: ['Unknown tab'] };
      }

      setValidationResult(validation);
      setPreviewData(normalizedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    switch (activeTab) {
      case TABS.TREES:
        generateTreeTemplate();
        break;
      case TABS.MEMBERS:
        generateMemberTemplate();
        break;
      case TABS.EVENTS:
        generateEventTemplate();
        break;
      default:
        break;
    }
  };

  const handlePreview = () => {
    // Already showing preview below
    console.log('Preview enabled');
  };

  const handleCommit = async () => {
    if (!validationResult?.isValid) {
      setError('Please fix validation errors before uploading');
      return;
    }

    try {
      setIsLoading(true);
      let results;

      switch (activeTab) {
        case TABS.TREES:
          results = await createTreesFromBulkUpload(previewData, userId, userEmail);
          break;
        case TABS.MEMBERS:
          // Fetch tree IDs for member linking
          const allTrees = await Trees.list(userId);
          const treeMap = new Map();
          (allTrees || []).forEach(tree => {
            if (!tree.deleted) {
              // Map both 'name' and 'title' to support different tree structures
              treeMap.set(tree.name || tree.title, tree.id);
            }
          });
          results = await addFamilyMembersFromBulkUpload(previewData, userId, treeMap);
          break;
        case TABS.EVENTS:
          // Fetch tree and member IDs for event linking
          const allTreesForEvents = await Trees.list(userId);
          const treeMapForEvents = new Map();
          const memberMapForEvents = new Map();
          
          for (const tree of (allTreesForEvents || [])) {
            if (!tree.deleted) {
              treeMapForEvents.set(tree.name || tree.title, tree.id);
              
              // Fetch members for this tree
              const members = await Members.list(tree.id);
              (members || []).forEach(member => {
                memberMapForEvents.set(`${tree.name || tree.title}:${member.name}`, member.id);
              });
            }
          }
          results = await addEventsFromBulkUpload(previewData, userId, treeMapForEvents, memberMapForEvents);

          break;
        default:
          results = { success: [], failed: [], stats: {} };
      }

      setUploadResults(results);
      if (onComplete) {
        onComplete(results, activeTab);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setUploadFile(null);
    setValidationResult(null);
    setPreviewData(null);
    setError(null);
    setUploadResults(null);
    onClose();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setUploadFile(null);
    setValidationResult(null);
    setPreviewData(null);
    setError(null);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case TABS.TREES:
        return 'Upload Trees';
      case TABS.MEMBERS:
        return 'Upload Family Members';
      case TABS.EVENTS:
        return 'Upload Events';
      default:
        return 'Bulk Upload';
    }
  };

  return (
    <div className="bum-backdrop" onClick={handleClose}>
      <div className="bum-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bum-header">
          <h2>{getTabTitle()}</h2>
          <button className="bum-close nc-header-close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className="bum-tabs">
          <button
            className={`bum-tab ${activeTab === TABS.TREES ? 'active' : ''}`}
            onClick={() => handleTabChange(TABS.TREES)}
          >
            🌳 Trees
          </button>
          <button
            className={`bum-tab ${activeTab === TABS.MEMBERS ? 'active' : ''}`}
            onClick={() => handleTabChange(TABS.MEMBERS)}
          >
            👥 Members
          </button>
          <button
            className={`bum-tab ${activeTab === TABS.EVENTS ? 'active' : ''}`}
            onClick={() => handleTabChange(TABS.EVENTS)}
          >
            📅 Events
          </button>
        </div>

        {/* Content */}
        <div className="bum-content">
          {uploadResults ? (
            // Show results
            <div className="bum-results">
              <div className="bum-results-summary">
                <h3>Upload Complete!</h3>
                <p>✅ Created: {uploadResults.stats.created}</p>
                <p>⚠️ Skipped: {uploadResults.stats.skipped}</p>
                <p>❌ Errors: {uploadResults.stats.errors}</p>
              </div>

              {uploadResults.success.length > 0 && (
                <div className="bum-results-section">
                  <h4>✅ Successful Uploads</h4>
                  <ul className="bum-results-list">
                    {uploadResults.success.slice(0, 10).map((item, idx) => (
                      <li key={idx}>{item.name || item.member}</li>
                    ))}
                    {uploadResults.success.length > 10 && (
                      <li>... and {uploadResults.success.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}

              {uploadResults.failed.length > 0 && (
                <div className="bum-results-section">
                  <h4>❌ Failed Uploads</h4>
                  <ul className="bum-results-list errors">
                    {uploadResults.failed.slice(0, 5).map((item, idx) => (
                      <li key={idx}>
                        <strong>{item.name || item.member}:</strong> {item.reason}
                      </li>
                    ))}
                    {uploadResults.failed.length > 5 && (
                      <li>... and {uploadResults.failed.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="bum-actions">
                <button className="app-cancel-btn" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* File Upload Section */}
              <div
                className={`bum-upload-area ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="bum-upload-content">
                  <span className="bum-upload-icon">📁</span>
                  <p>Drag and drop your file here or</p>
                  <label className="bum-file-input-label">
                    choose file
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <p className="bum-upload-hint">Supported: .xlsx, .xls, .csv</p>
                </div>
              </div>

              {/* File Info */}
              {uploadFile && (
                <div className="bum-file-info">
                  <p>📄 {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bum-error">
                  <p>❌ {error}</p>
                </div>
              )}

              {/* Validation Results */}
              {validationResult && (
                <div className={`bum-validation ${validationResult.isValid ? 'success' : 'error'}`}>
                  <div className="bum-validation-summary">
                    <p>Rows: {validationResult.summary.totalRows}</p>
                    <p>Errors: {validationResult.summary.errorsCount}</p>
                    <p>Warnings: {validationResult.summary.warningsCount}</p>
                  </div>

                  {validationResult.errors.length > 0 && (
                    <div className="bum-validation-errors">
                      <h4>❌ Errors</h4>
                      <ul>
                        {validationResult.errors.slice(0, 5).map((e, idx) => (
                          <li key={idx}>
                            Row {e.rowIndex}: {e.message}
                          </li>
                        ))}
                        {validationResult.errors.length > 5 && (
                          <li>... and {validationResult.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="bum-validation-warnings">
                      <h4>⚠️ Warnings</h4>
                      <ul>
                        {validationResult.warnings.slice(0, 5).map((w, idx) => (
                          <li key={idx}>
                            Row {w.rowIndex}: {w.message}
                          </li>
                        ))}
                        {validationResult.warnings.length > 5 && (
                          <li>... and {validationResult.warnings.length - 5} more warnings</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Data */}
              {previewData && previewData.length > 0 && (
                <div className="bum-preview">
                  <h4>📊 Preview (first 5 rows)</h4>
                  <div className="bum-preview-table-wrapper">
                    <table className="bum-preview-table">
                      <thead>
                        <tr>
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((val, vidx) => (
                              <td key={vidx}>{val || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewData.length > 5 && (
                    <p className="bum-preview-note">... and {previewData.length - 5} more rows</p>
                  )}
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="bum-loading">
                  <div className="bum-spinner"></div>
                  <p>Processing...</p>
                </div>
              )}

              {/* Actions */}
              <div className="bum-actions">
                <button
                  className="bum-btn bum-btn-secondary"
                  onClick={handleDownloadTemplate}
                >
                  ⬇️ Download Template
                </button>
                <button
                  className="bum-btn bum-btn-secondary"
                  onClick={handlePreview}
                  disabled={!validationResult || isLoading}
                >
                  👁️ Preview
                </button>
                <button
                  className="app-save-btn"
                  onClick={handleCommit}
                  disabled={!validationResult?.isValid || isLoading}
                >
                  ✅ Commit Upload
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
