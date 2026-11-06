import { useState, useEffect, useCallback } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { connectBluetoothScanner } from '../services/bluetoothScanner';

interface BluetoothStatus {
  isSupported: boolean;
  isConnected: boolean;
  scannerConnected: boolean;
  lastChecked: Date | null;
  error: string | null;
}

interface UseBluetoothStatusReturn extends BluetoothStatus {
  connectPrinter: () => Promise<boolean>;
  connectScanner: (onScan: (barcode: string) => void) => Promise<boolean>;
  printerName: string | null;
  scannerName: string | null;
}

export function useBluetoothStatus(): UseBluetoothStatusReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const {
    printerName,
    isPrinterConnected,
    scannerName,
    isScannerConnected,
    setPrinter,
    setScanner,
  } = useHardwareStore();

  useEffect(() => {
    const supported = 'bluetooth' in navigator;
    setIsSupported(supported);
    if (!supported) {
      setError('Web Bluetooth not supported in this browser');
    }
  }, []);

  const connectPrinter = useCallback(async (): Promise<boolean> => {
    if (!('bluetooth' in navigator)) {
      setError('Web Bluetooth not supported');
      return false;
    }

    try {
      setError(null);
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'PT' },
          { namePrefix: 'Printer' },
          { namePrefix: 'MPT' },
          { namePrefix: 'GOOJPRT' },
          { namePrefix: 'RP' },
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
        ]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb').catch(() =>
        server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb')
      );
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb').catch(() =>
        service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb')
      );

      setPrinter(device, server, characteristic, device.name || 'Thermal Printer');
      setLastChecked(new Date());
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to connect printer');
      setLastChecked(new Date());
      return false;
    }
  }, [setPrinter]);

  const connectScanner = useCallback(async (onScan: (barcode: string) => void): Promise<boolean> => {
    try {
      setError(null);
      const result = await connectBluetoothScanner(onScan);
      if (result) {
        setScanner(result.device, result.server, result.characteristic, result.name);
        setLastChecked(new Date());
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to connect Bluetooth scanner');
      setLastChecked(new Date());
      return false;
    }
  }, [setScanner]);

  return {
    isSupported,
    isConnected: isPrinterConnected,
    scannerConnected: isScannerConnected,
    lastChecked,
    error,
    connectPrinter,
    connectScanner,
    printerName,
    scannerName,
  };
}