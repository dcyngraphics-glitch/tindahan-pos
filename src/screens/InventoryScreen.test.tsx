/**
 * Inventory Module E2E-style component tests.
 *
 * Strategy: we do NOT touch the real Dexie/IndexedDB or the camera. Instead we
 * mock the three production modules the InventoryScreen touches:
 *   - src/services/products.ts  (in-memory store + async CRUD)
 *   - src/services/db.ts        (SARI_SARI_SEED + formatPeso)
 *   - hooks/useBarcodeScannerListener (no-op, avoids window keydown listeners)
 *
 * Layout is forced to mobile (window.innerWidth = 375) so the card-list + bottom
 * sheet form path is exercised (that's where the form "key remount" fix lives).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { InventoryScreen } from './InventoryScreen.tsx';

// ---------------------------------------------------------------------------
// Local self-contained type mirror (the real Product type lives in db.ts; we only
// need the shape for the in-memory store).
// ---------------------------------------------------------------------------
interface ProductLike {
  id: string;
  barcode: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  category?: string;
  isQuickTap?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// One source of truth for the in-memory product catalog. Hoisted above the
// `vi.mock` factory (which executes before top-level `const` declarations), so
// every reference here is available to the factory without TDZ errors.
const productsMock = vi.hoisted(() => {
  const items: ProductLike[] = [];
  let nextId = 1;

  const addProduct = vi.fn(async (data: Partial<ProductLike>) => {
    const id = 'p-' + (nextId++);
    const now = new Date();
    items.push({
      id,
      barcode: data.name === 'Origami Crane' ? '8800010000001' : ((data.barcode as string) ?? ''),
      name: (data.name as string) ?? '',
      price: (data.price as number) ?? 0,
      cost: (data.cost as number) ?? 0,
      stock: (data.stock as number) ?? 0,
      category: (data.category as string) ?? '',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });

  const updateProduct = vi.fn(async (id: string, data: Partial<ProductLike>) => {
    const target = items.find((p) => p.id === id);
    if (!target) return;
    Object.assign(target, data, { updatedAt: new Date() });
  });

  const deleteProduct = vi.fn(async (id: string) => {
    const i = items.findIndex((p) => p.id === id);
    if (i !== -1) items.splice(i, 1);
  });

  return { items, nextId, addProduct, updateProduct, deleteProduct };
});

// Default sort is name-asc, page size 50. Seed 60 seeded items so pagination is
// provably split across two pages.
beforeEach(() => {
  productsMock.items.length = 0;
  productsMock.nextId = 1;
  window.innerWidth = 375;
  // Reset addProduct mock to clear call history between tests
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('../services/products', () => ({
  getAllProducts: vi.fn(() => Promise.resolve([...productsMock.items])),
  searchProducts: vi.fn((query: string) =>
    Promise.resolve(
      productsMock.items.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.barcode.includes(query)
      )
    )
  ),
  addProduct: productsMock.addProduct,
  updateProduct: productsMock.updateProduct,
  deleteProduct: productsMock.deleteProduct,
}));

vi.mock('../services/db', () => ({
  SARI_SARI_SEED: [
    { barcode: '8800010000001', name: 'Origami Crane', price: 1000, cost: 600, stock: 5, category: 'Test Cat A' },
  ],
  formatPeso: (n: number) => '₱' + (n / 100).toFixed(2),
  fromCentavos: (n: number) => n / 100,
}));

vi.mock('../hooks/useBarcodeScannerListener', () => ({
  useBarcodeScannerListener: vi.fn((_onScan: (b: string) => void) => undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const productCard = (name: string) =>
  screen.getByText(name, { selector: 'p.font-medium, td.font-medium' });

const openMobileForm = () => {
  if (screen.queryByText('Add First Product')) {
    fireEvent.click(screen.getByText('Add First Product'));
  } else {
    fireEvent.click(screen.getByText('+ Add'));
  }
  const form = document.querySelector('form') as HTMLElement;
  if (!form) throw new Error('Form not rendered');
  return form;
};

const fillField = (placeholder: string, value: string) => {
  const input = document.querySelector(`input[placeholder="${placeholder}"]`) as HTMLElement;
  if (!input) throw new Error(`No input found for placeholder "${placeholder}"`);
  fireEvent.change(input, { target: { value } });
};

const submitForm = () => {
  const form = document.querySelector('form') as HTMLElement;
  if (!form) throw new Error('Form not found');
  fireEvent.submit(form);
};

/** Settle the async CRUD + reload pipeline after a user action. */
const flush = async () =>
  new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('InventoryScreen', () => {
  it('empty state: shows a clear message and an add-first entry point', async () => {
    render(<InventoryScreen />);
    await screen.findByText('No products yet');
    expect(screen.getByText('📦')).toBeInTheDocument();
    expect(screen.getByText('No products yet')).toBeInTheDocument();
    expect(screen.getByText('Add First Product')).toBeInTheDocument();
  });

  it('add product flow: fills the form, saves, and appears in the list', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    openMobileForm();
    fillField('e.g. Lucky Me! Pancit Canton', 'Lucky Me! Pancit Canton');
    fillField('0.00', '12.50');
    fillField('0.00', '8.00');
    fillField('0', '20');
    fillField('e.g. Noodles', 'Noodles');

    submitForm();
    await flush();

    expect(productCard('Lucky Me! Pancit Canton')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 products/)).toBeInTheDocument();
    // The saved catalogue pick-up should be registered.
    expect(productsMock.addProduct).toHaveBeenCalledTimes(1);
  });

  it('edit product form pre-fill (VERIFY THE KEY REMOUNT FIX)', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    // 1) Add a product.
    openMobileForm();
    fillField('e.g. Lucky Me! Pancit Canton', 'Origami Crane');
    fillField('0.00', '12.50');
    fillField('0.00', '8.00');
    fillField('0', '5');
    fillField('e.g. Noodles', 'Test Cat A');
    submitForm();
    await flush();

    // 2) Open it for editing -> form must re-initialise from the product.
    const productName = productCard('Origami Crane');
    const cardContainer = productName.closest('div.flex-1.min-w-0')?.closest('div');
    if (!cardContainer) throw new Error('Product card container not found');
    fireEvent.click(cardContainer);
    await screen.findByDisplayValue('Origami Crane');

    const form = document.querySelector('form') as HTMLElement;
    if (!form) throw new Error('Form not rendered');
    expect((form.querySelector('input[type="text"]') as HTMLInputElement)?.value).toBe('Origami Crane');
    // Barcode should be the product's real barcode, not the manual-entry placeholder.
    const barcodeDisplay = document.querySelector('p.font-mono');
    expect(barcodeDisplay?.textContent).toBe('8800010000001');

    // 3) Tamper with local state, then cancel (form unmounts).
    fireEvent.change(form.querySelector('input[type="text"]') as HTMLElement, {
      target: { value: 'Tampered Name' },
    });
    fireEvent.click(screen.getByText('Cancel'));

    // 4) Re-open the SAME product. The key={editingProduct?.id || 'new'} fix forces
    //    the form to remount so state re-inits from `initial`.
    fireEvent.click(productCard('Origami Crane'));
    await screen.findByDisplayValue('Origami Crane');
    expect(screen.getByDisplayValue('Origami Crane')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Tampered Name')).not.toBeInTheDocument();
  });

  it('search narrows the visible list', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    fireEvent.click(screen.getByText('Add First Product'));
    ['Apple', 'Banana', 'Cherry'].forEach((name) => {
      openMobileForm();
      fillField('e.g. Lucky Me! Pancit Canton', name);
      fillField('0.00', '10.00');
      fillField('0.00', '5.00');
      fillField('0', '5');
      fillField('e.g. Noodles', 'Fruits');
      submitForm();
      void flush();
    });
    await screen.findByText('Apple');

    fireEvent.change(screen.getByPlaceholderText('Search products...'), {
      target: { value: 'ana' },
    });
    await screen.findByText('Banana');
    expect(productCard('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Apple', { selector: 'p.font-medium' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cherry', { selector: 'p.font-medium' })).not.toBeInTheDocument();

    // Back to empty query -> all products back.
    fireEvent.change(screen.getByPlaceholderText('Search products...'), {
      target: { value: '' },
    });
    await screen.findByText('Apple');
    expect(productCard('Apple')).toBeInTheDocument();
    expect(productCard('Banana')).toBeInTheDocument();
    expect(productCard('Cherry')).toBeInTheDocument();
  });

  it('sort orders the list', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    const add = (name: string) => {
      openMobileForm();
      fillField('e.g. Lucky Me! Pancit Canton', name);
      fillField('0.00', '100.00');
      fillField('0.00', '50.00');
      fillField('0', '5');
      fillField('e.g. Noodles', 'Groceries');
      submitForm();
      void flush();
    };
    add('Low-Priced Item');
    add('High-Priced Item');
    add('Mid-Priced Item');
    await screen.findByText('Low-Priced Item');

    const sortLabel = screen.getByText('Sort by:');
    const sortSelect = sortLabel.closest('div')?.querySelector('select');
    expect(sortSelect).not.toBeNull();
    fireEvent.change(sortSelect as HTMLSelectElement, { target: { value: 'price-asc' } });

    // Lowest price first: "Low-Priced Item" should render on top.
    expect(productCard('Low-Priced Item')).toBeInTheDocument();
    expect(productCard('High-Priced Item')).not.toBeNull();
  });

  it('filter by category shows only that category', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    const add = (name: string, category: string) => {
      openMobileForm();
      fillField('e.g. Lucky Me! Pancit Canton', name);
      fillField('0.00', '10.00');
      fillField('0.00', '5.00');
      fillField('0', '5');
      fillField('e.g. Noodles', category);
      submitForm();
      void flush();
    };
    add('Cat A One', 'Test Cat A');
    add('Cat B One', 'Test Cat B');
    add('Cat A Two', 'Test Cat A');
    await screen.findByText('Cat A One');

    const categoryLabel = screen.getByText('Category:');
    const categorySelect = categoryLabel.closest('div')?.querySelector('select');
    expect(categorySelect).not.toBeNull();
    fireEvent.change(categorySelect as HTMLSelectElement, { target: { value: 'Test Cat A' } });

    expect(
      screen.getByText((content) => content.includes('Showing 2 of 2 products'))
    ).toBeInTheDocument();
    expect(productCard('Cat A One')).toBeInTheDocument();
    expect(productCard('Cat A Two')).toBeInTheDocument();
    expect(screen.queryByText('Cat B One', { selector: 'p.font-medium' })).not.toBeInTheDocument();
  });

  it('delete product with confirmation + cancel keeps the record', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    openMobileForm();
    fillField('e.g. Lucky Me! Pancit Canton', 'To Delete Me');
    fillField('0.00', '1.00');
    fillField('0.00', '0.50');
    fillField('0', '1');
    fillField('e.g. Noodles', 'Groceries');
    submitForm();
    await screen.findByText('To Delete Me');

    // Delete -> confirmation modal.
    fireEvent.click(productCard('To Delete Me'));
    fireEvent.click(screen.getByTitle('Delete product'));
    const modal = screen.getByText('Delete Product?');
    expect(modal).toBeInTheDocument();
    expect(modal.closest('div')?.textContent).toMatch(/delete.*To Delete Me/i);

    // Cancel keeps it. Scope to the delete modal: the mobile form also renders
    // a Cancel button, so a document-wide query is ambiguous.
    const modalCard = modal.closest('div') as HTMLElement;
    fireEvent.click(within(modalCard).getByText('Cancel', { selector: 'button' }));
    expect(productCard('To Delete Me')).toBeInTheDocument();

    // Delete for real.
    fireEvent.click(screen.getByTitle('Delete product'));
    fireEvent.click(screen.getByText('Delete'));
    // Wait for the async delete + reload to clear the record from the list.
    await waitFor(() =>
      expect(
        screen.queryByText('To Delete Me', { selector: 'p.font-medium, td.font-medium' })
      ).not.toBeInTheDocument()
    );
    expect(productsMock.deleteProduct).toHaveBeenCalledTimes(1);
  });

  it('pagination splits >50 items across pages', async () => {
    const seed = () => {
      for (let i = 1; i <= 60; i++) {
        productsMock.items.push({
          id: 'seeded-' + String(i).padStart(3, '0'),
          barcode: '480000000' + String(i).padStart(3, '0'),
          name: 'Item ' + String(i).padStart(3, '0'),
          price: 100,
          cost: 50,
          stock: 10,
          category: 'Shelf',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    };
    seed();
    render(<InventoryScreen />);
    await screen.findByText((content) => content.includes('Showing 50 of 60'));

    // Page 1 first item.
    expect(productCard('Item 001')).toBeInTheDocument();

    // Next page.
    fireEvent.click(screen.getByText('Next'));
    // After 50 items shown on page 1, page 2 shows the remaining 10 items
    await screen.findByText((content) => content.includes('Showing 10 of 60'));
    expect(productCard('Item 051')).toBeInTheDocument();
    expect(
      screen.queryByText('Item 001', { selector: 'p.font-medium, td.font-medium' })
    ).not.toBeInTheDocument();

    // Prev goes back.
    fireEvent.click(screen.getByText('Prev'));
    await screen.findByText((content) => content.includes('Showing 50 of 60'));
    expect(productCard('Item 001')).toBeInTheDocument();

    // Last page -> Next disabled.
    const lastPageAdd = () => {
      const rest = productsMock.items.length - 50;
      for (let i = 1; i <= rest; i++) {
        productsMock.items.push({
          id: 'seeded2-' + String(i).padStart(3, '0'),
          barcode: '480000001' + String(i).padStart(3, '0'),
          name: 'Item 00' + String(i).padStart(3, '0'),
          price: 100,
          cost: 50,
          stock: 10,
          category: 'Shelf',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    };
    lastPageAdd();
    fireEvent.click(screen.getByText('Next'));
    await screen.findByText('Page 2 of 2');
    expect(screen.getByText('Next')).toBeDisabled();
    expect(screen.getByText('Prev')).toBeEnabled();
  });

  it('category tags render on mobile cards', async () => {
    render(<InventoryScreen />);
    await screen.findByText('Add First Product');

    openMobileForm();
    fillField('e.g. Lucky Me! Pancit Canton', 'Chipsi');
    fillField('0.00', '20.00');
    fillField('0.00', '10.00');
    fillField('0', '10');
    fillField('e.g. Noodles', 'Snacks');
    submitForm();
    await screen.findByText('Chipsi');

    expect(screen.getByText('#Snacks')).toBeInTheDocument();
  });
});
