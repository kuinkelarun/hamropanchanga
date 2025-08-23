import { useState } from 'react';

const AddEventForm = ({ onAdd, familyMembers }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;

        onAdd({ name, date, personId: selectedPersonId });
        setName('');
        setDate('');
        setSelectedPersonId('');
    };

    return (
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
                        Date
                    </label>
                    <input
                        id="event-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div className="flex justify-end">
                    <button type="submit" className="px-4 py-2 rounded-xl text-white font-semibold transition bg-green-600 hover:bg-green-700 text-sm">
                        Add Event
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddEventForm;