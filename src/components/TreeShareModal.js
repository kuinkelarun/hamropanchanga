/**
 * Tree Share Modal Component
 * Allows users to share trees with other users and manage permissions
 * Responsive: Bottom sheet on mobile, modal on tablet/desktop
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { getAccessibleGroups } from '../services/UserGroupService';
import { getAccessibleContacts } from '../services/ContactService';
import {
  getContactDisplayName,
  getContactOwnerLabel,
  filterGroups,
  getEmailSuggestions,
  getPhoneSuggestions,
} from '../utils/shareDirectory';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useClickOutside } from '../hooks/useClickOutside';
import ResponsiveModal from './ResponsiveModal/ResponsiveModal';
import './TreeShareModal.css';

async function resolveMembers(members, contacts) {
  return Promise.all(members.map(async (m) => {
    if (!m.contactId) return m;
    let found = contacts.find((ct) => ct.id === m.contactId);
    if (!found) {
      try {
        const snap = await getDoc(doc(db, 'userContacts', m.contactId));
        if (snap.exists()) found = { id: snap.id, ...snap.data() };
      } catch { /* permission denied — member will be skipped */ }
    }
    return { ...m, email: found?.email || m.email || '', phone: found?.phone || m.phone || '' };
  }));
}

const TreeShareModal = ({ isOpen, onClose, tree, onComplete, userEmail, userId }) => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
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
  const [emailQuery, setEmailQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const groupPickerRef = useRef(null);
  useClickOutside(groupPickerRef, useCallback(() => setIsGroupPickerOpen(false), []));
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);

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
      getAccessibleGroups(userId, { includeAllOwners: isAdmin }).then(setGroups).catch(() => {});
      getAccessibleContacts(userId, { includeAllOwners: isAdmin }).then(setContacts).catch(() => {});
    }
  }, [isOpen, userId, isAdmin]);

  const emailSuggestions = useMemo(() => (
    showEmailSuggestions ? getEmailSuggestions(contacts, emailQuery) : []
  ), [contacts, emailQuery, showEmailSuggestions]);

  const phoneSuggestions = useMemo(() => (
    showPhoneSuggestions ? getPhoneSuggestions(contacts, phoneQuery) : []
  ), [contacts, phoneQuery, showPhoneSuggestions]);

  const filteredGroups = useMemo(() => filterGroups(groups, groupSearchQuery), [groups, groupSearchQuery]);

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
      setEmailQuery('');
      setPhoneQuery('');
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
    const resolved = await resolveMembers(group.members, contacts);

    // Diagnostic: log resolved members to console for debugging
    console.group('[ShareGroup] "' + group.name + '" — ' + resolved.length + ' member(s), contacts loaded: ' + contacts.length);
    resolved.forEach((m, i) => {
      console.log(`  [${i}] ${m.displayName || '(no name)'} — email: ${m.email ? m.email.replace(/(.{2}).*(@.*)/, '$1***$2') : 'none'} — phone: ${m.phone ? 'yes' : 'none'} — contactId: ${m.contactId || 'n/a'}`);
    });
    console.groupEnd();

    for (const member of resolved) {
      const emailKey = member.email?.toLowerCase();
      if (!emailKey) { skipped++; continue; } // skip phone-only contacts (shareTreeWithEmail handles WhatsApp notify for opted-in users)
      if (sharedUsers[emailKey]) { skipped++; continue; }
      if (emailKey === userEmail?.toLowerCase()) { skipped++; continue; } // skip self
      try {
        const fn = httpsCallable(functions, 'shareTreeWithEmail');
        await fn({
          treeId: tree.id,
          recipientEmail: emailKey,
          permission: groupPermission,
        });
        setSharedUsers((prev) => ({
          ...prev,
          [emailKey]: { permission: groupPermission, sharedAt: new Date().toISOString(), sharedBy: userEmail },
        }));
        sent++;
      } catch { skipped++; }
    }
    setGroupResult({ sent, skipped });
    setGroupSharing(false);
    if (onComplete) onComplete();
  };

  const applyContactSuggestion = (contact, source) => {
    if (contact.email) {
      setRecipientEmail(contact.email);
    }
    if (contact.phone) {
      setWhatsappPhone(contact.phone);
    }
    if (source === 'email' && contact.phone && !phoneQuery) {
      setPhoneQuery(contact.phone);
    }
    if (source === 'phone' && contact.email && !emailQuery) {
      setEmailQuery(contact.email);
    }
    setEmailQuery('');
    setPhoneQuery('');
    setShowEmailSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const handleClose = () => {
    setRecipientEmail('');
    setWhatsappPhone('');
    setEmailQuery('');
    setPhoneQuery('');
    setGroupSearchQuery('');
    setPermission(SHARE_PERMISSIONS.VIEW);
    setError(null);
    setSuccess(null);
    setGroupResult(null);
    setSelectedGroupId('');
    setShareTab('person');
    setIsGroupPickerOpen(false);
    setShowEmailSuggestions(false);
    setShowPhoneSuggestions(false);
    onClose();
  };

  const sharedEmailsList = Object.keys(sharedUsers);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('treeShare.title')}
      className="tsm-responsive-content"
      fullScreen={true}
    >
      {/* Tree name subtitle */}
      <p className="tsm-tree-name">{tree.title || tree.name || 'Untitled Tree'}</p>

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
          <div className="tsm-form-group" style={{ position: 'relative' }}>
            <label htmlFor="email" className="tsm-label">
              {t('treeShare.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={recipientEmail}
              onChange={(e) => {
                const value = e.target.value;
                setRecipientEmail(value);
                setEmailQuery(value);
                setShowEmailSuggestions(true);
              }}
              onFocus={() => setShowEmailSuggestions(true)}
              onBlur={() => setShowEmailSuggestions(false)}
              placeholder={t('treeShare.emailPlaceholder')}
              className="tsm-input"
              disabled={isLoading}
            />
            {emailSuggestions.length > 0 && (
              <div className="tsm-phone-suggestions">
             * Responsive: Bottom sheet on mobile, modal on tablet/desktop
             */
              */
                {emailSuggestions.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    className={`tsm-phone-suggestion-item${contact.isOwnedByCurrentUser ? '' : ' tsm-phone-suggestion-item-external'}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyContactSuggestion(contact, 'email')}
                  >
                    <span className="tsm-suggestion-details">
                      <span className="tsm-suggestion-name">{getContactDisplayName(contact)}</span>
                      <span className="tsm-suggestion-email">{contact.email}</span>
                      {contact.phone && <span className="tsm-suggestion-phone">{contact.phone}</span>}
                    </span>
                    {!contact.isOwnedByCurrentUser && (
                      <span className="tsm-suggestion-owner">{getContactOwnerLabel(contact)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
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
                onChange={(val) => {
                  const value = val || '';
                  setWhatsappPhone(value);
                  setPhoneQuery(value);
                  setShowPhoneSuggestions(true);
                }}
                onFocus={() => setShowPhoneSuggestions(true)}
                onBlur={() => setShowPhoneSuggestions(false)}
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
                    className={`tsm-phone-suggestion-item${c.isOwnedByCurrentUser ? '' : ' tsm-phone-suggestion-item-external'}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyContactSuggestion(c, 'phone')}
                  >
                    <span className="tsm-suggestion-details">
                      <span className="tsm-suggestion-name">{getContactDisplayName(c)}</span>
                      <span className="tsm-suggestion-phone">{c.phone}</span>
                      {c.email && <span className="tsm-suggestion-email">{c.email}</span>}
                    </span>
                    {!c.isOwnedByCurrentUser && (
                      <span className="tsm-suggestion-owner">{getContactOwnerLabel(c)}</span>
                    )}
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
            <div className="tsm-group-layout">
              <div className="tsm-form-group">
                <label className="tsm-label">{t('userGroups.selectGroup')}</label>
                <div className="tsm-group-picker" ref={groupPickerRef}>
                  <button
                    type="button"
                    className="tsm-group-picker-btn"
                    onClick={() => setIsGroupPickerOpen((prev) => !prev)}
                    disabled={groupSharing}
                    aria-expanded={isGroupPickerOpen}
                  >
                    <span className="tsm-group-picker-value">
                      {selectedGroup ? (
                        <>
                          <span>{selectedGroup.name}</span>
                          <span className="tsm-group-picker-meta">
                            {selectedGroup.members?.length ?? 0} members{!selectedGroup.isOwnedByCurrentUser ? ` • ${getContactOwnerLabel(selectedGroup)}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="tsm-group-picker-placeholder">{t('userGroups.selectGroup')}</span>
                      )}
                    </span>
                    {selectedGroup && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="tsm-group-clear-btn"
                        onClick={(e) => { e.stopPropagation(); setSelectedGroupId(''); setGroupResult(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setSelectedGroupId(''); setGroupResult(null); } }}
                        aria-label="Clear selected group"
                      >×</span>
                    )}
                    <span className="tsm-group-picker-chevron">▾</span>
                  </button>

                  {isGroupPickerOpen && (
                    <div className="tsm-group-dropdown">
                      <div className="tsm-group-dropdown-search">
                        <input
                          type="text"
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          placeholder="Search by group or owner"
                          className="tsm-input"
                          disabled={groupSharing}
                          autoFocus
                        />
                      </div>
                      <div className="tsm-group-dropdown-list">
                        {filteredGroups.length > 0 ? filteredGroups.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className={`tsm-group-option${g.isOwnedByCurrentUser ? '' : ' tsm-group-option-external'}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedGroupId(g.id);
                              setGroupResult(null);
                              setIsGroupPickerOpen(false);
                            }}
                          >
                            <span className="tsm-group-option-name">{g.name}</span>
                            <span className="tsm-group-option-meta">
                              {g.members?.length ?? 0} members{!g.isOwnedByCurrentUser ? ` • ${getContactOwnerLabel(g)}` : ''}
                            </span>
                          </button>
                        )) : (
                          <div className="tsm-group-empty">No groups match your search.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedGroup ? (
                  <div className="tsm-group-meta">
                    {selectedGroup.members?.length ?? 0} members{!selectedGroup.isOwnedByCurrentUser ? ` • ${getContactOwnerLabel(selectedGroup)}` : ''}
                  </div>
                ) : null}
              </div>

              <div className="tsm-form-group">
                <label className="tsm-label">{t('treeShare.permissionLabel')}</label>
                <div className="tsm-permission-options">
                  <label className="tsm-permission-option">
                    <input
                      type="radio"
                      name="groupPermission"
                      value={SHARE_PERMISSIONS.VIEW}
                      checked={groupPermission === SHARE_PERMISSIONS.VIEW}
                      onChange={(e) => setGroupPermission(e.target.value)}
                      disabled={groupSharing}
                    />
                    <div>
                      <span className="tsm-permission-name">{t('treeShare.viewOnly')}</span>
                    </div>
                    <span className="tsm-info-icon" aria-hidden="true" title={t('treeShare.viewOnlyTooltip')}><i>i</i></span>
                  </label>

                  <label className="tsm-permission-option">
                    <input
                      type="radio"
                      name="groupPermission"
                      value={SHARE_PERMISSIONS.EDIT}
                      checked={groupPermission === SHARE_PERMISSIONS.EDIT}
                      onChange={(e) => setGroupPermission(e.target.value)}
                      disabled={groupSharing}
                    />
                    <div>
                      <span className="tsm-permission-name">{t('treeShare.canEdit')}</span>
                    </div>
                    <span className="tsm-info-icon" aria-hidden="true" title={t('treeShare.canEditTooltip')}><i>i</i></span>
                  </label>
                </div>
              </div>
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

          {groups.length > 0 && (
            <button
              type="button"
              className="app-save-btn"
              onClick={handleShareGroup}
              disabled={groupSharing || !selectedGroupId}
            >
              {groupSharing ? t('treeShare.sharingButton') : t('userGroups.shareGroupBtn')}
            </button>
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
    </ResponsiveModal>
  );
};

export default TreeShareModal;
