import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { convertAdToBs } from '../../utils/nepaliDateUtils';
import { formatAdDateToNepaliStringWithNumerals } from '../../utils/nepaliDateUtils';
import { compareTithisByStart, toNepaliNumber } from '../../utils/calendarHelpers';
import { NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS } from '../../constants/calendarConstants';
import { signInWithGoogle } from '../../firebase';
import { PERMISSIONS } from '../../constants/roles';

/**
 * DayDetailsModal — shows existing tithis, public events, and private events
 * for a selected day on the calendar.
 *
 * Props:
 *   isOpen               — boolean, whether the modal is visible
 *   onClose              — () => void
 *   activeDate           — 'YYYY-MM-DD' string or null
 *   tithis               — sorted array of tithis for the day
 *   publicEvents         — array of public calendar events
 *   personalEvents       — array of the current user's private events
 *   user                 — Firebase auth user object or null
 *   isAdmin              — boolean
 *   isSuperUser          — boolean
 *   isEditMode           — boolean (settings toggle)
 *   permsLoading         — boolean
 *   hasPermission        — (permKey) => boolean
 *   onOpenAddEvent       — (adYear, adMonth0, adDay) => void
 *   onOpenAddTithi       — (adYear, adMonth0, adDay, focusHint) => void
 *   onDeleteEvent        — async (eventId) => void
 *   onTreeEventClick     — (eventData) => void | undefined
 *   getTithiDisplayName  — (tithi) => string
 *   formatTithiDateTime  — (tithi) => string
 *   getTreeMemberName    — (treeId, memberId) => string|null
 *   getResolvedTithiEventDate — (event) => string
 */
const DayDetailsModal = ({
  isOpen,
  onClose,
  activeDate,
  tithis,
  publicEvents,
  personalEvents,
  user,
  isAdmin,
  isSuperUser,
  isEditMode,
  permsLoading,
  hasPermission,
  onOpenAddEvent,
  onOpenAddTithi,
  onDeleteEvent,
  onTreeEventClick,
  getTithiDisplayName,
  formatTithiDateTime,
  getTreeMemberName,
  getResolvedTithiEventDate,
}) => {
  const { t, tn, isNepali } = useLanguage();

  if (!isOpen) return null;

  // Compute header date string
  const headerText = (() => {
    if (!activeDate) return '';
    const [year, month, day] = activeDate.split('-').map(Number);
    const bs = convertAdToBs(year, month - 1, day);
    const monthIndex = bs.month - 1;
    const monthName = isNepali ? NEPALI_MONTHS[monthIndex] : ENGLISH_NEPALI_MONTHS[monthIndex];
    return isNepali
      ? `${tn(bs.day)} ${monthName} ${tn(bs.year)}`
      : `${bs.day} ${monthName} ${bs.year}`;
  })();

  return (
    <div className="nc-modal-backdrop" onClick={onClose}>
      <div className="nc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="nc-modal-header">
          <h3 className="nc-modal-title" style={{ fontSize: '0.95rem', color: '#666' }}>
            {headerText}
          </h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="nc-modal-body">
          {/* Tithis Section */}
          <div className="nc-modal-section">
            <h4>{t('calendar.tithis')}</h4>
            {tithis.length === 0 && (
              <div className="muted">✨ Tithis will be added soon for this date</div>
            )}
            {[...tithis].sort(compareTithisByStart).map((ti) => (
              <div key={ti.id} className="nc-item">
                <div>
                  <div className="nc-item-title">{getTithiDisplayName(ti)}</div>
                  <div className="muted">{formatTithiDateTime(ti)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Public Events Section */}
          <div className="nc-modal-section" style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <h4>{t('calendar.publicEvents')}</h4>
            {publicEvents.length === 0 && (
              <div className="muted">No public events for this date</div>
            )}
            {publicEvents.map((event) => (
              <div
                key={event.id}
                className="nc-item"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}
              >
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="nc-item-title">
                      {event.title}
                      {event.createdByAdmin && (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.375rem',
                            background: '#fbbf24',
                            color: '#78350f',
                            borderRadius: '0.25rem',
                            fontWeight: '600',
                          }}
                        >
                          Admin
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <div className="muted" style={{ marginTop: '0.25rem' }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Private Events Section */}
          <div className="nc-modal-section" style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {t('calendar.privateEvents')}
            </h4>
            {personalEvents.length === 0 && (
              <div className="muted">No private events for this date</div>
            )}
            {personalEvents.map((event) => {
              const memberName = getTreeMemberName(event.treeId, event.memberId);
              const isTreeEvent = !!event.treeId;

              let displayDateKey = event.dateKey;
              if (event.tithi) {
                displayDateKey = activeDate;
              } else if (event.repetition === 'yearly') {
                displayDateKey = getResolvedTithiEventDate(event);
              }

              const eventNepaliDate = displayDateKey
                ? formatAdDateToNepaliStringWithNumerals(displayDateKey)
                : '';

              let tithiDisplay = '';
              if (event.tithi) {
                let pakshaDisplay = event.tithi.paksha;
                if (pakshaDisplay === 'Shukla' || pakshaDisplay === 'शुक्ल') {
                  pakshaDisplay = 'शुक्लपक्ष';
                } else if (pakshaDisplay === 'Krishna' || pakshaDisplay === 'कृष्ण') {
                  pakshaDisplay = 'कृष्णपक्ष';
                }
                tithiDisplay = ` (${event.tithi.month} ${pakshaDisplay} ${event.tithi.name})`;
              }

              return (
                <div
                  key={event.id}
                  className="nc-item"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    cursor: isTreeEvent && onTreeEventClick ? 'pointer' : 'default',
                  }}
                  onDoubleClick={() => {
                    if (isTreeEvent && onTreeEventClick) {
                      onTreeEventClick({
                        ...event,
                        name: event.title,
                        date: event.dateKey,
                        personId: event.memberId,
                      });
                      onClose();
                    }
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="nc-item-title">{event.title}</div>
                      {memberName && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#7c3aed', fontWeight: '500' }}>
                          For: {memberName}
                        </div>
                      )}
                      {displayDateKey && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                          📅 {displayDateKey}
                          {eventNepaliDate && (
                            <div style={{ color: '#7c3aed', marginTop: '0.25rem', fontWeight: '500' }}>
                              🗓️ {eventNepaliDate}
                              {tithiDisplay}
                            </div>
                          )}
                        </div>
                      )}
                      {event.description && (
                        <div className="muted" style={{ marginTop: '0.25rem' }}>
                          {event.description}
                        </div>
                      )}
                    </div>
                    {!isTreeEvent && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this event?')) {
                            await onDeleteEvent(event.id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.1rem',
                          padding: '0 0 0 8px',
                          opacity: 0.7,
                        }}
                        title="Delete Event"
                        onMouseOver={(e) => (e.target.style.opacity = 1)}
                        onMouseOut={(e) => (e.target.style.opacity = 0.7)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Actions */}
          <div className="nc-modal-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="app-cancel-btn"
              onClick={onClose}
              style={{ flex: '1 1 auto' }}
            >
              {t('calendar.cancel') || 'Cancel'}
            </button>

            {/* For Guests: Show "Login to Add Events" button */}
            {!user && (
              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (err) {
                    console.error('Login error:', err);
                  }
                }}
                className="app-save-btn"
                style={{ flex: '1 1 auto' }}
              >
                Login to Add Events
              </button>
            )}

            {/* For Logged-in Users: Show "Add Event" button */}
            {user && (
              <button
                onClick={() => {
                  if (!activeDate) return;
                  const parts = activeDate.split('-').map(Number);
                  onOpenAddEvent(parts[0], parts[1] - 1, parts[2]);
                }}
                className="app-save-btn"
                style={{ flex: '1 1 auto' }}
              >
                Add Event
              </button>
            )}

            {/* For Admins and Super Users with tithi permission: Show "Add Tithi" when in edit mode */}
            {(isAdmin || (isSuperUser && !permsLoading && hasPermission(PERMISSIONS.MANAGE_TITHIS))) &&
              isEditMode && (
                <button
                  onClick={() => {
                    if (!activeDate) return;
                    const parts = activeDate.split('-').map(Number);
                    onOpenAddTithi(parts[0], parts[1] - 1, parts[2], 'tithi');
                  }}
                  className="app-save-btn"
                  style={{ flex: '1 1 auto' }}
                >
                  Add Tithi
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayDetailsModal;
