import React, { useCallback, useRef } from 'react';

// Hook custom pour gérer le clic long (long press)
export const useLongPress = (
  onLongPress: (event: React.MouseEvent | React.TouchEvent) => void,
  onClick: () => void,
  { delay = 500 }: { delay?: number } = {}
) => {
  const timeout = useRef<NodeJS.Timeout>();
  const longPressTriggered = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Empêcher le menu contextuel sur mobile qui peut apparaître au relâchement
      if ('touches' in event) {
        const preventContextMenu = (e: Event) => e.preventDefault();
        event.currentTarget.addEventListener('contextmenu', preventContextMenu, { once: true });
      }
      
      longPressTriggered.current = false;
      timeout.current = setTimeout(() => {
        onLongPress(event);
        longPressTriggered.current = true;
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      if (e.type === 'touchend' && longPressTriggered.current) {
        e.preventDefault();
      }
      if (!longPressTriggered.current) {
        onClick();
      }
    },
    [onClick]
  );
  
  const cancel = useCallback(() => {
    if (timeout.current) {
        clearTimeout(timeout.current);
    }
  }, []);


  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: cancel,
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  };
};