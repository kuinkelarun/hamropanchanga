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
import { getUserGroups } from '../services/UserGroupService';
import { getUserContacts } from '../services/ContactService';
import './TreeShareModal.css';

function resolveMembers(members, contacts) {
  return members.map((m) => {
    if (m.contactId) {
      const c = contacts.find((ct) => ct.id === m.contactId);
      return { ...m, email: c?.email || m.email || '', phone: c?.phone || m.phone || '' };
    }
    return m;
  });
}

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
  const [supportsContacts, setSupportsContacts] = useState(false);

  const [shareTab, setShareTab] = useState('person');
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupPermission, setGroupPermission] = useState(SHARE_PERMISSIONS.VIEW);
  const [groupSharing, setGroupSharing] = useState(false);
  const [groupResult, setGroupResult] = useState(null);
  const [phoneSuggestions, setPhoneSuggestions] = useState([]);

  useEffect(() => {
    setSupportsContacts(
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'ContactsManager' in window
    );
  }, []);

  useEffect(() => {
    if (tree && tree.sharedWith) {
      setSharedUsers(tree.sharedWith);
    }
  }, [tree]);

  useEffect(() => {
    if (isOpen && userId) {
      getUserGroups(userId).then(setGroups).catch(() => {});
      getUserContacts(userId).then(setContacts).catch(() => {});
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!whatsappPhone || whatsappPhone.replace(/\D/g, '').length < 4) {
      setPhoneSuggestions([]);
      return;
    }
    const q = whatsappPhone.replace(/\s/g, '');
    const matches = contacts
      .filter((c) => c.phone && c.phone.replace(/\s/g, '').startsWith(q))
      .slice(0, 5);
    setPhoneSuggestions(matches);
  }, [whatsappPhone, contacts]);

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

  const handlePickContact = async () => {
    try {
      const contacts = await navigator.contacts.select(['tel'], { multiple: false });
      if (contacts.length > 0 && contacts[0].tel?.length > 0) {
        setWhatsappPhone(contacts[0].tel[0]);
      }
    } catch {
      // user cancelled or permission denied — do nothing
    }
  };

  const handleShareGroup = async () => {
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group || !group.members?.length) return;
    setGroupSharing(true);
    setGroupResult(null);
    let sent = 0;
    let skipped = 0;
    const resolved = resolveMembers(group.members, contacts);
    for (const member of resolved) {
      const emailKey = member.email?.toLowerCase();
      if (emailKey && sharedUsers[emailKey]) { skipped++; continue; }
      try {
        if (member.phone) {
          const fn = httpsCallable(functions, 'shareTreeWithWhatsApp');
          await fn({
            treeId: tree.id,
            hintEmail: member.email || '',
            whatsappPhone: member.phone,
            permission: groupPermission,
          });
        } else {
          const fn = httpsCallable(functions, 'shareTreeWithEmail');
          await fn({
            treeId: tree.id,
            recipientEmail: member.email.toLowerCase(),
            permission: groupPermission,
          });
        }
        if (emailKey) {
          setSharedUsers((prev) => ({
            ...prev,
            [emailKey]: { permission: groupPermission, sharedAt: new Date().toISOString(), sharedBy: userEmail },
          }));
        }
        sent++;
      } catch { skipped++; }
    }
    setGroupResult({ sent, skipped });
    setGroupSharing(false);
    if (onComplete) onComplete();
  };

  const handleClose = () => {
    setRecipientEmail('');
    setWhatsappPhone('');
    setPermission(SHARE_PERMISSIONS.VIEW);
    setError(null);
    setSuccess(null);
    setGroupResult(null);
    setSelectedGroupId('');
    setShareTab('person');
    setPhoneSuggestions([]);
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
          {/* Alerts */}
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
          {error && (
            <div className="tsm-alert tsm-alert-error">
              <span>❌</span>
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="tsm-alert tsm-alert-success">
              <span>✅</span>
              <p>{success}</p>
            </div>
          )}

          {/* Tab bar */}
          <div className="tsm-tab-bar">
            <button
              type="button"
              className={`tsm-tab-btn${shareTab === 'person' ? ' active' : ''}`}
              onClick={() => setShareTab('person')}
            >
              {t('treeShare.tabPerson')}
            </button>
            <button
              type="button"
              className={`tsm-tab-btn${shareTab === 'group' ? ' active' : ''}`}
              onClick={() => setShareTab('group')}
            >
              {t('treeShare.tabGroup')}
            </button>
          </div>

          {/* Person tab */}
          {shareTab === 'person' && (
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

              <div className="tsm-form-group" style={{ position: 'relative' }}>
                <label className="tsm-label">
                  {t('treeShare.whatsappLabel')} <span className="tsm-optional">{t('treeShare.optional')}</span>
                </label>
                <div className="tsm-phone-row">
                  <PhoneInput
                    international
                    defaultCountry={detectedCountry}
                    value={whatsappPhone}
                    onChange={(val) => setWhatsappPhone(val || '')}
                    disabled={isLoading}
                    placeholder="+977 98XXXXXXXX"
                    className="tsm-phone-input"
                  />
                  {supportsContacts && (
                    <button
                      type="button"
                      className="tsm-contact-btn"
                      onClick={handlePickContact}
                      disabled={isLoading}
                      title="Pick from contacts"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </button>
                  )}
                </div>
                {phoneSuggestions.length > 0 && (
                  <div className="tsm-phone-suggestions">
                    <p className="tsm-phone-suggestions-label">{t('treeShare.phoneMatchHint')}</p>
                    {phoneSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="tsm-phone-suggestion-item"
                        onClick={() => {
                          setWhatsappPhone(c.phone);
                          if (!recipientEmail && c.email) setRecipientEmail(c.email);
                          setPhoneSuggestions([]);
                        }}
                      >
                        <span className="tsm-suggestion-name">{c.displayName || c.firstName}</span>
                        <span className="tsm-suggestion-phone">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
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
          )}

          {/* Group tab */}
          {shareTab === 'group' && (
            <div className="tsm-group-tab">
              {groups.length === 0 ? (
                <p className="tsm-field-hint" style={{ marginBottom: 16 }}>
                  {t('userGroups.noGroups')}{' '}
                  <a href="/settings/groups" style={{ color: '#2563eb', textDecoration: 'underline' }}>{t('userGroups.createOne')}</a>
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => { setSelectedGroupId(e.target.value); setGroupResult(null); }}
                    className="tsm-permission-select"
                    style={{ minWidth: 160, flex: '1 1 160px' }}
                    disabled={groupSharing}
                  >
                    <option value="">{t('userGroups.selectGroup')}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({t('userGroups.memberCount').replace('{n}', g.members?.length ?? 0)})
                      </option>
                    ))}
                  </select>

                  <select
                    value={groupPermission}
                    onChange={(e) => setGroupPermission(e.target.value)}
                    className="tsm-permission-select"
                    disabled={groupSharing}
                  >
                    <option value={SHARE_PERMISSIONS.VIEW}>{t('treeShare.viewOnly')}</option>
                    <option value={SHARE_PERMISSIONS.EDIT}>{t('treeShare.canEdit')}</option>
                  </select>

                  <button
                    type="button"
                    className="tsm-btn tsm-btn-primary"
                    style={{ margin: 0, width: 'auto', flex: '0 0 auto' }}
                    onClick={handleShareGroup}
                    disabled={groupSharing || !selectedGroupId}
                  >
                    {groupSharing ? '...' : t('userGroups.shareGroupBtn')}
                  </button>
                </div>
              )}

              {groupResult && (
                <div className="tsm-alert tsm-alert-success" style={{ marginBottom: 12 }}>
                  <span>✅</span>
                  <p>
                    {t('userGroups.groupResult')
                      .replace('{sent}', groupResult.sent)
                      .replace('{skipped}', groupResult.skipped)}
                  </p>
                </div>
              )}
            </div>
          )}

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
