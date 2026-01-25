import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const ConfirmModal = ({ open, title = 'Confirm', message, onConfirm, onCancel, confirmText = 'Confirm' }) => {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-5">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          <button onClick={onCancel} className="app-cancel-btn text-sm">{t('cancel') || 'Cancel'}</button>
          <button onClick={onConfirm} className="app-save-btn text-sm">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
