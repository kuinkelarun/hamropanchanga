import React, { useEffect } from 'react';

const Toast = ({ id, type = 'success', message, onClose, duration = 3500 }) => {
  useEffect(() => {
    const t = setTimeout(() => onClose && onClose(id), duration);
    return () => clearTimeout(t);
  }, [id, onClose, duration]);

  const bg = type === 'error' ? 'bg-red-600' : 'bg-green-600';

  return (
    <div className={`fixed right-4 top-4 z-60 ${bg} text-white px-4 py-2 rounded shadow-md`}>
      {message}
    </div>
  );
};

export default Toast;
