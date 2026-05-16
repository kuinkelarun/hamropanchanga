import React from 'react';
import BottomSheet from '../ResponsiveModal/BottomSheet';
import AddTithiContent from './AddTithiContent';

export default function AddTithiModal({
  isOpen,
  onClose,
  activeDate,
  focusHint,
  user,
  authLoading,
  onAddTithi,
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="92vh" overflowContent>
      <AddTithiContent
        isOpen={isOpen}
        onClose={onClose}
        activeDate={activeDate}
        focusHint={focusHint}
        user={user}
        authLoading={authLoading}
        onAddTithi={onAddTithi}
      />
    </BottomSheet>
  );
}
