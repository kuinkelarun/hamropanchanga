import React, { useEffect, useState } from 'react';
import { normalizeForCompare } from '../../utils/textNormalize';
import { useLanguage } from '../../contexts/LanguageContext';

// Validate and filter to allow only English (0-9) or Nepali numerals (०-९)
const validateNumericInput = (value) => {
  if (!value) return '';
  const nepaliPattern = /^[०-९]*$/;
  const englishPattern = /^[0-9]*$/;
  // Only allow if it's all English digits or all Nepali digits
  if (englishPattern.test(value) || nepaliPattern.test(value)) {
    return value;
  }
  // Return empty if contains invalid characters
  return '';
};

// Lightweight member editor modal inspired by the standalone builder's MemberModal.
// Fields: name (required), nickname, gender, dob, location, notes, photo (URL).
// Validation: name is required; duplicate checks compare the (name, nickname)
// pair. If another member has the exact same name and empty nickname, we
// prompt for a nickname; if the exact same name and nickname already exist,
// save is blocked.

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
      // Parse dob (YYYY-MM-DD) into separate fields
      if (member?.dob) {
        const [year, month, day] = member.dob.split('-');
        setDobYear(year || '');
        setDobMonth(month || '');
        setDobDay(day || '');
      } else {
        setDobYear('');
        setDobMonth('');
        setDobDay('');
      }
      setPhoto(member?.photo || '');
      setNotes(member?.notes || '');
      setLocation(member?.location || '');
      setGender(member?.gender || 'unknown');
      setStatus(member?.status || 'alive');
      // Parse dod (YYYY-MM-DD) into separate fields
      if (member?.dod) {
        const [year, month, day] = member.dod.split('-');
        setDodYear(year || '');
        setDodMonth(month || '');
        setDodDay(day || '');
      } else {
        setDodYear('');
        setDodMonth('');
        setDodDay('');
      }
    }
  }, [open, member]);

  // Handle Escape key and outside click - must be before early return
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('keydown', handleEscape);
    }
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
    const payload = {
      name,
      nickname,
      gender,
      status,
    };
    
    // Helper function to format date while preserving numeric format
    const formatDateWithPreservedFormat = (year, month, day) => {
      if (!year || !month || !day) return null;
      const yearTrimmed = year.trim();
      const monthTrimmed = month.trim();
      const dayTrimmed = day.trim();
      
      // Validate both formats (English and Nepali digits)
      const nepaliDigitRegex = /^[०-९]+$/;
      const englishDigitRegex = /^[0-9]+$/;
      
      const yearValid = englishDigitRegex.test(yearTrimmed) || nepaliDigitRegex.test(yearTrimmed);
      const monthValid = englishDigitRegex.test(monthTrimmed) || nepaliDigitRegex.test(monthTrimmed);
      const dayValid = englishDigitRegex.test(dayTrimmed) || nepaliDigitRegex.test(dayTrimmed);
      
      if (yearValid && monthValid && dayValid) {
        // Preserve the original format - don't convert
        return `${yearTrimmed}-${monthTrimmed.padStart(2, '0')}-${dayTrimmed.padStart(2, '0')}`;
      }
      return null;
    };
    
    // Build dob from year/month/day fields (preserve original format)
    const dob = formatDateWithPreservedFormat(dobYear, dobMonth, dobDay);
    if (dob) {
      payload.dob = dob;
    }
    
    // Build dod from year/month/day fields (preserve original format) if status is deceased
    if (status === 'deceased') {
      const dod = formatDateWithPreservedFormat(dodYear, dodMonth, dodDay);
      if (dod) {
        payload.dod = dod;
      }
    }
    
    if (location && String(location).trim()) payload.location = location.trim();
    if (notes && String(notes).trim()) payload.notes = notes.trim();
    if (photo && String(photo).trim()) payload.photo = photo.trim();

    if (onSave) onSave(payload);
  };

  const saveDisabled = !canSave || !name.trim() || duplicateExact;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2"
      onClick={handleBackdropClick}
    >
      <div
        className={`w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl backdrop-blur-xl ${
          previewMode 
            ? 'bg-white/80 border border-white/20' 
            : 'bg-white/95 border border-white/30'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-4 py-3 rounded-t-2xl ${
          previewMode
            ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
            : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
        }`}>
          <h3 className="text-sm font-semibold">
            {previewMode ? t('memberModal.memberDetails') : (isEdit ? t('memberModal.editMemberDetails') : t('memberModal.addNewMember'))}
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

        <form onSubmit={handleSubmit} className={`px-3 py-2 space-y-2 text-sm rounded-b-lg ${
          previewMode ? 'bg-white/50' : 'bg-gray-50'
        }`}>
          <div className="grid grid-cols-1 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.name')} <span className="text-red-500">{t('memberModal.nameRequired')}</span></span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('memberModal.namePlaceholder')}
                disabled={previewMode}
                className={`w-full rounded-md border px-2 py-1 text-xs bg-white transition-all ${
                  previewMode 
                    ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                }`}
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
                disabled={previewMode}
                className={`w-full rounded-md border px-2 py-1 text-xs bg-white transition-all ${
                  previewMode 
                    ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                }`}
              />
            </label>
          </div>

          {duplicateExact && !nickname.trim() && (
            <p className="text-xs text-red-600">
              {t('memberModal.duplicateNameNickname')}
            </p>
          )}
          {duplicateExact && !!nickname.trim() && (
            <p className="text-xs text-red-600">
              {t('memberModal.duplicateFull')}
            </p>
          )}

          <div className="grid grid-cols-[auto,1fr] items-center gap-3">
            <span className="text-xs font-semibold text-gray-700">{t('memberModal.gender')}</span>
            <div className="flex flex-wrap gap-3 text-xs" style={{color: '#1f2937'}}>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  disabled={previewMode}
                  checked={gender === 'male'}
                  onChange={e => setGender(e.target.value)}
                  className={previewMode ? 'cursor-not-allowed opacity-60' : ''}
                />
                {t('memberModal.male')}
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  disabled={previewMode}
                  checked={gender === 'female'}
                  onChange={e => setGender(e.target.value)}
                  className={previewMode ? 'cursor-not-allowed opacity-60' : ''}
                />
                {t('memberModal.female')}
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="nonbinary"
                  disabled={previewMode}
                  checked={gender === 'nonbinary'}
                  onChange={e => setGender(e.target.value)}
                  className={previewMode ? 'cursor-not-allowed opacity-60' : ''}
                />
                {t('memberModal.nonbinary')}
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="unknown"
                  disabled={previewMode}
                  checked={gender === 'unknown'}
                  onChange={e => setGender(e.target.value)}
                  className={previewMode ? 'cursor-not-allowed opacity-60' : ''}
                />
                {t('memberModal.preferNotToSay')}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.dateOfBirth')}</span>
              <div className="flex flex-wrap gap-3 text-xs" style={{color: '#1f2937'}}>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="status"
                    value="alive"
                    disabled={previewMode}
                    checked={status === 'alive'}
                    onChange={e => setStatus(e.target.value)}
                    className={previewMode ? 'cursor-not-allowed opacity-60' : ''}
                  />
                  {t('memberModal.isAlive')}
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="status"
                    value="deceased"
                    disabled={previewMode}
                    checked={status === 'deceased'}
                    onChange={e => setStatus(e.target.value)}
                    className={previewMode ? 'cursor-not-allowed opacity-60' : ''}
                  />
                  {t('memberModal.passedAway')}
                </label>
              </div>
            </div>
            <label className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dobYear}
                  onChange={e => setDobYear(validateNumericInput(e.target.value))}
                  disabled={previewMode}
                  placeholder={t('memberModal.yearPlaceholder')}
                  className={`w-24 rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all ${
                    previewMode 
                      ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                  }`}
                />
                <input
                  type="text"
                  value={dobMonth}
                  onChange={e => setDobMonth(validateNumericInput(e.target.value))}
                  disabled={previewMode}
                  placeholder={t('memberModal.monthPlaceholder')}
                  className={`w-16 rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all ${
                    previewMode 
                      ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                  }`}
                />
                <input
                  type="text"
                  value={dobDay}
                  onChange={e => setDobDay(validateNumericInput(e.target.value))}
                  disabled={previewMode}
                  placeholder={t('memberModal.dayPlaceholder')}
                  className={`w-16 rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all ${
                    previewMode 
                      ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                  }`}
                />
              </div>
            </label>

            {status === 'deceased' && (
              <label className="space-y-1">
                <span className="text-xs font-semibold text-gray-700">{t('memberModal.dateOfDeath')}</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dodYear}
                    onChange={e => setDodYear(validateNumericInput(e.target.value))}
                    disabled={previewMode}
                    placeholder={t('memberModal.yearPlaceholder')}
                    className={`w-24 rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all ${
                      previewMode 
                        ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                    }`}
                  />
                  <input
                    type="text"
                    value={dodMonth}
                    onChange={e => setDodMonth(validateNumericInput(e.target.value))}
                    disabled={previewMode}
                    placeholder={t('memberModal.monthPlaceholder')}
                    className={`w-16 rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all ${
                      previewMode 
                        ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                    }`}
                  />
                  <input
                    type="text"
                    value={dodDay}
                    onChange={e => setDodDay(validateNumericInput(e.target.value))}
                    disabled={previewMode}
                    placeholder={t('memberModal.dayPlaceholder')}
                    className={`w-16 rounded-md border px-2 py-1 text-xs bg-white placeholder-gray-400 transition-all ${
                      previewMode 
                        ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                    }`}
                  />
                </div>
              </label>
            )}

            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">{t('memberModal.location')}</span>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                disabled={previewMode}
                placeholder={t('memberModal.locationPlaceholder')}
                className={`w-full rounded-md border px-2 py-1 text-xs bg-white transition-all ${
                  previewMode 
                    ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                }`}
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('memberModal.photoUrl')}</span>
            <input
              type="url"
              value={photo}
              onChange={e => setPhoto(e.target.value)}
              disabled={previewMode}
              placeholder={t('memberModal.photoUrlPlaceholder')}
              className={`w-full rounded-md border px-2 py-1 text-xs bg-white transition-all ${
                previewMode 
                  ? 'border-gray-300 text-gray-900 bg-white cursor-default' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
              }`}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-700">{t('memberModal.notes')}</span>
            <textarea
              rows={2}
              disabled={previewMode}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('memberModal.notesPlaceholder')}
              className={`w-full rounded-md border px-2 py-1 text-xs resize-none overflow-y-auto ${
                previewMode
                  ? 'border-gray-300 text-gray-900 bg-white cursor-default'
                  : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
              }`}
              style={{maxHeight: '120px'}}
            />
          </label>

            <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-300 mt-2 justify-end">
            {!previewMode && isEdit && onMoveToPool && member?.position && typeof member.position.x === 'number' && typeof member.position.y === 'number' && (
              <button
                type="button"
                onClick={() => onMoveToPool(member.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                {t('memberModal.moveToPool')}
              </button>
            )}
            {!previewMode && isEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(member.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-red-600 hover:bg-red-700 transition-colors"
              >
                {t('memberModal.delete')}
              </button>
            )}
            {!previewMode && (
              <button
                type="button"
                onClick={onClose}
                className="app-cancel-btn text-xs"
              >
                {t('memberModal.cancel')}
              </button>
            )}
            {!previewMode && (
              <button
                type="submit"
                disabled={saveDisabled}
                className={`app-save-btn text-xs ${saveDisabled ? 'disabled' : ''}`}
              >
                {isEdit ? t('memberModal.saveChanges') : t('memberModal.addMember')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
