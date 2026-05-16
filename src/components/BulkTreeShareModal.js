/**
 * Bulk Tree Share Modal Component
 * Allows users to share multiple trees at once with multi-select functionality
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Trees } from './TreeBuilder/utils/firestoreTreeApi';
import { SHARE_PERMISSIONS, getPermissionDescription, isValidEmail } from '../utils/TreeSharingUtils';
import { useDetectedCountry } from '../hooks/useDetectedCountry';
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
import './TreeShareModal.css';

async function resolveMembers(members, contacts) {
  return Promise.all(members.map(async (member) => {
    if (!member.contactId) return member;
    let found = contacts.find((entry) => entry.id === member.contactId);
    if (!found) {
      try {
        const snap = await getDoc(doc(db, 'userContacts', member.contactId));
        if (snap.exists()) found = { id: snap.id, ...snap.data() };
      } catch { /* permission denied — member will be skipped */ }
    }
    return { ...member, email: found?.email || member.email || '', phone: found?.phone || member.phone || '' };
  }));
}

const BulkTreeShareModal = ({ isOpen, onClose, onComplete, userEmail, userId, isAdmin }) => {
  const [trees, setTrees] = useState([]);
  const [selectedTrees, setSelectedTrees] = useState([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [permission, setPermission] = useState(SHARE_PERMISSIONS.VIEW);
  const [shareTab, setShareTab] = useState('person');
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupPermission, setGroupPermission] = useState(SHARE_PERMISSIONS.VIEW);
  const [groupResult, setGroupResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const groupPickerRef = useRef(null);
  useClickOutside(groupPickerRef, useCallback(() => setIsGroupPickerOpen(false), []));
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [shareProgress, setShareProgress] = useState(null);
  const { country: detectedCountry } = useDetectedCountry();

  const resetState = () => {
    setSelectedTrees([]);
    setRecipientEmail('');
    setWhatsappPhone('');
    setPermission(SHARE_PERMISSIONS.VIEW);
    setShareTab('person');
    setSelectedGroupId('');
    setGroupPermission(SHARE_PERMISSIONS.VIEW);
    setGroupResult(null);
    setError(null);
    setSuccess(null);
    setFilter('');
    setEmailQuery('');
    setPhoneQuery('');
    setGroupSearchQuery('');
    setIsGroupPickerOpen(false);
    setShowEmailSuggestions(false);
    setShowPhoneSuggestions(false);
    setShareProgress(null);
  };

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const loadModalData = async () => {
      try {
        setIsLoading(true);
        const [allTrees, shareableGroups, shareableContacts] = await Promise.all([
          Trees.list(isAdmin ? null : userId, { includeDeleted: false }),
          getAccessibleGroups(userId, { includeAllOwners: isAdmin }),
          getAccessibleContacts(userId, { includeAllOwners: isAdmin }),
        ]);
        setTrees(allTrees);
        setGroups(shareableGroups);
        setContacts(shareableContacts);
      } catch (err) {
        console.error('Error loading bulk share data:', err);
        setError('Failed to load sharing data');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadModalData();
    } else {
      resetState();
    }
  }, [isOpen, userId, isAdmin]);

  const emailSuggestions = useMemo(() => (
    showEmailSuggestions ? getEmailSuggestions(contacts, emailQuery) : []
  ), [contacts, emailQuery, showEmailSuggestions]);

  const phoneSuggestions = useMemo(() => (
    showPhoneSuggestions ? getPhoneSuggestions(contacts, phoneQuery) : []
  ), [contacts, phoneQuery, showPhoneSuggestions]);

  const filteredTrees = useMemo(() => {
    if (!filter.trim()) return trees;

    const searchTerm = filter.toLowerCase();
    return trees.filter((tree) => {
      const title = (tree.title || tree.name || '').toLowerCase();
      const location = (tree.location || '').toLowerCase();
      const primary = (tree.primaryMemberName || '').toLowerCase();

      return title.includes(searchTerm)
        || location.includes(searchTerm)
        || primary.includes(searchTerm);
    });
  }, [trees, filter]);

  const allFilteredSelected = filteredTrees.length > 0
    && filteredTrees.every((tree) => selectedTrees.includes(tree.id));

  const filteredGroups = useMemo(() => filterGroups(groups, groupSearchQuery), [groups, groupSearchQuery]);

  const handleTreeSelect = (treeId) => {
    setSelectedTrees((prev) => {
      if (prev.includes(treeId)) {
        return prev.filter((id) => id !== treeId);
      }
      return [...prev, treeId];
    });
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = filteredTrees.map((tree) => tree.id);
      setSelectedTrees((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }

    const filteredIds = filteredTrees.map((tree) => tree.id);
    setSelectedTrees((prev) => Array.from(new Set([...prev, ...filteredIds])));
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

  const shareSingleTree = async ({ treeId, recipientEmail: email, phone, sharePermission }) => {
    if (phone) {
      const fn = httpsCallable(functions, 'shareTreeWithWhatsApp');
      await fn({ treeId, hintEmail: email.toLowerCase(), whatsappPhone: phone, permission: sharePermission });
      return;
    }

    const fn = httpsCallable(functions, 'shareTreeWithEmail');
    await fn({ treeId, recipientEmail: email.toLowerCase(), permission: sharePermission });
  };

  const processShareJobs = async (jobs, { successMessage, failureMessage, summarySetter } = {}) => {
    setError(null);
    setSuccess(null);
    setGroupResult(null);

    if (jobs.length === 0) {
      setError('Nothing to share with the current selection');
      return;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    try {
      setIsLoading(true);
      setShareProgress({ current: 0, total: jobs.length, label: 'Starting share...' });

      for (const job of jobs) {
        if (job.skip) {
          skipped += 1;
          setShareProgress((prev) => ({
            current: prev.current + 1,
            total: prev.total,
            label: job.label,
          }));
          continue;
        }

        try {
          await shareSingleTree(job);
          sent += 1;
        } catch (err) {
          console.error('Bulk share failed:', err);
          failed += 1;
        } finally {
          setShareProgress((prev) => ({
            current: prev.current + 1,
            total: prev.total,
            label: job.label,
          }));
        }
      }

      if (sent > 0) {
        if (summarySetter) {
          summarySetter({ sent, skipped, failed });
        }
        setSuccess(successMessage(sent, skipped, failed));
        setRecipientEmail('');
        setWhatsappPhone('');
        setEmailQuery('');
        setPhoneQuery('');
        setPermission(SHARE_PERMISSIONS.VIEW);
        setGroupPermission(SHARE_PERMISSIONS.VIEW);
        if (onComplete) {
          onComplete();
        }
      } else {
        setError(failureMessage || 'Failed to share trees. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setShareProgress(null);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();

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

    const normalizedEmail = recipientEmail.toLowerCase();
    const jobs = selectedTrees.map((treeId) => ({
      treeId,
      recipientEmail: normalizedEmail,
      phone: whatsappPhone,
      sharePermission: permission,
      label: `${normalizedEmail} · ${treeId}`,
    }));

    await processShareJobs(jobs, {
      successMessage: (sent, skipped, failed) => {
        const parts = [`Shared ${sent} tree(s) with ${recipientEmail}`];
        if (skipped > 0) parts.push(`${skipped} skipped`);
        if (failed > 0) parts.push(`${failed} failed`);
        return parts.join(' • ');
      },
      failureMessage: 'Failed to share trees. Please try again.',
    });
  };

  const handleShareGroup = async () => {
    if (selectedTrees.length === 0) {
      setError('Please select at least one tree to share');
      return;
    }

    const group = groups.find((entry) => entry.id === selectedGroupId);
    if (!group || !group.members?.length) {
      setError('Please select a group with members');
      return;
    }

    const treeById = new Map(trees.map((tree) => [tree.id, tree]));
    const resolvedMembers = await resolveMembers(group.members, contacts);
    const jobs = [];

    // Diagnostic log
    console.group('[BulkShareGroup] "' + group.name + '" — ' + resolvedMembers.length + ' member(s), contacts: ' + contacts.length);
    resolvedMembers.forEach((m, i) => {
      console.log(`  [${i}] ${m.displayName || '(no name)'} — email: ${m.email ? m.email.replace(/(.{2}).*(@.*)/, '$1***$2') : 'none'} — contactId: ${m.contactId || 'n/a'}`);
    });
    console.groupEnd();

    selectedTrees.forEach((treeId) => {
      const tree = treeById.get(treeId);
      resolvedMembers.forEach((member) => {
        const email = (member.email || '').toLowerCase();
        if (!email) {
          jobs.push({ skip: true, label: `Skipped member without email · ${treeId}` });
          return;
        }
        if (email === userEmail?.toLowerCase()) {
          jobs.push({ skip: true, label: `Skipped self-share · ${treeId}` });
          return;
        }

        const alreadyShared = Boolean(tree?.sharedWith?.[email]);
        jobs.push({
          skip: alreadyShared,
          treeId,
          recipientEmail: email,
          phone: '', // always use email path for group share (shareTreeWithEmail handles WhatsApp notify for opted-in users)
          sharePermission: groupPermission,
          label: `${getContactDisplayName(member)} · ${treeId}`,
        });
      });
    });

    await processShareJobs(jobs, {
      successMessage: (sent, skipped, failed) => {
        const parts = [`Shared ${sent} tree access entries from ${group.name}`];
        if (skipped > 0) parts.push(`${skipped} skipped`);
        if (failed > 0) parts.push(`${failed} failed`);
        return parts.join(' • ');
      },
      failureMessage: 'Failed to share the selected trees with this group.',
      summarySetter: setGroupResult,
    });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

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

          {shareProgress && (
            <div className="tsm-progress-card">
              <div className="tsm-progress-copy">
                <strong>Sharing in progress</strong>
                <span>{shareProgress.current} of {shareProgress.total} complete</span>
                <span>{shareProgress.label}</span>
              </div>
              <div className="tsm-progress-track">
                <div
                  className="tsm-progress-fill"
                  style={{ width: `${shareProgress.total ? (shareProgress.current / shareProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="tsm-tab-bar">
            <button
              type="button"
              className={`tsm-tab-btn${shareTab === 'person' ? ' active' : ''}`}
              onClick={() => setShareTab('person')}
            >
              Person
            </button>
            <button
              type="button"
              className={`tsm-tab-btn${shareTab === 'group' ? ' active' : ''}`}
              onClick={() => setShareTab('group')}
            >
              Group
            </button>
          </div>

          {/* Share Form */}
          {shareTab === 'person' && (
            <form onSubmit={handleShare} className="tsm-form">
              <div className="tsm-form-group" style={{ position: 'relative' }}>
                <label htmlFor="email" className="tsm-label">
                  Recipient Email Address *
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
                  placeholder="Search by name or email"
                  className="tsm-input"
                  disabled={isLoading}
                  required
                />
                {emailSuggestions.length > 0 && (
                  <div className="tsm-phone-suggestions">
                    <p className="tsm-phone-suggestions-label">Matching contacts</p>
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
                  📱 WhatsApp Phone <span className="tsm-optional">(optional)</span>
                </label>
                <PhoneInput
                  international
                  defaultCountry={detectedCountry}
                  value={whatsappPhone}
                  onChange={(value) => {
                    const nextValue = value || '';
                    setWhatsappPhone(nextValue);
                    setPhoneQuery(nextValue);
                    setShowPhoneSuggestions(true);
                  }}
                  onFocus={() => setShowPhoneSuggestions(true)}
                  onBlur={() => setShowPhoneSuggestions(false)}
                  disabled={isLoading}
                  placeholder="Search by name or phone"
                  className="tsm-phone-input"
                />
                <p className="tsm-field-hint">If provided, an invitation link will be sent via WhatsApp</p>
                {phoneSuggestions.length > 0 && (
                  <div className="tsm-phone-suggestions">
                    <p className="tsm-phone-suggestions-label">Matching contacts</p>
                    {phoneSuggestions.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className={`tsm-phone-suggestion-item${contact.isOwnedByCurrentUser ? '' : ' tsm-phone-suggestion-item-external'}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyContactSuggestion(contact, 'phone')}
                      >
                        <span className="tsm-suggestion-details">
                          <span className="tsm-suggestion-name">{getContactDisplayName(contact)}</span>
                          <span className="tsm-suggestion-phone">{contact.phone}</span>
                          {contact.email && <span className="tsm-suggestion-email">{contact.email}</span>}
                        </span>
                        {!contact.isOwnedByCurrentUser && (
                          <span className="tsm-suggestion-owner">{getContactOwnerLabel(contact)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
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

              <button
                type="submit"
                className="tsm-btn tsm-btn-primary"
                disabled={isLoading || selectedTrees.length === 0}
              >
                {isLoading ? 'Sharing...' : `Share ${selectedTrees.length} Tree(s)`}
              </button>
            </form>
          )}

          {shareTab === 'group' && (
            <div className="tsm-group-tab">
              {groups.length === 0 ? (
                <div className="tsm-empty">No groups available for sharing</div>
              ) : (
                <div className="tsm-group-layout">
                  <div className="tsm-form-group">
                    <label className="tsm-label">Select a group</label>
                    <div className="tsm-group-picker" ref={groupPickerRef}>
                      <button
                        type="button"
                        className="tsm-group-picker-btn"
                        onClick={() => setIsGroupPickerOpen((prev) => !prev)}
                        disabled={isLoading}
                        aria-expanded={isGroupPickerOpen}
                      >
                        <span className="tsm-group-picker-value">
                          {selectedGroup ? (
                            <>
                              <span>{selectedGroup.name}</span>
                              <span className="tsm-group-picker-meta">
                                {selectedGroup.members?.length || 0} members{!selectedGroup.isOwnedByCurrentUser ? ` • ${getContactOwnerLabel(selectedGroup)}` : ''}
                              </span>
                            </>
                          ) : (
                            <span className="tsm-group-picker-placeholder">Select a group</span>
                          )}
                        </span>
                        {selectedGroup && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="tsm-group-clear-btn"
                            onClick={(e) => { e.stopPropagation(); setSelectedGroupId(''); setGroupResult(null); setError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setSelectedGroupId(''); setGroupResult(null); setError(null); } }}
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
                              disabled={isLoading}
                              autoFocus
                            />
                          </div>
                          <div className="tsm-group-dropdown-list">
                            {filteredGroups.length > 0 ? filteredGroups.map((group) => (
                              <button
                                key={group.id}
                                type="button"
                                className={`tsm-group-option${group.isOwnedByCurrentUser ? '' : ' tsm-group-option-external'}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedGroupId(group.id);
                                  setGroupResult(null);
                                  setError(null);
                                  setIsGroupPickerOpen(false);
                                }}
                              >
                                <span className="tsm-group-option-name">{group.name}</span>
                                <span className="tsm-group-option-meta">
                                  {group.members?.length || 0} members{!group.isOwnedByCurrentUser ? ` • ${getContactOwnerLabel(group)}` : ''}
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
                        {selectedGroup.members?.length || 0} members{!selectedGroup.isOwnedByCurrentUser ? ` • ${getContactOwnerLabel(selectedGroup)}` : ''}
                      </div>
                    ) : null}
                  </div>

                  <div className="tsm-form-group">
                    <label className="tsm-label">Permission Level *</label>
                    <div className="tsm-permission-options">
                      <label className="tsm-permission-option">
                        <input
                          type="radio"
                          name="bulkGroupPermission"
                          value={SHARE_PERMISSIONS.VIEW}
                          checked={groupPermission === SHARE_PERMISSIONS.VIEW}
                          onChange={(e) => setGroupPermission(e.target.value)}
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
                          name="bulkGroupPermission"
                          value={SHARE_PERMISSIONS.EDIT}
                          checked={groupPermission === SHARE_PERMISSIONS.EDIT}
                          onChange={(e) => setGroupPermission(e.target.value)}
                          disabled={isLoading}
                        />
                        <div>
                          <strong>✏️ Can Edit</strong>
                          <p>{getPermissionDescription(SHARE_PERMISSIONS.EDIT)}</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {groupResult && (
                    <div className="tsm-alert tsm-alert-success" style={{ marginBottom: 12 }}>
                      <span>✅</span>
                      <p>
                        Shared {groupResult.sent} entries. {groupResult.skipped} skipped. {groupResult.failed} failed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {groups.length > 0 && (
                <button
                  type="button"
                  className="tsm-btn tsm-btn-primary"
                  onClick={handleShareGroup}
                  disabled={isLoading || !selectedGroupId || selectedTrees.length === 0}
                >
                  {isLoading ? 'Sharing...' : `Share ${selectedTrees.length} Tree(s)`}
                </button>
              )}
            </div>
          )}

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
                    {allFilteredSelected ? 'Deselect All' : 'Select All'} ({filteredTrees.length})
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

        </div>
      </div>
    </div>
  );
};

export default BulkTreeShareModal;
