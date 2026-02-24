import React from 'react';

/**
 * Preview component for filtered trees in the delete confirmation modal.
 */
function FilteredTreesPreview({ trees, range, userType, userFilter }) {
  const days = parseInt(range, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString();
  let filtered = trees.filter(t => {
    if (!t.createdAt) return false;
    let createdAtIso = '';
    if (typeof t.createdAt === 'string') {
      createdAtIso = t.createdAt;
    } else if (t.createdAt && typeof t.createdAt.toDate === 'function') {
      createdAtIso = t.createdAt.toDate().toISOString();
    } else if (t.createdAt instanceof Date) {
      createdAtIso = t.createdAt.toISOString();
    }
    return createdAtIso > cutoffDate;
  });
  if (userType === 'email' && userFilter) {
    filtered = filtered.filter(t => t.ownerEmail === userFilter);
  } else if (userType === 'id' && userFilter) {
    filtered = filtered.filter(t => t.ownerUid === userFilter);
  }
  if (filtered.length === 0) return <div className="status-message info">No trees match the selected filter.</div>;
  return (
    <div style={{ maxHeight: 200, overflowY: 'auto', margin: '10px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Trees to be deleted ({filtered.length}):</div>
      <table className="data-table" style={{ fontSize: '0.95em' }}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Owner</th>
            <th>Created At</th>
            <th>Tree ID</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 20).map(t => (
            <tr key={t.id}>
              <td>{t.title || '(Untitled)'}</td>
              <td>{t.ownerEmail || t.ownerUid || ''}</td>
              <td>{(() => {
                if (!t.createdAt) return '';
                let iso = '';
                if (typeof t.createdAt === 'string') {
                  iso = t.createdAt;
                } else if (t.createdAt && typeof t.createdAt.toDate === 'function') {
                  iso = t.createdAt.toDate().toISOString();
                } else if (t.createdAt instanceof Date) {
                  iso = t.createdAt.toISOString();
                }
                return iso ? iso.slice(0, 19).replace('T', ' ') : '';
              })()}</td>
              <td style={{ fontSize: '0.85em', color: '#888' }}>{t.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 20 && <div style={{ fontSize: '0.9em', color: '#888', marginTop: 2 }}>Showing first 20 of {filtered.length} trees.</div>}
    </div>
  );
}

/**
 * Confirmation modal for bulk delete operations (tithis, events, trees, recent test data).
 */
export default function DeleteConfirmationModal({
  deleteConfirmation,
  setDeleteConfirmation,
  filteredTreesForModal,
  softDeletedTreesCount = 0,
  trees,
  onExecuteBulkDelete,
  onExecuteBulkDeleteTrees,
  onPerformDeleteTestData,
}) {
  if (!deleteConfirmation.show) return null;

  const close = () => setDeleteConfirmation({ show: false, type: '', count: 0, confirmText: '' });

  const getExpectedText = () => {
    if (deleteConfirmation.type === 'recent') return 'DELETE RECENT TEST DATA';
    if (deleteConfirmation.type === 'trees') return 'DELETE ALL TREES';
    return `DELETE ALL ${deleteConfirmation.type.toUpperCase()}`;
  };

  const expectedText = getExpectedText();
  const isConfirmed = deleteConfirmation.confirmText === expectedText;

  const handleExecute = () => {
    if (deleteConfirmation.type === 'recent') {
      onPerformDeleteTestData();
    } else if (deleteConfirmation.type === 'trees') {
      onExecuteBulkDeleteTrees();
    } else {
      onExecuteBulkDelete();
    }
  };

  const totalTreesToDelete = filteredTreesForModal.length + softDeletedTreesCount;

  const getButtonLabel = () => {
    if (deleteConfirmation.type === 'recent') return `Delete ${deleteConfirmation.count} Recent Test Records`;
    if (deleteConfirmation.type === 'trees') return `Delete All ${totalTreesToDelete} Trees`;
    return `Delete All ${deleteConfirmation.count} ${deleteConfirmation.type}`;
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-content" style={{ maxWidth: 800, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚠️ Confirm Bulk Delete</h3>
          <button onClick={close} className="modal-close nc-header-close" aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <div className="confirmation-warning">
            <div className="warning-icon">🚨</div>
            {deleteConfirmation.type === 'recent' ? (
              <>
                <p className="warning-text">
                  You are about to permanently delete <strong>{deleteConfirmation.count} recent test records</strong> created in the last 30 days.
                </p>
                <p className="warning-subtext">
                  This will delete <strong>{deleteConfirmation.details?.tithis || 0} Tithis</strong> and <strong>{deleteConfirmation.details?.events || 0} Events</strong>. A backup file will be automatically downloaded before deletion.
                </p>
              </>
            ) : (
              <>
                <p className="warning-text">
                  You are about to permanently delete <strong>{deleteConfirmation.type === 'trees' ? totalTreesToDelete : deleteConfirmation.count} {deleteConfirmation.type}</strong>.
                  {deleteConfirmation.type === 'trees' && softDeletedTreesCount > 0 && (
                    <span style={{ display: 'block', fontSize: '0.85em', color: '#d97706', marginTop: 4 }}>
                      ({filteredTreesForModal.length} matching filter + {softDeletedTreesCount} archived/pending purge)
                    </span>
                  )}
                </p>
                <p className="warning-subtext">
                  A backup file will be automatically downloaded before deletion.
                </p>
              </>
            )}
          </div>

          {/* Range / User filter options */}
          {(deleteConfirmation.type === 'recent' || deleteConfirmation.type === 'trees') && (
            <div className="form-group">
              <label>Delete Range</label>
              <select
                className="form-input"
                value={deleteConfirmation.range || '30'}
                onChange={e => setDeleteConfirmation(prev => ({ ...prev, range: e.target.value }))}
              >
                <option value="1">Last 1 day</option>
                <option value="2">Last 2 days</option>
                <option value="3">Last 3 days</option>
                <option value="4">Last 4 days</option>
                <option value="5">Last 5 days</option>
                <option value="6">Last 6 days</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          )}
          {(deleteConfirmation.type === 'recent' || deleteConfirmation.type === 'trees') && (
            <div className="form-group">
              <label>User Filter</label>
              <select
                className="form-input"
                value={deleteConfirmation.userType || 'all'}
                onChange={e => setDeleteConfirmation(prev => ({ ...prev, userType: e.target.value, userFilter: '' }))}
              >
                <option value="all">All Users</option>
                <option value="email">By Email</option>
                <option value="id">By User ID</option>
              </select>
              {(deleteConfirmation.userType === 'email' || deleteConfirmation.userType === 'id') && (
                <input
                  type="text"
                  className="form-input"
                  placeholder={deleteConfirmation.userType === 'email' ? 'Enter user email' : 'Enter user ID'}
                  value={deleteConfirmation.userFilter || ''}
                  onChange={e => setDeleteConfirmation(prev => ({ ...prev, userFilter: e.target.value }))}
                  style={{ marginTop: 4 }}
                />
              )}
            </div>
          )}

          {/* Filtered trees preview */}
          {deleteConfirmation.type === 'trees' && (
            <FilteredTreesPreview
              trees={trees}
              range={deleteConfirmation.range}
              userType={deleteConfirmation.userType}
              userFilter={deleteConfirmation.userFilter}
            />
          )}

          <label>
            Type <code>{expectedText}</code> to confirm:
          </label>
          <input
            type="text"
            value={deleteConfirmation.confirmText}
            onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, confirmText: e.target.value }))}
            className="form-input"
            placeholder={expectedText}
            autoFocus
          />
        </div>

        <div className="modal-footer">
          <button onClick={close} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleExecute}
            className="btn-danger"
            disabled={!isConfirmed}
          >
            {getButtonLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
