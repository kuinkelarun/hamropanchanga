import React from 'react';

const CalendarToggle = ({ isNepali, onToggle, label = "Calendar Type" }) => {
    return (
        <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700">{label}:</span>
            <div className="flex items-center space-x-2">
                <span className={`text-sm ${isNepali ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                    नेपाली
                </span>
                <button
                    type="button"
                    onClick={onToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                        isNepali ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            isNepali ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
                <span className={`text-sm ${!isNepali ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                    English
                </span>
            </div>
        </div>
    );
};

export default CalendarToggle;