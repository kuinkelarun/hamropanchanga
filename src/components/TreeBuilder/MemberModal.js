import React, { useEffect, useState } from 'react';

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
}) {
  const isEdit = !!(member && member.id);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [photo, setPhoto] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('unknown');

  useEffect(() => {
    if (open) {
      setName(member?.name || '');
      setNickname(member?.nickname || '');
      const isoDob = member?.dob ? new Date(member.dob).toISOString().slice(0, 10) : '';
      setDob(isoDob);
      setPhoto(member?.photo || '');
      setNotes(member?.notes || '');
      setLocation(member?.location || '');
      setGender(member?.gender || 'unknown');
    }
  }, [open, member]);

  const normalize = value => String(value || '').trim().toLocaleLowerCase();

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
      name: name.trim(),
      nickname: nickname.trim(),
      gender,
    };
    if (dob && String(dob).trim()) payload.dob = dob;
    if (location && String(location).trim()) payload.location = location.trim();
    if (notes && String(notes).trim()) payload.notes = notes.trim();
    if (photo && String(photo).trim()) payload.photo = photo.trim();

    if (onSave) onSave(payload);
  };

  const saveDisabled = !canSave || !name.trim() || duplicateExact;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md rounded-lg bg-white shadow-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
          <h3 className="text-sm font-semibold">
            {isEdit ? 'Edit Member Details' : 'Add New Member'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium px-2 py-1 rounded-md bg-white/20 hover:bg-white/30"
          >
            ✕ Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-3 py-2 space-y-2 text-sm bg-gray-50 rounded-b-lg">
          <div className="grid grid-cols-1 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-700">Name <span className="text-red-500">*</span></span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white"
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
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white"
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
              <span className="text-xs font-semibold text-gray-700">📅 Date of Birth</span>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 bg-white"
              />
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
            {isEdit && onMoveToPool && member?.position && typeof member.position.x === 'number' && typeof member.position.y === 'number' && (
              <button
                type="button"
                onClick={() => onMoveToPool(member.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-amber-500 hover:bg-amber-600"
              >
                Move to Pool
              </button>
            )}
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(member.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={saveDisabled}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-sm ${
                saveDisabled
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
              }`}
            >
              {isEdit ? 'Save Changes' : 'Add Member'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
