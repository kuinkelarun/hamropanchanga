import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import NepaliDatePicker from './NepaliDatePicker'; // Use the existing NepaliDatePicker component
import { useSettings } from '../contexts/SettingsContext';
import { nepaliMonths, getTithisForMonth, convertAdToBs, getTithiIndexByName, getTithiLunarMonthName, getTithiYearFromAdDate } from '../utils/nepaliDateUtils';

// Component to add/edit an event
const AddEventForm = ({ onAdd, familyMembers, onCancel, editingEvent }) => {
    // Initialize date with today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(getTodayDate());
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [repetition, setRepetition] = useState('none');
    const [entryMode, setEntryMode] = useState('date'); // 'date' or 'tithi'
    const [tithiMonth, setTithiMonth] = useState('');
    const [tithiId, setTithiId] = useState('');
    const [resolvingTithi, setResolvingTithi] = useState(false);
    
    const { isNepaliCalendar } = useSettings(); // Use global settings

    // Populate form when editing
    useEffect(() => {
        if (editingEvent) {
            setName(editingEvent.title || '');
            setDescription(editingEvent.description || '');
            setDate(editingEvent.dateKey || getTodayDate());
            setSelectedPersonId(editingEvent.memberId || '');
            setRepetition(editingEvent.repetition || 'none');
            if (editingEvent.tithi) {
                setEntryMode('tithi');
                // If stored month is a name (string), convert to 1-based index
                // If it's already a number (legacy), use as is
                let monthVal = editingEvent.tithi.month;
                if (typeof monthVal === 'string') {
                    const idx = nepaliMonths.indexOf(monthVal);
                    if (idx !== -1) monthVal = idx + 1;
                }
                setTithiMonth(monthVal);
                setTithiId(editingEvent.tithi.id);
            }
        }
    }, [editingEvent]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !selectedPersonId) return;

        let finalDate = date;
        let tithiInfo = null;

        if (entryMode === 'tithi') {
            if (!tithiMonth || !tithiId) return;
            
            setResolvingTithi(true);
            try {
                // Resolve date from Tithi
                const [pakshaKey, tithiName] = tithiId.split('-');
                const paksha = pakshaKey === 'shukla' ? 'Shukla' : 'Krishna';
                const pakshaNepali = pakshaKey === 'shukla' ? 'शुक्लपक्ष' : 'कृष्णपक्ष';
                
                // Determine current BS Year
                const today = new Date();
                const bsToday = convertAdToBs(today.getFullYear(), today.getMonth(), today.getDate());
                const currentBsYear = bsToday.year;
                const selectedMonthName = nepaliMonths[parseInt(tithiMonth) - 1];
                
                // Query Firestore for matching tithi
                const fullName = `${pakshaNepali} ${tithiName}`;
                const q = query(collection(db, 'tithis'), where('name', '>=', fullName), where('name', '<=', fullName + '\uf8ff'));
                const snapshot = await getDocs(q);
                
                let matchingTithi = null;
                let actualTithiLunarMonth = null;
                snapshot.docs.forEach(doc => {
                    const t = doc.data();
                    if (!t.name.includes(tithiName) || !t.name.includes(pakshaNepali)) return;
                    
                    const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
                    if (!tithiIndex) return;
                    const lunarMonthName = getTithiLunarMonthName(paksha, tithiIndex, t.startDate);
                    const tithiYearInfo = getTithiYearFromAdDate(t.startDate, null, paksha, tithiIndex);
                    
                    if (lunarMonthName === selectedMonthName && tithiYearInfo.tithiYear === currentBsYear) {
                        matchingTithi = t;
                        actualTithiLunarMonth = lunarMonthName;
                    }
                });
                
                if (matchingTithi && actualTithiLunarMonth) {
                    finalDate = matchingTithi.startDate;
                    tithiInfo = {
                        month: actualTithiLunarMonth,  // Save the actual tithi lunar month name, NOT calendar month
                        id: tithiId,
                        name: tithiName,
                        paksha: paksha
                    };
                } else {
                    alert(`Could not find date for ${selectedMonthName} ${pakshaNepali} ${tithiName} in year ${currentBsYear}. Please ensure Tithis are generated.`);
                    setResolvingTithi(false);
                    return;
                }
            } catch (err) {
                console.error('Error resolving tithi:', err);
                alert('Error resolving tithi date');
                setResolvingTithi(false);
                return;
            }
            setResolvingTithi(false);
        } else {
            if (!date) return;
        }

        onAdd({ 
            name, 
            description: description.trim(),
            date: finalDate, 
            personId: selectedPersonId, 
            repetition,
            tithi: tithiInfo 
        });
        
        setName('');
        setDescription('');
        setDate(getTodayDate());
        setSelectedPersonId('');
        setRepetition('none');
        setEntryMode('date');
        setTithiMonth('');
        setTithiId('');
    };

    return (
        <>
            <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
                <h4 className="text-lg font-bold text-gray-800">
                    {editingEvent ? 'Edit Event' : 'Add New Event'}
                </h4>
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
                        <label htmlFor="event-description" className="block text-gray-700 font-semibold mb-1 text-sm">
                            Description (Optional)
                        </label>
                        <textarea
                            id="event-description"
                            placeholder="Add details (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            rows={3}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-gray-700 font-semibold mb-1 text-sm">
                            Entry Mode
                        </label>
                        <div className="flex space-x-4 mb-2">
                            <label className="inline-flex items-center">
                                <input 
                                    type="radio" 
                                    className="form-radio text-green-600" 
                                    name="entryMode" 
                                    value="date" 
                                    checked={entryMode === 'date'} 
                                    onChange={() => {
                                        setEntryMode('date');
                                        // Keep current repetition value
                                    }} 
                                />
                                <span className="ml-2 text-sm">By Date</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input 
                                    type="radio" 
                                    className="form-radio text-green-600" 
                                    name="entryMode" 
                                    value="tithi" 
                                    checked={entryMode === 'tithi'} 
                                    onChange={() => {
                                        setEntryMode('tithi');
                                        // Default to monthly for tithi-based events
                                        if (repetition === 'none') {
                                            setRepetition('monthly');
                                        }
                                    }} 
                                />
                                <span className="ml-2 text-sm">By Tithi</span>
                            </label>
                        </div>

                        {entryMode === 'date' ? (
                            <>
                                <label htmlFor="event-date" className="block text-gray-700 font-semibold mb-1 text-sm">
                                    Date ({isNepaliCalendar ? 'Nepali Calendar' : 'Gregorian Calendar'})
                                </label>
                                {isNepaliCalendar ? (
                                    <NepaliDatePicker
                                        value={date}
                                        onChange={(adDate) => setDate(adDate)}
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
                            </>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-sm">Tithi Month (Lunar)</label>
                                    <select 
                                        value={tithiMonth} 
                                        onChange={(e) => setTithiMonth(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                        required
                                    >
                                        <option value="">Select Tithi Month</option>
                                        {nepaliMonths.map((month, idx) => (
                                            <option key={idx} value={idx + 1}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-1 text-sm">Tithi</label>
                                    <select 
                                        value={tithiId} 
                                        onChange={(e) => setTithiId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                        disabled={!tithiMonth}
                                        required
                                    >
                                        <option value="">Select Tithi</option>
                                        {tithiMonth && getTithisForMonth(tithiMonth).map(tithi => (
                                            <option key={tithi.tithiId} value={tithi.tithiId}>
                                                {tithi.name} ({tithi.pakshya})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
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
                        <button type="submit" disabled={resolvingTithi} className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm disabled:opacity-50">
                            {resolvingTithi ? 'Resolving...' : (editingEvent ? 'Update Event' : 'Add Event')}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddEventForm;
