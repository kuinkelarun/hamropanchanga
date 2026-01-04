import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import CalendarSwitchConfirmation from './CalendarSwitchConfirmation';
import { useUserPermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../constants/roles';

const SettingsMenu = ({ 
    user, 
    onSignOut, 
    isAdmin, 
    onAdminEditCards, 
    onAdminManagement, 
    onUserManagement 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { isNepaliCalendar, toggleCalendarLanguage, isEditMode, toggleEditMode } = useSettings();
    const menuRef = useRef(null);

    // Get user permissions
    const { hasPermission, isSuperUser } = useUserPermissions(user);
    
    // User has admin capabilities if they're an admin OR a super user with certain permissions
    const canManageHomeCards = hasPermission(PERMISSIONS.MANAGE_HOME_CARDS);
    const canAccessBulkUpload = hasPermission(PERMISSIONS.BULK_UPLOAD);
    const canManageTithis = hasPermission(PERMISSIONS.MANAGE_TITHIS);
    const canManageEvents = hasPermission(PERMISSIONS.MANAGE_EVENTS);
    const canManageCalendar = hasPermission(PERMISSIONS.MANAGE_CALENDAR);
    const canEditCalendar = isAdmin || isSuperUser || canManageTithis || canManageEvents;
    
    const showAdminSection = isAdmin || isSuperUser || canManageHomeCards || canAccessBulkUpload || canManageTithis || canManageEvents || canManageCalendar;

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

    // Calculate user initials
    const getInitials = () => {
        if (!user) return '?';
        if (user.displayName) {
            const names = user.displayName.split(' ');
            if (names.length >= 2) {
                return (names[0][0] + names[names.length - 1][0]).toUpperCase();
            }
            return names[0].substring(0, 2).toUpperCase();
        }
        return user.email ? user.email.substring(0, 2).toUpperCase() : '?';
    };

    return (
    <div className="settings-root relative" ref={menuRef}>
            {/* Menu Button - Profile Circle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-full hover:bg-gray-100 transition-all duration-200 group p-1"
                title="User Profile & Settings"
            >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-md group-hover:shadow-lg transition-all transform group-hover:scale-105 border-2 border-white">
                    <span className="font-bold text-sm tracking-wide">{getInitials()}</span>
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Logged in as</p>
                        <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                    </div>

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

                    {/* Admin/Super User Options */}
                    {showAdminSection && (
                        <div className="px-4 py-2 border-t border-gray-100">
                            {canManageHomeCards && (
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
                            )}

                            {canAccessBulkUpload && (
                                <button
                                    onClick={() => {
                                        onAdminManagement();
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-2 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center space-x-2 mt-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Admin Management</span>
                                </button>
                            )}

                            {/* User Management now a top-level settings item (not nested under Admin Management) */}
                            {(isAdmin || hasPermission(PERMISSIONS.MANAGE_USERS)) && (
                                <button
                                    onClick={() => {
                                        if (onUserManagement) onUserManagement();
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-2 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center space-x-2 mt-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-3-3h-2" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20H4v-2a3 3 0 013-3h2" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10a4 4 0 108 0 4 4 0 00-8 0z" />
                                    </svg>
                                    <span>User Management</span>
                                </button>
                            )}
                            
                            {/* Edit Mode Toggle - show for users who can edit calendar */}
                            {canEditCalendar && (
                                <div className="mt-2 px-2 py-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                            <span className="text-sm text-gray-700">Edit Mode</span>
                                        </div>
                                        <button
                                            onClick={toggleEditMode}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                isEditMode ? 'bg-orange-600' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    isEditMode ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {isEditMode ? 'Edit calendar tithis and events' : 'Enable to edit tithis'}
                                    </p>
                                </div>
                            )}
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