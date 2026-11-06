import { create } from 'zustand';

interface HardwareState {
  printerDevice: any | null;
  printerServer: any | null;
  printerCharacteristic: any | null;
  printerName: string | null;
  isPrinterConnected: boolean;

  scannerDevice: any | null;
  scannerServer: any | null;
  scannerCharacteristic: any | null;
  scannerName: string | null;
  isScannerConnected: boolean;

  serialPort: any | null;
  serialReader: any | null;
  isSerialConnected: boolean;

  setPrinter: (device: any, server: any, characteristic: any, name: string) => void;
  disconnectPrinter: () => void;
  setScanner: (device: any, server: any, characteristic: any, name: string) => void;
  disconnectScanner: () => void;
  setSerialScanner: (port: any, reader: any) => void;
  disconnectSerialScanner: () => Promise<void>;
}

export const useHardwareStore = create<HardwareState>((set, get) => ({
  printerDevice: null,
  printerServer: null,
  printerCharacteristic: null,
  printerName: null,
  isPrinterConnected: false,

  scannerDevice: null,
  scannerServer: null,
  scannerCharacteristic: null,
  scannerName: null,
  isScannerConnected: false,

  serialPort: null,
  serialReader: null,
  isSerialConnected: false,

  setPrinter: (device, server, characteristic, name) => set({
    printerDevice: device,
    printerServer: server,
    printerCharacteristic: characteristic,
    printerName: name,
    isPrinterConnected: true,
  }),
  disconnectPrinter: () => {
    const { printerServer, printerDevice } = get();
    try {
      if (printerServer && typeof printerServer.disconnect === 'function') {
        printerServer.disconnect();
      }
    } catch (e) {
      console.warn('Failed to disconnect printer GATT server:', e);
    }
    try {
      if (printerDevice && typeof printerDevice.gatt?.disconnect === 'function') {
        printerDevice.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Failed to disconnect printer device:', e);
    }
    set({
      printerDevice: null,
      printerServer: null,
      printerCharacteristic: null,
      printerName: null,
      isPrinterConnected: false,
    });
  },
  setScanner: (device, server, characteristic, name) => set({
    scannerDevice: device,
    scannerServer: server,
    scannerCharacteristic: characteristic,
    scannerName: name,
    isScannerConnected: true,
  }),
  disconnectScanner: () => {
    const { scannerServer, scannerDevice } = get();
    try {
      if (scannerServer && typeof scannerServer.disconnect === 'function') {
        scannerServer.disconnect();
      }
    } catch (e) {
      console.warn('Failed to disconnect scanner GATT server:', e);
    }
    try {
      if (scannerDevice && typeof scannerDevice.gatt?.disconnect === 'function') {
        scannerDevice.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Failed to disconnect scanner device:', e);
    }
    set({
      scannerDevice: null,
      scannerServer: null,
      scannerCharacteristic: null,
      scannerName: null,
      isScannerConnected: false,
    });
  },
  setSerialScanner: (port, reader) => set({
    serialPort: port,
    serialReader: reader,
    isSerialConnected: true,
  }),
  disconnectSerialScanner: async () => {
    const { serialPort, serialReader } = get();
    if (serialReader) {
      try { serialReader.cancel(); } catch (e) {}
    }
    if (serialPort) {
      try { serialPort.close(); } catch (e) {}
    }
    set({
      serialPort: null,
      serialReader: null,
      isSerialConnected: false,
    });
  },
}));
