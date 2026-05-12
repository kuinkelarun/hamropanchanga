/**
 * Bulk Tree Share Modal Component
 * Allows users to share multiple trees at once with multi-select functionality
 */

import React, { useState, useEffect } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Trees } from './TreeBuilder/utils/firestoreTreeApi';
import { SHARE_PERMISSIONS, getPermissionDescription, isValidEmail } from '../utils/TreeSharingUtils';
import { useDetectedCountry } from '../hooks/useDetectedCountry';
import './TreeShareModal.css';

const BulkTreeShareModal = ({ isOpen, onClose, onComplete, userEmail, userId, isAdmin }) => {
  const [trees, setTrees] = useState([]);
  const [selectedTrees, setSelectedTrees] = useState([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [permission, setPermission] = useState(SHARE_PERMISSIONS.VIEW);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const { country: detectedCountry } = useDetectedCountry();

  // Load trees when modal opens
  useEffect(() => {
    const loadTrees = async () => {
      try {
        setIsLoading(true);
        // Admin can load all trees, regular users only their own
        const allTrees = await Trees.list(isAdmin ? null : userId, { includeDeleted: false });
        setTrees(allTrees);
      } catch (err) {
        console.error('Error loading trees:', err);
        setError('Failed to load trees');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadTrees();
    } else {
      // Reset state when modal closes
      setSelectedTrees([]);
      setRecipientEmail('');
      setWhatsappPhone('');
      setPermission(SHARE_PERMISSIONS.VIEW);
      setError(null);
      setSuccess(null);
      setFilter('');
      setSelectAll(false);
    }
  }, [isOpen, userId, isAdmin]);

  const handleTreeSelect = (treeId) => {
    setSelectedTrees(prev => {
      if (prev.includes(treeId)) {
        return prev.filter(id => id !== treeId);
      } else {
        return [...prev, treeId];
      }
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredTrees();
    if (selectAll) {
      // Deselect all filtered trees
      const filteredIds = filtered.map(t => t.id);
      setSelectedTrees(prev => prev.filter(id => !filteredIds.includes(id)));
      setSelectAll(false);
    } else {
      // Select all filtered trees
      const filteredIds = filtered.map(t => t.id);
      setSelectedTrees(prev => {
        const newSet = new Set([...prev, ...filteredIds]);
        return Array.from(newSet);
      });
      setSelectAll(true);
    }
  };

  const getFilteredTrees = () => {
    if (!filter.trim()) return trees;
    
    const searchTerm = filter.toLowerCase();
    return trees.filter(tree => {
      const title = (tree.title || tree.name || '').toLowerCase();
      const location = (tree.location || '').toLowerCase();
      const primary = (tree.primaryMemberName || '').toLowerCase();
      
      return title.includes(searchTerm) || 
             location.includes(searchTerm) || 
             primary.includes(searchTerm);
    });
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (selectedTrees.length === 0) {
      setError('Please select at least one tree to share');
      return;
    }

    if (!recipientEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!isValidEmail(recipientEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (recipientEmail.toLowerCase() === userEmail.toLowerCase()) {
      setError('You cannot share with yourself');
      return;
    }

    if (whatsappPhone && !isValidPhoneNumber(whatsappPhone)) {
      setError('Please enter a valid WhatsApp phone number (include country code)');
      return;
    }

    try {
      setIsLoading(true);

      if (whatsappPhone) {
        // Send WhatsApp invitations for each selected tree
        const fn = httpsCallable(functions, 'shareTreeWithWhatsApp');
        const results = await Promise.allSettled(
          selectedTrees.map(treeId =>
            fn({ treeId, hintEmail: recipientEmail.toLowerCase(), whatsappPhone, permission })
          )
        );
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (succeeded > 0) {
          setSuccess(`WhatsApp invitations sent for ${succeeded} tree(s) to ${recipientEmail}`);
          setSelectedTrees([]);
          setRecipientEmail('');
          setWhatsappPhone('');
          setPermission(SHARE_PERMISSIONS.VIEW);
          if (failed > 0) setError(`Failed to send for ${failed} tree(s).`);
          if (onComplete) onComplete();
        } else {
          setError('Failed to send WhatsApp invitations. Please try again.');
        }
      } else {
        const emailFn = httpsCallable(functions, 'shareTreeWithEmail');
        const results = await Promise.allSettled(
          selectedTrees.map(treeId =>
            emailFn({ treeId, recipientEmail: recipientEmail.toLowerCase(), permission })
          )
        );
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (succeeded > 0) {
          setSuccess(`Invitation sent for ${succeeded} tree(s) to ${recipientEmail}`);
          setSelectedTrees([]);
          setRecipientEmail('');
          setPermission(SHARE_PERMISSIONS.VIEW);
          if (failed > 0) setError(`Failed to send for ${failed} tree(s).`);
          if (onComplete) onComplete();
        } else {
          setError('Failed to send invitations. Please try again.');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to share trees');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTrees([]);
    setRecipientEmail('');
    setWhatsappPhone('');
    setPermission(SHARE_PERMISSIONS.VIEW);
    setError(null);
    setSuccess(null);
    setFilter('');
    onClose();
  };

  if (!isOpen) return null;

  const filteredTrees = getFilteredTrees();

  return (
    <div className="tsm-backdrop" onClick={handleClose}>
      <div className="tsm-modal tsm-modal-bulk" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tsm-header">
          <h2>📤 Share Multiple Trees</h2>
          <button className="tsm-close nc-header-close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        {/* Content */}
        <div className="tsm-content tsm-content-bulk">
          {/* Error Message */}
          {error && (
            <div className="tsm-alert tsm-alert-error">
              <span>❌</span>
              <p>{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="tsm-alert tsm-alert-success">
              <span>✅</span>
              <p>{success}</p>
            </div>
          )}

          {/* Share Form */}
          <form onSubmit={handleShare} className="tsm-form">
            <div className="tsm-form-group">
              <label htmlFor="email" className="tsm-label">
                Recipient Email Address *
              </label>
              <input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                className="tsm-input"
                disabled={isLoading}
                required
              />
            </div>

            <div className="tsm-form-group">
              <label className="tsm-label">
                📱 WhatsApp Phone <span className="tsm-optional">(optional)</span>
              </label>
              <PhoneInput
                international
                defaultCountry={detectedCountry}
                value={whatsappPhone}
                onChange={setWhatsappPhone}
                disabled={isLoading}
                placeholder="+977 98XXXXXXXX"
                className="tsm-phone-input"
              />
              <p className="tsm-field-hint">If provided, an invitation link will be sent via WhatsApp</p>
            </div>

            <div className="tsm-form-group">
              <label className="tsm-label">Permission Level *</label>
              <div className="tsm-permission-options">
                <label className="tsm-permission-option">
                  <input
                    type="radio"
                    name="permission"
                    value={SHARE_PERMISSIONS.VIEW}
                    checked={permission === SHARE_PERMISSIONS.VIEW}
                    onChange={(e) => setPermission(e.target.value)}
                    disabled={isLoading}
                  />
                  <div>
                    <strong>👁️ View Only</strong>
                    <p>{getPermissionDescription(SHARE_PERMISSIONS.VIEW)}</p>
                  </div>
                </label>

                <label className="tsm-permission-option">
                  <input
                    type="radio"
                    name="permission"
                    value={SHARE_PERMISSIONS.EDIT}
                    checked={permission === SHARE_PERMISSIONS.EDIT}
                    onChange={(e) => setPermission(e.target.value)}
                    disabled={isLoading}
                  />
                  <div>
                    <strong>✏️ Can Edit</strong>
                    <p>{getPermissionDescription(SHARE_PERMISSIONS.EDIT)}</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="tsm-divider"></div>

            {/* Tree Selection */}
            <div className="tsm-tree-selection">
              <div className="tsm-selection-header">
                <label className="tsm-label">
                  Select Trees to Share * ({selectedTrees.length} selected)
                </label>
                <div className="tsm-selection-actions">
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="🔍 Search trees..."
                    className="tsm-search-input"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="tsm-btn-select-all"
                    disabled={isLoading || filteredTrees.length === 0}
                  >
                    {selectAll ? 'Deselect All' : 'Select All'} ({filteredTrees.length})
                  </button>
                </div>
              </div>

              <div className="tsm-tree-list">
                {isLoading && trees.length === 0 ? (
                  <div className="tsm-loading">Loading trees...</div>
                ) : filteredTrees.length === 0 ? (
                  <div className="tsm-empty">
                    {filter ? 'No trees match your search' : 'No trees available to share'}
                  </div>
                ) : (
                  filteredTrees.map(tree => (
                    <label key={tree.id} className="tsm-tree-item">
                      <input
                        type="checkbox"
                        checked={selectedTrees.includes(tree.id)}
                        onChange={() => handleTreeSelect(tree.id)}
                        disabled={isLoading}
                      />
                      <div className="tsm-tree-info">
                        <div className="tsm-tree-title">
                          {tree.title || tree.name || 'Untitled Tree'}
                        </div>
                        <div className="tsm-tree-meta">
                          {tree.primaryMemberName && (
                            <span>👤 {tree.primaryMemberName}</span>
                          )}
                          {tree.location && (
                            <span>📍 {tree.location}</span>
                          )}
                          <span>👥 {tree.memberCount || 0} members</span>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="tsm-actions">
              <button
                type="button"
                onClick={handleClose}
                className="tsm-btn tsm-btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="tsm-btn tsm-btn-primary"
                disabled={isLoading || selectedTrees.length === 0}
              >
                {isLoading ? 'Sharing...' : `Share ${selectedTrees.length} Tree(s)`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BulkTreeShareModal;
