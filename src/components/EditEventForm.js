import { useState } from 'react';

// Component to edit an existing event
const EditEventForm = ({ event, onUpdate, onCancel, familyMembers }) => {
    const [name, setName] = useState(event.name);
    const [date, setDate] = useState(event.date); // Use the current, most recent date
    const [selectedPersonId, setSelectedPersonId] = useState(event.personId);
    const [repetition, setRepetition] = useState(event.repetition || 'none');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !date || !selectedPersonId) return;

        // Find the associated person to get their name and relation
        const person = familyMembers.find(member => member.id === selectedPersonId);

        // Create the updated event object, adding the new date to the history array
        const updatedEvent = {
            ...event,
            name,
            date, // This is the new, current date
            personId: selectedPersonId,
            personName: person ? person.name : 'Unknown',
            personRelation: person ? person.relation : 'N/A',
            repetition,
            dateHistory: [...event.dateHistory, date] // Append the new date to the history array
        };

        onUpdate(updatedEvent);
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
            <h4 className="text-lg font-bold text-gray-800">Edit Event</h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="edit-event-person" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Associated Person
                    </label>
                    <select
                        id="edit-event-person"
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
                    <label htmlFor="edit-event-name" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Event Name
                    </label>
                    <input
                        id="edit-event-name"
                        type="text"
                        placeholder="Event Name (e.g., Birthday)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="edit-event-date" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Date
                    </label>
                    <input
                        id="edit-event-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="edit-event-repetition" className="block text-gray-700 font-semibold mb-1 text-sm">
                        Repeats
                    </label>
                    <select
                        id="edit-event-repetition"
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
                        Update Event
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditEventForm;