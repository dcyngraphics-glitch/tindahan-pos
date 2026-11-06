import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../cartStore';

describe('cartStore operations', () => {
  beforeEach(() => {
    // Reset store to empty state before each test
    useCartStore.setState({ items: [], discount: null });
  });

  it('addItem adds a new item to the cart', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '123', name: 'Chippy', price: 1500, quantity: 1 });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].name).toBe('Chippy');
  });

  it('addItem increments quantity when same productId added again', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '123', name: 'Chippy', price: 1500, quantity: 1 });
    store.addItem({ productId: 'p1', barcode: '123', name: 'Chippy', price: 1500, quantity: 1 });
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('getTotal returns sum of price * quantity in centavos', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 1 });
    // add p1 again — quantity increments to 2 → 2000
    store.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 1000, quantity: 1 });
    store.addItem({ productId: 'p2', barcode: '2', name: 'B', price: 500, quantity: 1 });
    // p1: 1000*2=2000, p2: 500*1=500 → total 2500
    expect(useCartStore.getState().getTotal()).toBe(2500);
  });

  it('getDiscountedTotal applies percent discount correctly', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 10000, quantity: 1 });
    store.setDiscount({ type: 'percent', value: 10 });
    expect(useCartStore.getState().getDiscountedTotal()).toBe(9000);
  });

  it('getDiscountedTotal applies fixed discount correctly', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 10000, quantity: 1 });
    store.setDiscount({ type: 'fixed', value: 2000 });
    expect(useCartStore.getState().getDiscountedTotal()).toBe(8000);
  });

  it('clearCart empties items and clears discount', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 100, quantity: 1 });
    store.setDiscount({ type: 'percent', value: 10 });
    store.clearCart();
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.discount).toBeNull();
  });

  it('removeItem removes the item by cartId', () => {
    const store = useCartStore.getState();
    store.addItem({ productId: 'p1', barcode: '1', name: 'A', price: 100, quantity: 1 });
    const { cartId } = useCartStore.getState().items[0];
    store.removeItem(cartId);
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
