import { db, type Product, generateId } from './db';

// Sanitize user input to prevent XSS and SQL injection
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .trim()
    .slice(0, 500); // Limit length
}

// Sanitize product data before saving
function sanitizeProductData(data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> {
  const sanitized: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> = {};
  if (data.name !== undefined) sanitized.name = sanitizeInput(data.name);
  if (data.barcode !== undefined) sanitized.barcode = sanitizeInput(data.barcode);
  if (data.category !== undefined) sanitized.category = sanitizeInput(data.category);
  // Pass through numeric and boolean fields without sanitization
  if (data.price !== undefined) sanitized.price = data.price;
  if (data.cost !== undefined) sanitized.cost = data.cost;
  if (data.stock !== undefined) sanitized.stock = data.stock;
  if (data.isQuickTap !== undefined) sanitized.isQuickTap = data.isQuickTap;
  if (data.image !== undefined) sanitized.image = data.image;
  return sanitized;
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
      ...data,
      ...sanitizedData,
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  } catch (err) {
    console.error('Failed to add product:', err);
    throw new Error('Failed to add product');
  }
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> {
  try {
    const sanitizedData = sanitizeProductData(data);
    await db.products.update(id, {
      ...sanitizedData,
      updatedAt: new Date(),
    });
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
  const product = await db.products.get(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }
  if (product.stock < quantity) {
    throw new Error(`Insufficient stock for "${product.name}": requested ${quantity}, available ${product.stock}`);
  }
  await db.products.update(productId, {
    stock: product.stock - quantity,
    updatedAt: new Date(),
  });
}

export async function getLowStockProducts(threshold = 10): Promise<Product[]> {
  try {
    return await db.products.filter(p => p.stock <= threshold).toArray();
  } catch (err) {
    console.error('Failed to get low stock products:', err);
    throw new Error('Failed to load low stock products');
  }
}