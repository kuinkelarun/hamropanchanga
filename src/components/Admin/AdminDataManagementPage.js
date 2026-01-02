import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminPages.css';

const AdminDataManagementPage = ({ user, isAdmin, onBack }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/admin/management');
  };

  // Admin navigation tabs
  const navTabs = [
    { label: '📅 Tithis', path: '/admin/tithis', active: false },
    { label: '🎉 Events', path: '/admin/events', active: false },
    { label: '🗓️ Calendar', path: '/admin/calendar', active: false },
    { label: '🗂️ Data Management', path: '/admin/data-management', active: true }
  ];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-title">
            <h1>🗂️ Data Management</h1>
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
        <p className="coming-soon">Data management features will be displayed here.</p>
        <p className="info-text">This page is dedicated to data cleanup, validation, and management.</p>
      </div>
    </div>
  );
};

export default AdminDataManagementPage;
