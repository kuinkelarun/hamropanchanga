import React, { useState, useEffect, useRef } from 'react';
import CalendarSideWidget from './CalendarSideWidget';
import DayDetailsContent from './DayDetailsContent';
import AddEventContent from './AddEventContent';
import AddTithiContent from './AddTithiContent';
import './CalendarDayView.css';

/**
 * CalendarDayView
 * Desktop full-page split-pane: mini-calendar on left, day content on right.
 *
 * Props:
 *   isOpen            — boolean
 *   onClose           — () => void
 *   initialPanel      — 'details' | 'addEvent' | 'addTithi'
 *   activeDate        — AD date string "YYYY-MM-DD"
 *   onDateChange      — (newAdDateString) => void
 *   tithis            — array
 *   publicEvents      — array
 *   personalEvents    — array
 *   user              — Firebase user or null
 *   isAdmin           — boolean
 *   isSuperUser       — boolean
 *   permsLoading      — boolean
 *   hasPermission     — function
 *   trees             — array
 *   onDeleteEvent     — function
 *   onTreeEventClick  — function
 *   getTithiDisplayName   — function
 *   formatTithiDateTime   — function
 *   getTreeMemberName     — function
 *   onAddTithi        — function
 *   authLoading       — boolean
 *   findTithisForAdDate   — function
 *   eventsData        — { [adDateKey]: { hasPublic?, hasPrivate?, hasTithi? } }
 */
export default function CalendarDayView({
  isOpen,
  onClose,
  initialPanel = 'details',
  activeDate,
  onDateChange,
  tithis = [],
  publicEvents = [],
  personalEvents = [],
  user,
  isAdmin,
  isSuperUser,
  permsLoading,
  hasPermission,
  trees = [],
  onDeleteEvent,
  onTreeEventClick,
  getTithiDisplayName,
  formatTithiDateTime,
  getTreeMemberName,
  onAddTithi,
  authLoading,
  findTithisForAdDate,
  eventsData = {},
}) {
  const [panel, setPanel] = useState(initialPanel || 'details');
  const [animating, setAnimating] = useState(false);

  // Swipe-to-dismiss (touch devices — phones & tablets)
  const cdvContainerRef = useRef(null);
  const cdvRightRef = useRef(null);
  const dismissTimerRef = useRef(null);
  // Drag state in refs — no re-renders during gesture
  const dragStartY = useRef(0);
  const isDragging = useRef(false);

  // Non-passive touchmove listener so e.preventDefault() blocks pull-to-refresh
  // and background scroll. React synthetic onTouchMove is passive by default.
  useEffect(() => {
    const panel = cdvRightRef.current;
    const container = cdvContainerRef.current;
    if (!panel || !container || !isOpen) return;

    const handleTouchStart = (e) => {
      const scrollTop = panel.scrollTop ?? 0;
      if (scrollTop > 0) return;
      dragStartY.current = e.touches[0].clientY;
      isDragging.current = true;
      container.style.transition = 'none';
    };

    const handleTouchMove = (e) => {
      if (!isDragging.current) return;
      const delta = Math.max(0, e.touches[0].clientY - dragStartY.current);
      e.preventDefault();
      container.style.transform = `translateY(${delta}px)`;
      container.style.opacity = String(Math.max(0.5, 1 - delta / 300));
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const m = (container.style.transform || '').match(/translateY\((\d+(?:\.\d+)?)px\)/);
      const delta = m ? parseFloat(m[1]) : 0;
      container.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      if (delta > 80) {
        container.style.transform = 'translateY(100%)';
        container.style.opacity = '0';
        dismissTimerRef.current = setTimeout(() => onClose(), 260);
      } else {
        container.style.transform = 'translateY(0)';
        container.style.opacity = '1';
      }
    };

    panel.addEventListener('touchstart', handleTouchStart, { passive: true });
    panel.addEventListener('touchmove', handleTouchMove, { passive: false });
    panel.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      panel.removeEventListener('touchstart', handleTouchStart);
      panel.removeEventListener('touchmove', handleTouchMove);
      panel.removeEventListener('touchend', handleTouchEnd);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [isOpen, onClose]);

  // Sync panel when initialPanel or activeDate changes from outside
  useEffect(() => {
    setPanel(initialPanel || 'details');
  }, [initialPanel, activeDate]);

  // Lock body scroll while overlay is open (same pattern as BottomSheet)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  function switchPanel(newPanel) {
    setAnimating(true);
    setTimeout(() => {
      setPanel(newPanel);
      setAnimating(false);
    }, 150);
  }

  function handleSideWidgetDateChange(newDate) {
    onDateChange(newDate);
    setPanel('details');
  }

  function handleOpenAddEvent(adYear, adMonthZeroBased, adDay) {
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    onDateChange(key);
    switchPanel('addEvent');
  }

  function handleOpenAddTithi(adYear, adMonthZeroBased, adDay, focusHint) {
    const key = `${adYear}-${String(adMonthZeroBased + 1).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
    onDateChange(key);
    switchPanel('addTithi');
  }

  if (!isOpen) return null;

  return (
    <div
      className="cdv-container"
      ref={cdvContainerRef}
    >
      {/* ── Left: mini calendar (hidden on small screens) ── */}
      <div className="cdv-left">
        <CalendarSideWidget
          selectedDate={activeDate}
          onDateChange={handleSideWidgetDateChange}
          eventsData={eventsData}
        />
      </div>

      <div className="cdv-divider" />

      {/* ── Right: animated panel ───────────────────────────────────────────── */}
      <div
        className={`cdv-right${animating ? ' cdv-animating' : ''}`}
        ref={cdvRightRef}
      >
        {panel === 'details' && (
          <DayDetailsContent
            activeDate={activeDate}
            tithis={tithis}
            publicEvents={publicEvents}
            personalEvents={personalEvents}
            user={user}
            isAdmin={isAdmin}
            isSuperUser={isSuperUser}
            permsLoading={permsLoading}
            hasPermission={hasPermission}
            onOpenAddEvent={handleOpenAddEvent}
            onOpenAddTithi={handleOpenAddTithi}
            onDeleteEvent={onDeleteEvent}
            onTreeEventClick={onTreeEventClick}
            trees={trees}
            getTithiDisplayName={getTithiDisplayName}
            formatTithiDateTime={formatTithiDateTime}
            getTreeMemberName={getTreeMemberName}
            onClose={onClose}
          />
        )}

        {panel === 'addEvent' && (
          <AddEventContent
            isOpen={panel === 'addEvent'}
            onClose={() => switchPanel('details')}
            activeDate={activeDate}
            user={user}
            authLoading={authLoading}
            isAdmin={isAdmin}
            isSuperUser={isSuperUser}
            findTithisForAdDate={findTithisForAdDate}
          />
        )}

        {panel === 'addTithi' && (
          <AddTithiContent
            isOpen={panel === 'addTithi'}
            onClose={() => switchPanel('details')}
            activeDate={activeDate}
            user={user}
            authLoading={authLoading}
            onAddTithi={onAddTithi}
          />
        )}
      </div>
    </div>
  );
}
