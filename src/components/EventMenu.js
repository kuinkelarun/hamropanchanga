import React, { useRef, useEffect, useState } from 'react';

// EventMenu supports both controlled and uncontrolled modes:
// - Controlled: pass `isOpen`, `onToggle(id)`, `onClose(id)` and manage open state from parent
// - Uncontrolled: omit `isOpen` and `onToggle`/`onClose` and it will manage its own open state
const EventMenu = ({ event, onEdit, onDeleteRequest, showDelete = true, isOpen, onToggle, onClose }) => {
  const [openInternal, setOpenInternal] = useState(false);
  const ref = useRef(null);

  const controlled = typeof isOpen !== 'undefined';
  const open = controlled ? isOpen : openInternal;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        if (controlled) {
          onClose && onClose(event.id);
        } else {
          setOpenInternal(false);
        }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [controlled, onClose, event]);

  const toggle = (e) => {
    e.stopPropagation();
    if (controlled) {
      onToggle && onToggle(event.id);
    } else {
      setOpenInternal(prev => !prev);
    }
  };

  const handleEdit = () => {
    onEdit && onEdit(event);
    if (controlled) onClose && onClose(event.id);
    else setOpenInternal(false);
  };

  const handleDelete = () => {
    onDeleteRequest && onDeleteRequest(event);
    if (controlled) onClose && onClose(event.id);
    else setOpenInternal(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="p-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border rounded-md shadow-lg z-10">
          <button onClick={handleEdit} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">Edit</button>
          {showDelete && (
            <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
          )}
        </div>
      )}
    </div>
  );
};

export default EventMenu;
