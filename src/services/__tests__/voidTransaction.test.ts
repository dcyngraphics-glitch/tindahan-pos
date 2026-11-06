import { describe, it, expect } from 'vitest';
import { InsufficientStockError, voidTransaction } from '../transactions';

describe('voidTransaction', () => {
  it('is exported as a function', () => {
    expect(typeof voidTransaction).toBe('function');
  });

  it('InsufficientStockError carries product info', () => {
    const err = new InsufficientStockError('p1', 'Chippy', 5, 2);
    expect(err.productId).toBe('p1');
    expect(err.productName).toBe('Chippy');
    expect(err.requested).toBe(5);
    expect(err.available).toBe(2);
    expect(err.name).toBe('InsufficientStockError');
    expect(err.message).toMatch(/Chippy/);
  });
});
