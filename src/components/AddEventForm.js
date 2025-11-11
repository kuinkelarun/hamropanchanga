import { useState } from 'react';
import './NepaliDatePicker.css'; // Import styles for Nepali date picker
import { useSettings } from '../contexts/SettingsContext';

// Nepali Calendar utilities
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

// Nepali Date Picker Component
const NepaliDatePicker = ({ selectedDate, onDateSelect, onClose }) => {
  const todayAd = getNepalDate();
  const todayBs = convertAdToBs(todayAd.getFullYear(), todayAd.getMonth(), todayAd.getDate());
  
  const [currentBsYear, setCurrentBsYear] = useState(todayBs.year);
  const [currentBsMonth, setCurrentBsMonth] = useState(todayBs.month);

  const nepaliMonthDays = bsCalendarData[currentBsYear]?.daysInMonths[currentBsMonth-1] ?? 30;
  const firstDayOfBsMonthAd = convertBsToAd(currentBsYear, currentBsMonth, 1);
  const startDayOfWeek = firstDayOfBsMonthAd ? new Date(firstDayOfBsMonthAd.year, firstDayOfBsMonthAd.month, firstDayOfBsMonthAd.day).getDay() : 0;

  const handlePrev = () => {
    let m = currentBsMonth - 1;
    let y = currentBsYear;
    if (m < 1) { m = 12; y -= 1; }
    if (y < minBsYear) { y = minBsYear; m = 1; }
    setCurrentBsMonth(m);
    setCurrentBsYear(y);
  };

  const handleNext = () => {
    let m = currentBsMonth + 1;
    let y = currentBsYear;
    if (m > 12) { m = 1; y += 1; }
    if (y > maxBsYear) { y = maxBsYear; m = 12; }
    setCurrentBsMonth(m);
    setCurrentBsYear(y);
  };

  const handleDateClick = (day) => {
    const ad = convertBsToAd(currentBsYear, currentBsMonth, day);
    if (ad) {
      // Format as YYYY-MM-DD for HTML date input compatibility
      const formattedDate = `${ad.year}-${String(ad.month + 1).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
      onDateSelect(formattedDate);
      onClose();
    }
  };

  const renderDayTiles = () => {
    const tiles = [];
    
    // Empty tiles for days before month start
    for (let i = 0; i < startDayOfWeek; i++) {
      tiles.push(<div key={`empty-${i}`} className="np-day-tile empty" />);
    }
    
    // Day tiles
    for (let day = 1; day <= nepaliMonthDays; day++) {
      const isToday = todayBs.year === currentBsYear && todayBs.month === currentBsMonth && todayBs.day === day;
      const ad = convertBsToAd(currentBsYear, currentBsMonth, day);
      
      tiles.push(
        <div
          key={day}
          className={`np-day-tile ${isToday ? 'today' : ''}`}
          onClick={() => handleDateClick(day)}
        >
          <div className="np-nepali-date">{toNepaliNumber(day)}</div>
          <div className="np-english-date">{ad?.day}</div>
        </div>
      );
    }
    
    return tiles;
  };

  return (
    <div className="np-modal-backdrop" onClick={onClose}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-modal-header">
          <h3 className="np-modal-title">Select Date - Nepali Calendar</h3>
          <button onClick={onClose} className="np-close-btn">✕</button>
        </div>
        
        <div className="np-calendar-container">
          <div className="np-header">
            <button onClick={handlePrev} className="np-nav-btn">‹ Prev</button>
            <div className="np-center">
              <div className="np-nepali">{nepaliMonths[currentBsMonth-1]} {toNepaliNumber(currentBsYear)}</div>
              <div className="np-english">{englishMonths[firstDayOfBsMonthAd?.month ?? 0]} {firstDayOfBsMonthAd?.year ?? ''}</div>
            </div>
            <button onClick={handleNext} className="np-nav-btn">Next ›</button>
          </div>

          <div className="np-weekdays">
            {nepaliWeekdays.map((nepaliDay, index) => (
              <div key={nepaliDay} className="np-weekday">
                <div className="np-weekday-nepali">{nepaliDay}</div>
                <div className="np-weekday-english">{englishWeekdays[index]}</div>
              </div>
            ))}
          </div>

          <div className="np-grid">
            {renderDayTiles()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component to add a new event
const AddEventForm = ({ onAdd, familyMembers, onCancel }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [repetition, setRepetition] = useState('none');
    const [showNepaliCalendar, setShowNepaliCalendar] = useState(false);
    const { isNepaliCalendar } = useSettings(); // Use global settings

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;

        onAdd({ name, date, personId: selectedPersonId, repetition });
        setName('');
        setDate('');
        setSelectedPersonId('');
        setRepetition('none');
    };

    const handleDateSelect = (selectedDate) => {
        setDate(selectedDate);
        setShowNepaliCalendar(false);
    };

    // Convert AD date to Nepali format for display
    const getDisplayDate = () => {
        if (!date) return '';
        
        const [year, month, day] = date.split('-').map(Number);
        const bs = convertAdToBs(year, month - 1, day);
        const nepaliDate = `${nepaliMonths[bs.month-1]} ${toNepaliNumber(bs.day)}, ${toNepaliNumber(bs.year)}`;
        const englishDate = `${englishMonths[month-1]} ${day}, ${year}`;
        
        return `${nepaliDate} (${englishDate})`;
    };

    return (
        <>
            <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
                <h4 className="text-lg font-bold text-gray-800">Add New Event</h4>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label htmlFor="event-person" className="block text-gray-700 font-semibold mb-1 text-sm">
                            Associated Person
                        </label>
                        <select
                            id="event-person"
                            value={selectedPersonId}
                            onChange={(e) => setSelectedPersonId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            required
                        >
                            <option value="" disabled>Select a person...</option>
                            {familyMembers.map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.name} ({member.relation})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="event-name" className="block text-gray-700 font-semibold mb-1 text-sm">
                            Event Name
                        </label>
                        <input
                            id="event-name"
                            type="text"
                            placeholder="Event Name (e.g., Birthday)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            required
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="event-date" className="block text-gray-700 font-semibold mb-1 text-sm">
                            Date ({isNepaliCalendar ? 'Nepali Calendar' : 'Gregorian Calendar'})
                        </label>
                        <div className="relative">
                            {isNepaliCalendar ? (
                                <input
                                    id="event-date"
                                    type="text"
                                    placeholder="Click to select date from Nepali Calendar"
                                    value={getDisplayDate()}
                                    onClick={() => setShowNepaliCalendar(true)}
                                    readOnly
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer bg-white"
                                    required
                                />
                            ) : (
                                <input
                                    id="event-date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                    required
                                />
                            )}
                            {isNepaliCalendar && (
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="event-repetition" className="block text-gray-700 font-semibold mb-1 text-sm">
                            Repeats
                        </label>
                        <select
                            id="event-repetition"
                            value={repetition}
                            onChange={(e) => setRepetition(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                            <option value="none">Does not repeat</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-gray-700 font-semibold transition bg-gray-200 hover:bg-gray-300 text-sm">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
                            Add Event
                        </button>
                    </div>
                </form>
            </div>

            {/* Nepali Calendar Modal */}
            {showNepaliCalendar && isNepaliCalendar && (
                <NepaliDatePicker
                    selectedDate={date}
                    onDateSelect={handleDateSelect}
                    onClose={() => setShowNepaliCalendar(false)}
                />
            )}
        </>
    );
};

export default AddEventForm;
