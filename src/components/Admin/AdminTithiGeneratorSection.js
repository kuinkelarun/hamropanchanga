import React from 'react';

/**
 * Tithi Auto Generator section — calculates tithis for a date range
 * and generates an Excel file for bulk upload.
 * Pure render component — all state and handlers passed via props.
 */
export default function AdminTithiGeneratorSection({
  autoStartDate,
  autoEndDate,
  autoProgress,
  autoStatus,
  loading,
  onStartDateChange,
  onEndDateChange,
  onGenerate,
  getNepaliDateDisplay,
}) {
  return (
    <div className="admin-section">
      <h2>⚡ Tithi Auto Generator</h2>
      <p>Automatically calculate Tithis for a date range and generate Excel file for bulk upload.</p>
      <p className="text-sm text-gray-600 mt-1">
        <strong>Note:</strong> Calculations use <strong>Kathmandu, Nepal</strong> coordinates (27.7172° N, 85.3240° E) for astronomical accuracy.
      </p>

      <div className="auto-management-form">
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-input"
                value={autoStartDate}
                onChange={onStartDateChange}
              />
              {autoStartDate && (
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {getNepaliDateDisplay(autoStartDate)}
                </div>
              )}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-input"
                value={autoEndDate}
                onChange={onEndDateChange}
              />
              {autoEndDate && (
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {getNepaliDateDisplay(autoEndDate)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          onClick={onGenerate}
          className="btn-primary"
          disabled={loading || !autoStartDate || !autoEndDate || (autoProgress > 0 && autoProgress < 100)}
        >
          {autoProgress === 100 ? '✅ Complete' : autoProgress > 0 ? '🔄 Generating...' : '📊 Generate Tithi Excel'}
        </button>
        {autoProgress > 0 && autoProgress < 100 && (
          <div className="progress-indicator">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${autoProgress}%` }} />
            </div>
            <span className="progress-text">{autoProgress}% Complete</span>
          </div>
        )}
        {autoProgress === 100 && (
          <div className="progress-indicator complete">
            <span className="progress-text">🎉 Generation Complete!</span>
          </div>
        )}
      </div>

      {autoStatus && (
        <div className={`status-message ${autoStatus.startsWith('❌') ? 'error' : autoStatus.startsWith('✅') ? 'success' : 'info'}`}>
          {autoStatus}
        </div>
      )}
    </div>
  );
}
