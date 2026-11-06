import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBarcodeScannerListener } from '../useBarcodeScannerListener';

describe('useBarcodeScannerListener', () => {
  let onScan: (barcode: string) => void;

  beforeEach(() => {
    // Freeze time so the 800ms buffer-debounce threshold is deterministic.
    vi.useFakeTimers();
    onScan = vi.fn();
    vi.spyOn(Date, 'now').mockImplementation(() => 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fireKey = (key: string, code = 'KeyA', modifiers: Record<string, boolean> = {}) => {
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          code,
          bubbles: true,
          cancelable: true,
          ...modifiers,
        })
      );
    });
  };

  const render = () =>
    renderHook(() => useBarcodeScannerListener(onScan), { wrapper: ({ children }) => children });

  it('accumulates single characters into a buffer', () => {
    render();
    fireKey('4');
    fireKey('8');
    fireKey('0');
    expect(onScan).not.toHaveBeenCalled();
    expect(Date.now()).toBe(1000);
  });

  it('submits the barcode when Enter is pressed', () => {
    render();
    fireKey('4');
    fireKey('8');
    fireKey('0');
    fireKey('Enter');
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('480');
  });

  it('clears the buffer after a successful submit', () => {
    render();
    fireKey('4');
    fireKey('8');
    fireKey('0');
    fireKey('Enter');
    fireKey('9');
    fireKey('7');
    fireKey('0');
    fireKey('Enter');
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenNthCalledWith(2, '970');
  });

  it('ignores control/alt/meta modifier key combos', () => {
    render();
    fireKey('a', 'KeyA', { ctrlKey: true });
    expect(onScan).not.toHaveBeenCalled();
  });

  it('resets the buffer after 800ms of idle', () => {
    render();
    fireKey('4');
    fireKey('8');
    // simulate a long pause by returning a later timestamp for subsequent events
    vi.spyOn(Date, 'now').mockImplementation(() => 2000);
    fireKey('0');
    fireKey('1');
    fireKey('2');
    fireKey('Enter');
    // buffer was reset (gap > 800ms), so only '012' is captured.
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('012');
  });

  it('ignores barcodes with 2 or fewer characters', () => {
    render();
    fireKey('1');
    fireKey('2');
    fireKey('Enter');
    expect(onScan).not.toHaveBeenCalled();
  });

  it('supports Tab as a submit key', () => {
    render();
    fireKey('5');
    fireKey('5');
    fireKey('5');
    fireKey('Tab');
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('555');
  });

  it('supports Return as a submit key', () => {
    render();
    fireKey('1');
    fireKey('2');
    fireKey('3');
    fireKey('Return');
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('123');
  });
});
