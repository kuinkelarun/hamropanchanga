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
import { normalizeForCompare } from '../utils/textNormalize';
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

// Helper function to build structured member lookup keys
// Uses JSON to avoid delimiter conflicts when tree/member names contain colons or other special chars
function buildMemberKey(treeName, memberName) {
  return JSON.stringify({ 
    tree: normalizeForCompare(treeName), 
    member: normalizeForCompare(memberName) 
  });
}

const BulkUploadModal = ({ isOpen, onClose, onComplete, userId, userEmail, isAdmin=false }) => {
  const [activeTab, setActiveTab] = useState(TABS.TREES);
  const [uploadFile, setUploadFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  // Track the tab that was committed so onComplete can be called on close
  const [committedTab, setCommittedTab] = useState(null);

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
        // If the current user is admin, load all trees (pass null)
        const all = await Trees.list(isAdmin ? null : userId);
        const treeNames = (all || [])
          .filter(t => !t.deleted)
          .map(t => t.title || t.name);
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
      let allTreesForValidation = null;
      let treeNameToId = null;
      switch (activeTab) {
        case TABS.TREES:
          validation = validateTreeData(normalizedData, existingTrees);
          break;
        case TABS.MEMBERS:
          validation = validateMemberData(normalizedData, existingTrees);
          break;
          case TABS.EVENTS:
          // For events, also need to fetch members for validation
          // If admin, fetch all trees
          allTreesForValidation = await Trees.list(isAdmin ? null : userId);
          const membersByTree = {};
          
          for (const tree of (allTreesForValidation || [])) {
            if (!tree.deleted) {
              const treeKey = tree.title || tree.name;
              membersByTree[treeKey] = [];
              
              try {
                const members = await Members.list(tree.id);
                // Expand member name variants: handle entries that contain multiple names
                const collected = [];
                (members || []).forEach(m => {
                  const raw = (m.name || '').toString();
                  if (!raw) return;
                  // include full raw name
                  collected.push(raw.trim());
                  // split on common separators to catch multiple names in one record
                  const parts = raw.split(/[,\/\\|;]+/).map(p => p.trim()).filter(Boolean);
                  parts.forEach(p => collected.push(p));
                });
                // dedupe
                const unique = Array.from(new Set(collected.map(s => s.trim())));
                // store under original and normalized tree keys to avoid lookup mismatches
                membersByTree[treeKey] = unique;
                try {
                  membersByTree[normalizeForCompare(treeKey)] = unique;
                } catch (nErr) {
                  // ignore
                }
              } catch (err) {
                console.warn(`Could not fetch members for tree ${treeKey}:`, err);
              }
            }
          }
          
          // Pass array of tree NAMES (not objects) to validation, matching validateEventData expectations
          const treeNamesForValidation = (allTreesForValidation || []).map(t => t.title || t.name);
          treeNameToId = {};
          (allTreesForValidation || []).forEach(t => {
            const k = t.title || t.name;
            if (!k) return;
            treeNameToId[k] = t.id;
            try {
              treeNameToId[normalizeForCompare(k)] = t.id;
            } catch (nErr) {
              // ignore
            }
            // If backend stored normalized fields, include those as well
            if (t.titleNormalized) treeNameToId[t.titleNormalized] = t.id;
            if (t.nameNormalized) treeNameToId[t.nameNormalized] = t.id;
            // Also include a cleaned variant removing punctuation to help match CSV labels
            try {
              const cleaned = (k || '').replace(/[.,\/\\|]+/g, ' ').trim();
              if (cleaned && cleaned !== k) treeNameToId[cleaned] = t.id;
              const cleanedNorm = normalizeForCompare(cleaned || '');
              if (cleanedNorm) treeNameToId[cleanedNorm] = t.id;
            } catch (e) {
              // ignore
            }
          });

          // Diagnostics: log fetched trees and member counts to help debug member-not-found issues
          try {
            console.log('[BulkUpload] treeNamesForValidation count=', treeNamesForValidation.length);
            console.log('[BulkUpload] treeNamesForValidation sample=', treeNamesForValidation.slice(0,50));
            const memberCounts = {};
            Object.keys(membersByTree).forEach(k => { memberCounts[k] = (membersByTree[k] || []).length; });
            console.log('[BulkUpload] membersByTree counts sample=', memberCounts);

            // For keys with zero members, attempt a re-fetch and log details to help debug
            const zeroKeys = Object.keys(memberCounts).filter(k => memberCounts[k] === 0).slice(0, 10);
            for (const zk of zeroKeys) {
              try {
                // try to find tree object that corresponds to this key
                const treeObj = (allTreesForValidation || []).find(t => (t.title || t.name) === zk);
                if (treeObj) {
                  console.log('[BulkUpload] re-fetch members for tree key=', zk, 'id=', treeObj.id);
                  try {
                    const refMembers = await Members.list(treeObj.id);
                    console.log('[BulkUpload] re-fetch result count=', (refMembers || []).length, 'sample=', (refMembers || []).slice(0,20).map(m=>m.name));
                    if ((refMembers || []).length === 0) {
                      try {
                        const treeDoc = await Trees.get(treeObj.id);
                        console.log('[BulkUpload] tree doc for', treeObj.id, treeDoc);
                      } catch(tdErr) {
                        console.warn('[BulkUpload] could not fetch tree doc for', treeObj.id, tdErr?.message || tdErr);
                      }
                    }
                  } catch (refErr) {
                    console.warn('[BulkUpload] re-fetch failed for', zk, refErr?.message || refErr);
                  }
                } else {
                  console.log('[BulkUpload] no tree object found for key=', zk);
                }
              } catch (innerErr) {
                console.warn('[BulkUpload] diagnostics inner loop failed', innerErr);
              }
            }
          } catch (dbgErr) {
            console.warn('[BulkUpload] diagnostics failed', dbgErr);
          }

          validation = await validateEventData(normalizedData, treeNamesForValidation, membersByTree, treeNameToId);
          break;
        default:
          validation = { isValid: false, errors: ['Unknown tab'] };
      }

      setValidationResult(validation);
      setPreviewData(normalizedData);

      // If there are member-not-found errors, run a targeted diagnostic **only** against the
      // tree label provided in the CSV row. Do NOT search other trees — this keeps
      // validation strict and avoids noisy cross-tree matches.
      try {
        const memberErrors = (validation.errors || []).filter(e => e.message && e.message.includes('Member') && e.message.includes('not found'));
        if (memberErrors.length > 0) {
          const toCheck = memberErrors.slice(0, 50);
          for (const me of toCheck) {
            const text = me.message;
            const m = text.match(/Member\s+([^\s]+(?:\s[^\s]+)*)\s+not found in tree\s+(.+)\s*\(/);
            if (!m) continue;
            const memberName = m[1].trim();
            const treeLabel = m[2].trim();
            console.log('[BulkUpload] diagnostic: searching for member=', memberName, 'expected tree label=', treeLabel);
            const normalizedTarget = normalizeForCompare(memberName);

            // Resolve tree id from provided maps (try exact, then normalized)
            let tid = null;
            if (treeNameToId) tid = treeNameToId[treeLabel] || treeNameToId[normalizeForCompare(treeLabel)];
            // If we still don't have a tid, try to find the tree object in the fetched list
            let treeObj = null;
            if (!tid && (allTreesForValidation || []).length) {
              treeObj = (allTreesForValidation || []).find(t => {
                const label = t.title || t.name || '';
                try {
                  return label === treeLabel || normalizeForCompare(label) === normalizeForCompare(treeLabel);
                } catch (e) {
                  return label === treeLabel;
                }
              });
              if (treeObj) tid = treeObj.id;
            }

            if (!tid) {
                console.log('[BulkUpload] diagnostic: could not resolve tree id for', treeLabel);
                try {
                  // show a sample of available tree keys and normalized forms to help debug
                  const sampleKeys = Object.keys(treeNameToId || {}).slice(0, 40);
                  console.log('[BulkUpload] diagnostic: sample treeNameToId keys=', sampleKeys);
                  const normTarget = normalizeForCompare(treeLabel);
                  console.log('[BulkUpload] diagnostic: normalized target=', normTarget);
                  const sampleNorm = sampleKeys.map(k => ({ raw: k, normalized: normalizeForCompare(k) }));
                  console.log('[BulkUpload] diagnostic: sample treeNameToId normalized sample=', sampleNorm);
                  // try to find any tree in allTreesForValidation whose normalized label matches
                  const matches = (allTreesForValidation || []).filter(t => {
                    const label = (t.title || t.name || '').toString();
                    try { return normalizeForCompare(label) === normTarget; } catch (e) { return label === treeLabel; }
                  });
                  if (matches.length) {
                    console.log('[BulkUpload] diagnostic: FOUND matching normalized tree(s) for', treeLabel, matches.map(m => ({ id: m.id, label: m.title || m.name }))); 
                    // If we found normalized matches in the fetched tree list, use the first match to resolve tid.
                    if (!tid) {
                      treeObj = matches[0];
                      tid = matches[0].id;
                      console.log('[BulkUpload] diagnostic: resolving tree id from normalized match ->', tid);
                    }
                  } else {
                    // Check direct lookup in treeNameToId map (exact and normalized)
                    try {
                      const directExact = treeNameToId ? treeNameToId[treeLabel] : undefined;
                      const directNorm = treeNameToId ? treeNameToId[normalizeForCompare(treeLabel)] : undefined;
                      console.log('[BulkUpload] diagnostic: direct lookup exact=', directExact, 'normalized=', directNorm);

                      const normMatchesInMap = Object.entries(treeNameToId || {}).filter(([k, v]) => {
                        try { return normalizeForCompare(k) === normTarget; } catch (e) { return false; }
                      }).slice(0, 20);
                      if (normMatchesInMap.length) console.log('[BulkUpload] diagnostic: map keys normalized match=', normMatchesInMap);
                    } catch (inner) {
                      console.warn('[BulkUpload] diagnostic inner lookup failed', inner);
                    }
                    // also log any trees whose normalized label *startsWith* the target (for punctuation/spacing diffs)
                    const starts = (allTreesForValidation || []).filter(t => {
                      const label = (t.title || t.name || '').toString();
                      try { return normalizeForCompare(label).startsWith(normTarget) || normTarget.startsWith(normalizeForCompare(label)); } catch (e) { return false; }
                    }).slice(0,20).map(m => ({ id: m.id, label: m.title || m.name }));
                    if (starts.length) console.log('[BulkUpload] diagnostic: close matches (startsWith)=', starts);
                  }
                } catch(diagEx) {
                  console.warn('[BulkUpload] diagnostic inner error', diagEx);
                }
              continue;
            }

            try {
              const members = await Members.list(tid);
              const found = (members || []).some(mm => {
                try {
                  return normalizeForCompare(mm.name || '') === normalizedTarget || (mm.name || '').includes(memberName);
                } catch (e) {
                  return (mm.name || '').includes(memberName);
                }
              });
              if (found) console.log('[BulkUpload] diagnostic: found member', memberName, 'in tree', treeObj ? (treeObj.name || treeObj.title) : treeLabel, 'id=', tid);
              else console.log('[BulkUpload] diagnostic: member', memberName, 'NOT found in expected tree', treeLabel);
            } catch (err) {
              console.warn('[BulkUpload] diagnostic: could not fetch members for tree id=', tid, err?.message || err);
            }
          }
        }
      } catch (diagErr) {
        console.warn('[BulkUpload] member diagnostic failed', diagErr);
      }
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
          // Admin users can upload to any tree; fetch all trees for admins
          const allTrees = await Trees.list(isAdmin ? null : userId);
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
          const allTreesForEvents = await Trees.list(isAdmin ? null : userId);
          const treeMapForEvents = new Map();
          const memberMapForEvents = new Map();
          
          for (const tree of (allTreesForEvents || [])) {
            if (!tree.deleted) {
              const label = tree.name || tree.title;
              treeMapForEvents.set(label, tree.id);
              try { treeMapForEvents.set(normalizeForCompare(label), tree.id); } catch (e) { /* ignore */ }
              
              // Fetch members for this tree
              const members = await Members.list(tree.id);
              (members || []).forEach(member => {
                const mLabel = member.name || '';
                const treeLabel = tree.name || tree.title;
                // Use structured key to avoid delimiter conflicts
                const structuredKey = buildMemberKey(treeLabel, mLabel);
                memberMapForEvents.set(structuredKey, member.id);
              });
            }
          }
          results = await addEventsFromBulkUpload(previewData, userId, treeMapForEvents, memberMapForEvents);

          break;
        default:
          results = { success: [], failed: [], stats: {} };
      }

      setUploadResults(results);
      // Remember which tab was committed; onComplete will fire when the user
      // dismisses the results screen ("Done" button) so they can see the
      // upload summary first.
      setCommittedTab(activeTab);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // If we have upload results, notify the parent so it can refresh data
    if (uploadResults && onComplete) {
      onComplete(uploadResults, committedTab || activeTab);
    }
    // Reset state
    setUploadFile(null);
    setValidationResult(null);
    setPreviewData(null);
    setError(null);
    setUploadResults(null);
    setCommittedTab(null);
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

  const formatValidationText = () => {
    if (!validationResult) return '';
    const lines = [];
    lines.push(`${getTabTitle()} - Validation Summary`);
    lines.push(`Rows: ${validationResult.summary.totalRows}`);
    lines.push(`Errors: ${validationResult.summary.errorsCount}`);
    lines.push(`Warnings: ${validationResult.summary.warningsCount}`);
    lines.push('');

    if (validationResult.errors && validationResult.errors.length) {
      lines.push('Errors:');
      validationResult.errors.forEach(e => {
        lines.push(`Row ${e.rowIndex}: ${e.message}`);
      });
      lines.push('');
    }

    if (validationResult.warnings && validationResult.warnings.length) {
      lines.push('Warnings:');
      validationResult.warnings.forEach(w => {
        lines.push(`Row ${w.rowIndex}: ${w.message}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  };

  const handleCopyValidation = async () => {
    try {
      const text = formatValidationText();
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error('Copy failed', err);
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
                    <button
                      className="bum-btn bum-btn-secondary"
                      onClick={handleCopyValidation}
                      disabled={(!validationResult.errors || validationResult.errors.length === 0) && (!validationResult.warnings || validationResult.warnings.length === 0)}
                    >
                      📋 Copy All
                    </button>
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
