import { useState } from 'react';

// Component to add a new customer
const AddCustomerForm = ({ onAddSuccess, onCancel }) => {
    const [name, setName] = useState('');
    const [contactInfo, setContactInfo] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        const selfId = crypto.randomUUID();
        const newCustomerData = {
            name,
            contactInfo,
            familyMembers: {
                [selfId]: {
                    id: selfId,
                    name: name,
                    relation: 'Self',
                    parentIds: [],
                    spouseIds: [],
                    generation: 0
                }
            },
            events: []
        };
        onAddSuccess(newCustomerData); // Corrected prop name
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-gray-700 font-semibold mb-1">Customer Name</label>
                    <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                    <label htmlFor="contact" className="block text-gray-700 font-semibold mb-1">Contact Information</label>
                    <input id="contact" type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex justify-end space-x-4">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 rounded-xl hover:bg-gray-200 transition">Cancel</button>
                    <button type="submit" className="px-6 py-2 rounded-xl text-white font-semibold transition bg-blue-600 hover:bg-blue-700">Add Customer</button>
                </div>
            </form>
        </div>
    );
};

export default AddCustomerForm;