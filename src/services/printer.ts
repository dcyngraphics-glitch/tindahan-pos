import { useHardwareStore } from '../stores/hardwareStore';
import { useSettingsStore } from '../stores/settingsStore';

export interface BluetoothPrinterService {
  printReceipt: (receipt: {
    items: Array<{ name: string; price: number; quantity: number }>;
    total: number;
    cashTendered: number;
    change: number;
    date: Date;
  }) => Promise<boolean>;
}

// Common Bluetooth thermal printer service & characteristic UUIDs (including GOOJPRT PT-220 FFE0/FFE1)
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // GOOJPRT / MTP series
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
];

const PRINTER_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Standard characteristic
  '0000ffe1-0000-1000-8000-00805f9b34fb', // GOOJPRT characteristic
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // ISSC characteristic
];

export async function printViaBluetooth(receipt: {
  items: Array<{ name: string; price: number; quantity: number }>;
  total: number;
  cashTendered: number;
  change: number;
  date: Date;
}): Promise<boolean> {
  if (!('navigator' in window) || !('bluetooth' in navigator)) {
    alert('Web Bluetooth is not supported on this browser/device.');
    return false;
  }

  try {
    const store = useHardwareStore.getState();
    const settings = useSettingsStore.getState().receiptConfig;
    let characteristic = store.printerCharacteristic;
    let server = store.printerServer;

    // If persistent characteristic is missing or disconnected, request and connect
    if (!characteristic || !server || !server.connected) {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'PT' },
          { namePrefix: 'Printer' },
          { namePrefix: 'MPT' },
          { namePrefix: 'RP' },
          { namePrefix: 'GOOJPRT' }
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });

      server = await device.gatt.connect();

      let connectedService = null;
      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          connectedService = await server.getPrimaryService(serviceUuid);
          if (connectedService) {
            for (const charUuid of PRINTER_CHARACTERISTICS) {
              try {
                characteristic = await connectedService.getCharacteristic(charUuid);
                if (characteristic) break;
              } catch (e) {}
            }
            if (characteristic) break;
          }
        } catch (e) {}
      }

      if (characteristic) {
        store.setPrinter(device, server, characteristic, device.name || 'Thermal Printer');
      }
    }

    if (!characteristic) {
      throw new Error('Could not find writable printer characteristic on this Bluetooth device.');
    }

    // ESC/POS commands formatting for 58mm thermal paper (~32 chars per line) using customized settings
    const encoder = new TextEncoder();
    let commands = '\x1B\x40'; // Initialize printer
    commands += '\x1B\x61\x01'; // Center alignment
    commands += '\x1B\x21\x30'; // Double width & height
    commands += `${settings.storeName}\n`;
    commands += '\x1B\x21\x00'; // Normal font
    commands += `${settings.storeAddress}\n`;
    commands += `${settings.contactInfo}\n`;
    commands += '--------------------------------\n';
    commands += `${settings.receiptHeader}\n`;
    commands += `Date: ${receipt.date.toLocaleString()}\n`;
    commands += '--------------------------------\n';
    commands += '\x1B\x61\x00'; // Left alignment

    for (const item of receipt.items) {
      const lineTotal = ((item.price * item.quantity) / 100).toFixed(2);
      commands += `${item.quantity}x ${item.name}\n`;
      commands += `   @₱${(item.price / 100).toFixed(2)} = ₱${lineTotal}\n`;
    }

    commands += '--------------------------------\n';
    commands += '\x1B\x61\x02'; // Right alignment
    commands += `TOTAL: ₱${(receipt.total / 100).toFixed(2)}\n`;
    commands += `CASH:  ₱${(receipt.cashTendered / 100).toFixed(2)}\n`;
    commands += `CHANGE: ₱${(receipt.change / 100).toFixed(2)}\n`;
    commands += '\x1B\x61\x01'; // Center
    commands += '--------------------------------\n';
    commands += `${settings.receiptFooter}\n\n\n`;

    // Send in safe chunks (128 bytes) with property checks and inter-chunk delay
    const data = encoder.encode(commands);
    const chunkSize = 128;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else if (characteristic.properties.write) {
        await characteristic.writeValue(chunk);
      } else {
        try {
          await characteristic.writeValueWithoutResponse(chunk);
        } catch {
          await characteristic.writeValue(chunk);
        }
      }
      // Small delay between chunks for printer buffer stability
      await new Promise(r => setTimeout(r, 25));
    }

    return true;
  } catch (err) {
    console.error('Bluetooth print error:', err);
    alert('Bluetooth print failed: ' + (err as Error).message + '\n\nTip: Ensure the printer is paired in Windows Bluetooth settings first!');
    return false;
  }
}
