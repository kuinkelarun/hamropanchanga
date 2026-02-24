import React from 'react';

/**
 * Trees tab content for Admin Management.
 * Displays a read-only table of all trees with an Excel export button.
 */
export default function AdminTreesTab({ trees, loading, onDownloadExcel, uploadStatus }) {
  return (
    <div className="admin-section">
      <h2>🌳 Trees</h2>
      <p className="section-description">View and export Trees from all users. Use the download button to export the table to Excel.</p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={onDownloadExcel} className="btn-primary" disabled={loading || !trees || trees.length === 0}>
          📥 Download Trees (Excel)
        </button>
        <span style={{ marginLeft: 12, color: '#6b7280' }}>{trees.length} trees loaded</span>
      </div>

      <div className="preview-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tree Name *</th>
              <th>Primary Member Name *</th>
              <th>Contact Information *</th>
              <th>Location *</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {(trees || []).slice(0, 500).map(tr => (
              <tr key={tr.id}>
                <td>{tr.title || ''}</td>
                <td>{tr.primaryMemberName || ''}</td>
                <td>{tr.contactInfo || tr.contact || ''}</td>
                <td>{tr.location || ''}</td>
                <td>{tr.ownerEmail || tr.ownerUid || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trees.length > 500 && <div style={{ marginTop: 6, color: '#6b7280' }}>Showing first 500 of {trees.length} trees.</div>}
      </div>
    </div>
  );
}
