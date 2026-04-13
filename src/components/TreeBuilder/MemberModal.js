import React, { useEffect, useState } from 'react';
import { normalizeForCompare } from '../../utils/textNormalize';
import { useLanguage } from '../../contexts/LanguageContext';

// Validate and filter to allow only English (0-9) or Nepali numerals (०-९)
const validateNumericInput = (value) => {
  if (!value) return '';
  const nepaliPattern = /^[०-९]*$/;
  const englishPattern = /^[0-9]*$/;
  if (englishPattern.test(value) || nepaliPattern.test(value)) {
    return value;
  }
  return '';
};

export default function MemberModal({
  open,
  member,
  allMembers = [],
  onSave,
  onClose,
  canSave = true,
  onMoveToPool,
  onDelete,
  previewMode = false,
}) {
  const { t } = useLanguage();
  const isEdit = !!(member && member.id);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [photo, setPhoto] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('unknown');
  const [status, setStatus] = useState('alive');
  const [dodYear, setDodYear] = useState('');
  const [dodMonth, setDodMonth] = useState('');
  const [dodDay, setDodDay] = useState('');

  useEffect(() => {
    if (open) {
      setName(member?.name || '');
      setNickname(member?.nickname || '');
      if (member?.dob) {
        const [year, month, day] = member.dob.split('-');
        setDobYear(year || '');
        setDobMonth(month || '');
        setDobDay(day || '');
      } else {
        setDobYear(''); setDobMonth(''); setDobDay('');
      }
      setPhoto(member?.photo || '');
      setNotes(member?.notes || '');
      setLocation(member?.location || '');
      setGender(member?.gender || 'unknown');
      setStatus(member?.status || 'alive');
      if (member?.dod) {
        const [year, month, day] = member.dod.split('-');
        setDodYear(year || ''); setDodMonth(month || ''); setDodDay(day || '');
      } else {
        setDodYear(''); setDodMonth(''); setDodDay('');
      }
    }
  }, [open, member]);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape' && open) onClose(); };
    if (open) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const normalize = value => normalizeForCompare(value);

  const duplicateExact = (() => {
    const nm = normalize(name);
    const nick = normalize(nickname);
    if (!nm) return false;
    return allMembers.some(m => (
      normalize(m.name) === nm &&
      normalize(m.nickname) === nick &&
      (!member || String(m.id) !== String(member.id))
    ));
  })();

  if (!open) return null;

  const handleSubmit = event => {
    event.preventDefault();
    const payload = { name, nickname, gender, status };
    const formatDateWithPreservedFormat = (year, month, day) => {
      if (!year || !month || !day) return null;
      const yT = year.trim(), mT = month.trim(), dT = day.trim();
      const nR = /^[०-९]+$/, eR = /^[0-9]+$/;
      if ((eR.test(yT) || nR.test(yT)) && (eR.test(mT) || nR.test(mT)) && (eR.test(dT) || nR.test(dT))) {
        return `${yT}-${mT.padStart(2, '0')}-${dT.padStart(2, '0')}`;
      }
      return null;
    };
    const dob = formatDateWithPreservedFormat(dobYear, dobMonth, dobDay);
    if (dob) payload.dob = dob;
    if (status === 'deceased') {
      const dod = formatDateWithPreservedFormat(dodYear, dodMonth, dodDay);
      if (dod) payload.dod = dod;
    }
    if (location && String(location).trim()) payload.location = location.trim();
    if (notes && String(notes).trim()) payload.notes = notes.trim();
    if (photo && String(photo).trim()) payload.photo = photo.trim();
    if (onSave) onSave(payload);
  };

  const saveDisabled = !canSave || !name.trim() || duplicateExact;

  const handleBackdropClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  // ── Preview Mode: Card-based read-only view ──
  if (previewMode) {
    const genderLabel = {
      male: t('memberModal.male'),
      female: t('memberModal.female'),
      nonbinary: t('memberModal.nonbinary'),
      unknown: t('memberModal.preferNotToSay'),
    }[gender] || gender;

    const formatDate = (y, m, d) => {
      if (!y) return null;
      let parts = [y];
      if (m) parts.push(m.padStart(2, '0'));
      if (d) parts.push(d.padStart(2, '0'));
      return parts.join('-');
    };
    const dobDisplay = formatDate(dobYear, dobMonth, dobDay);
    const dodDisplay = formatDate(dodYear, dodMonth, dodDay);
    const isDeceased = status === 'deceased';

    // Initials for avatar
    const initials = name
      ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
      : '?';

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2"
        onClick={handleBackdropClick}
      >
        <div
          className="w-full max-w-sm sm:max-w-md overflow-hidden"
          onClick={e => e.stopPropagation()}
          style={{ borderRadius: '16px', boxShadow: '0 20px 50px rgba(2,6,23,0.25)' }}
        >
          {/* Header with gradient */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
            padding: '24px 20px 40px',
            position: 'relative',
          }}>
            {/* Decorative circles */}
            <div style={{
              position: 'absolute', top: '-30px', right: '-20px',
              width: '120px', height: '120px', borderRadius: '50%',
              background: 'rgba(167, 139, 250, 0.08)', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '-20px',
              width: '100px', height: '100px', borderRadius: '50%',
              background: 'rgba(246, 173, 85, 0.06)', pointerEvents: 'none',
            }} />

            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: '12px', right: '12px',
                background: 'rgba(255,255,255,0.12)', border: 'none',
                color: 'rgba(255,255,255,0.8)', width: '32px', height: '32px',
                borderRadius: '8px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={t('memberModal.close')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              {/* Avatar */}
              {photo ? (
                <img
                  src={photo}
                  alt={name}
                  style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    objectFit: 'cover', margin: '0 auto 12px',
                    border: '3px solid rgba(255,255,255,0.25)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                />
              ) : (
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', fontSize: '1.5rem', fontWeight: '700',
                  color: '#ffffff', border: '3px solid rgba(255,255,255,0.25)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}>
                  {initials}
                </div>
              )}
              <h3 style={{
                color: '#ffffff', fontSize: '1.25rem', fontWeight: '700',
                margin: '0 0 2px', lineHeight: '1.3',
              }}>
                {name || 'Unknown'}
              </h3>
              {nickname && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                  "{nickname}"
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{
            background: '#ffffff', padding: '20px',
            maxHeight: '50vh', overflowY: 'auto',
          }}>
            {/* Status + Gender pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '600',
                background: isDeceased ? '#fef2f2' : '#f0fdf4',
                color: isDeceased ? '#991b1b' : '#166534',
                border: `1px solid ${isDeceased ? '#fecaca' : '#bbf7d0'}`,
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isDeceased ? '#ef4444' : '#22c55e',
                }} />
                {isDeceased ? t('memberModal.passedAway') : t('memberModal.isAlive')}
              </span>
              {gender && gender !== 'unknown' && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '600',
                  background: '#f5f3ff', color: '#5b21b6', border: '1px solid #ede9fe',
                }}>
                  {genderLabel}
                </span>
              )}
            </div>

            {/* Detail rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dobDisplay && (
                <DetailRow
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
                  label={t('memberModal.dateOfBirth')}
                  value={dobDisplay}
                />
              )}

              {isDeceased && dodDisplay && (
                <DetailRow
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
                  label={t('memberModal.dateOfDeath')}
                  value={dodDisplay}
                />
              )}

              {location && (
                <DetailRow
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                  label={t('memberModal.location')}
                  value={location}
                />
              )}

              {notes && (
                <DetailRow
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
                  label={t('memberModal.notes')}
                  value={notes}
                />
              )}

              {/* Empty state */}
              {!dobDisplay && !location && !notes && !isDeceased && (
                <div style={{
                  textAlign: 'center', padding: '16px 8px',
                  color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic',
                }}>
                  No additional details available.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px 16px', borderTop: '1px solid #f1f5f9',
            background: '#ffffff', borderRadius: '0 0 16px 16px',
            display: 'flex', justifyContent: 'center',
          }}>
            <button
              onClick={onClose}
              className="ddm-btn ddm-btn-ghost"
              style={{ minWidth: '120px' }}
            >
              {t('memberModal.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit Mode: Original form (unchanged) ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl backdrop-blur-xl bg-white/95 border border-white/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 rounded-t-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <h3 className="text-sm font-semibold">
            {isEdit ? t('memberModal.editMemberDetails') : t('memberModal.addNewMember')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
            title={t('memberModal.close')}
            aria-label={t('memberModal.close')}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-3 py-2 space-y-2 text-sm rounded-b-lg bg-gray-50">
          <div className="grid grid-cols-1 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.name')} <span className="text-red-500">{t('memberModal.nameRequired')}</span></span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('memberModal.namePlaceholder')}
                className="w-full rounded-md border px-2 py-1 text-xs bg-white transition-all border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.nickname')}</span>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder={t('memberModal.nicknamePlaceholder')}
                className="w-full rounded-md border px-2 py-1 text-xs bg-white transition-all border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
              />
            </label>
          </div>

          {duplicateExact && !nickname.trim() && (
            <p className="text-xs text-red-600">{t('memberModal.duplicateNameNickname')}</p>
          )}
          {duplicateExact && !!nickname.trim() && (
            <p className="text-xs text-red-600">{t('memberModal.duplicateFull')}</p>
          )}

          <div className="grid grid-cols-[auto,1fr] items-center gap-3">
            <span className="text-xs font-semibold text-gray-700">{t('memberModal.gender')}</span>
            <div className="flex flex-wrap gap-3 text-xs" style={{color: '#1f2937'}}>
              {['male', 'female', 'nonbinary', 'unknown'].map(g => (
                <label key={g} className="inline-flex items-center gap-1">
                  <input type="radio" name="gender" value={g} checked={gender === g} onChange={e => setGender(e.target.value)} />
                  {t(`memberModal.${g === 'unknown' ? 'preferNotToSay' : g}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.dateOfBirth')}</span>
              <div className="flex flex-wrap gap-3 text-xs" style={{color: '#1f2937'}}>
                <label className="inline-flex items-center gap-1">
                  <input type="radio" name="status" value="alive" checked={status === 'alive'} onChange={e => setStatus(e.target.value)} />
                  {t('memberModal.isAlive')}
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="radio" name="status" value="deceased" checked={status === 'deceased'} onChange={e => setStatus(e.target.value)} />
                  {t('memberModal.passedAway')}
                </label>
              </div>
            </div>
            <label className="space-y-1">
              <div className="flex gap-2">
                {[['dobYear', dobYear, setDobYear, 'yearPlaceholder', 'w-24'],
                  ['dobMonth', dobMonth, setDobMonth, 'monthPlaceholder', 'w-16'],
                  ['dobDay', dobDay, setDobDay, 'dayPlaceholder', 'w-16']].map(([key, val, setter, ph, w]) => (
                  <input
                    key={key}
                    type="text"
                    value={val}
                    onChange={e => setter(validateNumericInput(e.target.value))}
                    placeholder={t(`memberModal.${ph}`)}
                    className={`${w} rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400`}
                  />
                ))}
              </div>
            </label>

            {status === 'deceased' && (
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700">{t('memberModal.dateOfDeath')}</span>
                <div className="flex gap-2">
                  {[['dodYear', dodYear, setDodYear, 'yearPlaceholder', 'w-24'],
                    ['dodMonth', dodMonth, setDodMonth, 'monthPlaceholder', 'w-16'],
                    ['dodDay', dodDay, setDodDay, 'dayPlaceholder', 'w-16']].map(([key, val, setter, ph, w]) => (
                    <input
                      key={key}
                      type="text"
                      value={val}
                      onChange={e => setter(validateNumericInput(e.target.value))}
                      placeholder={t(`memberModal.${ph}`)}
                      className={`${w} rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400`}
                    />
                  ))}
                </div>
              </label>
            )}

            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.location')}</span>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder={t('memberModal.locationPlaceholder')}
                className="w-full rounded-md border px-2 py-1 text-xs bg-white transition-all border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('memberModal.photoUrl')}</span>
            <input
              type="url"
              value={photo}
              onChange={e => setPhoto(e.target.value)}
              placeholder={t('memberModal.photoUrlPlaceholder')}
              className="w-full rounded-md border px-2 py-1 text-xs bg-white transition-all border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('memberModal.notes')}</span>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('memberModal.notesPlaceholder')}
              className="w-full rounded-md border px-2 py-1 text-xs resize-none overflow-y-auto border-gray-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
              style={{maxHeight: '120px'}}
            />
          </label>

          <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-300 mt-2 justify-end">
            {isEdit && onMoveToPool && member?.position && typeof member.position.x === 'number' && typeof member.position.y === 'number' && (
              <button type="button" onClick={() => onMoveToPool(member.id)} className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-amber-500 hover:bg-amber-600 transition-colors">
                {t('memberModal.moveToPool')}
              </button>
            )}
            {isEdit && onDelete && (
              <button type="button" onClick={() => onDelete(member.id)} className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-red-600 hover:bg-red-700 transition-colors">
                {t('memberModal.delete')}
              </button>
            )}
            <button type="button" onClick={onClose} className="app-cancel-btn text-xs">
              {t('memberModal.cancel')}
            </button>
            <button type="submit" disabled={saveDisabled} className={`app-save-btn text-xs ${saveDisabled ? 'disabled' : ''}`}>
              {isEdit ? t('memberModal.saveChanges') : t('memberModal.addMember')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Row sub-component ──
function DetailRow({ icon, label, value }) {
  // Strip emoji prefix from label (e.g. "📅 Date of Birth" → "Date of Birth")
  const cleanLabel = label.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]\s*/u, '');

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '10px 14px', borderRadius: '10px',
      background: '#fafbfc', border: '1px solid #f1f5f9',
    }}>
      <div style={{
        color: '#667eea', flexShrink: 0, marginTop: '2px',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.72rem', fontWeight: '600', color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px',
        }}>
          {cleanLabel}
        </div>
        <div style={{
          fontSize: '0.875rem', color: '#1e293b', fontWeight: '500',
          lineHeight: '1.5', wordBreak: 'break-word',
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}
