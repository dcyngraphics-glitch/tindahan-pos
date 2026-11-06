import { db, type Product, generateId } from './db';

// Sanitize user input to prevent XSS and SQL injection
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .trim()
    .slice(0, 500); // Limit length
}

// Sanitize product data before saving (handles both full and partial objects)
function sanitizeProductData(data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> {
  const result: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> = {};
  if (data.barcode !== undefined) result.barcode = sanitizeInput(data.barcode);
  if (data.name !== undefined) result.name = sanitizeInput(data.name);
  if (data.price !== undefined) result.price = data.price;
  if (data.cost !== undefined) result.cost = data.cost;
  if (data.stock !== undefined) result.stock = data.stock;
  if (data.category !== undefined) result.category = data.category ? sanitizeInput(data.category) : undefined;
  if (data.image !== undefined) result.image = data.image;
  if (data.isQuickTap !== undefined) result.isQuickTap = data.isQuickTap;
  return result;
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    return await db.products.where('id').above('').toArray();
  } catch (err) {
    console.error('Failed to get products:', err);
    throw new Error('Failed to load products');
  }
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  try {
    return await db.products.where('barcode').equals(barcode).first();
  } catch (err) {
    console.error('Failed to get product by barcode:', err);
    throw new Error('Failed to lookup product');
  }
}

export async function getProductById(id: string): Promise<Product | undefined> {
  try {
    return await db.products.get(id);
  } catch (err) {
    console.error('Failed to get product:', err);
    throw new Error('Failed to load product');
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  try {
    const lower = query.toLowerCase();
    return await db.products
      .filter(p => p.name.toLowerCase().includes(lower) || p.barcode.includes(query))
      .toArray();
  } catch (err) {
    console.error('Failed to search products:', err);
    throw new Error('Failed to search products');
  }
}

export async function addProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const id = generateId();
    const now = new Date();
    const sanitizedData = sanitizeProductData(data);
    await db.products.add({
      ...sanitizedData,
      id,
      createdAt: now,
      updatedAt: now,
    } as any);
    return id;
  } catch (err) {
    console.error('Failed to add product:', err);
    throw new Error('Failed to add product');
  }
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  try {
    // Fetch existing product to preserve fields not provided in the update
    const existing = await db.products.get(id);
    if (!existing) throw new Error(`Product not found: ${id}`);
    const sanitizedData = sanitizeProductData(data);
    await db.products.update(id, {
      ...existing,
      ...sanitizedData,
      updatedAt: new Date(),
    } as any);
  } catch (err) {
    console.error('Failed to update product:', err);
    throw new Error('Failed to update product');
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await db.products.delete(id);
  } catch (err) {
    console.error('Failed to delete product:', err);
    throw new Error('Failed to delete product');
  }
}

export async function decrementStock(productId: string, quantity: number): Promise<void> {
  const updated = await db.products
    .where('id')
    .equals(productId)
    .and(p => p.stock >= quantity)
    .modify(p => {
      p.stock -= quantity;
      p.updatedAt = new Date();
    });

  if (updated === 0) {
    throw new Error(`Insufficient stock for product ${productId}: requested ${quantity}`);
  }
}

export async function getLowStockProducts(threshold = 10): Promise<Product[]> {
  try {
    return await db.products.filter(p => p.stock <= threshold).toArray();
  } catch (err) {
    console.error('Failed to get low stock products:', err);
    throw new Error('Failed to load low stock products');
  }
}