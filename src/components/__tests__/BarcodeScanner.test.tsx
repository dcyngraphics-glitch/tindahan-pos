import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { BarcodeScanner } from '../BarcodeScanner';

// ---------------------------------------------------------------------------
// Mock for the html5-qrcode library. A single decode callback is captured
// and can be driven by the tests to simulate a successful barcode read or a
// startup failure.
// ---------------------------------------------------------------------------

type StartBehavior = { outcome: 'resolve' } | { outcome: 'reject'; error: string };

interface MockState {
  decodeCallback: ((text: string) => void) | null;
  startBehavior: StartBehavior;
}

// Live module state that the static vi.mock factory reads at call time.
const mockState: MockState = {
  decodeCallback: null,
  startBehavior: { outcome: 'resolve' },
};

let startBehavior: MockState['startBehavior'] = mockState.startBehavior;

const setStartBehavior = (behavior: MockState['startBehavior']) => {
  mockState.startBehavior = behavior;
  startBehavior = behavior;
};

const getDecodeCallback = (): ((text: string) => void) | null => mockState.decodeCallback;

vi.mock('html5-qrcode', () => {
  return {
    // NOTE: the Html5Qrcode "constructor" is a plain function so that
    // `new Html5Qrcode(...)` works under Vitest v5 (an arrow function
    // implementation returning an object would throw).
    Html5Qrcode: vi.fn(function Html5Qrcode(this: any, id: string) {
      this.id = id;
      // `start` checks the live start behaviour at call time so it honours
      // startBehavior even after vi.clearAllMocks() between tests.
      this.start = vi.fn().mockImplementation(async (_cameraIdOrConfig, _configuration, onDecode, _onError) => {
        if (startBehavior.outcome === 'reject') {
          return Promise.reject(new Error(startBehavior.error));
        }
        mockState.decodeCallback = onDecode;
        return Promise.resolve();
      });
      (this as any).stop = vi.fn().mockResolvedValue(undefined);
    }),
  };
});

import { Html5Qrcode } from 'html5-qrcode';

const renderScanner = () => render(<BarcodeScanner onScan={vi.fn()} />);

const getScannerInstance = () => {
  const MockHtml5Qrcode = Html5Qrcode as any;
  const results = MockHtml5Qrcode.mock.results as Array<{ value: unknown }>;
  return results[results.length - 1]?.value as { start: () => void; stop: () => void } | null;
};

const triggerScan = (barcode: string) => {
  act(() => {
    getDecodeCallback()?.(barcode);
  });
};

describe('BarcodeScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStartBehavior({ outcome: 'resolve' });
  });

  it('renders the camera viewfinder and alignment frame', () => {
    const { getByText } = renderScanner();

    expect(getByText('Align Barcode in Frame')).toBeInTheDocument();
    // camera preview feed container
    expect(document.getElementById('scanner')).toBeInTheDocument();
  });

  it('invokes onScan with the decoded barcode', () => {
    const onScan = vi.fn();
    render(<BarcodeScanner onScan={onScan} />);

    triggerScan('4800016045321');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('4800016045321');
  });

  it('debounces repeated identical barcodes (ignores within 2s)', () => {
    const onScan = vi.fn();
    render(<BarcodeScanner onScan={onScan} />);

    triggerScan('4800016045321');
    expect(onScan).toHaveBeenCalledTimes(1);

    triggerScan('4800016045321');
    expect(onScan).toHaveBeenCalledTimes(1); // second identical read within 2s is ignored
  });

  it('accepts subsequent distinct barcodes', () => {
    const onScan = vi.fn();
    render(<BarcodeScanner onScan={onScan} />);

    triggerScan('4800016045321');
    triggerScan('4800016045338');

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenLastCalledWith('4800016045338');
  });

  it('shows an error overlay when the camera cannot start', async () => {
    setStartBehavior({ outcome: 'reject', error: 'navigator.mediaDevices.getUserMedia error' });

    const { getByText } = renderScanner();

    // The simulated rejection is delivered as a microtask; flush it before asserting.
    await vi.waitFor(() => {
      expect(getByText('Camera Access Required')).toBeInTheDocument();
    });
  });

  it('stops the scanner when it is unmounted', () => {
    const { unmount } = renderScanner();
    const instance = getScannerInstance();

    expect(instance).not.toBeNull();
    unmount();

    expect(instance!.stop).toHaveBeenCalled();
  });
});
