import { describe, it, expect } from 'vitest';
import { safeParseAuth } from '../authStore';
import { safeParseCart } from '../cartStore';
import { safeParseReceiptConfig } from '../settingsStore';

describe('safeParseAuth', () => {
  it('restores valid auth from JSON string', () => {
    const raw = JSON.stringify({ isAuthenticated: true, role: 'cashier' });
    const result = safeParseAuth(raw);
    expect(result.isAuthenticated).toBe(true);
    expect(result.role).toBe('cashier');
  });
  it('returns default for null', () => {
    const result = safeParseAuth(null);
    expect(result.isAuthenticated).toBe(false);
    expect(result.role).toBe(null);
  });
  it('rejects prototype pollution attempt', () => {
    const raw = '{"__proto__":{"isAdmin":true},"isAuthenticated":true,"role":"cashier"}';
    const result = safeParseAuth(raw);
    expect(result.isAuthenticated).toBe(false);
  });
  it('rejects invalid role', () => {
    const raw = JSON.stringify({ isAuthenticated: true, role: 'superuser' });
    const result = safeParseAuth(raw);
    expect(result.role).toBe(null);
  });
});

describe('safeParseCart', () => {
  it('restores cart items from JSON string', () => {
    const items = [
      { cartId: 'c1', productId: 'p1', barcode: '123', name: 'A', price: 100, quantity: 2 },
    ];
    const raw = JSON.stringify(items);
    const result = safeParseCart(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
  it('returns empty array for null', () => {
    expect(safeParseCart(null)).toEqual([]);
  });
  it('filters out items with __proto__ key', () => {
    const raw = '[{"__proto__":{"hack":true},"cartId":"x","productId":"p","barcode":"1","name":"B","price":10,"quantity":1}]';
    const result = safeParseCart(raw);
    expect(result).toHaveLength(0);
  });
  it('returns empty array for non-array JSON', () => {
    expect(safeParseCart(JSON.stringify({ items: [] }))).toEqual([]);
  });
});

describe('safeParseReceiptConfig', () => {
  it('restores receipt config from JSON string', () => {
    const raw = JSON.stringify({ storeName: 'My Store' });
    const result = safeParseReceiptConfig(raw);
    expect(result.storeName).toBe('My Store');
  });
  it('returns default config for null', () => {
    const result = safeParseReceiptConfig(null);
    expect(result.storeName).toBeTruthy();
  });
  it('merges partial config with defaults', () => {
    const raw = JSON.stringify({ storeName: 'Aling Nena' });
    const result = safeParseReceiptConfig(raw);
    expect(result.storeName).toBe('Aling Nena');
    expect(result.receiptFooter).toBeTruthy(); // default filled in
  });
});
