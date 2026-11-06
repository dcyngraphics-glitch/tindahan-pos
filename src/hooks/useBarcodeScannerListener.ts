import { useEffect, useRef } from 'react';

export function useBarcodeScannerListener(onScan: (barcode: string) => void) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when modifier keys are held (Ctrl+C, Alt+Tab, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const currentTime = Date.now();

      // If typing is too slow (800ms threshold for wireless/Bluetooth scanners), reset buffer
      if (currentTime - lastKeyTime > 800) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      // Support Enter, Tab, and carriage return/newline terminators
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Return' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        const barcode = buffer.trim();
        if (barcode.length > 2) {
          onScanRef.current(barcode);
          buffer = '';
          e.preventDefault();
        } else {
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
