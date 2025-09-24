import React, { useEffect, useRef, useState } from 'react';

// groupedOptions: [{ label: 'Parents', options: ['Father','Mother'] }, ...]
export default function RelationInput({ id, value, onChange, groupedOptions = [], placeholder = '', required = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e){
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    // reset query when value externally changes
    setQuery('');
  }, [value]);

  const filteredGroups = groupedOptions.map(group => {
    const opts = group.options.filter(o => {
      if (!query) return true;
      return o.toLowerCase().includes(query.toLowerCase());
    });
    return { label: group.label, options: opts };
  }).filter(g => g.options.length > 0);

  return (
    <div className="relative" ref={ref}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setQuery(e.target.value); setOpen(true); }}
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
