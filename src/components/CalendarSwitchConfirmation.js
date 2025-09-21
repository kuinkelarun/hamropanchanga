import React from 'react';

const CalendarSwitchConfirmation = ({ isOpen, onConfirm, onCancel, currentLanguage, targetLanguage }) => {
    if (!isOpen) return null;

    const getCurrentLanguageDisplay = () => currentLanguage === 'nepali' ? 'नेपाली' : 'English';
    const getTargetLanguageDisplay = () => targetLanguage === 'nepali' ? 'नेपाली' : 'English';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Switch Calendar Language</h3>
                </div>

                <div className="mb-6">
                    <p className="text-gray-700 mb-3">
                        You are about to switch from <span className="font-semibold text-blue-600">{getCurrentLanguageDisplay()}</span> to <span className="font-semibold text-blue-600">{getTargetLanguageDisplay()}</span> calendar.
                    </p>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <h4 className="text-sm font-medium text-amber-800 mb-2">This will affect:</h4>
                        <ul className="text-sm text-amber-700 space-y-1">
                            <li>• Date display in all events</li>
                            <li>• Event grouping by months</li>
                            <li>• Date picker when creating events</li>
                        </ul>
                    </div>

                    <p className="text-sm text-gray-600">
                        Your preference will be saved and applied immediately across the entire application.
                    </p>
                </div>

                <div className="flex space-x-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                        Switch to {getTargetLanguageDisplay()}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalendarSwitchConfirmation;