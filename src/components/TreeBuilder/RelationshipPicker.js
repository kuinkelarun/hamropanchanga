import React, { useEffect, useState } from 'react';

// Lightweight relationship picker modeled after the standalone builder.
// Lets the user choose a relationship type (parent/child/spouse/sibling/custom)
// and an optional label between two members.

export default function RelationshipPicker({
  open,
  fromName = '...',
  toName = '...',
  onCancel,
  onConfirm,
  mode = 'create', // 'create' | 'edit'
  initialType,
  initialLabel,
  title,
  confirmText,
  onDelete,
  onTypePreview,
}) {
  const [type, setType] = useState(initialType || 'custom');
  const [label, setLabel] = useState(initialLabel || '');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    // Reset to initial values only when dialog opens or initial props change.
    // Avoid depending on onTypePreview identity to prevent unwanted resets.
    setType(initialType || 'custom');
    setLabel(initialLabel || '');
    // Only preview when an initial type is provided (edit mode).
    if (onTypePreview && initialType) {
      onTypePreview(initialType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType, initialLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onCancel && onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const handleConfirm = () => {
    console.log('[RelationshipPicker] Confirming with:', { type, label, initialType });
    if (onConfirm) {
      // In edit mode, pass empty string to clear saved label.
      // In create mode, undefined will omit label field from the doc.
      const effectiveLabel = mode === 'edit' ? label : (label || undefined);
      onConfirm(type, effectiveLabel);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white shadow-xl border border-gray-200 p-4 text-sm"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          {title || (mode === 'edit' ? 'Edit relationship' : 'Create relationship')}
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Between <span className="font-semibold">{fromName}</span> and{' '}
          <span className="font-semibold">{toName}</span>
        </p>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-700">Type</label>
          <select
            value={type}
            onChange={e => {
              const nextType = e.target.value;
              setType(nextType);
              if (onTypePreview) onTypePreview(nextType);
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs bg-white"
          >
            <option value="parent">parent</option>
            <option value="child">child</option>
            <option value="spouse">spouse</option>
            <option value="sibling">sibling</option>
            <option value="custom">custom</option>
          </select>

          <label className="block text-xs font-semibold text-gray-700 mt-2">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Leave blank to use type"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs bg-white"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2 text-xs">
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50 mr-auto"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            {confirmText || (mode === 'edit' ? 'Save' : 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
}
