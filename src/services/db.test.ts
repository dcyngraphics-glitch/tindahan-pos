import { describe, it, expect } from 'vitest';
import { toCentavos, fromCentavos, formatPeso } from './db';

describe('Currency Utils', () => {
  it('converts pesos to centavos correctly', () => {
    expect(toCentavos(15.50)).toBe(1550);
    expect(toCentavos(100)).toBe(10000);
  });

  it('converts centavos to pesos correctly', () => {
    expect(fromCentavos(1550)).toBe(15.50);
  });

  it('formats pesos correctly', () => {
    expect(formatPeso(1550)).toBe('₱15.50');
    expect(formatPeso(100000)).toBe('₱1000.00');
  });
});