import React from 'react';
import './SearchBar.css';

/**
 * Reusable search bar with icon and clear button.
 *
 * Props:
 *   value       {string}   - controlled value
 *   onChange    {function} - called with the new string value on every keystroke
 *   placeholder {string}   - input placeholder text
 *   className   {string}   - optional extra class on the wrapper
 */
export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '' }) {
    return (
        <div className={`sb-wrap${className ? ' ' + className : ''}`}>
            <svg className="sb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
                className="sb-input"
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
            {value && (
                <button className="sb-clear" onClick={() => onChange('')} aria-label="Clear search">×</button>
            )}
        </div>
    );
}
