/**
 * Tree Share Modal Component
 * Allows users to share trees with other users and manage permissions
 */

import React, { useState, useEffect } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import {
  updateSharePermission,
  removeTreeShare
} from '../services/BulkUploadService';
import { SHARE_PERMISSIONS, isValidEmail } from '../utils/TreeSharingUtils';
import './TreeShareModal.css';

const TreeShareModal = ({ isOpen, onClose, tree, onComplete, userEmail, userId }) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [permission, setPermission] = useState(SHARE_PERMISSIONS.VIEW);
  const [sharedUsers, setSharedUsers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (tree && tree.sharedWith) {
      setSharedUsers(tree.sharedWith);
    }
  }, [tree]);

  if (!isOpen || !tree) return null;

  const handleShare = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
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

    if (sharedUsers[recipientEmail.toLowerCase()]) {
      setError('This tree is already shared with this user');
      return;
    }

    if (whatsappPhone && !isValidPhoneNumber(whatsappPhone)) {
      setError('Please enter a valid WhatsApp phone number (include country code)');
      return;
    }

    try {
      setIsLoading(true);

      if (whatsappPhone) {
        // Use WhatsApp-enhanced sharing callable (handles invite token logic)
        const fn = httpsCallable(functions, 'shareTreeWithWhatsApp');
        await fn({
          treeId: tree.id,
          hintEmail: recipientEmail.toLowerCase(),
          whatsappPhone,
          permission,
        });
      } else {
        // Email-only share: sends invite email or WhatsApp notification if user exists
        const fn = httpsCallable(functions, 'shareTreeWithEmail');
        await fn({
          treeId: tree.id,
          recipientEmail: recipientEmail.toLowerCase(),
          permission,
        });
      }

      setSharedUsers({
        ...sharedUsers,
        [recipientEmail.toLowerCase()]: {
          permission,
          sharedAt: new Date().toISOString(),
          sharedBy: userEmail
        }
      });

      setSuccess(whatsappPhone
        ? `Invitation sent to ${recipientEmail} via WhatsApp`
        : `Invitation sent to ${recipientEmail}`);
      setRecipientEmail('');
      setWhatsappPhone('');
      setPermission(SHARE_PERMISSIONS.VIEW);

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to share tree');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = async (email, newPermission) => {
    try {
      setIsLoading(true);
      await updateSharePermission(tree.id, email, newPermission);

      setSharedUsers({
        ...sharedUsers,
        [email]: {
          ...sharedUsers[email],
          permission: newPermission
        }
      });

      setSuccess('Permission updated');

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to update permission');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (email) => {
    if (!window.confirm(`Remove ${email} from sharing?`)) {
      return;
    }

    try {
      setIsLoading(true);
      await removeTreeShare(tree.id, email);

      const updated = { ...sharedUsers };
      delete updated[email];
      setSharedUsers(updated);

      setSuccess(`Sharing removed for ${email}`);

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err.message || 'Failed to remove share');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRecipientEmail('');
    setWhatsappPhone('');
    setPermission(SHARE_PERMISSIONS.VIEW);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const sharedEmailsList = Object.keys(sharedUsers);

  return (
    <div className="tsm-backdrop" onClick={handleClose}>
      <div className="tsm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tsm-header">
          <div>
            <h2>Share Tree</h2>
            <p className="tsm-tree-name">{tree.title || tree.name || 'Untitled Tree'}</p>
          </div>
          <button className="tsm-close nc-header-close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        {/* Content */}
        <div className="tsm-content">
          {/* Existing Share Info Notice */}
          {sharedEmailsList.length > 0 && !error && !success && (
            <div className="tsm-alert tsm-alert-info">
              <span>ℹ️</span>
              <p>
                This tree is currently shared with {sharedEmailsList.length} {sharedEmailsList.length === 1 ? 'user' : 'users'}. 
                You can manage their permissions or add more users below.
              </p>
            </div>
          )}
          
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
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                className="tsm-input"
                disabled={isLoading}
              />
            </div>

            <div className="tsm-form-group">
              <label className="tsm-label">
                📱 WhatsApp Phone <span className="tsm-optional">(optional)</span>
              </label>
              <PhoneInput
                international
                defaultCountry="NP"
                value={whatsappPhone}
                onChange={setWhatsappPhone}
                disabled={isLoading}
                placeholder="+977 98XXXXXXXX"
                className="tsm-phone-input"
              />
              <p className="tsm-field-hint">If provided, an invitation link will be sent via WhatsApp</p>
            </div>

            <div className="tsm-form-group">
              <label className="tsm-label">Permission Level</label>
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
                    <span className="tsm-permission-name">👁️ View Only</span>
                    <span className="tsm-permission-desc">Can view tree, builder, and events but cannot edit</span>
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
                    <span className="tsm-permission-name">✏️ Can Edit</span>
                    <span className="tsm-permission-desc">Can view and edit everything except delete/share</span>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="app-save-btn"
              disabled={isLoading || !recipientEmail.trim()}
            >
              {isLoading ? '🔄 Sharing...' : '📤 Share Tree'}
            </button>
          </form>

          {/* Divider */}
          {sharedEmailsList.length > 0 && (
            <div className="tsm-divider">
              <span>Currently Shared With ({sharedEmailsList.length})</span>
            </div>
          )}

          {/* Shared Users List */}
          {sharedEmailsList.length > 0 ? (
            <div className="tsm-shared-list">
              {sharedEmailsList.map((email) => {
                const shareData = sharedUsers[email];
                const permissionIcon = shareData.permission === SHARE_PERMISSIONS.VIEW ? '👁️' : '✏️';
                const permissionText = shareData.permission === SHARE_PERMISSIONS.VIEW ? 'View Only' : 'Can Edit';
                
                return (
                  <div key={email} className="tsm-shared-item">
                    <div className="tsm-shared-info">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{permissionIcon}</span>
                        <p className="tsm-shared-email">{email}</p>
                      </div>
                      <p className="tsm-shared-date">
                        {permissionText} • Shared on {new Date(shareData.sharedAt).toLocaleDateString()}
                        {shareData.sharedBy && ` by ${shareData.sharedBy}`}
                      </p>
                    </div>

                    <div className="tsm-shared-actions">
                      <select
                        value={shareData.permission}
                        onChange={(e) => handlePermissionChange(email, e.target.value)}
                        className="tsm-permission-select"
                        disabled={isLoading}
                      >
                        <option value={SHARE_PERMISSIONS.VIEW}>👁️ View</option>
                        <option value={SHARE_PERMISSIONS.EDIT}>✏️ Edit</option>
                      </select>

                      <button
                        type="button"
                        className="tsm-btn-remove"
                        onClick={() => handleRemoveShare(email)}
                        disabled={isLoading}
                        title="Remove share"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="tsm-empty">
              <p>Tree not shared with anyone yet</p>
            </div>
          )}

          {/* Permission Info */}
          <div className="tsm-info-box">
            <h4>📋 About Permissions</h4>
            <div className="tsm-info-items">
              <div className="tsm-info-item">
                <strong>👁️ View Only</strong>
                <p>Can view the tree, builder, and events but cannot make any changes</p>
              </div>
              <div className="tsm-info-item">
                <strong>✏️ Can Edit</strong>
                <p>Can view and edit all tree data, members, and events. Cannot delete the tree or manage sharing.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="tsm-footer">
          <button className="tsm-btn tsm-btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreeShareModal;
