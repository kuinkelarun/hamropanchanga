import React, { useEffect } from 'react';
import { useWindowSize } from '../../hooks/useWindowSize';
import BottomSheet from './BottomSheet';
import './ResponsiveModal.css';

/**
 * Responsive Modal Wrapper
 * Automatically adapts based on screen size:
 * - Mobile (<640px): Bottom sheet with swipe-to-dismiss
 * - Tablet (640-1024px): Medium responsive modal
 * - Desktop (≥1024px): Standard centered modal
 *
 * Usage:
 * <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Share Tree">
 *   <YourFormContent />
 * </ResponsiveModal>
 */
const ResponsiveModal = ({
  isOpen,
  onClose,
  children,
  title,
  className = '',
  modalClassName = '',
  showCloseButton = true,
  fullScreenOnMobile = false,
  maxHeightOverride = null,
  fullScreen = false,
}) => {
  const { isMobile, isDesktop } = useWindowSize();

  // Lock body scroll when fullScreen modal is open
  useEffect(() => {
    if (!fullScreen) return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, fullScreen]);

  if (!isOpen) return null;

  // Full-screen mode: bypass BottomSheet and centered modal
  if (fullScreen) {
    return (
      <div className="rm-fullscreen-container">
        {title && (
          <div className="rm-header">
            <h2 className="rm-title">{title}</h2>
            {showCloseButton && (
              <button className="rm-close" onClick={onClose} aria-label="Close">✕</button>
            )}
          </div>
        )}
        <div className={`rm-content rm-content-scroll ${className}`}>{children}</div>
      </div>
    );
  }

  // Mobile/small tablet (<768px): Use bottom sheet
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        showCloseButton={showCloseButton}
        maxHeight={fullScreenOnMobile ? '96vh' : '92vh'}
        overflowContent={true}
      >
        <div className={className}>{children}</div>
      </BottomSheet>
    );
  }

  // Tablet/Desktop: Centered modal
  return (
    <div className="rm-backdrop" onClick={onClose}>
      <div
        className={`rm-modal ${isDesktop ? 'rm-modal-desktop' : 'rm-modal-tablet'} ${modalClassName}`}
        onClick={(e) => e.stopPropagation()}
        style={maxHeightOverride ? { maxHeight: maxHeightOverride } : {}}
      >
        {/* Header with close button */}
        {title && (
          <div className="rm-header">
            <h2 className="rm-title">{title}</h2>
            {showCloseButton && (
              <button
                className="rm-close"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`rm-content ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveModal;
