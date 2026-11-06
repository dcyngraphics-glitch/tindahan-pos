import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../cartStore';

function reset() {
  useCartStore.setState({ items: [], discount: null });
  localStorage.removeItem('tindahan_active_cart');
}

describe('cashier store flows', () => {
  beforeEach(() => reset());

  it('addItem blocks a brand-new item that is out of stock (availableStock=0)', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'Out', price: 1000, quantity: 1, availableStock: 0 });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('addItem allows a new item that is in stock', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'In', price: 1000, quantity: 1, availableStock: 3 });
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('updateQuantity sets quantity; quantity <= 0 removes the item', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 2, availableStock: 5 });
    const { cartId } = useCartStore.getState().items[0];
    s.updateQuantity(cartId, 1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
    s.updateQuantity(cartId, 0); // quantity <= 0 -> removes item
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('updateQuantity cannot exceed availableStock snapshot', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 1, availableStock: 2 });
    const { cartId } = useCartStore.getState().items[0];
    s.updateQuantity(cartId, 3);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('addItem increments quantity when the same productId+price is added again', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 1 });
    s.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 1 });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('getDiscountedTotal percent 0 and 100', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 10000, quantity: 1 });
    s.setDiscount({ type: 'percent', value: 0 });
    expect(s.getDiscountedTotal()).toBe(10000);
    s.setDiscount({ type: 'percent', value: 100 });
    expect(s.getDiscountedTotal()).toBe(0);
  });

  it('clearCart empties items and discount', () => {
    const s = useCartStore.getState();
    s.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 2 });
    s.setDiscount({ type: 'fixed', value: 1000 });
    s.clearCart();
    expect(s.items).toHaveLength(0);
    expect(s.discount).toBeNull();
  });
});
