const SCANNER_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Generic BLE / SPP
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
];

const SCANNER_CHARACTERISTICS = [
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
];

export async function connectBluetoothScanner(onScan: (barcode: string) => void): Promise<{ device: any; server: any; characteristic: any; name: string; disconnect: () => void } | null> {
  if (!('navigator' in window) || !('bluetooth' in navigator)) {
    alert('Web Bluetooth is not supported on this browser.');
    return null;
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
        { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },
        { namePrefix: 'Scanner' },
        { namePrefix: 'Barcode' },
        { namePrefix: 'BS' },
        { namePrefix: 'MS' },
        { namePrefix: 'RFS' },
        { namePrefix: 'HID' }
      ],
      optionalServices: [
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
      ]
    });

    const server = await device.gatt.connect();
    let characteristic: any = null;
    let connectedService: any = null;

    for (const serviceUuid of SCANNER_SERVICES) {
      try {
        connectedService = await server.getPrimaryService(serviceUuid);
        if (connectedService) {
          for (const charUuid of SCANNER_CHARACTERISTICS) {
            try {
              characteristic = await connectedService.getCharacteristic(charUuid);
              if (characteristic) break;
            } catch (e) {}
          }
          if (characteristic) break;
        }
      } catch (e) {}
    }

    if (!characteristic) {
      throw new Error('Could not find readable characteristic on Bluetooth scanner.');
    }

    const decoder = new TextDecoder();
    let scanBuffer = '';

    // Store the listener so it can be removed on disconnect
    const onCharacteristicValueChanged = (event: any) => {
      const value = event.target.value;
      const text = decoder.decode(value);
      scanBuffer += text;
      if (scanBuffer.includes('\n') || scanBuffer.includes('\r') || scanBuffer.length > 20) {
        const barcode = scanBuffer.trim();
        if (barcode.length > 2) {
          onScan(barcode);
        }
        scanBuffer = '';
      }
    };
    characteristic.addEventListener('characteristicvaluechanged', onCharacteristicValueChanged);

    await characteristic.startNotifications();

    // Return a cleanup/detach function so the listener can be removed on disconnect
    const disconnect = () => {
      try {
        characteristic.removeEventListener('characteristicvaluechanged', onCharacteristicValueChanged);
        characteristic.stopNotifications();
        device.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    };

    return { device, server, characteristic, name: device.name || 'Bluetooth Scanner', disconnect };
  } catch (err) {
    console.error('Bluetooth scanner connection error:', err);
    throw err;
  }
}
