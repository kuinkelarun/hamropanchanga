import { useState, useEffect } from 'react';
import NepaliDatePicker from './NepaliDatePicker'; // Use the existing NepaliDatePicker component
import { useSettings } from '../contexts/SettingsContext';

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
    const [date, setDate] = useState(getTodayDate());
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [repetition, setRepetition] = useState('none');
    const { isNepaliCalendar } = useSettings(); // Use global settings

    // Populate form when editing
    useEffect(() => {
        if (editingEvent) {
            setName(editingEvent.title || '');
            setDate(editingEvent.dateKey || getTodayDate());
            setSelectedPersonId(editingEvent.memberId || '');
            setRepetition(editingEvent.repetition || 'none');
        }
    }, [editingEvent]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;

        onAdd({ name, date, personId: selectedPersonId, repetition });
        setName('');
        setDate(getTodayDate());
        setSelectedPersonId('');
        setRepetition('none');
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
                            {editingEvent ? 'Update Event' : 'Add Event'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddEventForm;
