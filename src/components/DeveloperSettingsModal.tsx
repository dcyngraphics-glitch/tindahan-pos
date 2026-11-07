import { useState } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../context/AuthContext';
import { connectBluetoothScanner } from '../services/bluetoothScanner';
import { connectSerialScanner } from '../services/serialScanner';
import { useBluetoothStatus } from '../hooks/useBluetoothStatus';
import { getCashierPinHash, setCashierPinHash, hashPin } from '../services/cashierPin';

interface DeveloperSettingsModalProps {
  onClose: () => void;
}

export function DeveloperSettingsModal({ onClose }: DeveloperSettingsModalProps) {
  const { role } = useAuthStore();
  const { signOut } = useAuth();
  const { receiptConfig, updateReceiptConfig } = useSettingsStore();
  const { isPrinterConnected, printerName, isScannerConnected, scannerName, isSerialConnected, setScanner, setSerialScanner, disconnectPrinter, disconnectScanner, disconnectSerialScanner } = useHardwareStore();
  const { connectPrinter } = useBluetoothStatus();

  const [storeName, setStoreName] = useState(receiptConfig.storeName);
  const [storeAddress, setStoreAddress] = useState(receiptConfig.storeAddress);
  const [contactInfo, setContactInfo] = useState(receiptConfig.contactInfo);
  const [receiptHeader, setReceiptHeader] = useState(receiptConfig.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState(receiptConfig.receiptFooter);
  const [savedMsg, setSavedMsg] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Cashier PIN Change state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<{ text: string; error: boolean } | null>(null);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only cashier can change cashier PIN; inventory staff cannot.
    if (role !== 'cashier') {
      setPinMessage({ text: 'Only Cashier role can change the cashier PIN.', error: true });
      return;
    }
    const storedHash = getCashierPinHash();
    if (storedHash) {
      const currentHash = await hashPin(currentPinInput);
      if (currentHash !== storedHash) {
        setPinMessage({ text: 'Current PIN is incorrect.', error: true });
        return;
      }
    }
    if (!/^\d{4}$/.test(newPinInput)) {
      setPinMessage({ text: 'New PIN must be exactly 4 digits.', error: true });
      return;
    }
    const newHash = await hashPin(newPinInput);
    setCashierPinHash(newHash);
    setCurrentPinInput('');
    setNewPinInput('');
    setPinMessage({ text: 'Cashier PIN updated successfully! ✓', error: false });
    setTimeout(() => setPinMessage(null), 3000);
  };

  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    updateReceiptConfig({ storeName, storeAddress, contactInfo, receiptHeader, receiptFooter });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleConnectBTScanner = async () => {
    setConnecting(true);
    try {
      const res = await connectBluetoothScanner((barcode) => {
        console.log('[DevSettings] Scanned via BT:', barcode);
      });
      if (res) {
        setScanner(res.device, res.server, res.characteristic, res.device.name || 'BT Scanner');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectSerial = async () => {
    setConnecting(true);
    try {
      const res = await connectSerialScanner((barcode) => {
        console.log('[DevSettings] Scanned via Serial:', barcode);
      });
      if (res) {
        setSerialScanner(res.port, res.reader);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛠️</span>
            <div>
              <h2 className="text-xl font-black text-slate-900">Developer & Hardware Settings</h2>
              <p className="text-xs text-slate-500">Logged in as {role} ({role})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Account & Logout */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Active Session</p>
            <p className="font-bold text-slate-900">{role}</p>
          </div>
          <button
            onClick={() => { onClose(); void signOut(); }}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition"
          >
            Log Out 🚪
          </button>
        </div>

        {/* Hardware Status & Pairing */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Hardware Peripherals</h3>

          {/* Printer */}
          <div className="flex justify-between items-center p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <div>
              <p className="font-bold text-slate-800">🖨️ Thermal Receipt Printer</p>
              <p className="text-xs text-slate-500">{isPrinterConnected ? `Connected to ${printerName || 'Bluetooth Printer'}` : 'Not connected'}</p>
            </div>
            {isPrinterConnected ? (
              <button onClick={disconnectPrinter} className="px-3 py-1.5 bg-red-100 text-red-700 font-bold text-xs rounded-xl">Disconnect</button>
            ) : (
              <button onClick={() => connectPrinter()} className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm">Pair Bluetooth</button>
            )}
          </div>

          {/* Bluetooth Scanner */}
          <div className="flex justify-between items-center p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <div>
              <p className="font-bold text-slate-800">📷 Bluetooth Barcode Scanner</p>
              <p className="text-xs text-slate-500">{isScannerConnected ? `Connected to ${scannerName || 'BLE Scanner'}` : 'Not connected'}</p>
            </div>
            {isScannerConnected ? (
              <button onClick={disconnectScanner} className="px-3 py-1.5 bg-red-100 text-red-700 font-bold text-xs rounded-xl">Disconnect</button>
            ) : (
              <button disabled={connecting} onClick={handleConnectBTScanner} className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm">Pair BLE Scanner</button>
            )}
          </div>

          {/* Serial Scanner */}
          <div className="flex justify-between items-center p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <div>
              <p className="font-bold text-slate-800">🔌 USB / Serial Scanner</p>
              <p className="text-xs text-slate-500">{isSerialConnected ? 'Connected via Web Serial' : 'Not connected'}</p>
            </div>
            {isSerialConnected ? (
              <button onClick={disconnectSerialScanner} className="px-3 py-1.5 bg-red-100 text-red-700 font-bold text-xs rounded-xl">Disconnect</button>
            ) : (
              <button disabled={connecting} onClick={handleConnectSerial} className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm">Connect Serial</button>
            )}
          </div>
        </div>

        {/* Cashier Security PIN Management */}
        <div className="border-t border-slate-200 pt-6 mb-6">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">🔒 Cashier Security PIN</h3>
          <p className="text-xs text-slate-500 mb-4">Set or update the 4-digit PIN required to unlock the Cashier shift. If no PIN is set, the till opens without one.</p>

          <form onSubmit={handleChangePin} className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPinInput}
                  onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current PIN"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-mono tracking-widest text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New 4-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter new 4 digits"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-mono tracking-widest text-center"
                  required
                />
              </div>
            </div>

            {pinMessage && (
              <p className={`text-xs font-bold p-2 rounded-lg ${pinMessage.error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {pinMessage.text}
              </p>
            )}

            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold rounded-xl shadow-xs transition"
            >
              Update PIN
            </button>
          </form>
        </div>

        {/* Receipt Configuration */}
        <form onSubmit={handleSaveReceipt} className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Receipt Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Store Name</label>
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Store Address</label>
              <input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Contact Info</label>
              <input type="text" value={contactInfo} onChange={e => setContactInfo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Receipt Header</label>
              <input type="text" value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Receipt Footer Message</label>
            <input type="text" value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>

          <div className="flex justify-between items-center pt-2">
            {savedMsg && <span className="text-green-600 font-bold text-xs animate-bounce">Settings Saved! ✓</span>}
            <button type="submit" className="ml-auto px-6 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl shadow hover:bg-slate-800">
              Save Receipt Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
