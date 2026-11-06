import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('scanner');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 120 } },
        (decodedText) => {
          const now = Date.now();
          const last = lastScannedRef.current;
          // Debounce: ignore same barcode within 2 seconds
          if (decodedText === last.code && now - last.time < 2000) return;
          lastScannedRef.current = { code: decodedText, time: now };
          onScanRef.current(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        setError('Camera not available: ' + err);
      });

    return () => {
      try {
        scanner.stop().catch(() => {});
      } catch (e) {
        // "Cannot stop, scanner is not running or paused" etc. - ignore.
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-slate-900 flex flex-col relative overflow-hidden">
      <div className="flex-1 flex items-center justify-center relative">
        <div id="scanner" className="scanner-container w-full h-full" />
        <div className="absolute inset-0 border-4 border-amber-500 rounded-2xl m-4 pointer-events-none flex items-center justify-center">
          <span className="bg-black/80 text-amber-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            Align Barcode in Frame
          </span>
        </div>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-white rounded-2xl p-6 text-center max-w-xs shadow-xl">
            <p className="text-red-600 font-bold text-sm mb-2">Camera Access Required</p>
            <p className="text-slate-500 text-xs mb-4">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
