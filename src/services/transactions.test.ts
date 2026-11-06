import { describe, it, expect } from 'vitest';
import { InsufficientStockError } from './transactions';

describe('Transaction & Stock Errors', () => {
  it('creates InsufficientStockError with correct properties', () => {
    const err = new InsufficientStockError('prod-1', 'Lucky Me', 5, 2);
    expect(err.productId).toBe('prod-1');
    expect(err.productName).toBe('Lucky Me');
    expect(err.requested).toBe(5);
    expect(err.available).toBe(2);
    expect(err.message).toContain('Insufficient stock for "Lucky Me"');
  });
});