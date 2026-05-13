import { useState, useEffect, useCallback, useRef } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDetectedCountry } from '../../hooks/useDetectedCountry';
import {
  getUserGroups,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
} from '../../services/UserGroupService';
import { getUserContacts, createContact } from '../../services/ContactService';
import './UserGroupsSection.css';

export default function UserGroupsSection({ uid }) {
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingGroup, setEditingGroup] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [supportsContacts, setSupportsContacts] = useState(false);
  const { country } = useDetectedCountry();

  useEffect(() => {
    setSupportsContacts(
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'ContactsManager' in window
    );
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, contactData] = await Promise.all([
        getUserGroups(uid),
        getUserContacts(uid),
      ]);
      setGroups(groupData);
      setContacts(contactData);
    } catch (_) {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleStartCreate = () => {
    setEditingGroup(null);
    setView('create');
  };

  const handleStartEdit = (group) => {
    setEditingGroup(group);
    setView('edit');
  };

  const handleFormSave = async (name, description, members) => {
    if (view === 'create') {
      await createUserGroup(uid, name, description, members);
    } else {
      await updateUserGroup(editingGroup.id, { name, description, members });
    }
    await loadGroups();
    setView('list');
  };

  const handleFormCancel = () => {
    setView('list');
    setEditingGroup(null);
  };

  const handleDeleteConfirm = async (groupId) => {
    await deleteUserGroup(groupId);
    setConfirmDeleteId(null);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  if (loading) {
    return <div className="ugs-loading">{t('common.loading')}</div>;
  }

  if (view === 'create' || view === 'edit') {
    return (
      <GroupForm
        key={editingGroup?.id ?? 'new'}
        initial={editingGroup}
        contacts={contacts}
        supportsContacts={supportsContacts}
        defaultCountry={country}
        onSave={handleFormSave}
        onCancel={handleFormCancel}
        onContactCreated={(c) => setContacts((prev) => [...prev, c])}
        uid={uid}
        t={t}
      />
    );
  }

  return (
    <div>
      <div className="ugs-header">
        <div className="ugs-header-text">
          <h2>{t('userGroups.title')}</h2>
          <p>{t('userGroups.subtitle')}</p>
        </div>
        <button className="ugs-btn-new" onClick={handleStartCreate}>
          + {t('userGroups.newGroup')}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="ugs-empty">{t('userGroups.empty')}</div>
      ) : (
        <div className="ugs-list">
          {groups.map((group) => (
            <div key={group.id} className="ugs-group-card">
              <div className="ugs-group-info">
                <p className="ugs-group-name">{group.name}</p>
                <div className="ugs-group-meta">
                  <span className="ugs-member-badge">
                    {t('userGroups.memberCount').replace('{n}', group.members?.length ?? 0)}
                  </span>
                  {group.description && (
                    <span className="ugs-group-desc">{group.description}</span>
                  )}
                </div>
              </div>

              <div className="ugs-group-actions">
                {confirmDeleteId === group.id ? (
                  <div className="ugs-confirm-row">
                    <span>{t('userGroups.confirmDelete').replace('{name}', group.name)}</span>
                    <button className="ugs-btn-confirm-yes" onClick={() => handleDeleteConfirm(group.id)}>
                      {t('userGroups.delete')}
                    </button>
                    <button className="ugs-btn-confirm-no" onClick={() => setConfirmDeleteId(null)}>
                      {t('userGroups.cancel')}
                    </button>
                  </div>
                ) : (
                  <>
                    <button className="ugs-btn-icon" onClick={() => handleStartEdit(group)}>
                      {t('userGroups.edit')}
                    </button>
                    <button className="ugs-btn-icon ugs-btn-danger" onClick={() => setConfirmDeleteId(group.id)}>
                      {t('userGroups.delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Three-dot kebab menu for each member row ──────────────────────────────────
function KebabMenu({ onEdit, onDelete, t }) {
  // onEdit may be null for contact-linked members (editing done via Contacts tab)
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="ugs-kebab-wrap" ref={ref}>
      <button
        type="button"
        className="ugs-kebab-btn"
        onClick={() => setOpen((v) => !v)}
        title="Options"
      >
        ⋮
      </button>
      {open && (
        <div className="ugs-kebab-menu">
          {onEdit && (
            <button
              type="button"
              className="ugs-kebab-item"
              onClick={() => { setOpen(false); onEdit(); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {t('userGroups.edit')}
            </button>
          )}
          <button
            type="button"
            className="ugs-kebab-item ugs-kebab-danger"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            {t('userGroups.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Group create / edit form ──────────────────────────────────────────────────
function GroupForm({ initial, contacts, supportsContacts, defaultCountry, onSave, onCancel, onContactCreated, uid, t }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [members, setMembers] = useState(
    initial?.members ? initial.members.map((m) => ({ ...m })) : []
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editAllMembers, setEditAllMembers] = useState(false);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState(null);

  // Contact search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactSaving, setNewContactSaving] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!searchOpen) return;
    const handle = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [searchOpen]);

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.displayName || '').toLowerCase().includes(q) ||
      (c.firstName || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  }).slice(0, 6);

  const handleSelectContact = (contact) => {
    setAddError('');
    const isDup = members.some(
      (m) =>
        (m.contactId && m.contactId === contact.id) ||
        (contact.email && m.email?.toLowerCase() === contact.email.toLowerCase()) ||
        (contact.phone && m.phone === contact.phone)
    );
    if (isDup) {
      setAddError(t('userGroups.errorDuplicate'));
      setSearchOpen(false);
      setSearchQuery('');
      return;
    }
    setMembers((prev) => [...prev, { contactId: contact.id, displayName: contact.displayName || contact.firstName }]);
    setSearchQuery('');
    setSearchOpen(false);
  };

  const handleCreateNewContact = async () => {
    setAddError('');
    const email = newContactEmail.trim().toLowerCase();
    const phone = newContactPhone?.trim() || '';
    const firstName = newContactName.trim();
    if (!firstName) { setAddError(t('contacts.errorRequired') || 'Name required.'); return; }
    if (!email && !phone) { setAddError(t('userGroups.errorMemberContact')); return; }
    if (phone && !isValidPhoneNumber(phone)) { setAddError(t('userGroups.errorPhoneInvalid')); return; }
    setNewContactSaving(true);
    try {
      const ref = await createContact(uid, { firstName, email, phone, displayName: firstName });
      const newContact = { id: ref.id, firstName, displayName: firstName, email, phone };
      if (onContactCreated) onContactCreated(newContact);
      setMembers((prev) => [...prev, { contactId: ref.id, displayName: firstName }]);
      setShowNewContactForm(false);
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setSearchQuery('');
      setSearchOpen(false);
    } catch (err) {
      setAddError(err.message || 'Failed to create contact.');
    } finally {
      setNewContactSaving(false);
    }
  };

  const handleRemoveMember = (id) => {
    setMembers((prev) => prev.filter((m) => m.id !== id && m.contactId !== id));
    setConfirmDeleteMemberId(null);
  };

  const resolveDisplay = (m) => {
    if (m.contactId) {
      const c = contacts.find((c) => c.id === m.contactId);
      return {
        displayName: m.displayName || c?.displayName || c?.firstName || '—',
        email: c?.email || m.email || '',
        phone: c?.phone || m.phone || '',
      };
    }
    return { displayName: m.displayName || '—', email: m.email || '', phone: m.phone || '' };
  };

  const handleSave = async () => {
    setFormError('');
    if (!name.trim()) {
      setFormError(t('userGroups.errorNameRequired'));
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim(), members);
    } catch (err) {
      setFormError(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ugs-form">
      <h3 className="ugs-form-title">
        {initial ? t('userGroups.edit') + ' — ' + initial.name : t('userGroups.newGroup')}
      </h3>

      <div className="ugs-field">
        <label>{t('userGroups.groupName')}</label>
        <input
          type="text"
          className="ugs-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('userGroups.groupName')}
          maxLength={80}
        />
      </div>

      <div className="ugs-field">
        <label>{t('userGroups.description')}</label>
        <input
          type="text"
          className="ugs-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('userGroups.description')}
          maxLength={200}
        />
      </div>

      {/* Member list */}
      <div className="ugs-members-header">
        <p className="ugs-members-label">{t('userGroups.members')}</p>
        {members.length > 0 && (
          editAllMembers ? (
            <button
              type="button"
              className="ugs-btn-edit-all active"
              onClick={() => { setEditAllMembers(false); setEditingMemberId(null); }}
              title="Done editing all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Done
            </button>
          ) : (
            <button
              type="button"
              className="ugs-btn-edit-all"
              onClick={() => { setEditAllMembers(true); setEditingMemberId(null); }}
              title="Edit all members"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit all
            </button>
          )
        )}
      </div>

      {members.length > 0 && (
        <div className="ugs-members-table">
          <div className="ugs-member-row header">
            <div>{t('userGroups.displayName')}</div>
            <div>{t('userGroups.email')}</div>
            <div>{t('userGroups.phone')}</div>
            <div />
          </div>

          {members.map((m) => {
            const rowKey = m.contactId || m.id;
            const resolved = resolveDisplay(m);
            const isEditing = !m.contactId && (editAllMembers || editingMemberId === m.id);
            const isConfirmingDelete = confirmDeleteMemberId === (m.contactId || m.id);

            if (isConfirmingDelete) {
              return (
                <div key={rowKey} className="ugs-member-confirm-row">
                  <span>{t('userGroups.confirmDeleteMember') || `Remove "${resolved.displayName}"?`}</span>
                  <button className="ugs-btn-confirm-yes" onClick={() => handleRemoveMember(m.contactId || m.id)}>
                    {t('userGroups.delete')}
                  </button>
                  <button className="ugs-btn-confirm-no" onClick={() => setConfirmDeleteMemberId(null)}>
                    {t('userGroups.cancel')}
                  </button>
                </div>
              );
            }

            return (
              <div key={rowKey} className={`ugs-member-row${isEditing ? ' is-editing' : ''}`}>
                <div className="ugs-member-cell">
                  {isEditing ? (
                    <input
                      type="text"
                      className="ugs-cell-input"
                      value={m.displayName}
                      onChange={(e) => setMembers((prev) =>
                        prev.map((x) => x.id === m.id ? { ...x, displayName: e.target.value } : x)
                      )}
                      placeholder={t('userGroups.displayName')}
                      autoFocus
                    />
                  ) : (
                    <span className="ugs-cell-text">{resolved.displayName}</span>
                  )}
                </div>
                <div className="ugs-member-cell">
                  {isEditing ? (
                    <input
                      type="email"
                      className="ugs-cell-input"
                      value={m.email}
                      onChange={(e) => setMembers((prev) =>
                        prev.map((x) => x.id === m.id ? { ...x, email: e.target.value } : x)
                      )}
                      placeholder={t('userGroups.email')}
                    />
                  ) : (
                    <span className="ugs-cell-text">{resolved.email || '—'}</span>
                  )}
                </div>
                <div className="ugs-member-cell ugs-cell-phone">
                  {isEditing ? (
                    <PhoneInput
                      international
                      defaultCountry={defaultCountry}
                      countryCallingCodeEditable={false}
                      value={m.phone}
                      onChange={(val) => setMembers((prev) =>
                        prev.map((x) => x.id === m.id ? { ...x, phone: val || '' } : x)
                      )}
                    />
                  ) : (
                    <span className="ugs-cell-text">{resolved.phone || '—'}</span>
                  )}
                </div>
                <div className="ugs-member-cell ugs-cell-actions">
                  {isEditing && !editAllMembers ? (
                    <button
                      type="button"
                      className="ugs-btn-done"
                      onClick={() => setEditingMemberId(null)}
                      title="Done"
                    >
                      ✓
                    </button>
                  ) : (
                    <KebabMenu
                      t={t}
                      onEdit={m.contactId ? null : () => { setEditAllMembers(false); setEditingMemberId(m.id); }}
                      onDelete={() => setConfirmDeleteMemberId(m.contactId || m.id)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contact search + inline new contact */}
      {addError && <p className="ugs-add-error">{addError}</p>}

      {!showNewContactForm ? (
        <div className="ugs-contact-search-wrap" ref={searchRef}>
          <div className="ugs-contact-search-row">
            <input
              type="text"
              className="ugs-add-input"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder={t('userGroups.searchContact') || 'Search contacts to add…'}
              style={{ flex: 1 }}
            />
          </div>
          {searchOpen && (
            <div className="ugs-contact-dropdown">
              {filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="ugs-contact-option"
                  onMouseDown={(e) => { e.preventDefault(); handleSelectContact(c); }}
                >
                  <span className="ugs-contact-option-name">{c.displayName || c.firstName}</span>
                  <span className="ugs-contact-option-detail">{c.email || c.phone || ''}</span>
                </button>
              ))}
              <button
                type="button"
                className="ugs-contact-option ugs-contact-option-new"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchOpen(false);
                  setSearchQuery('');
                  setShowNewContactForm(true);
                }}
              >
                {t('contacts.createNewContact') || '+ Create new contact'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="ugs-new-contact-inline">
          <div className="ugs-new-contact-row">
            <input
              type="text"
              className="ugs-add-input"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder={t('contacts.firstName') || 'Name *'}
              autoFocus
            />
            <input
              type="email"
              className="ugs-add-input"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder={t('contacts.email') || 'Email'}
            />
            <div className="ugs-add-phone">
              <PhoneInput
                international
                defaultCountry={defaultCountry}
                countryCallingCodeEditable={false}
                value={newContactPhone}
                onChange={(val) => setNewContactPhone(val || '')}
                placeholder={t('contacts.phone') || 'Phone'}
              />
            </div>
            <div className="ugs-new-contact-actions">
              <button
                type="button"
                className="ugs-btn-add-member"
                onClick={handleCreateNewContact}
                disabled={newContactSaving}
              >
                {newContactSaving ? '…' : t('contacts.save') || 'Save'}
              </button>
              <button
                type="button"
                className="ugs-btn-cancel"
                style={{ fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  setShowNewContactForm(false);
                  setNewContactName('');
                  setNewContactEmail('');
                  setNewContactPhone('');
                  setAddError('');
                }}
              >
                {t('userGroups.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {formError && <p className="ugs-form-error">{formError}</p>}

      <div className="ugs-form-actions">
        <button
          type="button"
          className="ugs-btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('common.loading') : t('userGroups.save')}
        </button>
        <button type="button" className="ugs-btn-cancel" onClick={onCancel}>
          {t('userGroups.cancel')}
        </button>
      </div>
    </div>
  );
}
