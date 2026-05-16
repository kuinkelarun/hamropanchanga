import React from 'react';
import BottomSheet from '../ResponsiveModal/BottomSheet';
import DayDetailsContent from './DayDetailsContent';

const DayDetailsModal = ({
  isOpen,
  onClose,
  activeDate,
  tithis,
  publicEvents,
  personalEvents,
  user,
  isAdmin,
  isSuperUser,
  permsLoading,
  hasPermission,
  onOpenAddEvent,
  onOpenAddTithi,
  onDeleteEvent,
  onTreeEventClick,
  trees = [],
  getTithiDisplayName,
  formatTithiDateTime,
  getTreeMemberName,
  getResolvedTithiEventDate,
}) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="92vh" overflowContent>
      <DayDetailsContent
        activeDate={activeDate}
        tithis={tithis}
        publicEvents={publicEvents}
        personalEvents={personalEvents}
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
        permsLoading={permsLoading}
        hasPermission={hasPermission}
        onOpenAddEvent={onOpenAddEvent}
        onOpenAddTithi={onOpenAddTithi}
        onDeleteEvent={onDeleteEvent}
        onTreeEventClick={onTreeEventClick}
        trees={trees}
        getTithiDisplayName={getTithiDisplayName}
        formatTithiDateTime={formatTithiDateTime}
        getTreeMemberName={getTreeMemberName}
        onClose={onClose}
      />
    </BottomSheet>
  );
};

export default DayDetailsModal;
