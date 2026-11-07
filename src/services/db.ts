import Dexie, { type EntityTable } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number; // in centavos
  cost: number; // in centavos
  stock: number;
  category?: string;
  image?: string;
  isQuickTap?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionItem {
  productId: string;
  barcode: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Transaction {
  id: string;
  items: TransactionItem[];
  total: number; // in centavos (after discount)
  cashTendered: number;
  change: number;
  createdAt: Date;
  voided?: boolean;
  discount?: { type: 'percent' | 'fixed'; value: number } | null;
}

const db = new Dexie('TindahanPOS', { addons: [dexieCloud] }) as Dexie & {
  products: EntityTable<Product, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
};

if (db.cloud) {
  db.cloud.configure({
    databaseUrl: 'https://zo7vbabeq.dexie.cloud',
    // NOTE: requireAuth removed — OTP/login endpoints must be reachable
    // before user is authenticated. Authenticated writes will be blocked
    // by the server side (requireAuth true requires Dexie Cloud identity config).
  });
}

db.version(1).stores({
  products: 'id, barcode, name, category, createdAt',
  transactions: 'id, createdAt',
});

export { db };

export function generateId(): string {
  return crypto.randomUUID();
}

export function toCentavos(peso: number): number {
  return Math.round(peso * 100);
}

export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

export function formatPeso(centavos: number): string {
  return '₱' + fromCentavos(centavos).toFixed(2);
}

export const SARI_SARI_SEED: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // ── INSTANT NOODLES ──
  { barcode: '4800016045321', name: 'Lucky Me Pancit Canton Original', price: 1500, cost: 1200, stock: 100, category: 'Instant Noodles', isQuickTap: true },
  { barcode: '4800016045338', name: 'Lucky Me Pancit Canton Chilimansi', price: 1500, cost: 1200, stock: 80, category: 'Instant Noodles', isQuickTap: true },
  { barcode: '4800016045345', name: 'Lucky Me Pancit Canton Extra Hot', price: 1500, cost: 1200, stock: 80, category: 'Instant Noodles', isQuickTap: true },
  { barcode: '4800016045352', name: 'Lucky Me Pancit Canton Sweet & Spicy', price: 1500, cost: 1200, stock: 60, category: 'Instant Noodles', isQuickTap: true },
  { barcode: '4800016045369', name: 'Lucky Me Pancit Canton Kalamansi', price: 1500, cost: 1200, stock: 60, category: 'Instant Noodles' },
  { barcode: '4800016012345', name: 'Lucky Me La Paz Batchoy', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { barcode: '4800016012352', name: 'Lucky Me Beef Noodle Soup', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { barcode: '4800016012369', name: 'Lucky Me Chicken Noodle Soup', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { barcode: '4800016012376', name: 'Lucky Me Pork Barbecue', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { barcode: '4800016012383', name: 'Lucky Me Supreme Bulalo', price: 2500, cost: 2000, stock: 40, category: 'Instant Noodles' },
  { barcode: '4800016012390', name: 'Lucky Me Supreme Crispy Patola', price: 2500, cost: 2000, stock: 40, category: 'Instant Noodles' },
  { barcode: '4800144022401', name: 'Nissin Yakisoba', price: 1500, cost: 1200, stock: 60, category: 'Instant Noodles' },
  { barcode: '4800144022418', name: 'Nissin Cup Noodles Chicken', price: 2500, cost: 2000, stock: 40, category: 'Instant Noodles' },
  { barcode: '4800144022425', name: 'Nissin Cup Noodles Beef', price: 2500, cost: 2000, stock: 40, category: 'Instant Noodles' },
  { barcode: '4800144022432', name: 'Nissin Seafood Flavor', price: 2500, cost: 2000, stock: 40, category: 'Instant Noodles' },
  { barcode: '4800144022449', name: 'Payless Extra Big Chicken', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { barcode: '4800144022456', name: 'Payless Extra Big Beef', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { barcode: '4800144022463', name: 'Quickchow Chicken', price: 1200, cost: 950, stock: 60, category: 'Instant Noodles' },
  { barcode: '4800144022470', name: 'Super Supreme Pancit Canton', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },

  // ── CANNED GOODS ──
  { barcode: '4800011012345', name: 'Century Tuna Flakes in Oil 155g', price: 3500, cost: 2900, stock: 60, category: 'Canned Goods' },
  { barcode: '4800011012352', name: 'Century Tuna Hot & Spicy 155g', price: 3500, cost: 2900, stock: 60, category: 'Canned Goods' },
  { barcode: '4800011012369', name: 'Century Tuna Corned Tuna 155g', price: 3800, cost: 3100, stock: 50, category: 'Canned Goods' },
  { barcode: '4800011022375', name: 'Argentina Corned Beef 150g', price: 3200, cost: 2600, stock: 50, category: 'Canned Goods' },
  { barcode: '4800011022382', name: 'Argentina Corned Beef 210g', price: 4500, cost: 3700, stock: 40, category: 'Canned Goods' },
  { barcode: '4800011022399', name: 'CDO Carne Norte 150g', price: 3000, cost: 2400, stock: 50, category: 'Canned Goods' },
  { barcode: '4800011022405', name: 'Purefoods Corned Beef 210g', price: 6500, cost: 5400, stock: 30, category: 'Canned Goods' },
  { barcode: '4800011032418', name: 'Mega Sardines Red Tomato Sauce 155g', price: 2200, cost: 1750, stock: 100, category: 'Canned Goods' },
  { barcode: '4800011032425', name: 'Mega Sardines Green Hot 155g', price: 2200, cost: 1750, stock: 100, category: 'Canned Goods' },
  { barcode: '4800011032432', name: 'Ligo Sardines Tomato Sauce 155g', price: 2200, cost: 1750, stock: 80, category: 'Canned Goods' },
  { barcode: '4800011032449', name: '555 Sardines Tomato Sauce 155g', price: 2100, cost: 1650, stock: 80, category: 'Canned Goods' },
  { barcode: '4800011042456', name: 'San Marino Corned Tuna 150g', price: 3800, cost: 3100, stock: 50, category: 'Canned Goods' },
  { barcode: '4800011042463', name: 'Youngs Town Sardines 155g', price: 2000, cost: 1550, stock: 60, category: 'Canned Goods' },

  // ── BEVERAGES – POWDERED & JUICE ──
  { barcode: '4800040600123', name: 'Milo Sachet 24g', price: 800, cost: 650, stock: 150, category: 'Beverages' },
  { barcode: '4800040600147', name: 'Milo 3-in-1 30g', price: 900, cost: 720, stock: 150, category: 'Beverages' },
  { barcode: '4800040600154', name: 'Bear Brand Powdered Milk Drink 33g', price: 1500, cost: 1200, stock: 120, category: 'Beverages' },
  { barcode: '4800040600161', name: 'Energen Cereal Drink Vanilla', price: 800, cost: 650, stock: 100, category: 'Beverages' },
  { barcode: '4800040600178', name: 'Great Taste White 3-in-1 Sachet', price: 700, cost: 550, stock: 200, category: 'Beverages' },
  { barcode: '4800040600185', name: 'Nescafe Original 3-in-1 Sachet', price: 700, cost: 550, stock: 200, category: 'Beverages' },
  { barcode: '4800040600192', name: 'Eight O\'Clock Pineapple 1L', price: 6000, cost: 5000, stock: 24, category: 'Beverages' },
  { barcode: '4800040600208', name: 'Minute Maid Orange 1L', price: 8500, cost: 7000, stock: 24, category: 'Beverages' },
  { barcode: '4800040600215', name: 'Minute Maid Pulpy Orange 350ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },

  // ── BEVERAGES – ENERGY & SPORTS ──
  { barcode: '4800700100012', name: 'Cobra Energy Drink 240ml', price: 3000, cost: 2400, stock: 48, category: 'Beverages' },
  { barcode: '4800700100029', name: 'Sting Energy Drink 330ml', price: 3500, cost: 2800, stock: 48, category: 'Beverages' },
  { barcode: '4800700100036', name: 'Red Bull 250ml Can', price: 10000, cost: 8500, stock: 24, category: 'Beverages' },
  { barcode: '4800700100043', name: 'Extra Joss Sachet', price: 1200, cost: 900, stock: 100, category: 'Beverages' },
  { barcode: '4800700100050', name: 'Gatorade Blue Bolt 500ml', price: 4500, cost: 3700, stock: 36, category: 'Beverages' },
  { barcode: '4800700100067', name: 'Gatorade Lemon Lime 500ml', price: 4500, cost: 3700, stock: 36, category: 'Beverages' },
  { barcode: '4800700100074', name: 'Pocari Sweat 500ml', price: 5500, cost: 4500, stock: 36, category: 'Beverages' },
  { barcode: '4800700100081', name: 'Pocari Sweat 330ml Can', price: 3500, cost: 2800, stock: 48, category: 'Beverages' },
  { barcode: '4800700100098', name: 'Revicon Forte 5s', price: 4000, cost: 3200, stock: 50, category: 'Beverages' },

  // ── BEVERAGES – COFFEE ──
  { barcode: '4800361001234', name: 'Kopiko 3-in-1 Classic Sachet', price: 700, cost: 550, stock: 200, category: 'Coffee & Tea' },
  { barcode: '4800361001241', name: 'Kopiko 3-in-1 Strong Sachet', price: 700, cost: 550, stock: 200, category: 'Coffee & Tea' },
  { barcode: '4800361001258', name: 'Kopiko Brown Coffee Sachet', price: 700, cost: 550, stock: 200, category: 'Coffee & Tea' },
  { barcode: '4800361001265', name: 'San Mig Coffee 3-in-1 White', price: 800, cost: 650, stock: 150, category: 'Coffee & Tea' },
  { barcode: '4800361001272', name: 'San Mig Coffee 3-in-1 Mild', price: 800, cost: 650, stock: 150, category: 'Coffee & Tea' },
  { barcode: '4800361001289', name: 'Great Taste Granules 50g', price: 3500, cost: 2900, stock: 30, category: 'Coffee & Tea' },
  { barcode: '4800361001296', name: 'Nescafe Classic Jar 50g', price: 4500, cost: 3800, stock: 25, category: 'Coffee & Tea' },
  { barcode: '4800361001302', name: 'Lipton Yellow Label Tea 25s', price: 6500, cost: 5400, stock: 20, category: 'Coffee & Tea' },

  // ── SEASONING & COOKING ──
  { barcode: '4800800100010', name: 'Ajinomoto Umami Seasoning 50g', price: 1500, cost: 1200, stock: 80, category: 'Seasoning' },
  { barcode: '4800800100027', name: 'Datu Puti Soy Sauce 350ml', price: 2500, cost: 2000, stock: 50, category: 'Seasoning' },
  { barcode: '4800800100034', name: 'Datu Puti Vinegar 350ml', price: 2200, cost: 1750, stock: 50, category: 'Seasoning' },
  { barcode: '4800800100041', name: 'Silver Swan Soy Sauce 350ml', price: 2500, cost: 2000, stock: 50, category: 'Seasoning' },
  { barcode: '4800800100058', name: 'Silver Swan Vinegar 350ml', price: 2200, cost: 1750, stock: 50, category: 'Seasoning' },
  { barcode: '4800800100065', name: 'Mang Tomas Siga Lechon Sauce 330g', price: 4500, cost: 3700, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100072', name: 'Mang Tomas Original Lechon Sauce 330g', price: 4500, cost: 3700, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100089', name: 'UFC Banana Catsup 320g', price: 3500, cost: 2900, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100096', name: 'Jufran Banana Catsup 320g', price: 3500, cost: 2900, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100104', name: 'Magic Sarap All-in-One Seasoning 8g', price: 700, cost: 550, stock: 300, category: 'Seasoning' },
  { barcode: '4800800100111', name: 'McCormick Black Pepper 50g', price: 3500, cost: 2900, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100128', name: 'McCormick Salt 250g', price: 1500, cost: 1200, stock: 60, category: 'Seasoning' },
  { barcode: '4800800100135', name: 'Iodized Salt 250g', price: 1000, cost: 700, stock: 80, category: 'Seasoning' },
  { barcode: '4800800100142', name: 'White Sugar 1kg', price: 8000, cost: 6600, stock: 30, category: 'Seasoning' },
  { barcode: '4800800100159', name: 'Brown Sugar 500g', price: 4500, cost: 3700, stock: 30, category: 'Seasoning' },
  { barcode: '4800800100166', name: 'Wansuy Garlic Powder 80g', price: 2000, cost: 1600, stock: 50, category: 'Seasoning' },
  { barcode: '4800800100173', name: 'Onion Powder 80g', price: 2000, cost: 1600, stock: 50, category: 'Seasoning' },
  { barcode: '4800800100180', name: 'Baking Powder 100g', price: 2000, cost: 1600, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100197', name: 'Baking Soda 200g', price: 1500, cost: 1200, stock: 40, category: 'Seasoning' },
  { barcode: '4800800100203', name: 'Cream of Tartar 50g', price: 2000, cost: 1600, stock: 30, category: 'Seasoning' },

  // ── SNACKS – CHIPS ──
  { barcode: '4800092001234', name: 'SkyFlakes Crackers 33g', price: 800, cost: 600, stock: 100, category: 'Snacks' },
  { barcode: '4800092001241', name: 'SkyFlakes Crackers 200g', price: 4000, cost: 3200, stock: 40, category: 'Snacks' },
  { barcode: '4800092001258', name: 'Hansel Original 33g', price: 800, cost: 600, stock: 100, category: 'Snacks' },
  { barcode: '4800092001265', name: 'Hansel Peanut Butter 33g', price: 800, cost: 600, stock: 100, category: 'Snacks' },
  { barcode: '4800092001272', name: 'Rebisco Assorted 33g', price: 800, cost: 600, stock: 100, category: 'Snacks' },
  { barcode: '4800092001289', name: 'Nova Country Cheddar 78g', price: 2500, cost: 2000, stock: 60, category: 'Snacks' },
  { barcode: '4800092001296', name: 'Piattos Cheese 85g', price: 2800, cost: 2200, stock: 60, category: 'Snacks' },
  { barcode: '4800092001302', name: 'Piattos Roadhouse BBQ 85g', price: 2800, cost: 2200, stock: 60, category: 'Snacks' },
  { barcode: '4800092001319', name: 'Chippy Barbecue 110g', price: 3000, cost: 2400, stock: 50, category: 'Snacks' },
  { barcode: '4800092001326', name: 'V-Cut Potato Chips BBQ 60g', price: 2500, cost: 2000, stock: 50, category: 'Snacks' },
  { barcode: '4800092001333', name: 'Jack n Jill Potato Chips 60g', price: 2500, cost: 2000, stock: 50, category: 'Snacks' },
  { barcode: '4800092001340', name: 'Boy Bawang Corncorn 100g', price: 2000, cost: 1600, stock: 70, category: 'Snacks' },
  { barcode: '4800092001357', name: 'Mr. Chips Nacho Cheese 100g', price: 3000, cost: 2400, stock: 50, category: 'Snacks' },

  // ── DAIRY ──
  { barcode: '4800096001234', name: 'Bear Brand Milk 300ml', price: 3500, cost: 2900, stock: 40, category: 'Dairy' },
  { barcode: '4800096001241', name: 'Bear Brand Milk Sachet 33g', price: 1500, cost: 1200, stock: 100, category: 'Dairy' },
  { barcode: '4800096001258', name: 'Alaska Evaporated Milk 370ml', price: 5500, cost: 4500, stock: 40, category: 'Dairy' },
  { barcode: '4800096001265', name: 'Alaska Evaporated Milk 140ml', price: 2500, cost: 2000, stock: 60, category: 'Dairy' },
  { barcode: '4800096001272', name: 'Alaska Condensed Milk 300ml', price: 5500, cost: 4500, stock: 40, category: 'Dairy' },
  { barcode: '4800096001289', name: 'Magnolia Gold Fresh Milk 1L', price: 9500, cost: 7900, stock: 20, category: 'Dairy' },
  { barcode: '4800096001296', name: 'Nestle All Purpose Cream 250ml', price: 6000, cost: 5000, stock: 30, category: 'Dairy' },
  { barcode: '4800096001302', name: 'Selecta Ice Cream Vanilla 750ml', price: 18000, cost: 15000, stock: 10, category: 'Dairy' },
  { barcode: '4800096001319', name: 'Selecta Cornetto Vanilla', price: 3500, cost: 2800, stock: 30, category: 'Dairy' },
  { barcode: '4800096001326', name: 'Magnolia Cheese Kraft 165g', price: 9000, cost: 7500, stock: 20, category: 'Dairy' },
  { barcode: '4800096001333', name: 'Qeso de Bola 50g', price: 3500, cost: 2800, stock: 30, category: 'Dairy' },
  { barcode: '4800096001340', name: 'Butter Magnolia 225g', price: 8500, cost: 7000, stock: 20, category: 'Dairy' },
  { barcode: '4800096001357', name: 'Lady\'s Choice Mayonnaise 220ml', price: 8000, cost: 6600, stock: 25, category: 'Dairy' },

  // ── NOODLES & PASTA ──
  { barcode: '4800097001234', name: 'San Remo Spaghetti 400g', price: 5500, cost: 4500, stock: 30, category: 'Noodles & Pasta' },
  { barcode: '4800097001241', name: 'Fibisco Pasta Penne 400g', price: 5000, cost: 4100, stock: 30, category: 'Noodles & Pasta' },
  { barcode: '4800097001258', name: 'Royal Spaghetti Sauce Sweet Style 500g', price: 6500, cost: 5400, stock: 30, category: 'Noodles & Pasta' },
  { barcode: '4800097001265', name: 'UFC Spaghetti Sauce Filipino Style 500g', price: 6000, cost: 5000, stock: 30, category: 'Noodles & Pasta' },

  // ── PERSONAL CARE – SOAP & BATH ──
  { barcode: '4800099001234', name: 'Safeguard White Soap 135g', price: 4500, cost: 3700, stock: 40, category: 'Personal Care' },
  { barcode: '4800099001241', name: 'Safeguard Lemon Soap 135g', price: 4500, cost: 3700, stock: 40, category: 'Personal Care' },
  { barcode: '4800099001258', name: 'Safeguard Pink Soap 135g', price: 4500, cost: 3700, stock: 40, category: 'Personal Care' },
  { barcode: '4800099001265', name: 'Silka Papaya Soap 90g', price: 3800, cost: 3100, stock: 40, category: 'Personal Care' },
  { barcode: '4800099001272', name: 'Protex Ice Cool Soap 135g', price: 4500, cost: 3700, stock: 30, category: 'Personal Care' },
  { barcode: '4800099001289', name: 'Dove White Soap 135g', price: 6500, cost: 5400, stock: 30, category: 'Personal Care' },
  { barcode: '4800099001296', name: 'Palmolive Naturals Soap 135g', price: 4200, cost: 3500, stock: 40, category: 'Personal Care' },

  // ── PERSONAL CARE – HAIR & SKIN SACHETS ──
  { barcode: '4800099001326', name: 'Dove Shampoo Sachet 9ml', price: 800, cost: 650, stock: 200, category: 'Personal Care' },
  { barcode: '4800099001333', name: 'Cream Silk Conditioner Sachet 9ml', price: 800, cost: 650, stock: 200, category: 'Personal Care' },
  { barcode: '4800099001340', name: 'Palmolive Shampoo Sachet 9ml', price: 700, cost: 550, stock: 200, category: 'Personal Care' },
  { barcode: '4800099001357', name: 'TRESemmé Shampoo Sachet 10ml', price: 1000, cost: 800, stock: 150, category: 'Personal Care' },
  { barcode: '4800099001364', name: 'Vaseline Lotion Sachet 10ml', price: 800, cost: 650, stock: 200, category: 'Personal Care' },
  { barcode: '4800099001371', name: 'Nivea Lotion Sachet 10ml', price: 1000, cost: 800, stock: 150, category: 'Personal Care' },
  { barcode: '4800099001388', name: 'Pond\'s White Beauty Sachet', price: 800, cost: 650, stock: 150, category: 'Personal Care' },
  { barcode: '4800099001395', name: 'Myra E Lotion Sachet 10ml', price: 1200, cost: 950, stock: 100, category: 'Personal Care' },
  { barcode: '4800099001401', name: 'Creamsilk Hair Treatment Sachet', price: 800, cost: 650, stock: 150, category: 'Personal Care' },

  // ── PERSONAL CARE – DENTAL ──
  { barcode: '4800099100012', name: 'Colgate Toothpaste 75g', price: 4500, cost: 3700, stock: 40, category: 'Personal Care' },
  { barcode: '4800099100029', name: 'Colgate Toothpaste 40g', price: 3000, cost: 2400, stock: 50, category: 'Personal Care' },
  { barcode: '4800099100036', name: 'Closeup Toothpaste 75g', price: 4000, cost: 3200, stock: 40, category: 'Personal Care' },
  { barcode: '4800099100043', name: 'Sensodyne Toothpaste 40g', price: 7500, cost: 6200, stock: 30, category: 'Personal Care' },
  { barcode: '4800099100050', name: 'Oral B Toothbrush Medium', price: 4500, cost: 3700, stock: 30, category: 'Personal Care' },
  { barcode: '4800099100067', name: 'Colgate Toothbrush Soft', price: 4000, cost: 3200, stock: 30, category: 'Personal Care' },

  // ── HOUSEHOLD – LAUNDRY & CLEANING ──
  { barcode: '4800101001234', name: 'Surf Powder Detergent 60g', price: 900, cost: 720, stock: 150, category: 'Household' },
  { barcode: '4800101001241', name: 'Surf Powder Detergent 1kg', price: 9500, cost: 7900, stock: 25, category: 'Household' },
  { barcode: '4800101001258', name: 'Tide Powder Detergent 60g', price: 1000, cost: 800, stock: 150, category: 'Household' },
  { barcode: '4800101001265', name: 'Tide Powder Detergent 1kg', price: 11000, cost: 9200, stock: 20, category: 'Household' },
  { barcode: '4800101001272', name: 'Ariel Powder Detergent 60g', price: 1000, cost: 800, stock: 150, category: 'Household' },
  { barcode: '4800101001289', name: 'Downy Fabric Softener Sachet', price: 800, cost: 650, stock: 200, category: 'Household' },
  { barcode: '4800101001296', name: 'Surf Fabric Conditioner Sachet', price: 700, cost: 550, stock: 200, category: 'Household' },
  { barcode: '4800101001302', name: 'Joy Dishwashing Liquid 250ml', price: 5500, cost: 4500, stock: 30, category: 'Household' },
  { barcode: '4800101001319', name: 'Joy Dishwashing Liquid Sachet', price: 700, cost: 550, stock: 200, category: 'Household' },
  { barcode: '4800101001326', name: 'Sabon Panlaba Bar 380g', price: 3800, cost: 3100, stock: 50, category: 'Household' },

  // ── MEDICINE & FIRST AID ──
  { barcode: '4800102001234', name: 'Biogesic Paracetamol 500mg Tablet', price: 500, cost: 350, stock: 200, category: 'Medicine' },
  { barcode: '4800102001241', name: 'Biogesic Syrup 60ml', price: 7500, cost: 6200, stock: 20, category: 'Medicine' },
  { barcode: '4800102001258', name: 'Bioflu Tablet', price: 800, cost: 600, stock: 100, category: 'Medicine' },
  { barcode: '4800102001265', name: 'Neozep Forte Tablet', price: 1000, cost: 800, stock: 80, category: 'Medicine' },
  { barcode: '4800102001272', name: 'Solmux 500mg Capsule', price: 1200, cost: 950, stock: 80, category: 'Medicine' },
  { barcode: '4800102001289', name: 'Alaxan FR Tablet', price: 1500, cost: 1200, stock: 60, category: 'Medicine' },
  { barcode: '4800102001296', name: 'Mefenamic Acid 500mg Capsule', price: 800, cost: 600, stock: 80, category: 'Medicine' },
  { barcode: '4800102001302', name: 'Kremil-S Antacid Tablet', price: 800, cost: 600, stock: 100, category: 'Medicine' },
  { barcode: '4800102001319', name: 'Rolaids Antacid Tablet', price: 1000, cost: 800, stock: 80, category: 'Medicine' },
  { barcode: '4800102001326', name: 'Betadine Antiseptic 30ml', price: 9000, cost: 7500, stock: 20, category: 'Medicine' },
  { barcode: '4800102001333', name: 'Efficascent Oil 50ml', price: 7000, cost: 5800, stock: 20, category: 'Medicine' },
  { barcode: '4800102001340', name: 'White Flower Oil 10ml', price: 5000, cost: 4100, stock: 30, category: 'Medicine' },
  { barcode: '4800102001357', name: 'Katinko Ointment 50g', price: 5000, cost: 4100, stock: 30, category: 'Medicine' },
  { barcode: '4800102001364', name: 'Vicks VapoRub 25g', price: 9500, cost: 7900, stock: 20, category: 'Medicine' },
  { barcode: '4800102001371', name: 'Forti-D Vitamin D 10s', price: 8000, cost: 6600, stock: 20, category: 'Medicine' },
  { barcode: '4800102001388', name: 'Enervon-C Tablet', price: 1200, cost: 950, stock: 80, category: 'Medicine' },
  { barcode: '4800102001395', name: 'Ascorbic Acid 500mg Tablet', price: 700, cost: 550, stock: 100, category: 'Medicine' },
  { barcode: '4800102001401', name: 'Stresstabs 30s Tablet', price: 18000, cost: 15000, stock: 15, category: 'Medicine' },
  { barcode: '4800102001418', name: 'Condom EZ 3pcs', price: 5500, cost: 4500, stock: 30, category: 'Medicine' },

  // ── SCHOOL SUPPLIES ──
  { barcode: '4800104001234', name: 'Mongol Pencil #2 1pc', price: 1200, cost: 900, stock: 50, category: 'School Supplies' },
  { barcode: '4800104001241', name: 'Mongol Pencil #2 3pcs', price: 3500, cost: 2800, stock: 30, category: 'School Supplies' },
  { barcode: '4800104001258', name: 'Pilot Ballpen Black 0.5', price: 2500, cost: 2000, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001265', name: 'Pilot Ballpen Blue 0.5', price: 2500, cost: 2000, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001272', name: 'Bic Ballpen Black', price: 1500, cost: 1100, stock: 50, category: 'School Supplies' },
  { barcode: '4800104001289', name: 'Intermediate Pad Paper 50 leaves', price: 3500, cost: 2800, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001296', name: 'Whole Pad Paper 50 leaves', price: 3500, cost: 2800, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001302', name: 'Composition Notebook 80 leaves', price: 3000, cost: 2400, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001319', name: 'Spiral Notebook 80 leaves', price: 3500, cost: 2800, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001326', name: 'Crayons 8 colors', price: 2500, cost: 2000, stock: 30, category: 'School Supplies' },
  { barcode: '4800104001333', name: 'Crayons 16 colors', price: 4500, cost: 3700, stock: 20, category: 'School Supplies' },
  { barcode: '4800104001340', name: 'Plastic Ruler 12 inch', price: 1500, cost: 1100, stock: 30, category: 'School Supplies' },
  { barcode: '4800104001357', name: 'Eraser White Pearl', price: 1000, cost: 700, stock: 50, category: 'School Supplies' },
  { barcode: '4800104001364', name: 'Sharpener Plastic', price: 1000, cost: 700, stock: 50, category: 'School Supplies' },
  { barcode: '4800104001371', name: 'Glue Stick 1pc', price: 1500, cost: 1100, stock: 40, category: 'School Supplies' },
  { barcode: '4800104001388', name: 'Permanent Marker Black', price: 2500, cost: 2000, stock: 30, category: 'School Supplies' },
  { barcode: '4800104001395', name: 'Highlighter Yellow', price: 2500, cost: 2000, stock: 30, category: 'School Supplies' },
  { barcode: '4800104001401', name: 'Bond Paper Long 5pcs', price: 1500, cost: 1100, stock: 50, category: 'School Supplies' },
  { barcode: '4800104001418', name: 'Coupon Bond Short 5pcs', price: 1200, cost: 900, stock: 50, category: 'School Supplies' },
  { barcode: '4800104001425', name: 'Pentel Pencil 0.5mm', price: 4500, cost: 3700, stock: 20, category: 'School Supplies' },

  // ── LOAD & PREPAID ──
  { barcode: '4800105001234', name: 'Globe Load ₱10', price: 1000, cost: 950, stock: 200, category: 'E-Load' },
  { barcode: '4800105001241', name: 'Globe Load ₱15', price: 1500, cost: 1425, stock: 200, category: 'E-Load' },
  { barcode: '4800105001258', name: 'Globe Load ₱20', price: 2000, cost: 1900, stock: 200, category: 'E-Load' },
  { barcode: '4800105001265', name: 'Globe Load ₱50', price: 5000, cost: 4750, stock: 100, category: 'E-Load' },
  { barcode: '4800105001272', name: 'Globe Load ₱100', price: 10000, cost: 9500, stock: 100, category: 'E-Load' },
  { barcode: '4800105001289', name: 'Smart/TNT Load ₱10', price: 1000, cost: 950, stock: 200, category: 'E-Load' },
  { barcode: '4800105001296', name: 'Smart/TNT Load ₱15', price: 1500, cost: 1425, stock: 200, category: 'E-Load' },
  { barcode: '4800105001302', name: 'Smart/TNT Load ₱20', price: 2000, cost: 1900, stock: 200, category: 'E-Load' },
  { barcode: '4800105001319', name: 'Smart/TNT Load ₱50', price: 5000, cost: 4750, stock: 100, category: 'E-Load' },
  { barcode: '4800105001326', name: 'Smart/TNT Load ₱100', price: 10000, cost: 9500, stock: 100, category: 'E-Load' },
  { barcode: '4800105001333', name: 'DITO Load ₱10', price: 1000, cost: 950, stock: 100, category: 'E-Load' },

  // ── CIGARETTES & TOBACCO ──
  { barcode: '4800111001234', name: 'Marlboro Red 20s', price: 17000, cost: 15000, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001241', name: 'Marlboro Gold 20s', price: 17000, cost: 15000, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001258', name: 'Marlboro Menthol 20s', price: 17000, cost: 15000, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001265', name: 'Fortune Green 20s', price: 8500, cost: 7200, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001272', name: 'Fortune Menthol 20s', price: 8500, cost: 7200, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001289', name: 'Winston Red 20s', price: 15000, cost: 13200, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001296', name: 'Hope Luxury 20s', price: 8500, cost: 7200, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001302', name: 'Capri Menthol 20s', price: 9000, cost: 7600, stock: 30, category: 'Cigarettes' },
  { barcode: '4800111001319', name: 'Marlboro Red Single Stick', price: 900, cost: 750, stock: 200, category: 'Cigarettes' },
  { barcode: '4800111001326', name: 'Fortune Single Stick', price: 500, cost: 400, stock: 200, category: 'Cigarettes' },

  // ── FROZEN & MISC ──
  { barcode: '4800112001234', name: 'Century Pacific Tuna 555 Flakes 180g', price: 3800, cost: 3100, stock: 30, category: 'Canned Goods' },
  { barcode: '4800112001241', name: 'Delimondo Corned Beef 260g', price: 20000, cost: 17000, stock: 10, category: 'Canned Goods' },
  { barcode: '4800112001258', name: 'Libbys Vienna Sausage 130g', price: 5000, cost: 4100, stock: 30, category: 'Canned Goods' },
  { barcode: '4800112001265', name: 'CDO Cooked Ham 180g', price: 7500, cost: 6200, stock: 20, category: 'Processed Meats' },
  { barcode: '4800112001272', name: 'Shanghai Fried Rice 250g Frozen', price: 9500, cost: 7900, stock: 10, category: 'Frozen Foods' },
  { barcode: '4800112001289', name: 'Delimex Mini Egg Rolls 200g', price: 8500, cost: 7000, stock: 10, category: 'Frozen Foods' },
  { barcode: '4800112001296', name: 'Birch Tree Full Cream Milk 33g', price: 1500, cost: 1200, stock: 80, category: 'Dairy' },
  { barcode: '4800112001302', name: 'Krem-Top Coffee Creamer Sachet 5g', price: 300, cost: 200, stock: 300, category: 'Coffee & Tea' },
  { barcode: '4800112001319', name: 'Coffee Mate Sachet 5g', price: 500, cost: 350, stock: 300, category: 'Coffee & Tea' },

  // ── MORE SNACKS ──
  { barcode: '4800114001234', name: 'Oishi Bread Pan 42g', price: 1500, cost: 1200, stock: 60, category: 'Snacks' },
  { barcode: '4800114001241', name: 'Oishi Pillows Choco 38g', price: 1500, cost: 1200, stock: 60, category: 'Snacks' },
  { barcode: '4800114001258', name: 'Oishi Smart C Orange 30g', price: 1500, cost: 1200, stock: 80, category: 'Snacks' },
  { barcode: '4800114001265', name: 'Lala Snack Mix 55g', price: 2000, cost: 1600, stock: 60, category: 'Snacks' },
  { barcode: '4800114001272', name: 'Pik-Nik Shoestring Potatoes 80g', price: 3500, cost: 2800, stock: 40, category: 'Snacks' },
  { barcode: '4800114001289', name: 'Corn Bits Cheese 22g', price: 1000, cost: 750, stock: 100, category: 'Snacks' },
  { barcode: '4800114001296', name: 'Cornicks Garlic 100g', price: 2500, cost: 2000, stock: 60, category: 'Snacks' },
  { barcode: '4800114001302', name: 'Polvoron Classic 10pcs', price: 3500, cost: 2800, stock: 40, category: 'Snacks' },
  { barcode: '4800114001319', name: 'Polvoron Pinipig 10pcs', price: 3500, cost: 2800, stock: 40, category: 'Snacks' },
  { barcode: '4800114001326', name: 'Mamon 3pcs', price: 3000, cost: 2400, stock: 30, category: 'Snacks' },
  { barcode: '4800114001333', name: 'Ensaymada 1pc', price: 1500, cost: 1100, stock: 30, category: 'Snacks' },
  { barcode: '4800114001340', name: 'Pan de Coco 1pc', price: 1000, cost: 700, stock: 40, category: 'Snacks' },
  { barcode: '4800114001357', name: 'Hany Candy Caramel 55g', price: 2000, cost: 1600, stock: 60, category: 'Candy' },
  { barcode: '4800114001364', name: 'Chew-ets Strawberry Candy', price: 500, cost: 350, stock: 150, category: 'Candy' },
  { barcode: '4800114001371', name: 'Storck Riesen Chocolate 4pcs', price: 2500, cost: 2000, stock: 50, category: 'Candy' },
  { barcode: '4800114001388', name: 'Kinder Joy 1pc', price: 5500, cost: 4500, stock: 30, category: 'Candy' },

  // ── MORE BEVERAGES ──
  { barcode: '4800115001234', name: 'C2 Green Tea Apple 500ml', price: 3000, cost: 2400, stock: 36, category: 'Beverages' },
  { barcode: '4800115001241', name: 'C2 Green Tea Lemon 500ml', price: 3000, cost: 2400, stock: 36, category: 'Beverages' },
  { barcode: '4800115001258', name: 'Royal Tru-Orange 500ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },
  { barcode: '4800115001265', name: 'Sprite 500ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },
  { barcode: '4800115001272', name: 'Coca-Cola 500ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },
  { barcode: '4800115001289', name: 'Mountain Dew 500ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },
  { barcode: '4800115001296', name: 'Pepsi 500ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },
  { barcode: '4800115001302', name: 'Wilkins Pure Drinking Water 500ml', price: 2000, cost: 1500, stock: 60, category: 'Beverages' },
  { barcode: '4800115001319', name: 'Summit Drinking Water 1L', price: 3000, cost: 2300, stock: 40, category: 'Beverages' },
  { barcode: '4800115001326', name: 'Sunquick Orange 25ml Sachet', price: 800, cost: 600, stock: 100, category: 'Beverages' },
  { barcode: '4800115001333', name: 'Royal Tru-Lemon 500ml', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },
  { barcode: '4800115001340', name: 'Cobra Energy Drink 350ml', price: 4000, cost: 3200, stock: 36, category: 'Beverages' },
  { barcode: '4800115001357', name: 'Milo 200ml RTD', price: 3000, cost: 2400, stock: 36, category: 'Beverages' },
  { barcode: '4800115001364', name: 'Bear Brand Milk 200ml RTD', price: 3500, cost: 2800, stock: 36, category: 'Beverages' },

  // ── MORE PERSONAL CARE ──
  { barcode: '4800116001234', name: 'Safeguard Liquid Handwash 200ml', price: 9000, cost: 7500, stock: 20, category: 'Personal Care' },
  { barcode: '4800116001241', name: 'Bioderm Germicidal Soap 135g', price: 4000, cost: 3200, stock: 40, category: 'Personal Care' },
  { barcode: '4800116001258', name: 'Mestiza Soap 90g', price: 3500, cost: 2800, stock: 40, category: 'Personal Care' },
  { barcode: '4800116001265', name: 'St. Ives Apricot Scrub Sachet', price: 1500, cost: 1200, stock: 80, category: 'Personal Care' },
  { barcode: '4800116001272', name: 'Belo Whitening Soap 65g', price: 6500, cost: 5400, stock: 30, category: 'Personal Care' },
  { barcode: '4800116001289', name: 'Lactacyd Feminine Wash Sachet', price: 1500, cost: 1200, stock: 80, category: 'Personal Care' },
  { barcode: '4800116001296', name: 'pH Care Feminine Wash Sachet', price: 1200, cost: 950, stock: 100, category: 'Personal Care' },
  { barcode: '4800116001302', name: 'Splash Island Baby Cologne 100ml', price: 5500, cost: 4500, stock: 20, category: 'Personal Care' },
  { barcode: '4800116001319', name: 'Bench Body Cologne 100ml', price: 8000, cost: 6600, stock: 15, category: 'Personal Care' },
  { barcode: '4800116001326', name: 'Gillette Razor 2-blade 1pc', price: 2500, cost: 2000, stock: 50, category: 'Personal Care' },
  { barcode: '4800116001333', name: 'Silka Papaya Soap 135g', price: 4500, cost: 3700, stock: 30, category: 'Personal Care' },
  { barcode: '4800116001340', name: 'Human Nature Sunblock 30ml', price: 15000, cost: 12500, stock: 10, category: 'Personal Care' },
  { barcode: '4800116001357', name: 'Biore UV Sunscreen Sachet', price: 2000, cost: 1600, stock: 50, category: 'Personal Care' },

  // ── MORE HOUSEHOLD ──
  { barcode: '4800117001234', name: 'Tissue Paper 10 pulls', price: 1000, cost: 750, stock: 100, category: 'Household' },
  { barcode: '4800117001241', name: 'Kleenex Tissue 100pulls', price: 5500, cost: 4500, stock: 30, category: 'Household' },
  { barcode: '4800117001258', name: 'Wet Wipes Pack 10pcs', price: 2500, cost: 2000, stock: 50, category: 'Household' },
  { barcode: '4800117001265', name: 'Scotties Tissue 10s', price: 1000, cost: 750, stock: 100, category: 'Household' },
  { barcode: '4800117001272', name: 'Napkin Small 10pcs', price: 2000, cost: 1600, stock: 60, category: 'Household' },
  { barcode: '4800117001289', name: 'Battery AA 2pcs Eveready', price: 5500, cost: 4500, stock: 30, category: 'Household' },
  { barcode: '4800117001296', name: 'Battery AAA 2pcs Eveready', price: 5500, cost: 4500, stock: 30, category: 'Household' },
  { barcode: '4800117001302', name: 'Battery AA 2pcs Energizer', price: 7500, cost: 6200, stock: 20, category: 'Household' },
  { barcode: '4800117001319', name: 'Light Bulb LED 7W', price: 9500, cost: 7900, stock: 15, category: 'Household' },
  { barcode: '4800117001326', name: 'Extension Cord 3 outlet 1.8m', price: 18000, cost: 15000, stock: 10, category: 'Household' },
  { barcode: '4800117001333', name: 'Pail Small Plastic', price: 10000, cost: 8300, stock: 10, category: 'Household' },
  { barcode: '4800117001340', name: 'Clothespin 12pcs Plastic', price: 3000, cost: 2400, stock: 20, category: 'Household' },
  { barcode: '4800117001357', name: 'Plastic Bag 100pcs Medium', price: 2500, cost: 2000, stock: 30, category: 'Household' },
  { barcode: '4800117001364', name: 'Ice Drop Plastic 50pcs', price: 2000, cost: 1600, stock: 30, category: 'Household' },
  { barcode: '4800117001371', name: 'Ice Candy Plastic 50pcs', price: 2000, cost: 1600, stock: 30, category: 'Household' },

  // ── MORE MEDICINE ──
  { barcode: '4800118001234', name: 'Loperamide 2mg Capsule', price: 800, cost: 600, stock: 80, category: 'Medicine' },
  { barcode: '4800118001241', name: 'Buscopan Tablet 10mg', price: 1200, cost: 950, stock: 60, category: 'Medicine' },
  { barcode: '4800118001258', name: 'Claritin 10mg Tablet', price: 2200, cost: 1800, stock: 40, category: 'Medicine' },
  { barcode: '4800118001265', name: 'Cetirizine 10mg Tablet', price: 800, cost: 600, stock: 80, category: 'Medicine' },
  { barcode: '4800118001272', name: 'Diatabs Tablet', price: 700, cost: 550, stock: 100, category: 'Medicine' },
  { barcode: '4800118001289', name: 'Oresol Sachet', price: 1500, cost: 1200, stock: 60, category: 'Medicine' },
  { barcode: '4800118001296', name: 'Carbocisteine Syrup 60ml', price: 9500, cost: 7900, stock: 20, category: 'Medicine' },
  { barcode: '4800118001302', name: 'Tempra Drops 15ml', price: 8500, cost: 7000, stock: 20, category: 'Medicine' },
  { barcode: '4800118001319', name: 'Ibuprofen 200mg Tablet', price: 700, cost: 550, stock: 100, category: 'Medicine' },
  { barcode: '4800118001326', name: 'Medicol Advance 400mg Tablet', price: 1000, cost: 800, stock: 80, category: 'Medicine' },
  { barcode: '4800118001333', name: 'Ferrous Sulfate 325mg Tablet', price: 500, cost: 350, stock: 100, category: 'Medicine' },
  { barcode: '4800118001340', name: 'Vitamin C 500mg Tablet', price: 700, cost: 550, stock: 100, category: 'Medicine' },
  { barcode: '4800118001357', name: 'Berocca Tablet 1pc', price: 2500, cost: 2000, stock: 50, category: 'Medicine' },
  { barcode: '4800118001364', name: 'Centrum Adults Tablet 1pc', price: 3000, cost: 2400, stock: 40, category: 'Medicine' },
  { barcode: '4800118001371', name: 'Obimin Tablet 1pc', price: 2000, cost: 1600, stock: 50, category: 'Medicine' },
  { barcode: '4800118001388', name: 'Alaxan FR Suspension 60ml', price: 12000, cost: 10000, stock: 15, category: 'Medicine' },
  { barcode: '4800118001395', name: 'Hydrogen Peroxide 60ml', price: 2500, cost: 2000, stock: 30, category: 'Medicine' },
  { barcode: '4800118001401', name: 'Povidone Iodine 10% 60ml', price: 4500, cost: 3700, stock: 20, category: 'Medicine' },
  { barcode: '4800118001418', name: 'Alcohol 70% Isopropyl 100ml', price: 4000, cost: 3200, stock: 40, category: 'Medicine' },
  { barcode: '4800118001425', name: 'Alcohol 70% Ethyl 100ml', price: 4500, cost: 3700, stock: 40, category: 'Medicine' },
];

export async function seedCatalogIfEmpty() {
  // NOTE: This function is intentionally a no-op for the "hidden catalog" feature.
  // We do NOT seed products into the database. The SARI_SARI_SEED data is kept
  // only for auto-populating product name/category when scanning (see handleScan
  // in InventoryScreen). The inventory starts EMPTY so the user can build their
  // own catalog by manually adding unrecognized barcodes.
  try {
    const count = await db.products.count();
    // Database intentionally starts empty; do NOT auto-seed.
    if (count > 0) {
      // Optional: clear existing products to start fresh (kept for debugging)
      // Uncomment the line below to clear existing products on startup:
      // await db.products.clear();
    }
  } catch (err) {
    console.error('Failed to check product count:', err);
  }
}
