import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import CalendarSwitchConfirmation from './CalendarSwitchConfirmation';

const SettingsMenu = ({ user, onSignOut, isAdmin, onAdminEditCards }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { isNepaliCalendar, toggleCalendarLanguage } = useSettings();
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleCalendarSwitchClick = () => {
        setShowConfirmation(true);
        setIsOpen(false); // Close the settings menu
    };

    const handleConfirmSwitch = () => {
        toggleCalendarLanguage();
        setShowConfirmation(false);
    };

    const handleCancelSwitch = () => {
        setShowConfirmation(false);
    };

    return (
    <div className="settings-root relative" ref={menuRef}>
            {/* User Info and Menu Button */}
            <div className="flex items-center space-x-4">
                <span className="logged-in text-gray-700">Logged in as: {user.email}</span>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-1.5 px-3 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md flex items-center space-x-2 text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    {/* Calendar Language Setting */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Calendar Language</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                                Current: {isNepaliCalendar ? 'नेपाली' : 'English'}
                            </span>
                            <button
                                onClick={handleCalendarSwitchClick}
                                className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                            >
                                Switch to {isNepaliCalendar ? 'English' : 'नेपाली'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            This affects date display and event grouping throughout the app
                        </p>
                    </div>

                    {/* Admin Options */}
                    {isAdmin && (
                        <div className="px-4 py-2 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    onAdminEditCards();
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-2 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Manage Home Cards</span>
                            </button>
                        </div>
                    )}

                    {/* Sign Out Option */}
                    <div className="px-4 py-2">
                        <button
                            onClick={() => {
                                onSignOut();
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <CalendarSwitchConfirmation
                isOpen={showConfirmation}
                onConfirm={handleConfirmSwitch}
                onCancel={handleCancelSwitch}
                currentLanguage={isNepaliCalendar ? 'nepali' : 'gregorian'}
                targetLanguage={isNepaliCalendar ? 'gregorian' : 'nepali'}
            />
        </div>
    );
};

export default SettingsMenu;