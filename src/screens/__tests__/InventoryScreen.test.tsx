import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

import { InventoryScreen } from '../InventoryScreen';

// ─── Mock shared module state ──────────────────────────────────────────
const mockProducts = { list: [] as any[] };
const mockUseIsAtLeast = { value: false };

// ─── Mock modules ──────────────────────────────────────────────────────
vi.mock('../../services/products', () => ({
  getAllProducts: () => Promise.resolve(mockProducts.list),
  searchProducts: (q: string) =>
    Promise.resolve(
      mockProducts.list.filter((p: any) =>
        p.name.toLowerCase().includes(q.toLowerCase()),
      ),
    ),
  addProduct: (data: any) => {
    const id = 'id-' + Math.random().toString(36).slice(2, 8);
    mockProducts.list.push({
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return Promise.resolve(id);
  },
  updateProduct: () => Promise.resolve(),
  deleteProduct: (id: string) => {
    const idx = mockProducts.list.findIndex((p: any) => p.id === id);
    if (idx !== -1) mockProducts.list.splice(idx, 1);
    return Promise.resolve();
  },
}));

vi.mock('../../services/db', () => ({
  db: {},
  fromCentavos: (c: number) => c / 100,
  toCentavos: (p: number) => Math.round(p * 100),
  formatPeso: (c: number) => '₱' + (c / 100).toFixed(2),
  SARI_SARI_SEED: [],
  generateId: () => 'id-mock',
}));

vi.mock('../../hooks/useResponsive', () => ({
  useIsAtLeast: vi.fn(() => mockUseIsAtLeast.value),
}));

vi.mock('../../hooks/useBarcodeScannerListener', () => ({
  useBarcodeScannerListener: vi.fn(),
}));

vi.mock('../../components/BarcodeScanner', () => ({
  BarcodeScanner: (props: any) => (
    <div data-testid="barcode-scanner">
      <button onClick={() => props.onScan?.('1234567890123')}>Scan</button>
      <button onClick={props.onClose}>Close</button>
    </div>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────────────────
const user = userEvent.setup();

const seedProducts = (items: Array<Partial<any>>) => {
  mockProducts.list.length = 0;
  items.forEach((it, i) => {
    mockProducts.list.push({
      id: `id-${i}`,
      barcode: `300000${String(i).padStart(3, '0')}`,
      name: it.name ?? `Product ${String(i).padStart(3, '0')}`,
      price: it.price ?? 100,
      cost: it.cost ?? 50,
      stock: it.stock ?? 10,
      category: it.category ?? 'Snacks',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
};

const renderScreen = () =>
  render(
    <MemoryRouter>
      <InventoryScreen />
    </MemoryRouter>,
  );

describe('InventoryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProducts.list = [];
    mockUseIsAtLeast.value = false;
  });

  // ── 1. Empty state ──────────────────────────────────────────────────
  it('shows empty state when the inventory is empty', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('No products yet')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /add first product/i }),
    ).toBeInTheDocument();
  });

  // ── 2. Add product ──────────────────────────────────────────────────
  it('adds a product and shows it with its category tag', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('No products yet')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /add first product/i }),
    );

    await user.type(screen.getByPlaceholderText('e.g. Lucky Me! Pancit Canton'), 'Yakult Manggadios');
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '15');
    await user.type(screen.getByPlaceholderText('0'), '12');
    await user.type(screen.getByPlaceholderText('e.g. Noodles'), 'Beverages');

    // happy-dom's number-step validation rejects "15" against step="0.01"
    // (float remainder), which blocks the native submit-button click. Submit
    // the form directly — the same onSave path still runs.
    fireEvent.submit(
      screen.getByRole('button', { name: /add product/i }).closest('form') as HTMLFormElement,
    );

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
    });
    expect(screen.getByText('#Beverages')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 products/)).toBeInTheDocument();
  });

  // ── 3. Edit form pre-fill (key remount fix) ─────────────────────────
  it('pre-fills the edit form and discards stale values on key remount', async () => {
    seedProducts([
      {
        id: 'p1',
        name: 'Lucky Me Pancit Canton Original',
        barcode: '4800016045321',
        price: 1500,
        cost: 1200,
        stock: 100,
        category: 'Noodles',
      },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Original')).toBeInTheDocument();
    });

    // 1. Open edit mode by clicking the product row.
    await user.click(
      screen.getByText('Lucky Me Pancit Canton Original'),
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('e.g. Lucky Me! Pancit Canton'),
      ).toHaveValue('Lucky Me Pancit Canton Original');
    });

    // 2. Open the "add" form and type a stale value.
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.type(screen.getByPlaceholderText('e.g. Lucky Me! Pancit Canton'), 'Stale Name');
    expect(
      screen.getByPlaceholderText('e.g. Lucky Me! Pancit Canton'),
    ).toHaveValue('Stale Name');

    // 3. Click the same product row again: the key changes (new id vs 'new'),
    //    so the form remounts and the stale value must be wiped.
    await user.click(
      screen.getByText('Lucky Me Pancit Canton Original'),
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('e.g. Lucky Me! Pancit Canton'),
      ).toHaveValue('Lucky Me Pancit Canton Original');
    });
  });

  // ── 4. Search ───────────────────────────────────────────────────────
  it('filters the list by search query', async () => {
    seedProducts([
      { name: 'Lucky Me Pancit Canton Original', category: 'Noodles' },
      { name: 'Yakult Manggadios', category: 'Beverages' },
      { name: 'Betamax', category: 'Snacks' },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText('Search products...'),
      'yak',
    );

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
    });
    expect(screen.queryByText('Lucky Me Pancit Canton Original')).not.toBeInTheDocument();
    expect(screen.queryByText('Betamax')).not.toBeInTheDocument();
  });

  // ── 5. Sort ─────────────────────────────────────────────────────────
  it('sorts products by name ascending', async () => {
    seedProducts([
      { name: 'Zeta', category: 'Snacks' },
      { name: 'Alpha', category: 'Snacks' },
      { name: 'Middle', category: 'Snacks' },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Zeta')).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByDisplayValue('Alphabetical (A-Z)'),
      'name-asc',
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeVisible();
      expect(screen.getByText('Middle')).toBeVisible();
      expect(screen.getByText('Zeta')).toBeVisible();
    });
  });

  // ── 6. Filter (category) ────────────────────────────────────────────
  it('filters products by category', async () => {
    seedProducts([
      { name: 'Yakult Manggadios', category: 'Beverages' },
      { name: 'SkyFlakes Crackers', category: 'Snacks' },
      { name: 'Coke 500ml', category: 'Beverages' },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue(/All Categories/), 'Beverages');

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
      expect(screen.getByText('Coke 500ml')).toBeInTheDocument();
      expect(screen.queryByText('SkyFlakes Crackers')).not.toBeInTheDocument();
    });
  });

  // ── 7. Delete ───────────────────────────────────────────────────────
  it('deletes a product', async () => {
    seedProducts([{ name: 'Yakult Manggadios', category: 'Beverages' }]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete product' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Product?' })).toBeInTheDocument();
    });

    const deleteModal = screen
      .getByRole('heading', { name: 'Delete Product?' })
      .closest('div') as HTMLElement;
    await user.click(within(deleteModal).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Yakult Manggadios')).not.toBeInTheDocument();
    });
  });

  // ── 8. Pagination ───────────────────────────────────────────────────
  it('paginates a large list at PAGE_SIZE = 50', async () => {
    const items: any[] = [];
    for (let i = 59; i >= 0; i--) {
      items.push({ name: `Product ${String(i).padStart(3, '0')}`, category: 'Snacks' });
    }
    seedProducts(items);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/Showing 50 of 60 products/)).toBeInTheDocument();
    });

    // Default sort is name-asc, so page 1 holds Product 000–049.
    expect(screen.getByText('Product 000')).toBeInTheDocument();
    expect(screen.queryByText('Product 059')).not.toBeInTheDocument();
    expect(screen.queryByText('Product 050')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText(/Showing 10 of 60 products/)).toBeInTheDocument();
    });

    expect(screen.getByText('Product 050')).toBeInTheDocument();
    expect(screen.getByText('Product 059')).toBeInTheDocument();
  });

  // ── 9. Category tags ────────────────────────────────────────────────
  it('renders a category tag for products that have a category', async () => {
    seedProducts([
      { name: 'Yakult Manggadios', category: 'Beverages' },
      { name: 'Lucky Me Pancit Canton', category: 'Noodles' },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Yakult Manggadios')).toBeInTheDocument();
    });

    expect(screen.getByText('#Beverages')).toBeInTheDocument();
    expect(screen.getByText('#Noodles')).toBeInTheDocument();
  });
});
