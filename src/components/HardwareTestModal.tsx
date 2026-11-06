import { useState, useEffect } from 'react';
import { getProductByBarcode } from '../services/products';
import { printViaBluetooth } from '../services/printer';
import { connectSerialScanner } from '../services/serialScanner';
import { useHardwareStore } from '../stores/hardwareStore';
import { formatPeso, type Product } from '../services/db';

interface HardwareTestModalProps {
  onClose: () => void;
}

export function HardwareTestModal({ onClose }: HardwareTestModalProps) {
  const [lastScanned, setLastScanned] = useState<string>('None yet. Click the input below and scan with your physical barcode scanner.');
  const [productMatch, setProductMatch] = useState<Product | null>(null);
  const [testInput, setTestInput] = useState<string>('');
  const [printing, setPrinting] = useState<boolean>(false);
  const [printResult, setPrintResult] = useState<string | null>(null);
  const [connectingSerial, setConnectingSerial] = useState<boolean>(false);

  const { isSerialConnected, setSerialScanner, disconnectSerialScanner } = useHardwareStore();

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyTime > 300) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length > 0) {
          const barcode = buffer.trim();
          setLastScanned(barcode);
          getProductByBarcode(barcode).then(prod => setProductMatch(prod || null));
          buffer = '';
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleTestPrint = async () => {
    setPrinting(true);
    setPrintResult(null);
    try {
      const success = await printViaBluetooth({
        items: [{ name: 'Lucky Me Pancit Canton', price: 1500, quantity: 1 }],
        total: 1500,
        cashTendered: 2000,
        change: 500,
        date: new Date(),
      });
      setPrintResult(success ? '✅ Print successful!' : '❌ Print failed or cancelled.');
    } catch (err) {
      setPrintResult('❌ Error: ' + (err as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-xl font-bold text-slate-800">🛠️ Hardware Test & Diagnostics</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-lg font-bold px-2 py-1">✕</button>
        </div>

        {/* Scanner Test Section */}
        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-2">1. Bluetooth Barcode Scanner Test</h3>
          <p className="text-xs text-slate-500 mb-3">
            Ensure your scanner is paired in <strong>HID Keyboard Wedge mode</strong>. Point your scanner at any barcode (e.g. sample items like Lucky Me: <code className="bg-slate-200 px-1 py-0.5 rounded">4800016045321</code>) and scan:
          </p>
          <div className="bg-white p-3 rounded-lg border border-slate-300 mb-2">
            <p className="text-xs text-slate-400">Last Captured Barcode:</p>
            <p className="text-lg font-mono font-bold text-amber-600">{lastScanned}</p>
          </div>
          {productMatch ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              ✅ Match found: <strong>{productMatch.name}</strong> ({formatPeso(productMatch.price)}) — Stock: {productMatch.stock}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No product match yet or unrecognized barcode.</p>
          )}
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Or test type / scan into input box:</label>
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && testInput) {
                  setLastScanned(testInput);
                  getProductByBarcode(testInput).then(prod => setProductMatch(prod || null));
                  setTestInput('');
                }
              }}
              placeholder="Click here and scan/type barcode + Enter..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2">
              If your scanner (e.g. EYOYO EY-011) is paired in <strong>Virtual COM / Serial mode</strong> instead of HID keyboard, connect via Web Serial:
            </p>
            {isSerialConnected ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2.5 rounded-lg text-sm text-green-800">
                <span>🟢 Serial Scanner Connected</span>
                <button
                  onClick={disconnectSerialScanner}
                  className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setConnectingSerial(true);
                  try {
                    const res = await connectSerialScanner((barcode) => {
                      setLastScanned(barcode);
                      getProductByBarcode(barcode).then(prod => setProductMatch(prod || null));
                    });
                    if (res) {
                      setSerialScanner(res.port, res.reader);
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setConnectingSerial(false);
                  }
                }}
                disabled={connectingSerial}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition"
              >
                {connectingSerial ? 'Selecting Port...' : '🔌 Connect USB/Serial Scanner (Web Serial)'}
              </button>
            )}
          </div>
        </div>

        {/* Printer Test Section */}
        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-2">2. Bluetooth Thermal Printer Test</h3>
          <p className="text-xs text-slate-500 mb-3">
            Tests Web Bluetooth pairing (`navigator.bluetooth`) with ESC/POS thermal printers (GOOJPRT, PT-220, MPT, etc.).
          </p>
          <button
            onClick={handleTestPrint}
            disabled={printing}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 transition"
          >
            {printing ? 'Connecting & Printing...' : '🖨️ Test Print Receipt'}
          </button>
          {printResult && (
            <p className="mt-3 text-sm font-medium text-center">{printResult}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl"
        >
          Close Diagnostics
        </button>
      </div>
    </div>
  );
}
