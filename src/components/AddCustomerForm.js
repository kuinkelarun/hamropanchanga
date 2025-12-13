import { useState, useEffect } from 'react';

// Component to add a new customer
const AddCustomerForm = ({ initialData, onAddSuccess, onUpdateSuccess, onCancel }) => {
    const [name, setName] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [location, setLocation] = useState('');

    // Prefill when editing an existing customer
    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setContactInfo(initialData.contactInfo || '');
            setLocation(initialData.location || '');
        } else {
            setName('');
            setContactInfo('');
            setLocation('');
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (initialData && initialData.id) {
            // Editing existing customer - only update simple fields
            const updatedFields = {
                name,
                contactInfo,
                location
            };
            if (onUpdateSuccess) onUpdateSuccess(updatedFields);
            return;
        }

        const selfId = crypto.randomUUID();
        const newCustomerData = {
            name,
            contactInfo,
            location,
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
        if (onAddSuccess) onAddSuccess(newCustomerData); // Corrected prop name
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6" 
                style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                {initialData ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">Customer Name *</label>
                    <input 
                        id="name" 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all" 
                        placeholder="Enter customer name"
                        required 
                    />
                </div>
                <div>
                    <label htmlFor="contact" className="block text-gray-700 font-semibold mb-2">Contact Information</label>
                    <input 
                        id="contact" 
                        type="text" 
                        value={contactInfo} 
                        onChange={(e) => setContactInfo(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all" 
                        placeholder="Phone number, email, etc."
                    />
                </div>
                <div>
                    <label htmlFor="location" className="block text-gray-700 font-semibold mb-2">Location</label>
                    <input 
                        id="location" 
                        type="text" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all" 
                        placeholder="City, address, etc."
                    />
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all font-semibold order-2 sm:order-1"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="px-8 py-3 rounded-lg text-white font-semibold transition-all shadow-md order-1 sm:order-2"
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                        }}
                    >
                        {initialData ? 'Update Contact' : 'Add Customer'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddCustomerForm;