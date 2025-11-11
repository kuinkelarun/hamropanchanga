import React, { useEffect, useRef, useState } from 'react';

// groupedOptions: [{ label: 'Parents', options: ['Father','Mother'] }, ...]
export default function RelationInput({ id, value, onChange, groupedOptions = [], placeholder = '', required = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e){
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) {
        // click outside: close dropdown
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    // When the controlled value changes externally (e.g., form resets or parent updates),
    // clear the local query and close suggestions to avoid auto-opening.
    setQuery('');
    setOpen(false);
  }, [value]);

  const filteredGroups = groupedOptions.map(group => {
    const opts = group.options.filter(o => {
      if (!query) return true;
      return o.toLowerCase().includes(query.toLowerCase());
    });
    return { label: group.label, options: opts };
  }).filter(g => g.options.length > 0);

  // handle user typing (only open on user-initiated events)
  const handleInputChange = (e) => {
    const v = e.target.value;
    onChange(v);
    setQuery(v);
    // Only open if this is a user interaction (avoid opening on programmatic changes)
    if (e.isTrusted !== false) setOpen(true);
  };

  return (
    <div className="relative" ref={ref}>
      <input
        id={id}
        name={id}
        autoComplete="off"
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
        aria-autocomplete="list"
        aria-haspopup="listbox"
      />

      {open && filteredGroups.length > 0 && (
        <div role="listbox" aria-label="Relation suggestions" className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
          {filteredGroups.map(g => (
            <div key={g.label} className="px-2 py-1">
              <div className="text-xs text-gray-500 font-semibold px-1 py-1">{g.label}</div>
              {g.options.map(opt => (
                <div
                  key={opt}
                  role="option"
                  tabIndex={0}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  onKeyDown={(e)=> { if (e.key === 'Enter') { onChange(opt); setOpen(false); } }}
                  className="px-2 py-1 hover:bg-gray-100 rounded cursor-pointer text-sm"
                >
                  {opt}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
