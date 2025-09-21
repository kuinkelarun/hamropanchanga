import React, { useEffect, useMemo, useRef, useState } from 'react';
import './NepaliCalendar.css';

const nepaliMonths = [
  "वैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"
];
const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const nepaliWeekdays = [
  "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"
];
const englishWeekdays = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const shuklaPackshyaTithis = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", 
  "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"
];

const krishnaPackshyaTithis = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी", 
  "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "औंसी"
];

const nepaliNumbers = ["०","१","२","३","४","५","६","७","८","९"];

const bsCalendarData = {
  2070: { startAdDate: new Date(2013,3,14), daysInMonths:[31,31,32,31,30,30,30,29,29,29,30,31] },
  2071: { startAdDate: new Date(2014,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31] },
  2072: { startAdDate: new Date(2015,3,14), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2073: { startAdDate: new Date(2016,3,13), daysInMonths:[31,31,32,31,31,30,30,29,29,29,30,31] },
  2081: { startAdDate: new Date(2024,3,13), daysInMonths:[31,32,31,31,30,30,30,29,29,29,30,31] },
  2082: { startAdDate: new Date(2025,3,14), daysInMonths:[31,31,32,31,31,30,30,29,29,30,29,31] }
};
const minBsYear = Math.min(...Object.keys(bsCalendarData).map(n=>+n));
const maxBsYear = Math.max(...Object.keys(bsCalendarData).map(n=>+n));

function toNepaliNumber(num){
  return String(num).split('').map(d => nepaliNumbers[+d] ?? d).join('');
}

function getNepalDate(){
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const nptOffset = 5.75 * 3600000;
  return new Date(utc + nptOffset);
}

function convertAdToBs(year, month, day){
  const adDate = new Date(year, month, day);
  let bsYear = null, totalDays = 0;
  for (const y of Object.keys(bsCalendarData).sort()) {
    const startAd = bsCalendarData[y].startAdDate;
    if (adDate >= startAd) {
      bsYear = +y;
      totalDays = Math.floor((adDate - startAd) / (1000*60*60*24)) + 1;
    } else break;
  }
  if (!bsYear) {
    bsYear = minBsYear;
    totalDays = 1;
  }
  let bsMonth = 1;
  let bsDay = totalDays;
  const months = bsCalendarData[bsYear].daysInMonths;
  for (let i=0;i<months.length;i++){
    if (bsDay <= months[i]) { bsMonth = i+1; break; }
    bsDay -= months[i];
  }
  return { year: bsYear, month: bsMonth, day: bsDay, dayOfWeek: adDate.getDay() };
}

function convertBsToAd(year, month, day){
  const start = bsCalendarData[year]?.startAdDate;
  if (!start) return null;
  let totalDays = 0;
  for (let i=0;i<month-1;i++) totalDays += bsCalendarData[year].daysInMonths[i];
  totalDays += day - 1;
  const adDate = new Date(start);
  adDate.setDate(start.getDate() + totalDays);
  return { year: adDate.getFullYear(), month: adDate.getMonth(), day: adDate.getDate() };
}

export default function NepaliCalendar() {
  const todayAd = useMemo(() => getNepalDate(), []);
  const todayBs = useMemo(() => convertAdToBs(todayAd.getFullYear(), todayAd.getMonth(), todayAd.getDate()), [todayAd]);

  const [currentBsYear, setCurrentBsYear] = useState(todayBs.year);
  const [currentBsMonth, setCurrentBsMonth] = useState(todayBs.month);
  const [tithisByDate, setTithisByDate] = useState({}); // { "YYYY-M-D": [{name,start,end}, ...] }
  const [activeDate, setActiveDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFocusHint, setModalFocusHint] = useState(null);
  const [tithiOptions, setTithiOptions] = useState([]); // loaded from calendar.txt (public/) or fallback

  const tithiInputRef = useRef(null);

  useEffect(()=>{
    if (currentBsYear < minBsYear) setCurrentBsYear(minBsYear);
    if (currentBsYear > maxBsYear) setCurrentBsYear(maxBsYear);
  }, [currentBsYear]);

  const nepaliMonthDays = useMemo(() => {
    return bsCalendarData[currentBsYear]?.daysInMonths[currentBsMonth-1] ?? 30;
  }, [currentBsYear, currentBsMonth]);

  const firstDayOfBsMonthAd = useMemo(() => {
    return convertBsToAd(currentBsYear, currentBsMonth, 1);
  }, [currentBsYear, currentBsMonth]);

  const startDayOfWeek = useMemo(() => {
    if (!firstDayOfBsMonthAd) return 0;
    return new Date(firstDayOfBsMonthAd.year, firstDayOfBsMonthAd.month, firstDayOfBsMonthAd.day).getDay();
  }, [firstDayOfBsMonthAd]);

  function dateKeyFromAd(ad){ return `${ad.year}-${ad.month+1}-${ad.day}`; }

  function handlePrev(){
    let m = currentBsMonth - 1;
    let y = currentBsYear;
    if (m < 1) { m = 12; y -= 1; }
    setCurrentBsMonth(m); setCurrentBsYear(y);
  }
  function handleNext(){
    let m = currentBsMonth + 1;
    let y = currentBsYear;
    if (m > 12) { m = 1; y += 1; }
    setCurrentBsMonth(m); setCurrentBsYear(y);
  }

  // open modal; optional focusHint 'tithi' will focus tithi input
  function openModalForDate(adYear, adMonthZeroBased, adDay, focusHint = null){
    const key = `${adYear}-${adMonthZeroBased+1}-${adDay}`;
    setActiveDate(key);
    setModalFocusHint(focusHint);
    setModalOpen(true);
  }

  function addTithi(dateKey, name, startTime='', endTime=''){
    setTithisByDate(prev=>{
      const copy = {...prev};
      copy[dateKey] = copy[dateKey] ? [...copy[dateKey], { name, startTime, endTime, id: Date.now() }] : [{ name, startTime, endTime, id: Date.now() }];
      return copy;
    });
  }

  function deleteTithi(dateKey, id){
    setTithisByDate(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).filter(i=>i.id!==id) }));
  }

  // controlled inputs inside modal
  const [newPakshya, setNewPakshya] = useState('शुक्लपक्ष');
  const [newTithi, setNewTithi] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [validation, setValidation] = useState('');

  useEffect(() => {
    if (modalOpen && modalFocusHint === 'tithi') {
      // focus after modal render
      setTimeout(() => {
        tithiInputRef.current?.focus();
      }, 40);
    }
    if (!modalOpen) {
      setModalFocusHint(null);
      setNewPakshya('शुक्लपक्ष'); setNewTithi(''); setStartTime(''); setEndTime(''); setValidation('');
    }
  }, [modalOpen, modalFocusHint]);

  function submitAdd(){
    setValidation('');
    if (!newPakshya) { setValidation('Select a Pakshya'); return; }
    if (!newTithi) { setValidation('Select a Tithi'); return; }
    if (!startTime || !endTime) { setValidation('Start and end times required for tithi'); return; }
    if (endTime <= startTime) { setValidation('End must be after start'); return; }
    
    const fullTithiName = `${newPakshya} ${newTithi}`;
    addTithi(activeDate, fullTithiName, startTime, endTime);
    setNewPakshya('शुक्लपक्ष'); setNewTithi(''); setStartTime(''); setEndTime('');
  }

  function renderDayTiles(){
    const tiles = [];
    for (let i=0;i<startDayOfWeek;i++){
      tiles.push(<div key={`b-${i}`} className="nt-day-tile empty" aria-hidden="true"/>);
    }
    for (let day=1; day<=nepaliMonthDays; day++){
      const ad = convertBsToAd(currentBsYear, currentBsMonth, day);
      const dateKey = dateKeyFromAd(ad);
      const isToday = todayBs.year === currentBsYear && todayBs.month === currentBsMonth && todayBs.day === day;
      const tithis = tithisByDate[dateKey] || [];
      const dayOfWeek = new Date(ad.year, ad.month, ad.day).getDay(); // 0=Sunday, 1=Monday, etc.

      tiles.push(
        <div
          key={dateKey}
          className={`nt-day-tile ${isToday ? 'today' : ''}`}
          onClick={()=> openModalForDate(ad.year, ad.month, ad.day)}
          tabIndex={0}
          onKeyDown={(e)=> { if (e.key === 'Enter') openModalForDate(ad.year, ad.month, ad.day); }}
          data-date={dateKey}
        >
          <button
            className="nt-quick-add-btn"
            aria-label="Quick add tithi"
            title="Add Tithi"
            onClick={(e)=>{ e.stopPropagation(); openModalForDate(ad.year, ad.month, ad.day, 'tithi'); }}
          >+</button>

          {/* removed three-dot edit button: use tile click or quick-add (+) instead */}

          <div className="nt-nepali-date" aria-hidden>{toNepaliNumber(day)}</div>
          <div className="nt-english-date" aria-hidden>{ad.day}</div>
          <div className="nt-summary" aria-hidden>
            {tithis.length > 0 && (
              <div className="nt-summary-item tithi">
                {tithis
                  .sort((a, b) => a.startTime.localeCompare(b.startTime)) // Sort by start time
                  .map(t => t.name)
                  .join(' / ') // Join with slash separator
                }
              </div>
            )}
          </div>
        </div>
      );
    }
    return tiles;
  }

  const modalTithis = tithisByDate[activeDate] || [];

  return (
    <div className="nepali-calendar-container">
      <div className="nc-header">
        <button onClick={handlePrev} className="nc-btn">‹ Prev</button>
        <div className="nc-center">
          <div className="nc-nepali">{nepaliMonths[currentBsMonth-1]} {toNepaliNumber(currentBsYear)}</div>
          <div className="nc-english">{englishMonths[firstDayOfBsMonthAd?.month ?? 0]} {firstDayOfBsMonthAd?.year ?? ''}</div>
        </div>
        <button onClick={handleNext} className="nc-btn">Next ›</button>
      </div>

      <div className="nc-weekdays">
        {nepaliWeekdays.map((nepaliDay, index) => (
          <div key={nepaliDay} className="nc-weekday">
            <div className="nc-weekday-nepali">{nepaliDay}</div>
            <div className="nc-weekday-english">{englishWeekdays[index]}</div>
          </div>
        ))}
      </div>

      <div className="nc-grid" role="grid" aria-label="Nepali calendar">
        {renderDayTiles()}
      </div>

      {modalOpen && (
        <div className="nc-modal-backdrop" onClick={()=> setModalOpen(false)}>
          <div className="nc-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="nc-modal-header">
              {/* show Nepali date (BS) for the activeDate key which is in AD form "YYYY-M-D" */}
              <h3 className="nc-modal-title">{
                (() => {
                  if (!activeDate) return '';
                  const parts = activeDate.split('-').map(p=>+p);
                  const adYear = parts[0];
                  const adMonthZeroBased = parts[1]-1;
                  const adDay = parts[2];
                  const bs = convertAdToBs(adYear, adMonthZeroBased, adDay);
                  return `${nepaliMonths[bs.month-1]} ${toNepaliNumber(bs.day)}, ${toNepaliNumber(bs.year)}`;
                })()
              }</h3>
              <button onClick={()=> setModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="nc-modal-section">
              <h4>Tithis</h4>
              {modalTithis.length===0 && <div className="muted">No tithis</div>}
              {modalTithis
                .sort((a, b) => a.startTime.localeCompare(b.startTime)) // Sort by start time
                .map(t => (
                <div key={t.id} className="nc-item">
                  <div>
                    <div className="nc-item-title">{t.name}</div>
                    <div className="muted">{t.startTime} — {t.endTime}</div>
                  </div>
                  <button onClick={()=> deleteTithi(activeDate, t.id)} aria-label="Delete tithi">🗑</button>
                </div>
              ))}
            </div>

            <div className="nc-modal-section">
              <h4>Add Tithi</h4>
              
              {/* Pakshya Field */}
              <div className="nc-form-row">
                <label className="nc-label">पक्ष (Pakshya):</label>
                <select
                  value={newPakshya}
                  onChange={e => {
                    setNewPakshya(e.target.value);
                    setNewTithi(''); // Reset tithi when pakshya changes
                  }}
                  className="nc-select"
                >
                  <option value="शुक्लपक्ष">शुक्लपक्ष (Shukla Pakshya)</option>
                  <option value="कृष्णपक्ष">कृष्णपक्ष (Krishna Pakshya)</option>
                </select>
              </div>

              {/* Tithi Field */}
              <div className="nc-form-row">
                <label className="nc-label">तिथि (Tithi):</label>
                <select
                  ref={tithiInputRef}
                  value={newTithi}
                  onChange={e => setNewTithi(e.target.value)}
                  className="nc-select"
                >
                  <option value="">Select Tithi</option>
                  {(newPakshya === 'शुक्लपक्ष' ? shuklaPackshyaTithis : krishnaPackshyaTithis).map(tithi => (
                    <option key={tithi} value={tithi}>{tithi}</option>
                  ))}
                </select>
              </div>

              {/* Time Fields */}
              <div className="nc-form-row">
                <label className="nc-label">आरम्भकाल (Start Time):</label>
                <input 
                  type="time" 
                  value={startTime} 
                  onChange={e=>setStartTime(e.target.value)} 
                  className="nc-input-time" 
                />
              </div>

              <div className="nc-form-row">
                <label className="nc-label">समाप्तिकाल (End Time):</label>
                <input 
                  type="time" 
                  value={endTime} 
                  onChange={e=>setEndTime(e.target.value)} 
                  className="nc-input-time" 
                />
              </div>

              {validation && <div className="nc-validation">{validation}</div>}
              <div className="nc-modal-actions">
                <button onClick={submitAdd} className="nc-add-btn">Add Tithi</button>
                <button onClick={()=>{ setModalOpen(false); setValidation(''); }}>Close</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};