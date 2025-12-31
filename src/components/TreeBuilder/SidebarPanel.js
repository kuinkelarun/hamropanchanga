import React from 'react';
import { displayMemberName } from './utils/format';

function hasPosVal(pos) {
  return pos && typeof pos.x === 'number' && typeof pos.y === 'number';
}

export default function SidebarPanel({
  members = [],
  onAddNewMember,
  onAddMemberToCanvas,
  onSelectMember,
  canAddMember = false,
  showToast,
}) {
  const membersOnCanvas = members.filter(m => hasPosVal(m.position));
  const membersInPool = members.filter(m => !hasPosVal(m.position));

  const handleAddClick = () => {
    if (!canAddMember) {
      if (showToast) showToast('Create or select a tree to add members.');
      return;
    }
    if (onAddNewMember) onAddNewMember();
  };

  return (
    <aside className="w-64 border-r border-gray-200 bg-white flex flex-col p-3 text-sm overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-800 text-sm">Members</h2>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div>
          <div className="flex items-center gap-2 text-gray-700 font-medium text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span>Member Pool ({membersInPool.length})</span>
          </div>
          <div className="mt-2 mb-2">
            <button
              type="button"
              onClick={handleAddClick}
              className={`px-3 py-1.5 rounded-md text-xs font-medium text-white ${
                canAddMember ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-200 cursor-not-allowed'
              }`}
              title={!canAddMember ? 'Create or select a tree to add members.' : 'Add a new member to this tree'}
            >
              + Add New Member
            </button>
          </div>
          {membersInPool.length === 0 ? (
            <div className="mt-1 p-2 rounded-md bg-gray-50 text-gray-500 italic text-xs">
              No members in pool. Use "+ Add New Member" to create members.
            </div>
          ) : (
            <ul className="mt-2 space-y-1 max-h-44 overflow-y-auto pr-1">
              {membersInPool.map(m => (
                <li
                  key={m.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/reactflow', 'member');
                    e.dataTransfer.setData('memberId', m.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md border border-gray-200 bg-white text-xs text-gray-800 cursor-grab hover:bg-gray-100 hover:border-orange-500 active:cursor-grabbing"
                  onClick={() => onSelectMember && onSelectMember(m.id)}
                >
                  <span className="font-medium truncate mr-2">{displayMemberName(m)}</span>
                  <button
                    type="button"
                    className="px-1.5 py-0.5 text-[11px] rounded bg-orange-500 text-white hover:bg-orange-600"
                    onClick={e => {
                      e.stopPropagation();
                      if (onAddMemberToCanvas) onAddMemberToCanvas(m);
                    }}
                  >
                    + Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <hr className="border-gray-200" />

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 text-gray-700 font-medium text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>On Canvas ({membersOnCanvas.length})</span>
          </div>
          {membersOnCanvas.length === 0 ? (
            <div className="mt-2 p-2 rounded-md bg-gray-50 text-gray-500 italic text-xs">
              No members on canvas yet.
            </div>
          ) : (
            <ul className="mt-2 space-y-1 overflow-y-auto pr-1 text-xs">
              {membersOnCanvas.map(m => (
                <li
                  key={m.id}
                  className="px-2 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-pointer hover:bg-emerald-100"
                  onClick={() => onSelectMember && onSelectMember(m.id)}
                >
                  {displayMemberName(m)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
