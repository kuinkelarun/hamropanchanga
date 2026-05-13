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
import { useDetectedCountry } from '../hooks/useDetectedCountry';
import { useLanguage } from '../contexts/LanguageContext';
import './TreeShareModal.css';

const TreeShareModal = ({ isOpen, onClose, tree, onComplete, userEmail, userId }) => {
  const { t } = useLanguage();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [permission, setPermission] = useState(SHARE_PERMISSIONS.VIEW);
  const { country: detectedCountry } = useDetectedCountry();
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
      setError(t('treeShare.errorEmailEmpty'));
      return;
    }

    if (!isValidEmail(recipientEmail)) {
      setError(t('treeShare.errorEmailInvalid'));
      return;
    }

    if (recipientEmail.toLowerCase() === userEmail.toLowerCase()) {
      setError(t('treeShare.errorEmailSelf'));
      return;
    }

    if (sharedUsers[recipientEmail.toLowerCase()]) {
      setError(t('treeShare.errorEmailDuplicate'));
      return;
    }

    if (whatsappPhone && !isValidPhoneNumber(whatsappPhone)) {
      setError(t('treeShare.errorPhoneInvalid'));
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
        ? t('treeShare.successWhatsapp').replace('{email}', recipientEmail)
        : t('treeShare.successEmail').replace('{email}', recipientEmail));
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

      setSuccess(t('treeShare.successPermissionUpdated'));

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
    if (!window.confirm(t('treeShare.confirmRemove').replace('{email}', email))) {
      return;
    }

    try {
      setIsLoading(true);
      await removeTreeShare(tree.id, email);

      const updated = { ...sharedUsers };
      delete updated[email];
      setSharedUsers(updated);

      setSuccess(t('treeShare.successRemovedSharing').replace('{email}', email));

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
            <h2>{t('treeShare.title')}</h2>
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
                {t('treeShare.alreadySharedInfo')
                  .replace('{count}', sharedEmailsList.length)
                  .replace('{userWord}', sharedEmailsList.length === 1 ? t('treeShare.user') : t('treeShare.users'))}
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
                {t('treeShare.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={t('treeShare.emailPlaceholder')}
                className="tsm-input"
                disabled={isLoading}
              />
            </div>

            <div className="tsm-form-group">
              <label className="tsm-label">
                {t('treeShare.whatsappLabel')} <span className="tsm-optional">{t('treeShare.optional')}</span>
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
            </div>

            <div className="tsm-form-group">
              <label className="tsm-label">{t('treeShare.permissionLabel')}</label>
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
                    <span className="tsm-permission-name">{t('treeShare.viewOnly')}</span>
                  </div>
                  <span className="tsm-info-icon" aria-hidden="true" title={t('treeShare.viewOnlyTooltip')}><i>i</i></span>
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
                    <span className="tsm-permission-name">{t('treeShare.canEdit')}</span>
                  </div>
                  <span className="tsm-info-icon" aria-hidden="true" title={t('treeShare.canEditTooltip')}><i>i</i></span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="app-save-btn"
              disabled={isLoading || !recipientEmail.trim()}
            >
              {isLoading ? t('treeShare.sharingButton') : t('treeShare.shareButton')}
            </button>
          </form>

          {/* Divider */}
          {sharedEmailsList.length > 0 && (
            <div className="tsm-divider">
              <span>{t('treeShare.currentlySharedWith')} ({sharedEmailsList.length})</span>
            </div>
          )}

          {/* Shared Users List */}
          {sharedEmailsList.length > 0 ? (
            <div className="tsm-shared-list">
              {sharedEmailsList.map((email) => {
                const shareData = sharedUsers[email];
                const permissionText = shareData.permission === SHARE_PERMISSIONS.VIEW ? t('treeShare.viewOnly') : t('treeShare.canEdit');

                return (
                  <div key={email} className="tsm-shared-item">
                    <div className="tsm-shared-info">
                      <div className="flex items-center gap-2">
                        <p className="tsm-shared-email">{email}</p>
                      </div>
                      <p className="tsm-shared-date">
                        {permissionText} • {t('treeShare.sharedOn')} {(shareData.sharedAt?.toDate ? shareData.sharedAt.toDate() : new Date(shareData.sharedAt)).toLocaleDateString()}
                        {shareData.sharedBy && ` ${t('treeShare.by')} ${shareData.sharedBy}`}
                      </p>
                    </div>

                    <div className="tsm-shared-actions">
                      <select
                        value={shareData.permission}
                        onChange={(e) => handlePermissionChange(email, e.target.value)}
                        className="tsm-permission-select"
                        disabled={isLoading}
                      >
                        <option value={SHARE_PERMISSIONS.VIEW}>{t('treeShare.viewLabel')}</option>
                        <option value={SHARE_PERMISSIONS.EDIT}>{t('treeShare.editLabel')}</option>
                      </select>

                      <button
                        type="button"
                        className="tsm-btn-remove"
                        onClick={() => handleRemoveShare(email)}
                        disabled={isLoading}
                        title={t('treeShare.removeShare')}
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
              <p>{t('treeShare.notSharedYet')}</p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="tsm-footer">
          <button className="tsm-btn tsm-btn-secondary" onClick={handleClose}>
            {t('treeShare.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreeShareModal;
