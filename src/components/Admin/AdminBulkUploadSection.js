import React from 'react';
import { formatTime12Hour } from '../../utils/calendarHelpers';

/**
 * Bulk Upload section for Admin Management — handles file upload, validation,
 * preview, and publishing for both tithis and events tabs.
 * Pure render component — all state and handlers are passed via props.
 */
export default function AdminBulkUploadSection({
  activeTab,
  uploadFile,
  uploadStatus,
  validationResults,
  previewData,
  loading,
  fileInputRef,
  onDownloadTemplate,
  onExportData,
  onExportProblematicRows,
  onFileSelect,
  onFileDrop,
  onValidateFile,
  onPublish,
  onClearUpload,
}) {
  return (
    <div className="admin-section">
      <h2>📤 Bulk Upload</h2>

      <div className="template-actions">
        <button onClick={onDownloadTemplate} className="btn-primary">
          ⬇️ Download Template
        </button>
        <button onClick={onExportData} className="btn-secondary">
          📥 Export Existing Data
        </button>
      </div>

      <div
        className="file-upload-area"
        onDrop={onFileDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">📂</div>
        <p>{uploadFile ? uploadFile.name : 'Click or drag Excel file here'}</p>
        <small>Supported formats: .xlsx, .xls</small>
      </div>

      {uploadFile && (
        <div className="upload-actions">
          <button onClick={onValidateFile} disabled={loading} className="btn-primary">
            {loading ? '⏳ Validating...' : '✓ Validate File'}
          </button>
          <button onClick={onClearUpload} className="btn-secondary">
            ✕ Clear
          </button>
        </div>
      )}

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.includes('❌') ? 'error' : 'success'}`}>
          <pre>{uploadStatus}</pre>
        </div>
      )}

      {/* Validation Errors */}
      {validationResults && validationResults.invalid.length > 0 && (
        <div className="validation-errors">
          <h3>❌ Invalid Records ({validationResults.invalid.length})</h3>
          <div className="error-list">
            {validationResults.invalid.map((item, idx) => (
              <div key={idx} className="error-item">
                <strong>Row {item.row}:</strong>
                <ul>
                  {item.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Problematic Records */}
      {validationResults && validationResults.problematic && validationResults.problematic.length > 0 && (
        <div className="problematic-records">
          <h3>⚠️ Problematic Records ({validationResults.problematic.length})</h3>
          <p>
            These rows have an end time earlier than the start time on the same AD date.
            They are not auto-published — please review and fix or export for audit.
          </p>
          <div className="problematic-list">
            <table className="problematic-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Tithi</th>
                  <th>Pakshya</th>
                  <th>Start Date</th>
                  <th>Start Time</th>
                  <th>End Date</th>
                  <th>End Time</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.problematic.slice(0, 50).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.row}</td>
                    <td>{item.data?.['Tithi*'] || item.data?.['Tithi'] || ''}</td>
                    <td>{item.data?.['Pakshya*'] || item.data?.['Pakshya'] || ''}</td>
                    <td>{item.data?.['Start Date* (MM-DD-YYYY Nepali)'] || item.data?.['Start Date'] || ''}</td>
                    <td>{item.data?.['Start Time* (HH:MM)'] || item.data?.['Start Time'] || ''}</td>
                    <td>{item.data?.['End Date* (MM-DD-YYYY Nepali)'] || item.data?.['End Date'] || ''}</td>
                    <td>{item.data?.['End Time* (HH:MM)'] || item.data?.['End Time'] || ''}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validationResults.problematic.length > 50 && (
              <p className="preview-note">Showing first 50 of {validationResults.problematic.length} problematic rows</p>
            )}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <button onClick={onExportProblematicRows} className="btn-secondary">⬇️ Export Problematic Rows</button>
          </div>
        </div>
      )}

      {/* Preview Data */}
      {previewData.length > 0 && (
        <div className="preview-section">
          <h3>📋 Preview ({previewData.length} records)</h3>
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  {activeTab === 'tithis' ? (
                    <>
                      <th>Name</th>
                      <th>Start Date</th>
                      <th>Start Time</th>
                      <th>End Date</th>
                      <th>End Time</th>
                      <th>Status</th>
                    </>
                  ) : (
                    <>
                      <th>Title</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Public</th>
                      <th>Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((item, idx) => (
                  <tr key={idx}>
                    {activeTab === 'tithis' ? (
                      <>
                        <td>{item.name}</td>
                        <td>{item.startDate}</td>
                        <td>{formatTime12Hour(item.startTime)}</td>
                        <td>{item.endDate}</td>
                        <td>{formatTime12Hour(item.endTime)}</td>
                        <td>{item.addOrReplace === 'REPLACE' ? '🔄 Replace' : '✨ Add'}</td>
                      </>
                    ) : (
                      <>
                        <td>{item.title}</td>
                        <td>{item.dateKey}</td>
                        <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</td>
                        <td>{item.isPublic ? '✅' : '❌'}</td>
                        <td>{item.addOrReplace === 'REPLACE' ? '🔄 Replace' : '✨ Add'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 10 && (
              <p className="preview-note">Showing first 10 of {previewData.length} records</p>
            )}
          </div>
          <button onClick={onPublish} disabled={loading} className="btn-publish">
            {loading ? '⏳ Publishing...' : '🚀 Publish Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
