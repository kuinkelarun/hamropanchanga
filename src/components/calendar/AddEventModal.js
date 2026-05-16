import React from 'react';
import BottomSheet from '../ResponsiveModal/BottomSheet';
import AddEventContent from './AddEventContent';

export default function AddEventModal({
  isOpen,
  onClose,
  activeDate,
  user,
  authLoading,
  isAdmin,
  isSuperUser,
  findTithisForAdDate,
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="92vh" overflowContent>
      <AddEventContent
        isOpen={isOpen}
        onClose={onClose}
        activeDate={activeDate}
        user={user}
        authLoading={authLoading}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
        findTithisForAdDate={findTithisForAdDate}
      />
    </BottomSheet>
  );
}
