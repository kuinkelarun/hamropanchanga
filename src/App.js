import { useState, useEffect } from 'react';

// Main App component
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'details', 'add'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Simulate user ID for demo purposes
  const userId = 'demo-user-123';

  // Handle customer selection
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setView('details');
  };

  // Handle navigation
  const handleBackToList = () => {
    setSelectedCustomer(null);
    setView('list');
  };

  const handleAddCustomer = () => {
    setView('add');
  };

  const handleAddCustomerSuccess = (newCustomer) => {
    setCustomers(prev => [...prev, newCustomer]);
    setView('list');
  };

  // Update customer in the list when modified
  const handleUpdateCustomer = (updatedCustomer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    setSelectedCustomer(updatedCustomer);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="text-xl text-gray-700">Loading...</div>
    </div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="text-red-500 text-center">{error}</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-6 text-center">
          Customer Family & Events Manager
        </h1>

        <div className="text-center text-sm text-gray-500 mb-4">
          Demo Mode - User ID: <span className="font-mono text-gray-600">{userId}</span>
        </div>

        {view === 'list' && (
          <CustomerList
            customers={customers}
            onSelect={handleSelectCustomer}
            onAdd={handleAddCustomer}
          />
        )}
        {view === 'details' && selectedCustomer && (
          <CustomerDetail
            customer={selectedCustomer}
            onBack={handleBackToList}
            onUpdate={handleUpdateCustomer}
          />
        )}
        {view === 'add' && (
          <AddCustomerForm
            onSuccess={handleAddCustomerSuccess}
            onCancel={handleBackToList}
          />
        )}
      </div>
    </div>
  );
}

// Component to display the list of customers
const CustomerList = ({ customers, onSelect, onAdd }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
        <button
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105"
        >
          Add New Customer
        </button>
      </div>
      {customers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No customers found. Click "Add New Customer" to get started!
        </div>
      ) : (
        <ul className="space-y-4">
          {customers.map(customer => (
            <li
              key={customer.id}
              className="p-4 bg-gray-50 rounded-xl shadow-sm hover:bg-gray-100 transition cursor-pointer flex justify-between items-center"
              onClick={() => onSelect(customer)}
            >
              <div>
                <span className="text-lg font-medium text-gray-700">{customer.name}</span>
                <div className="text-sm text-gray-500">{customer.contactInfo}</div>
              </div>
              <span className="text-sm text-gray-400">View Details &raquo;</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Component to add a new customer
const AddCustomerForm = ({ onSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newCustomer = {
        id: crypto.randomUUID(),
        name,
        contactInfo,
        familyMembers: {
          [crypto.randomUUID()]: {
            id: crypto.randomUUID(),
            name: name,
            relation: 'Self',
            parentIds: [],
            spouseIds: [],
            generation: 0
          }
        },
        events: []
      };
      
      onSuccess(newCustomer);
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Failed to add customer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Customer</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-gray-700 font-semibold mb-1">
            Customer Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label htmlFor="contact" className="block text-gray-700 font-semibold mb-1">
            Contact Information
          </label>
          <input
            id="contact"
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 rounded-xl hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className={`px-6 py-2 rounded-xl text-white font-semibold transition ${
              isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSaving ? 'Saving...' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Component to view customer details
const CustomerDetail = ({ customer, onBack, onUpdate }) => {
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(customer);

  // Function to add a new family member
  const handleAddFamilyMember = async (memberData) => {
    setIsAddingMember(false);
    try {
      const updatedFamilyMembers = { ...currentCustomer.familyMembers };
      
      const newMemberId = crypto.randomUUID();
      
      let generation;
      if (memberData.parentIds && memberData.parentIds.length > 0) {
        const parent = updatedFamilyMembers[memberData.parentIds[0]];
        if (parent) {
          generation = parent.generation - 1;
        } else {
          generation = calculateGeneration(memberData.relation, memberData.parentIds, updatedFamilyMembers);
        }
      } else {
        generation = calculateGeneration(memberData.relation, [], updatedFamilyMembers);
      }

      const newMember = {
        id: newMemberId,
        name: memberData.name,
        relation: memberData.relation,
        parentIds: memberData.parentIds || [],
        spouseIds: [],
        generation: generation
      };

      updatedFamilyMembers[newMemberId] = newMember;

      // Update parent-child relationships
      if (memberData.parentIds && memberData.parentIds.length > 0) {
        memberData.parentIds.forEach(parentId => {
          if (updatedFamilyMembers[parentId]) {
            if (!updatedFamilyMembers[parentId].childIds) {
              updatedFamilyMembers[parentId].childIds = [];
            }
            if (!updatedFamilyMembers[parentId].childIds.includes(newMemberId)) {
              updatedFamilyMembers[parentId].childIds.push(newMemberId);
            }
          }
        });
      }

      const updatedCustomer = {
        ...currentCustomer,
        familyMembers: updatedFamilyMembers
      };
      
      setCurrentCustomer(updatedCustomer);
      onUpdate(updatedCustomer);
    } catch (error) {
      console.error("Error adding family member:", error);
    }
  };

  // Function to add a new event
  const handleAddEvent = async (eventData) => {
    setIsAddingEvent(false);
    try {
      const updatedEvents = [...currentCustomer.events, eventData];
      const updatedCustomer = {
        ...currentCustomer,
        events: updatedEvents
      };
      
      setCurrentCustomer(updatedCustomer);
      onUpdate(updatedCustomer);
    } catch (error) {
      console.error("Error adding event:", error);
    }
  };

  const familyMembersArray = Object.values(currentCustomer.familyMembers || {});
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={onBack}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full transition-transform transform hover:scale-105"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-3xl font-bold text-gray-800">{currentCustomer.name}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Family Tree Section */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Family Tree</h3>
            <button
              onClick={() => setIsAddingMember(!isAddingMember)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm"
            >
              {isAddingMember ? 'Cancel' : 'Add Member'}
            </button>
          </div>
          
          {isAddingMember && (
            <AddFamilyMemberForm
              onAdd={handleAddFamilyMember}
              familyMembers={currentCustomer.familyMembers || {}}
            />
          )}
          
          <FamilyTreeChart familyMembers={currentCustomer.familyMembers || {}} />
        </div>

        {/* Events Section */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Events</h3>
            <button
              onClick={() => setIsAddingEvent(!isAddingEvent)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm"
            >
              {isAddingEvent ? 'Cancel' : 'Add Event'}
            </button>
          </div>
          {isAddingEvent && (
            <AddEventForm onAdd={handleAddEvent} familyMembers={familyMembersArray} />
          )}
          <EventList events={currentCustomer.events || []} />
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate generation
const calculateGeneration = (relation, parentIds, familyMembers) => {
  if (relation === 'Self') return 0;
  
  // If we have parent IDs, calculate based on parents' generation
  if (parentIds && parentIds.length > 0) {
    const parent = familyMembers[parentIds[0]];
    if (parent) {
      // Child is one generation below parent
      return parent.generation - 1;
    }
  }
  
  // Fallback to relation-based generation mapping
  const generationMap = {
    'Great Great Great Grandmother': 5,
    'Great Great Great Grandfather': 5,
    'Great Great Grandmother': 4,
    'Great Great Grandfather': 4,
    'Great Grandmother': 3,
    'Great Grandfather': 3,
    'Grandmother': 2,
    'Grandfather': 2,
    'Mother': 1,
    'Father': 1,
    'Uncle': 1,
    'Aunt': 1,
    'Self': 0,
    'Spouse': 0,
    'Brother': 0,
    'Sister': 0,
    'Son': -1,
    'Daughter': -1,
    'Grandson': -2,
    'Granddaughter': -2
  };

  if (generationMap.hasOwnProperty(relation)) {
    return generationMap[relation];
  }

  return 0; // Default to same generation as Self
};


// Enhanced Family Tree Chart Component
const FamilyTreeChart = ({ familyMembers }) => {
  if (!familyMembers || Object.keys(familyMembers).length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No family members added yet.
      </div>
    );
  }

  // Group members by generation
  const membersByGeneration = {};
  Object.values(familyMembers).forEach(member => {
    const gen = member.generation || 0;
    if (!membersByGeneration[gen]) {
      membersByGeneration[gen] = [];
    }
    membersByGeneration[gen].push(member);
  });

  // Sort generations from highest (oldest) to lowest (youngest)
  const sortedGenerations = Object.keys(membersByGeneration)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-full space-y-8 p-4">
        {sortedGenerations.map(generation => (
          <div key={generation} className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2 font-semibold">
              {getGenerationLabel(generation)}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {membersByGeneration[generation].map(member => (
                <div
                  key={member.id}
                  className="bg-white p-3 rounded-xl shadow-md border-2 border-gray-200 hover:shadow-lg transition-all cursor-pointer min-w-32 text-center"
                >
                  <div className="font-semibold text-gray-800 text-sm">{member.name}</div>
                  <div className="text-xs text-gray-500">({member.relation})</div>
                </div>
              ))}
            </div>
            {generation > sortedGenerations[sortedGenerations.length - 1] && (
              <div className="w-0.5 h-6 bg-gray-300 mt-4"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to get generation label
const getGenerationLabel = (generation) => {
  const labels = {
    5: 'Great Great Great Grandparents',
    4: 'Great Great Grandparents',
    3: 'Great Grandparents',
    2: 'Grandparents',
    1: 'Parents / Aunts & Uncles',
    0: 'Self / Spouse / Siblings',
    '-1': 'Children',
    '-2': 'Grandchildren'
  };
  return labels[generation] || `Generation ${generation}`;
};

// Component to add a new family member
const AddFamilyMemberForm = ({ onAdd, familyMembers }) => {
  const [relationshipType, setRelationshipType] = useState(''); // 'direct' or 'child_of'
  const [relation, setRelation] = useState('');
  const [name, setName] = useState('');
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  
  const directRelations = [
    'Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Uncle', 'Aunt',
    'Grandfather', 'Grandmother',
    'Great Grandfather', 'Great Grandmother',
    'Great Great Grandfather', 'Great Great Grandmother',
    'Great Great Great Grandfather', 'Great Great Great Grandmother'
  ];

  const childRelations = ['Son', 'Daughter'];

  const potentialParents = Object.values(familyMembers);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !relation) return;

    let finalRelation = relation;
    
    if (relationshipType === 'child_of' && selectedParentIds.length > 0) {
      const parent = Object.values(familyMembers).find(m => m.id === selectedParentIds[0]);
      if (parent) {
        switch (parent.relation) {
          case 'Self':
          case 'Spouse':
            finalRelation = relation;
            break;
          case 'Son':
          case 'Daughter':
            finalRelation = relation === 'Son' ? 'Grandson' : 'Granddaughter';
            break;
          case 'Father':
          case 'Mother':
            finalRelation = relation === 'Son' ? 'Brother' : 'Sister';
            break;
          
          // --- THIS IS THE CORRECTED LOGIC ---
          case 'Grandfather':
          case 'Grandmother':
            // A child of a known Grandparent is always an Uncle or Aunt.
            // This is the safest assumption and avoids incorrectly assigning a direct parent.
            finalRelation = relation === 'Son' ? 'Uncle' : 'Aunt';
            break;
          // ------------------------------------

          case 'Great Grandfather':
          case 'Great Grandmother':
            finalRelation = relation === 'Son' ? 'Grandfather' : 'Grandmother';
            break;
          default:
            finalRelation = relation;
        }
      }
    }

    onAdd({ 
      name, 
      relation: finalRelation, 
      parentIds: selectedParentIds 
    });
    
    setRelationshipType('');
    setRelation('');
    setName('');
    setSelectedParentIds([]);
  };

  // The JSX for the form remains the same
  return (
    <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
      <div>
        <label className="block text-gray-700 font-semibold mb-1 text-sm">
          How do you want to add this person?
        </label>
        <select
          value={relationshipType}
          onChange={(e) => {
            setRelationshipType(e.target.value);
            setRelation('');
            setSelectedParentIds([]);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        >
          <option value="" disabled>Choose relationship type...</option>
          <option value="direct">Add as direct relation (Father, Spouse, etc.)</option>
          <option value="child_of">Add as child of existing member</option>
        </select>
      </div>

      {relationshipType === 'direct' && (
        <div>
          <label htmlFor="relation" className="block text-gray-700 font-semibold mb-1 text-sm">
            Select Relation
          </label>
          <select
            id="relation"
            value={relation}
            onChange={(e) => {
              setRelation(e.target.value);
              setSelectedParentIds([]);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            required
          >
            <option value="" disabled>Select relation...</option>
            {directRelations.map(rel => (
              <option key={rel} value={rel}>{rel}</option>
            ))}
          </select>
        </div>
      )}

      {relationshipType === 'child_of' && (
        <div>
          <label htmlFor="child-relation" className="block text-gray-700 font-semibold mb-1 text-sm">
            This person is a...
          </label>
          <select
            id="child-relation"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            required
          >
            <option value="" disabled>Select gender...</option>
            {childRelations.map(rel => (
              <option key={rel} value={rel}>{rel}</option>
            ))}
          </select>
        </div>
      )}
      
      <div>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
      </div>

      {relationshipType === 'child_of' && potentialParents.length > 0 && (
        <div>
          <label className="block text-gray-700 font-semibold mb-1 text-sm">
            Select Parent(s)
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {potentialParents.map(parent => (
              <label key={parent.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedParentIds.includes(parent.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedParentIds([...selectedParentIds, parent.id]);
                    } else {
                      setSelectedParentIds(selectedParentIds.filter(id => id !== parent.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{parent.name} ({parent.relation})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl transition"
      >
        Add Member
      </button>
    </div>
  );
};


// Component to list upcoming events
const EventList = ({ events }) => {
  const upcomingEvents = events
    .map(event => ({
      ...event,
      date: new Date(event.date)
    }))
    .filter(event => event.date >= new Date())
    .sort((a, b) => a.date - b.date);

  return (
    <div className="space-y-3">
      {upcomingEvents.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">
          No upcoming events.
        </div>
      ) : (
        <ul className="space-y-2">
          {upcomingEvents.map((event, index) => (
            <li key={index} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
              <div className="flex-1">
                <div className="text-gray-800 font-medium">{event.name}</div>
                <div className="text-sm text-gray-500">{event.date.toDateString()}</div>
                {event.personName && (
                  <div className="text-xs text-gray-400 mt-1">For: {event.personName} ({event.personRelation})</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Component to add a new event
const AddEventForm = ({ onAdd, familyMembers }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState(familyMembers[0]?.id || '');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !date || !selectedPersonId) return;

    const selectedPerson = familyMembers.find(member => member.id === selectedPersonId);
    
    const eventData = {
      id: crypto.randomUUID(),
      name,
      date,
      personId: selectedPerson.id,
      personName: selectedPerson.name,
      personRelation: selectedPerson.relation
    };
    
    onAdd(eventData);
    setName('');
    setDate('');
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-inner mb-4 space-y-3">
      <div>
        <label htmlFor="event-person" className="block text-gray-700 font-semibold mb-1 text-sm">
          Event for
        </label>
        <select
          id="event-person"
          value={selectedPersonId}
          onChange={(e) => setSelectedPersonId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        >
          {familyMembers.length === 0 ? (
            <option value="" disabled>No family members to select</option>
          ) : (
            familyMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.relation})
              </option>
            ))
          )}
        </select>
      </div>
      <div>
        <input
          type="text"
          placeholder="Event Name (e.g., Birthday)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
      </div>
      <div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
      </div>
      <button
        onClick={handleSubmit}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl transition"
      >
        Add Event
      </button>
    </div>
  );
};