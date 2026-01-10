import React, { useEffect, useState } from 'react';
import { normalizeForCompare } from '../../utils/textNormalize';

// Nepali numerals for conversion
const nepaliNumbers = ["०","१","२","३","४","५","६","७","८","९"];

// Convert Nepali numerals to English
const normalizeNepaliNumerals = (str) => {
  if (!str) return str;
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(nepaliNumbers[i], 'g'), i.toString());
  }
  return result;
};

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
    };
    // Build dob from year/month/day fields (normalize Nepali numerals to English)
    if (dobYear && dobMonth && dobDay) {
      const year = normalizeNepaliNumerals(dobYear.trim());
      const month = normalizeNepaliNumerals(dobMonth.trim());
      const day = normalizeNepaliNumerals(dobDay.trim());
      
      // Validate that they're valid numbers
      if (/^\d+$/.test(year) && /^\d+$/.test(month) && /^\d+$/.test(day)) {
        payload.dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
            {previewMode ? 'Member Details' : (isEdit ? 'Edit Member Details' : 'Add New Member')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
            title="Press Escape or click outside to close"
          >
            ✕ Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className={`px-3 py-2 space-y-2 text-sm rounded-b-lg ${
          previewMode ? 'bg-white/50' : 'bg-gray-50'
        }`}>
          <div className="grid grid-cols-1 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">Name <span className="text-red-500">*</span></span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                disabled={previewMode}
                className={`w-full rounded-md border px-2 py-1 text-xs bg-white transition-all ${
                  previewMode 
                    ? 'border-gray-200 text-gray-600 bg-gray-50/50 cursor-default' 
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                }`}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">Nickname</span>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="Jr., Sr., Mike, etc."
                disabled={previewMode}
                className={`w-full rounded-md border px-2 py-1 text-xs bg-white transition-all ${
                  previewMode 
                    ? 'border-gray-200 text-gray-600 bg-gray-50/50 cursor-default' 
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                }`}
              />
            </label>
          </div>

          {duplicateExact && !nickname.trim() && (
            <p className="text-xs text-red-600">
              This name is already taken. Please add a nickname to distinguish.
            </p>
          )}
          {duplicateExact && !!nickname.trim() && (
            <p className="text-xs text-red-600">
              This name and nickname are already used. Please choose a different nickname.
            </p>
          )}

          <div className="grid grid-cols-[auto,1fr] items-center gap-3">
            <span className="text-xs font-semibold text-gray-700">Gender</span>
            <div className="flex flex-wrap gap-3 text-xs text-gray-800">
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={e => setGender(e.target.value)}
                />
                Male
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={e => setGender(e.target.value)}
                />
                Female
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="nonbinary"
                  checked={gender === 'nonbinary'}
                  onChange={e => setGender(e.target.value)}
                />
                Non-binary
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gender"
                  value="unknown"
                  checked={gender === 'unknown'}
                  onChange={e => setGender(e.target.value)}
                />
                Prefer not to say
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">📅 Date of Birth (Nepali or English)</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dobYear}
                  onChange={e => setDobYear(validateNumericInput(e.target.value))}
                  placeholder="yyyy"
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white placeholder-gray-400"
                />
                <input
                  type="text"
                  value={dobMonth}
                  onChange={e => setDobMonth(validateNumericInput(e.target.value))}
                  placeholder="mm"
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white placeholder-gray-400"
                />
                <input
                  type="text"
                  value={dobDay}
                  onChange={e => setDobDay(validateNumericInput(e.target.value))}
                  placeholder="dd"
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white placeholder-gray-400"
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">📍 Location</span>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="City, Country"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-700">Photo URL</span>
            <input
              type="url"
              value={photo}
              onChange={e => setPhoto(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-gray-700">📝 Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes, occupation, facts..."
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white resize-none"
            />
          </label>

          <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-300 mt-2 justify-end">
            {!previewMode && isEdit && onMoveToPool && member?.position && typeof member.position.x === 'number' && typeof member.position.y === 'number' && (
              <button
                type="button"
                onClick={() => onMoveToPool(member.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                Move to Pool
              </button>
            )}
            {!previewMode && isEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(member.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            )}
            {!previewMode && (
              <button
                type="submit"
                disabled={saveDisabled}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm transition-colors ${
                  saveDisabled
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}
              >
                {isEdit ? 'Save Changes' : 'Add Member'}
              </button>
            )}
            {!previewMode && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            {previewMode && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
