import { useState, useEffect, useCallback, useRef } from 'react';
import PhoneInput from 'react-phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDetectedCountry } from '../../hooks/useDetectedCountry';
import {
  getUserContacts,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
} from '../../services/ContactService';
import './ContactsSection.css';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function initials(contact) {
  const first = (contact.firstName || contact.displayName || '?')[0];
  const last = contact.lastName ? contact.lastName[0] : '';
  return (first + last).toUpperCase();
}

export default function ContactsSection({ uid }) {
  const { t } = useLanguage();
  const { country } = useDetectedCountry();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingContact, setEditingContact] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [supportsContacts, setSupportsContacts] = useState(false);
  const [supportsMultiple, setSupportsMultiple] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    const hasApi =
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'ContactsManager' in window;
    setSupportsContacts(hasApi);
    setSupportsMultiple(hasApi);
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserContacts(uid);
      setContacts(data);
    } catch (_) {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleImport = async () => {
    try {
      setImporting(true);
      setImportResult(null);
      const raw = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      if (!raw || raw.length === 0) return;
      const result = await importContacts(uid, raw, contacts);
      setImportResult(result);
      await loadContacts();
    } catch {
      // user cancelled or permission denied
    } finally {
      setImporting(false);
    }
  };

  const handleStartCreate = () => {
    setEditingContact(null);
    setView('create');
  };

  const handleStartEdit = (contact) => {
    setEditingContact(contact);
    setView('edit');
  };

  const handleFormSave = async (data) => {
    if (view === 'create') {
      await createContact(uid, data);
    } else {
      await updateContact(editingContact.id, data);
    }
    await loadContacts();
    setView('list');
    setEditingContact(null);
  };

  const handleFormCancel = () => {
    setView('list');
    setEditingContact(null);
  };

  const handleDeleteConfirm = async (contactId) => {
    await deleteContact(contactId);
    setConfirmDeleteId(null);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  };

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.displayName || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  });

  if (loading) {
    return <div className="cs-loading">{t('common.loading')}</div>;
  }

  if (view === 'create' || view === 'edit') {
    return (
      <ContactForm
        key={editingContact?.id ?? 'new'}
        initial={editingContact}
        supportsContacts={supportsContacts}
        defaultCountry={country}
        onSave={handleFormSave}
        onCancel={handleFormCancel}
        t={t}
      />
    );
  }

  return (
    <div>
      <div className="cs-header">
        <div className="cs-header-text">
          <h2>{t('contacts.title')}</h2>
          <p>{t('contacts.subtitle')}</p>
        </div>
        <div className="cs-header-actions">
          {supportsMultiple && (
            <button
              type="button"
              className="cs-btn-import"
              onClick={handleImport}
              disabled={importing}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {importing ? t('contacts.importing') : t('contacts.importFromPhone')}
            </button>
          )}
          <button className="cs-btn-new" onClick={handleStartCreate}>
            + {t('contacts.newContact')}
          </button>
        </div>
      </div>

      {importResult && (
        <div className="cs-import-result">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {t('contacts.importResult')
            .replace('{n}', importResult.imported)
            .replace('{skipped}', importResult.skipped)}
        </div>
      )}

      {contacts.length > 0 && (
        <div className="cs-search">
          <svg className="cs-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            className="cs-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('contacts.searchPlaceholder')}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="cs-empty">{t('contacts.empty')}</div>
      ) : (
        <div className="cs-list">
          {filtered.map((contact) =>
            confirmDeleteId === contact.id ? (
              <div key={contact.id} className="cs-confirm-row">
                <span>
                  {t('contacts.confirmDelete').replace('{name}', contact.displayName || contact.firstName || '?')}
                </span>
                <button className="cs-btn-confirm-yes" onClick={() => handleDeleteConfirm(contact.id)}>
                  {t('contacts.delete')}
                </button>
                <button className="cs-btn-confirm-no" onClick={() => setConfirmDeleteId(null)}>
                  {t('contacts.cancel')}
                </button>
              </div>
            ) : (
              <div key={contact.id} className="cs-contact-card">
                <div
                  className="cs-avatar"
                  style={{ background: avatarColor(contact.displayName || contact.firstName) }}
                >
                  {initials(contact)}
                </div>
                <div className="cs-contact-info">
                  <p className="cs-contact-name">{contact.displayName || contact.firstName || '—'}</p>
                  <div className="cs-contact-meta">
                    {contact.email && <span className="cs-contact-detail">{contact.email}</span>}
                    {contact.phone && <span className="cs-contact-detail">{contact.phone}</span>}
                  </div>
                </div>
                <div className="cs-contact-actions">
                  <ContactKebab
                    t={t}
                    onEdit={() => handleStartEdit(contact)}
                    onDelete={() => setConfirmDeleteId(contact.id)}
                  />
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ContactKebab({ onEdit, onDelete, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div className="cs-kebab-wrap" ref={ref}>
      <button
        type="button"
        className="cs-kebab-btn"
        onClick={() => setOpen((v) => !v)}
        title="Options"
      >
        ⋮
      </button>
      {open && (
        <div className="cs-kebab-menu">
          <button
            type="button"
            className="cs-kebab-item"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t('contacts.edit')}
          </button>
          <button
            type="button"
            className="cs-kebab-item cs-kebab-danger"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            {t('contacts.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

function ContactForm({ initial, supportsContacts, defaultCountry, onSave, onCancel, t }) {
  const [name, setName] = useState(initial?.displayName || initial?.firstName || '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePickContact = async () => {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: false });
      if (contacts.length > 0) {
        const raw = contacts[0];
        const fullName = Array.isArray(raw.name) ? raw.name[0] : '';
        if (fullName) setName(fullName.trim());
        if (Array.isArray(raw.tel) && raw.tel[0]) setPhone(raw.tel[0]);
        if (Array.isArray(raw.email) && raw.email[0]) setEmail(raw.email[0]);
      }
    } catch {
      // user cancelled
    }
  };

  const handleSave = async () => {
    setError('');
    if (!name.trim()) {
      setError(t('contacts.errorRequired'));
      return;
    }
    if (!email.trim() && !phone) {
      setError(t('contacts.errorContact'));
      return;
    }
    if (phone && !isValidPhoneNumber(phone)) {
      setError(t('userGroups.errorPhoneInvalid'));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        firstName: name.trim(),
        displayName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || '',
      });
    } catch (err) {
      setError(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cs-form">
      <h3 className="cs-form-title">
        {initial ? `${t('contacts.edit')} — ${initial.displayName || initial.firstName}` : t('contacts.newContact')}
      </h3>

      <div className="cs-field">
        <label>{t('contacts.firstName')} *</label>
        <input
          type="text"
          className="cs-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="cs-field">
        <label>{t('contacts.email')}</label>
        <input
          type="email"
          className="cs-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          maxLength={200}
        />
      </div>

      <div className="cs-phone-pick-row">
        <div className="cs-field">
          <label>{t('contacts.phone')}</label>
          <div className="cs-phone-wrap">
            <PhoneInput
              international
              defaultCountry={defaultCountry}
              countryCallingCodeEditable={false}
              value={phone}
              onChange={(val) => setPhone(val || '')}
              placeholder={t('contacts.phone')}
            />
          </div>
        </div>
        {supportsContacts && (
          <button
            type="button"
            className="cs-btn-pick"
            onClick={handlePickContact}
            title={t('contacts.pickContact')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        )}
      </div>

      {error && <p className="cs-form-error">{error}</p>}

      <div className="cs-form-actions">
        <button
          type="button"
          className="cs-btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('common.loading') : t('contacts.save')}
        </button>
        <button type="button" className="cs-btn-cancel" onClick={onCancel}>
          {t('contacts.cancel')}
        </button>
      </div>
    </div>
  );
}
