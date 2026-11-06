import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useCartStore } from '../../stores/cartStore';
import { QuickTapGrid } from '../QuickTapGrid';

const product = (id: string, opts: { stock?: number; isQuickTap?: boolean; price?: number } = {}): any => ({
  id, barcode: `123${id}`, name: `Product ${id}`, price: opts.price ?? 1500, cost: 1000,
  stock: opts.stock ?? 10, isQuickTap: opts.isQuickTap ?? false, createdAt: new Date(), updatedAt: new Date(),
});

describe('QuickTapGrid', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], discount: null });
    localStorage.removeItem('tindahan_active_cart');
  });

  it('renders QuickTap items and adds in-stock products to the cart on tap', () => {
    const products = [product('a', { isQuickTap: true, stock: 5 }), product('b', { isQuickTap: true, stock: 5 })];
    render(<QuickTapGrid products={products} />);
    const btn = screen.getByRole('button', { name: /Product a/i });
    btn.click();
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].name).toBe('Product a');
  });

  it('does not add an out-of-stock product to the cart', () => {
    const products = [product('a', { isQuickTap: true, stock: 0 })];
    render(<QuickTapGrid products={products} />);
    const btn = screen.getByRole('button', { name: /Product a/i });
    expect(btn).toBeDisabled();
    btn.click();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('shows Out badge on products with zero stock', () => {
    const products = [product('a', { isQuickTap: true, stock: 0 })];
    render(<QuickTapGrid products={products} />);
    expect(screen.getByText(/Out/i)).toBeInTheDocument();
  });

  it('shows the Add QuickTap tile when no products are quick-tap', () => {
    const products = [product('a', { isQuickTap: false, stock: 5 })];
    render(<QuickTapGrid products={products} />);
    expect(screen.getByRole('button', { name: /Add QuickTap/i })).toBeInTheDocument();
  });

  it('search filters the picker rows', async () => {
    const products = [product('a', { isQuickTap: true }), product('b', { isQuickTap: false })];
    const { container } = render(<QuickTapGrid products={products} />);
    screen.getByRole('button', { name: /Add QuickTap/i }).click();
    await screen.findByText(/Manage QuickTap Products/);
    const modal = container.querySelector('.max-w-xl') as HTMLElement;
    const search = modal.querySelector('input[placeholder*="Search products"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Product b' } });
    expect(modal.textContent).toContain('Product b');
    expect(modal.textContent).not.toContain('Product a');
  });
});
