import React, { useState, useMemo, useEffect } from 'react';
import {
  convertAdToBs,
  convertBsToAd,
  getNepalDate,
  toNepaliNumber,
  getActiveCalendarData,
  minBsYear,
  maxBsYear,
} from '../../utils/nepaliDateUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS } from '../../constants/calendarConstants';
import './CalendarSideWidget.css';

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_NE = ['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श'];
const YEAR_PAGE_SIZE = 12;

/**
 * CalendarSideWidget
 * Embedded mini Nepali calendar for the CalendarDayView split-pane.
 * No overlay/popup behaviour — renders inline.
 *
 * Props:
 *   selectedDate  — AD date string "YYYY-MM-DD"
 *   onDateChange  — (newAdDateString) => void
 *   eventsData    — { [adDateKey]: { hasPublic?, hasPrivate?, hasTithi? } }
 */
export default function CalendarSideWidget({ selectedDate, onDateChange, eventsData = {} }) {
  const { isNepali } = useLanguage();

  const nptNow = getNepalDate();
  const todayBs = convertAdToBs(
    nptNow.getUTCFullYear(),
    nptNow.getUTCMonth(),
    nptNow.getUTCDate()
  );

  const selectedBs = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split('-').map(Number);
    return convertAdToBs(y, m - 1, d);
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(selectedBs ? selectedBs.year : todayBs.year);
  const [viewMonth, setViewMonth] = useState(selectedBs ? selectedBs.month : todayBs.month);
  const [view, setView] = useState('day');
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(((selectedBs ? selectedBs.year : todayBs.year) - minBsYear) / YEAR_PAGE_SIZE) *
      YEAR_PAGE_SIZE +
      minBsYear
  );

  // Sync view when selectedDate changes from outside (e.g. day tile click in grid)
  useEffect(() => {
    if (selectedBs) {
      setViewYear(selectedBs.year);
      setViewMonth(selectedBs.month);
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ───────────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 1) {
      if (viewYear > minBsYear) { setViewYear(v => v - 1); setViewMonth(12); }
    } else {
      setViewMonth(m => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 12) {
      if (viewYear < maxBsYear) { setViewYear(v => v + 1); setViewMonth(1); }
    } else {
      setViewMonth(m => m + 1);
    }
  }
  function prevYear() { if (viewYear > minBsYear) setViewYear(v => v - 1); }
  function nextYear() { if (viewYear < maxBsYear) setViewYear(v => v + 1); }
  function prevYearPage() { if (yearPageStart - YEAR_PAGE_SIZE >= minBsYear) setYearPageStart(s => s - YEAR_PAGE_SIZE); }
  function nextYearPage() { if (yearPageStart + YEAR_PAGE_SIZE <= maxBsYear) setYearPageStart(s => s + YEAR_PAGE_SIZE); }

  // ── Day grid cells ───────────────────────────────────────────────────────────
  const cells = useMemo(() => {
    const calData = getActiveCalendarData();
    const yearData = calData[viewYear];
    const days = yearData ? (yearData.daysInMonths[viewMonth - 1] || 30) : 30;
    const firstAdDate = convertBsToAd(viewYear, viewMonth, 1);
    const firstWeekday = firstAdDate
      ? new Date(firstAdDate.year, firstAdDate.month, firstAdDate.day).getDay()
      : 0;
    const grid = [];
    for (let i = 0; i < firstWeekday; i++) grid.push(null);
    for (let d = 1; d <= days; d++) grid.push(d);
    return grid;
  }, [viewYear, viewMonth]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function handleDayClick(bsDay) {
    const ad = convertBsToAd(viewYear, viewMonth, bsDay);
    if (!ad) return;
    const key = `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
    onDateChange(key);
  }

  function getDotsForBsDay(bsDay) {
    const adDate = convertBsToAd(viewYear, viewMonth, bsDay);
    if (!adDate) return {};
    const adKey = `${adDate.year}-${String(adDate.month + 1).padStart(2, '0')}-${String(adDate.day).padStart(2, '0')}`;
    return eventsData[adKey] || {};
  }

  const label = (n) => (isNepali ? toNepaliNumber(n) : n);
  const monthNames = isNepali ? NEPALI_MONTHS : ENGLISH_NEPALI_MONTHS;
  const weekdays = isNepali ? WEEKDAYS_NE : WEEKDAYS_EN;

  const yearPageEnd = Math.min(yearPageStart + YEAR_PAGE_SIZE - 1, maxBsYear);
  const yearCells = [];
  for (let y = yearPageStart; y <= yearPageEnd; y++) yearCells.push(y);

  return (
    <div className="csw-container">

      {/* ── DAY VIEW ──────────────────────────────────────────────────────── */}
      {view === 'day' && (
        <>
          <div className="csw-header">
            <button type="button" className="csw-nav-btn" onClick={prevMonth}>&lt;</button>
            <button type="button" className="csw-header-label" onClick={() => setView('month')}>
              {monthNames[viewMonth - 1]} {label(viewYear)}
            </button>
            <button type="button" className="csw-nav-btn" onClick={nextMonth}>&gt;</button>
          </div>

          <div className="csw-grid">
            {weekdays.map(wd => (
              <div key={wd} className="csw-weekday">{wd}</div>
            ))}
            {cells.map((bsDay, idx) => {
              if (bsDay === null) return <div key={`e-${idx}`} className="csw-day csw-empty" />;
              const isToday =
                todayBs.year === viewYear &&
                todayBs.month === viewMonth &&
                todayBs.day === bsDay;
              const isSelected =
                selectedBs &&
                selectedBs.year === viewYear &&
                selectedBs.month === viewMonth &&
                selectedBs.day === bsDay;
              const adDate = convertBsToAd(viewYear, viewMonth, bsDay);
              const dots = getDotsForBsDay(bsDay);
              return (
                <div
                  key={bsDay}
                  className={`csw-day${isToday ? ' csw-today' : ''}${isSelected ? ' csw-selected' : ''}`}
                  onClick={() => handleDayClick(bsDay)}
                >
                  <span className="csw-bs-day">{label(bsDay)}</span>
                  <span className="csw-ad-day">{adDate ? adDate.day : ''}</span>
                  <div className="csw-dots">
                    {dots.hasPublic  && <span className="csw-dot csw-dot-blue" />}
                    {dots.hasPrivate && <span className="csw-dot csw-dot-green" />}
                    {dots.hasTithi   && <span className="csw-dot csw-dot-amber" />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── MONTH VIEW ────────────────────────────────────────────────────── */}
      {view === 'month' && (
        <>
          <div className="csw-header">
            <button type="button" className="csw-nav-btn" onClick={prevYear}>&lt;</button>
            <button type="button" className="csw-header-label" onClick={() => setView('year')}>
              {label(viewYear)}
            </button>
            <button type="button" className="csw-nav-btn" onClick={nextYear}>&gt;</button>
          </div>
          <div className="csw-month-grid">
            {monthNames.map((name, i) => (
              <div
                key={i}
                className={[
                  'csw-month-cell',
                  viewMonth === i + 1 && selectedBs?.year === viewYear ? 'csw-selected' : '',
                  todayBs.year === viewYear && todayBs.month === i + 1 ? 'csw-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => { setViewMonth(i + 1); setView('day'); }}
              >
                {name}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── YEAR VIEW ─────────────────────────────────────────────────────── */}
      {view === 'year' && (
        <>
          <div className="csw-header">
            <button type="button" className="csw-nav-btn" onClick={prevYearPage} disabled={yearPageStart <= minBsYear}>&lt;</button>
            <span className="csw-month-label">{label(yearPageStart)} – {label(yearPageEnd)}</span>
            <button type="button" className="csw-nav-btn" onClick={nextYearPage} disabled={yearPageEnd >= maxBsYear}>&gt;</button>
          </div>
          <div className="csw-year-grid">
            {yearCells.map(y => (
              <div
                key={y}
                className={[
                  'csw-year-cell',
                  viewYear === y ? 'csw-selected' : '',
                  todayBs.year === y ? 'csw-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setViewYear(y);
                  setYearPageStart(
                    Math.floor((y - minBsYear) / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE + minBsYear
                  );
                  setView('month');
                }}
              >
                {label(y)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
