import React from 'react';
import { formatTime12Hour } from '../../utils/adminUtils';

/**
 * Data Management & Cleanup tab for Admin Management.
 * Shows stats cards, danger zone delete buttons, and scan anomalies section.
 */
export default function AdminDataManagementTab({
  tithis,
  events,
  trees,
  softDeletedTreesCount = 0,
  loading,
  scanning,
  scanResults,
  recentCount,
  onBulkDelete,
  onBulkDeleteTrees,
  onRequestDeleteTestData,
  onScanTithis,
  onFixTithiSwap,
}) {
  return (
    <div className="admin-section data-management-section">
      <h2>🗂️ Data Management & Cleanup</h2>
      <p className="section-description">
        Manage and clean up your data before going to production. All bulk delete operations create automatic backups.
      </p>

      {/* Stats Cards */}
      <div className="data-stats">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-label">Total Tithis</div>
            <div className="stat-value">{tithis.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎉</div>
          <div className="stat-content">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{events.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🌳</div>
          <div className="stat-content">
            <div className="stat-label">Total Trees</div>
            <div className="stat-value">{trees.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🕒</div>
          <div className="stat-content">
            <div className="stat-label">Recent (30 days)</div>
            <div className="stat-value">
              {tithis.filter(t => t.createdAt && t.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length +
               events.filter(e => e.createdAt && e.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length +
               trees.filter(tr => tr.createdAt && tr.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).length}
            </div>
          </div>
        </div>
      </div>

      {/* Delete All Trees */}
      <div className="danger-action-card">
        <div className="danger-action-info">
          <h4>🗑️ Delete All Trees</h4>
          <p>Remove all trees and all associated members, relationships, marriage points, and events. A backup file will be downloaded automatically.</p>
          {softDeletedTreesCount > 0 && trees.length === 0 && (
            <p style={{ color: '#e67e22', fontSize: '0.85em', marginTop: '4px' }}>
              ⚠️ {softDeletedTreesCount} archived (soft-deleted) tree{softDeletedTreesCount !== 1 ? 's' : ''} pending purge.
            </p>
          )}
        </div>
        <button
          onClick={onBulkDeleteTrees}
          className="btn-danger"
          disabled={loading || (trees.length === 0 && softDeletedTreesCount === 0)}
        >
          Delete All Trees
        </button>
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <h3>⚠️ Danger Zone</h3>
        <p className="danger-description">
          These actions are irreversible. A backup will be automatically downloaded before deletion.
        </p>

        <div className="danger-actions">
          <div className="danger-action-card">
            <div className="danger-action-info">
              <h4>🗑️ Delete All Tithis</h4>
              <p>Remove all {tithis.length} Tithis from the database. A backup file will be downloaded automatically.</p>
            </div>
            <button
              onClick={() => onBulkDelete('tithis')}
              className="btn-danger"
              disabled={loading || tithis.length === 0}
            >
              Delete All Tithis
            </button>
          </div>

          <div className="danger-action-card">
            <div className="danger-action-info">
              <h4>🗑️ Delete All Events</h4>
              <p>Remove all {events.length} Events from the database. A backup file will be downloaded automatically.</p>
            </div>
            <button
              onClick={() => onBulkDelete('events')}
              className="btn-danger"
              disabled={loading || events.length === 0}
            >
              Delete All Events
            </button>
          </div>

          <div className="danger-action-card">
            <div className="danger-action-info">
              <h4>🧹 Delete Test Data</h4>
              <p>Remove all Tithis and Events created in the last 30 days. Useful for cleaning up test entries.</p>
            </div>
            <button
              onClick={onRequestDeleteTestData}
              className="btn-warning"
              disabled={loading || recentCount === 0}
              title={recentCount === 0 ? 'No recent data found (last 30 days)' : 'Delete recent test data'}
            >
              Delete Recent Test Data
            </button>
          </div>
        </div>

        {/* Scan Anomalies */}
        <div className="admin-section scan-anomalies-section" style={{ marginTop: '1rem' }}>
          <h3>🔎 Scan Tithi Boundary Anomalies</h3>
          <p>Detect tithis where the recorded end is earlier than the start. Only visible to admins.</p>
          <div style={{ marginBottom: '0.5rem' }}>
            <button
              onClick={onScanTithis}
              className="btn-secondary"
              disabled={scanning || loading}
            >
              {scanning ? 'Scanning…' : 'Scan Tithis for Boundary Anomalies'}
            </button>
          </div>

          {scanning && <div className="status-message info">Scanning all tithis. This may take a moment...</div>}

          {scanResults && scanResults.length > 0 && (
            <div className="scan-results" style={{ marginTop: '1rem' }}>
              <h4>Found {scanResults.length} anomalies</h4>
              <div className="preview-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>DocId</th>
                      <th>Name</th>
                      <th>Start (ISO / displayed)</th>
                      <th>End (ISO / displayed)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.map(r => (
                      <tr key={r.docId}>
                        <td><code style={{ whiteSpace: 'nowrap' }}>{r.docId}</code></td>
                        <td>{r.name}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.startIso}<br />{r.startDate} {r.startTime}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.endIso}<br />{r.endDate} {r.endTime}</td>
                        <td>
                          <button onClick={() => onFixTithiSwap(r.docId)} className="btn-primary">Swap Start/End</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {scanResults && scanResults.length === 0 && !scanning && (
            <div className="status-message success">No anomalies found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
