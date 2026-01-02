import React from 'react';
import { useNavigate } from 'react-router-dom';
import NepaliCalendarManagement from '../NepaliCalendarManagement';
import { useUserPermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../constants/roles';
import '../styles/AdminPages.css';

const AdminCalendarPage = ({ user, isAdmin, onBack }) => {
  const navigate = useNavigate();
  const { hasPermission, loading: permsLoading } = useUserPermissions(user);

  const handleBack = () => {
    navigate('/admin/management');
  };

  const canAccessCalendarManagement = isAdmin || hasPermission(PERMISSIONS.MANAGE_CALENDAR);

  if (permsLoading) {
    return (
      <div className="admin-page">
        <div className="loading-spinner">Loading permissions...</div>
      </div>
    );
  }

  if (!canAccessCalendarManagement) {
    return (
      <div className="admin-page">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>You don't have permission to manage the Nepali calendar.</p>
          <button onClick={handleBack} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Admin navigation tabs
  const navTabs = [
    { label: '📅 Tithis', path: '/admin/tithis', active: false },
    { label: '🎉 Events', path: '/admin/events', active: false },
    { label: '🗓️ Calendar', path: '/admin/calendar', active: true },
    { label: '🗂️ Data Management', path: '/admin/data-management', active: false }
  ];

  return (
    <div className="admin-page calendar-management-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-title">
            <h1>🗓️ Calendar Manager</h1>
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="admin-nav-tabs">
        {navTabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`admin-nav-tab ${tab.active ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        <NepaliCalendarManagement 
          hasPermission={hasPermission} 
          PERMISSIONS={PERMISSIONS}
        />
      </div>
    </div>
  );
};

export default AdminCalendarPage;
