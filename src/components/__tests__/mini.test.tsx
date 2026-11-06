import { describe, it, vi } from 'vitest';

describe('mini', () => {
  it('probe', () => {
    const F = vi.fn();
    console.log('typeof F =', typeof F);
    console.log('isMockFunction =', vi.isMockFunction(F));
    try {
      const inst = new F('scanner');
      console.log('new F -> inst:', inst);
    } catch (e: any) {
      console.log('new F threw:', e.message);
    }
    const G = vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn() }));
    try {
      const inst = new G('scanner');
      console.log('new G -> inst:', inst);
    } catch (e: any) {
      console.log('new G threw:', e.message);
    }
  });
});
