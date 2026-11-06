export async function connectSerialScanner(
  onScan: (barcode: string) => void
): Promise<{ port: any; reader: any } | null> {
  if (!('navigator' in window) || !('serial' in navigator)) {
    alert('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    return null;
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });

    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    // Start background reading loop
    (async () => {
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += value;
            let lineEndIndex;
            while ((lineEndIndex = buffer.search(/[\r\n]+/)) !== -1) {
              const barcode = buffer.substring(0, lineEndIndex).trim();
              // Advance past the entire matched terminator sequence
              const terminatorMatch = buffer.substring(lineEndIndex).match(/^[\r\n]+/);
              buffer = buffer.substring(lineEndIndex + (terminatorMatch ? terminatorMatch[0].length : 1));
              if (barcode.length > 2) {
                console.log('[Serial Scanner] Scanned barcode:', barcode);
                onScan(barcode);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Serial Scanner] Read error:', err);
      } finally {
        reader.releaseLock();
      }
    })();

    return { port, reader };
  } catch (err) {
    console.error('[Serial Scanner] Connection failed:', err);
    return null;
  }
}
