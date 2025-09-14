// CustomerList.js (No changes needed, this code is from your file)
const CustomerList = ({ customers, onSelectCustomer, onAddCustomer }) => {
    return (
        <div className="space-y-6">
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
                        <div
                            key={customer.id}
                            className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                            // className="branch-card"
                            onClick={() => onSelectCustomer(customer)} // This is the corrected prop name
                        >
                            <h3 className="text-xl font-semibold text-gray-800">{customer.name}</h3>
                            <p className="text-gray-500">ID: {customer.id}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomerList;