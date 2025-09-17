import React, { useRef, useEffect, useState } from 'react';

const EventMenu = ({ event, onEdit, onDeleteRequest, showDelete = true }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }} className="p-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border rounded-md shadow-lg z-10">
          <button onClick={() => { onEdit && onEdit(event); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">Edit</button>
          {showDelete && (
            <button onClick={() => { onDeleteRequest && onDeleteRequest(event); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
          )}
        </div>
      )}
    </div>
  );
};

export default EventMenu;
