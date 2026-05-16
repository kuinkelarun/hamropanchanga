import React, { useRef, useEffect } from 'react';
import './ResponsiveModal.css';

/**
 * Bottom Sheet Component - Mobile-optimized modal that slides from bottom
 * Features:
 * - Swipe down to dismiss (80px threshold)
 * - Fixed header with close button
 * - Scrollable content area
 * - Sticky footer for action buttons
 * - Safe area aware (notches, navigation bars)
 */
const BottomSheet = ({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  maxHeight = '85vh',
  overflowContent = false,
}) => {
  const sheetRef = useRef(null);
  const contentRef = useRef(null);
  const dismissTimerRef = useRef(null);

  // Drag state in refs — no re-renders during gesture, stays at 60fps
  const dragStartY = useRef(0);
  const isDragging = useRef(false);

  // Prevent body scroll when sheet is open
  useEffect(() => {
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
  }, [isOpen]);

  // Non-passive touch listeners so e.preventDefault() actually works.
  // React synthetic onTouchMove is passive by default — calling preventDefault()
  // inside it is silently ignored and won't stop pull-to-refresh or background scroll.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !isOpen) return;

    const handleTouchStart = (e) => {
      // Only activate dismiss-swipe when content is scrolled to top
      const scrollTop = contentRef.current?.scrollTop ?? 0;
      if (scrollTop > 0) return;
      dragStartY.current = e.touches[0].clientY;
      isDragging.current = true;
      // Suspend CSS transition for instant drag feedback
      sheet.style.transition = 'none';
    };

    const handleTouchMove = (e) => {
      if (!isDragging.current) return;
      const delta = Math.max(0, e.touches[0].clientY - dragStartY.current);
      // Block pull-to-refresh and background page scroll
      e.preventDefault();
      // Apply transform directly — bypasses React render cycle, stays at 60fps
      sheet.style.transform = `translateY(${delta}px)`;
      sheet.style.opacity = String(Math.max(0.5, 1 - delta / 300));
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Read delta from the inline style applied above
      const m = (sheet.style.transform || '').match(/translateY\((\d+(?:\.\d+)?)px\)/);
      const delta = m ? parseFloat(m[1]) : 0;

      // Re-enable transition for smooth snap-back or exit animation
      sheet.style.transition = 'transform 0.25s ease, opacity 0.25s ease';

      if (delta > 80) {
        // Animate fully off-screen BEFORE calling onClose so the touch can't
        // bleed through to the background page and scroll it.
        sheet.style.transform = 'translateY(100%)';
        sheet.style.opacity = '0';
        dismissTimerRef.current = setTimeout(() => onClose(), 260);
      } else {
        sheet.style.transform = 'translateY(0)';
        sheet.style.opacity = '1';
      }
    };

    sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
    sheet.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart);
      sheet.removeEventListener('touchmove', handleTouchMove);
      sheet.removeEventListener('touchend', handleTouchEnd);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="bs-backdrop" onClick={onClose}>
      <div
        className="bs-sheet"
        onClick={(e) => e.stopPropagation()}
        ref={sheetRef}
        style={{ maxHeight }}
      >
        {/* Drag Handle */}
        <div className="bs-drag-handle" />

        {/* Header */}
        {title && (
          <div className="bs-header">
            <h2 className="bs-title">{title}</h2>
            {showCloseButton && (
              <button
                className="bs-close"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className="bs-content"
          ref={contentRef}
          style={{
            overflowY: overflowContent ? 'auto' : 'visible',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
