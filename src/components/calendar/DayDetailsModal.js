import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { convertAdToBs } from '../../utils/nepaliDateUtils';
import { compareTithisByStart, formatTithiForDisplay } from '../../utils/calendarHelpers';
import { NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS } from '../../constants/calendarConstants';
import { PERMISSIONS } from '../../constants/roles';

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
  permsLoading,
  hasPermission,
  onOpenAddEvent,
  onOpenAddTithi,
  onDeleteEvent,
  onTreeEventClick,
    trees = [],
  getTithiDisplayName,
  formatTithiDateTime,
  getTreeMemberName,
  getResolvedTithiEventDate,
}) => {
  const { t, tn, isNepali } = useLanguage();
  const navigate = useNavigate();

  if (!isOpen) return null;

  // Parse date parts
  const [adYear, adMonth1, adDay] = activeDate ? activeDate.split('-').map(Number) : [0, 0, 0];
  const bs = activeDate ? convertAdToBs(adYear, adMonth1 - 1, adDay) : null;

  const headerDateNepali = bs
    ? (isNepali
        ? `${tn(bs.day)} ${NEPALI_MONTHS[bs.month - 1]} ${tn(bs.year)}`
        : `${bs.day} ${ENGLISH_NEPALI_MONTHS[bs.month - 1]} ${bs.year}`)
    : '';

  // English date for subtitle
  const adDateObj = activeDate ? new Date(adYear, adMonth1 - 1, adDay) : null;
  const headerDateEnglish = adDateObj
    ? adDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const sortedTithis = [...tithis].sort(compareTithisByStart);

  return (
    <div className="nc-modal-backdrop" onClick={onClose}>
      <div
        className="nc-modal ddm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        {/* ---- Header ---- */}
        <div className="ddm-header">
          <div className="ddm-header-date">
            <span className="ddm-header-nepali">{headerDateNepali}</span>
            <span className="ddm-header-english">{headerDateEnglish}</span>
          </div>
          <button className="ddm-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ---- Body ---- */}
        <div className="nc-modal-body">

          {/* ---- Tithis Section ---- */}
          <div className="ddm-section">
            <div className="ddm-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              <h4>{t('calendar.tithis')}</h4>
              <span className="ddm-badge">{tithis.length}</span>
            </div>
            {sortedTithis.length === 0 ? (
              <div className="ddm-empty">
                {isNepali ? 'यस मितिको तिथि चाँडै थपिनेछ' : 'Tithis will be added soon for this date'}
              </div>
            ) : (
              <div className="ddm-items">
                {sortedTithis.map((ti) => (
                  <div key={ti.id} className="ddm-item ddm-item-tithi">
                    <div className="ddm-item-icon-dot ddm-dot-amber" />
                    <div className="ddm-item-content">
                      <div className="ddm-item-title">{getTithiDisplayName(ti)}</div>
                      <div className="ddm-item-meta">{formatTithiDateTime(ti)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- Public Events Section ---- */}
          <div className="ddm-section">
            <div className="ddm-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <h4>{t('calendar.publicEvents')}</h4>
              <span className="ddm-badge">{publicEvents.length}</span>
            </div>
            {publicEvents.length === 0 ? (
              <div className="ddm-empty">
                {isNepali ? 'यस मितिमा सार्वजनिक कार्यक्रम छैन' : 'No public events for this date'}
              </div>
            ) : (
              <div className="ddm-items">
                {publicEvents.map((event) => (
                  <div key={event.id} className="ddm-item ddm-item-public">
                    <div className="ddm-item-icon-dot ddm-dot-blue" />
                    <div className="ddm-item-content">
                      <div className="ddm-item-title">
                        {event.title}
                      </div>
                      {event.description && (
                        <div className="ddm-item-meta">{event.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- Private Events Section ---- */}
          <div className="ddm-section">
            <div className="ddm-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h4>{t('calendar.privateEvents')}</h4>
              <span className="ddm-badge">{personalEvents.length}</span>
            </div>
            {personalEvents.length === 0 ? (
              <div className="ddm-empty">
                {user
                  ? (isNepali ? 'यस मितिमा निजी कार्यक्रम छैन' : 'No private events for this date')
                  : (isNepali ? 'निजी कार्यक्रम हेर्न साइन इन गर्नुहोस्' : 'Sign in to view private events')
                }
              </div>
            ) : (
              <div className="ddm-items">
                {personalEvents.map((event) => {
                  const memberName = getTreeMemberName(event.treeId, event.memberId);
                  const isTreeEvent = !!event.treeId;
                    const treeInfo = isTreeEvent ? trees.find(t => t.id === event.treeId) : null;
                    const treeName = treeInfo ? (treeInfo.name || treeInfo.title || '') : '';
                    const treeLocation = treeInfo ? (treeInfo.location || '') : '';

                    let tithiDisplay = '';
                  if (event.tithi) {
                    tithiDisplay = formatTithiForDisplay(event.tithi, isNepali);
                  }

                  return (
                    <div
                      key={event.id}
                      className={`ddm-item ddm-item-private ${isTreeEvent ? 'ddm-item-tree' : ''}`}
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
                      style={{ cursor: isTreeEvent && onTreeEventClick ? 'pointer' : 'default' }}
                    >
                      <div className={`ddm-item-icon-dot ${isTreeEvent ? 'ddm-dot-purple' : 'ddm-dot-emerald'}`} />
                      <div className="ddm-item-content">
                          <div className="ddm-item-title">
                            {event.title}{memberName ? ` (${memberName})` : ''}
                          </div>
                          {tithiDisplay && (
                            <div className="ddm-tithi-tag">{tithiDisplay}</div>
                          )}
                          {(treeName || treeLocation) && (
                            <div className="ddm-item-tree-info">
                              {treeName}{treeLocation ? ` | ${treeLocation}` : ''}
                            </div>
                          )}
                        {event.description && (
                          <div className="ddm-item-meta">{event.description}</div>
                        )}
                      </div>
                      {!isTreeEvent && (
                        <button
                          className="ddm-delete-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(isNepali ? 'के तपाईं यो कार्यक्रम मेटाउन निश्चित हुनुहुन्छ?' : 'Are you sure you want to delete this event?')) {
                              await onDeleteEvent(event.id);
                            }
                          }}
                          title={isNepali ? 'मेटाउनुहोस्' : 'Delete Event'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---- Footer Actions ---- */}
        <div className="ddm-footer">
          {!user && (
            <button
              className="ddm-btn ddm-btn-primary"
              onClick={() => navigate('/login')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              {isNepali ? 'साइन इन गर्नुहोस्' : 'Sign In to Add Events'}
            </button>
          )}

          {user && (
            <button
              className="ddm-btn ddm-btn-primary"
              onClick={() => {
                if (!activeDate) return;
                onOpenAddEvent(adYear, adMonth1 - 1, adDay);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
              {isNepali ? 'कार्यक्रम थप्नुहोस्' : 'Add Event'}
            </button>
          )}

          {(isAdmin || (isSuperUser && !permsLoading && hasPermission(PERMISSIONS.MANAGE_TITHIS))) && (
            <button
              className="ddm-btn ddm-btn-secondary"
              onClick={() => {
                if (!activeDate) return;
                onOpenAddTithi(adYear, adMonth1 - 1, adDay, 'tithi');
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              {isNepali ? 'तिथि थप्नुहोस्' : 'Add Tithi'}
            </button>
          )}

          <button className="ddm-btn ddm-btn-ghost" onClick={onClose}>
            {t('calendar.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayDetailsModal;
