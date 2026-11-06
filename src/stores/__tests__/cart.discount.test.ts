import { describe, it, expect } from 'vitest';

// Pure math — no store needed
function applyDiscount(totalCentavos: number, discount: { type: 'percent' | 'fixed'; value: number } | null): number {
  if (!discount) return totalCentavos;
  if (discount.type === 'percent') return Math.round(totalCentavos * (1 - discount.value / 100));
  return Math.max(0, totalCentavos - discount.value);
}

describe('applyDiscount', () => {
  it('applies percent discount', () => expect(applyDiscount(10000, { type: 'percent', value: 10 })).toBe(9000));
  it('applies fixed discount in centavos', () => expect(applyDiscount(10000, { type: 'fixed', value: 2000 })).toBe(8000));
  it('clamps fixed discount at zero', () => expect(applyDiscount(500, { type: 'fixed', value: 1000 })).toBe(0));
  it('returns total unchanged when discount is null', () => expect(applyDiscount(10000, null)).toBe(10000));
});
