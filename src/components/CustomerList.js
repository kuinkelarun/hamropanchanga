// CustomerList.js (No changes needed, this code is from your file)
import React, { useState } from 'react';
import EventMenu from './EventMenu';

const CustomerList = ({ customers, trees = [], onSelectCustomer, onAddCustomer, onEditCustomer, onDeleteCustomer, onOpenTree, onDeleteTree }) => {
    const [openMenuId, setOpenMenuId] = useState(null);

    const handleToggle = (id) => {
        setOpenMenuId(prev => (prev === id ? null : id));
    };

    const handleClose = (id) => {
        // Only clear if the closing id matches the currently open one (defensive)
        setOpenMenuId(prev => (prev === id ? null : prev));
    };

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-center mb-4">
                <h2 className="section-title">Your Customers</h2>
                {/* <h2 className="text-2xl font-bold text-gray-800">Your Customers</h2> */}
                <button
                    onClick={onAddCustomer} // This now correctly uses the onAddCustomer prop
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105"
                >
                    Add New Customer
                </button>
            </div>
            {customers.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl shadow-md text-center text-gray-500">
                    No customers found. Click "Add New Customer" to get started.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customers.map((customer) => (
                        <div key={customer.id} className="relative bg-white p-6 rounded-2xl shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow">
                            <div className="absolute right-3 top-3 z-10">
                                <EventMenu
                                    event={customer}
                                    isOpen={openMenuId === customer.id}
                                    onToggle={handleToggle}
                                    onClose={handleClose}
                                    onEdit={() => onEditCustomer && onEditCustomer(customer)}
                                    onDeleteRequest={() => onDeleteCustomer && onDeleteCustomer(customer)}
                                />
                            </div>
                            <div onClick={() => onSelectCustomer(customer)}>
                                <h3 className="text-xl font-semibold text-gray-800">{customer.name}</h3>
                                {customer.location ? (
                                    <p className="text-sm text-gray-600">{customer.location}</p>
                                ) : (
                                    <p className="text-sm text-gray-400">No location provided</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trees Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="section-title">Your Trees</h2>
                    <button onClick={() => onOpenTree && onOpenTree(null)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105">
                        Create New Tree
                    </button>
                </div>
                {trees.length === 0 ? (
                    <div className="bg-white p-6 rounded-2xl shadow-md text-center text-gray-500">
                        No trees found. Click "Create New Tree" to get started.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trees.map((tree) => (
                            <div 
                                key={tree.id} 
                                className="relative bg-white p-6 rounded-2xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => onOpenTree && onOpenTree(tree.id)}
                            >
                                <h3 className="text-xl font-semibold text-gray-800">{tree.title || 'Untitled Tree'}</h3>
                                <p className="text-sm text-gray-500">ID: {tree.id}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerList;