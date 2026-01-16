import React from 'react';
import { displayMemberName } from './utils/format';
import { useLanguage } from '../../contexts/LanguageContext';

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
  isVisible = true,
  onToggle,
  modalOpen = false,
}) {
  const { t } = useLanguage();
  const membersOnCanvas = members.filter(m => hasPosVal(m.position));
  const membersInPool = members.filter(m => !hasPosVal(m.position));

  const handleAddClick = () => {
    if (!canAddMember) {
      if (showToast) showToast(t('treeBuilder.createOrSelectTree'));
      return;
    }
    if (onAddNewMember) onAddNewMember();
  };

  return (
    <>
      {!isVisible && (
        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-blue-600 text-white p-3 rounded-r-lg shadow-lg hover:bg-blue-700 transition-all lg:hidden"
          title={t('treeBuilder.expandSidebar')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <aside
        className={`
          h-full
          w-56 sm:w-64
          border-r border-gray-200 bg-white
          flex flex-col p-3 text-sm overflow-hidden
          transition-transform duration-300 ease-in-out
          ${isVisible ? 'translate-x-0' : '-translate-x-full'}
          ${modalOpen ? 'pointer-events-none' : ''}
        `}
        style={{
          ...(modalOpen ? { filter: 'brightness(0.85)', opacity: 0.7 } : {}),
          // Conditionally add extra top padding on mobile to prevent header from blocking content
          paddingTop: window.innerWidth < 1024 ? '8px' : undefined
        }}
        onMouseEnter={() => {
          if (window.innerWidth >= 1024 && !isVisible) onToggle?.();
        }}
      >
        {modalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-30 z-20 pointer-events-none" />
        )}

        <div className="mb-3 hidden">
          <button
            type="button"
            onClick={handleAddClick}
            className={`w-full px-3 py-2 rounded-md text-sm font-medium text-white ${
              canAddMember ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-200 cursor-not-allowed'
            }`}
            title={!canAddMember ? t('treeBuilder.createOrSelectTree') : t('treeBuilder.addNode')}
          >
            {t('treeBuilder.addNode')}
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800 text-sm">{t('treeBuilder.members')}</h2>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors lg:hidden"
            title={t('treeBuilder.hideSidebar')}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div>
            <div className="flex items-center gap-2 text-gray-700 font-medium text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              <span>{t('treeBuilder.memberPool')} ({membersInPool.length})</span>
            </div>
            {membersInPool.length === 0 ? (
              <div className="mt-2 p-2 rounded-md bg-gray-50 text-gray-500 italic text-xs">
                {t('treeBuilder.noMembersInPool')}
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
                    className="group flex items-center justify-between px-2 py-1.5 rounded-md border border-gray-200 bg-white text-xs text-gray-800 cursor-grab hover:bg-gray-100 hover:border-orange-500 active:cursor-grabbing relative"
                    title={t('treeBuilder.dragToCanvasOrAdd')}
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
                      {t('treeBuilder.add')}
                    </button>
                    {/* Tooltip on hover */}
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap z-30 pointer-events-none">
                      {t('treeBuilder.dragToCanvas')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <hr className="border-gray-200" />

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 text-gray-700 font-medium text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>{t('treeBuilder.onCanvas')} ({membersOnCanvas.length})</span>
            </div>
            {membersOnCanvas.length === 0 ? (
              <div className="mt-2 p-2 rounded-md bg-gray-50 text-gray-500 italic text-xs">
                {t('treeBuilder.noMembersOnCanvas')}
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
    </>
  );
}
