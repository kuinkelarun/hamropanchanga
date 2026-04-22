import React, { useState, useMemo } from 'react';
import { convertAdToBs, convertBsToAd, getNepalDate, toNepaliNumber, getActiveCalendarData, minBsYear, maxBsYear } from '../utils/nepaliDateUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { NEPALI_MONTHS, ENGLISH_NEPALI_MONTHS } from '../constants/calendarConstants';
import './NepaliMiniCalendar.css';

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_NE = ['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श'];

// How many years to show in the year-grid view
const YEAR_PAGE_SIZE = 12;

export default function NepaliMiniCalendar({ value, onChange, onClose }) {
  const { isNepali } = useLanguage();

  const nptNow = getNepalDate();
  const todayBs = convertAdToBs(nptNow.getUTCFullYear(), nptNow.getUTCMonth(), nptNow.getUTCDate());

  const initialBs = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      return convertAdToBs(y, m - 1, d);
    }
    return todayBs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [viewYear, setViewYear] = useState(initialBs.year);
  const [viewMonth, setViewMonth] = useState(initialBs.month);
  // 'day' | 'month' | 'year'
  const [view, setView] = useState('day');
  // Starting year for the year-grid page
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor((initialBs.year - minBsYear) / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE + minBsYear
  );

  const selectedBs = useMemo(() => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    return convertAdToBs(y, m - 1, d);
  }, [value]);

  // ── Day view navigation ──────────────────────────────────────────────────────
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

  // ── Month view navigation ────────────────────────────────────────────────────
  function prevYear() { if (viewYear > minBsYear) setViewYear(v => v - 1); }
  function nextYear() { if (viewYear < maxBsYear) setViewYear(v => v + 1); }

  // ── Year view navigation ─────────────────────────────────────────────────────
  function prevYearPage() { if (yearPageStart - YEAR_PAGE_SIZE >= minBsYear) setYearPageStart(s => s - YEAR_PAGE_SIZE); }
  function nextYearPage() { if (yearPageStart + YEAR_PAGE_SIZE <= maxBsYear) setYearPageStart(s => s + YEAR_PAGE_SIZE); }

  // ── Day grid ─────────────────────────────────────────────────────────────────
  const { cells } = useMemo(() => {
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
    return { cells: grid };
  }, [viewYear, viewMonth]);

  function handleDayClick(bsDay) {
    const ad = convertBsToAd(viewYear, viewMonth, bsDay);
    if (!ad) return;
    onChange(`${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`);
  }

  function handleMonthClick(monthIdx) {
    setViewMonth(monthIdx + 1);
    setView('day');
  }

  function handleYearClick(year) {
    setViewYear(year);
    setYearPageStart(Math.floor((year - minBsYear) / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE + minBsYear);
    setView('month');
  }

  const adFooter = useMemo(() => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${d}, ${y}`;
  }, [value]);

  const label = (n) => isNepali ? toNepaliNumber(n) : n;
  const monthNames = isNepali ? NEPALI_MONTHS : ENGLISH_NEPALI_MONTHS;
  const weekdays = isNepali ? WEEKDAYS_NE : WEEKDAYS_EN;

  // ── Year page ─────────────────────────────────────────────────────────────────
  const yearPageEnd = Math.min(yearPageStart + YEAR_PAGE_SIZE - 1, maxBsYear);
  const yearCells = [];
  for (let y = yearPageStart; y <= yearPageEnd; y++) yearCells.push(y);

  return (
    <>
      <div className="nmc-overlay" onClick={onClose} />
      <div className="nmc-popup">

        {/* ── DAY VIEW ─────────────────────────────────────────────────────── */}
        {view === 'day' && (
          <>
            <div className="nmc-header">
              <button type="button" className="nmc-nav-btn" onClick={prevMonth}>&lt;</button>
              <button type="button" className="nmc-header-label" onClick={() => setView('month')}>
                {monthNames[viewMonth - 1]} {label(viewYear)}
              </button>
              <button type="button" className="nmc-nav-btn" onClick={nextMonth}>&gt;</button>
            </div>

            <div className="nmc-grid">
              {weekdays.map(wd => (
                <div key={wd} className="nmc-weekday">{wd}</div>
              ))}
              {cells.map((bsDay, idx) => {
                if (bsDay === null) return <div key={`e-${idx}`} className="nmc-day empty" />;
                const isToday = todayBs.year === viewYear && todayBs.month === viewMonth && todayBs.day === bsDay;
                const isSelected = selectedBs && selectedBs.year === viewYear && selectedBs.month === viewMonth && selectedBs.day === bsDay;
                const adDate = convertBsToAd(viewYear, viewMonth, bsDay);
                return (
                  <div
                    key={bsDay}
                    className={`nmc-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                    onClick={() => handleDayClick(bsDay)}
                  >
                    <span className="nmc-bs-day">{label(bsDay)}</span>
                    <span className="nmc-ad-day">{adDate ? adDate.day : ''}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── MONTH VIEW ───────────────────────────────────────────────────── */}
        {view === 'month' && (
          <>
            <div className="nmc-header">
              <button type="button" className="nmc-nav-btn" onClick={prevYear}>&lt;</button>
              <button type="button" className="nmc-header-label nmc-header-year" onClick={() => setView('year')}>
                {label(viewYear)}
              </button>
              <button type="button" className="nmc-nav-btn" onClick={nextYear}>&gt;</button>
            </div>
            <div className="nmc-month-grid">
              {monthNames.map((name, i) => (
                <div
                  key={i}
                  className={`nmc-month-cell${viewMonth === i + 1 && selectedBs?.year === viewYear ? ' selected' : ''}${todayBs.year === viewYear && todayBs.month === i + 1 ? ' today' : ''}`}
                  onClick={() => handleMonthClick(i)}
                >
                  {name}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── YEAR VIEW ────────────────────────────────────────────────────── */}
        {view === 'year' && (
          <>
            <div className="nmc-header">
              <button type="button" className="nmc-nav-btn" onClick={prevYearPage} disabled={yearPageStart <= minBsYear}>&lt;</button>
              <span className="nmc-month-label">{label(yearPageStart)} – {label(yearPageEnd)}</span>
              <button type="button" className="nmc-nav-btn" onClick={nextYearPage} disabled={yearPageEnd >= maxBsYear}>&gt;</button>
            </div>
            <div className="nmc-year-grid">
              {yearCells.map(y => (
                <div
                  key={y}
                  className={`nmc-year-cell${viewYear === y ? ' selected' : ''}${todayBs.year === y ? ' today' : ''}`}
                  onClick={() => handleYearClick(y)}
                >
                  {label(y)}
                </div>
              ))}
            </div>
          </>
        )}

        {value && (
          <div className="nmc-footer">{adFooter}</div>
        )}
      </div>
    </>
  );
}
