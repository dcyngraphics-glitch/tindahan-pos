import { useState, useRef } from 'react';
import { useBarcodeScannerListener } from '../hooks/useBarcodeScannerListener';

export function ScannerNotificationBanner() {
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBarcodeScannerListener((barcode) => {
    setLastScanned(barcode);
    setActiveStatus(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActiveStatus(false), 3000);
  });

  return (
    <div className="fixed bottom-16 right-4 z-50 flex items-center gap-2 bg-slate-900/90 text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-medium backdrop-blur pointer-events-none">
      <span className={`w-2.5 h-2.5 rounded-full ${activeStatus ? 'bg-green-400 animate-ping' : 'bg-green-500'}`} />
      <span>📷 Scanner: <strong>{activeStatus ? 'Receiving...' : 'Ready (USB/BT HID)'}</strong></span>
      {lastScanned && <span className="ml-2 bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-mono font-bold">Last: {lastScanned}</span>}
    </div>
  );
}
