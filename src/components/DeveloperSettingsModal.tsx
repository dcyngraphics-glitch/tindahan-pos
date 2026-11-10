import { useState, useRef } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../context/AuthContext';
import { connectBluetoothScanner } from '../services/bluetoothScanner';
import { connectSerialScanner } from '../services/serialScanner';
import { useBluetoothStatus } from '../hooks/useBluetoothStatus';
import { useCloudSession } from '../hooks/useCloudSession';
import { getCashierPinHash, setCashierPinHash, hashPin } from '../services/cashierPin';
import { exportBackup, restoreBackup } from '../services/backup';
import { ConfirmDialog } from './ConfirmDialog';

interface DeveloperSettingsModalProps {
  onClose: () => void;
}

export function DeveloperSettingsModal({ onClose }: DeveloperSettingsModalProps) {
  const { role } = useAuthStore();
  const { email: accountEmail } = useCloudSession();
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

  // Backup & restore state
  const [backupMessage, setBackupMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    setBackupMessage(null);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tindahan-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage({
        text: `Backup saved — ${backup.counts.products} products, ${backup.counts.transactions} sales, ${backup.counts.customers} customers, ${backup.counts.utang} debts.`,
        error: false,
      });
    } catch (err: any) {
      setBackupMessage({ text: err?.message || 'Could not create the backup.', error: true });
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so picking the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;
    setRestoring(true);
    setBackupMessage(null);
    try {
      const counts = await restoreBackup(JSON.parse(await file.text()));
      setBackupMessage({
        text: `Restored — ${counts.products} products, ${counts.transactions} sales, ${counts.customers} customers, ${counts.utang} debts.`,
        error: false,
      });
    } catch (err: any) {
      setBackupMessage({ text: err?.message || 'Could not restore from that file.', error: true });
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      onClose();
    } catch (err: any) {
      setBackupMessage({ text: err?.message || 'Could not sign out.', error: true });
    }
  };

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
              <p className="text-xs text-slate-500">
                Signed in as {accountEmail || (role === 'cashier' ? 'Cashier' : 'Inventory Staff')}
              </p>
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
            <p className="font-bold text-slate-900">{role === 'cashier' ? 'Cashier' : 'Inventory Staff'}</p>
            {accountEmail && <p className="text-xs text-slate-500">{accountEmail}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition"
          >
            Log Out 🚪
          </button>
        </div>

        {/* Backup & Restore */}
        <div className="mb-6">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">💾 Backup &amp; Restore</h3>
          <p className="text-xs text-slate-500 mb-4">
            Downloads everything — products, sales, customers, credit records and payments — into one
            file you can keep somewhere safe. Restoring replaces whatever is on this device, so check
            the download first.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportBackup}
              className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm"
            >
              ⬇️ Download backup
            </button>
            <button
              onClick={() => setRestoreConfirmOpen(true)}
              disabled={restoring}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl disabled:opacity-50"
            >
              {restoring ? 'Restoring…' : '⬆️ Restore from backup'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </div>
          {backupMessage && (
            <p className={`mt-3 text-xs font-bold p-2 rounded-lg ${backupMessage.error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {backupMessage.text}
            </p>
          )}
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

        {/* Cashier Shift PIN Management */}
        <div className="border-t border-slate-200 pt-6 mb-6">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">🔒 Cashier Shift PIN</h3>
          <p className="text-xs text-slate-500 mb-4">
            A 4-digit code that locks the till screen when the app opens, so a shared tablet cannot be
            tapped into by accident. <strong>This is a convenience lock, not a security control</strong> —
            anyone alone with the tablet can get past it from the browser. For real protection, use a
            tablet passcode and sign out between shifts.
          </p>

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

      <ConfirmDialog
        open={restoreConfirmOpen}
        title="Restore from backup?"
        message="This replaces everything currently on this device with the contents of the backup file. This cannot be undone."
        confirmLabel="Choose backup file"
        onConfirm={() => {
          setRestoreConfirmOpen(false);
          fileInputRef.current?.click();
        }}
        onCancel={() => setRestoreConfirmOpen(false)}
      />
    </div>
  );
}
