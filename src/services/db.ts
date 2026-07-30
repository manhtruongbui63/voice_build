import * as SQLite from 'expo-sqlite';
import { Product, Invoice, InvoiceItem } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('voicebill.db');
  }
  return db;
};

export const initDB = async () => {
  const database = getDB();
  database.execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT,
      unit TEXT NOT NULL DEFAULT 'kg',
      unit_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_code TEXT NOT NULL UNIQUE,
      customer_name TEXT,
      total_quantity REAL NOT NULL,
      subtotal_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      final_amount REAL NOT NULL,
      paid_amount REAL,
      change_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  try {
    database.execSync(`ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'chuyển khoản';`);
  } catch (e) {
    // Ignore error if column already exists
  }
};

export const calculateInvoiceTotals = (
  items: { quantity: number; unit_price: number; amount: number }[],
  discount: number = 0,
  paidAmount?: number
) => {
  const total_quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const final_amount = Math.max(0, subtotal_amount - discount);
  const change_amount = paidAmount !== undefined ? Math.max(0, paidAmount - final_amount) : 0;

  return {
    total_quantity,
    subtotal_amount,
    discount_amount: discount,
    final_amount,
    paid_amount: paidAmount,
    change_amount,
  };
};

export const getProductsFromDB = (): Product[] => {
  const database = getDB();
  return database.getAllSync<Product>('SELECT * FROM products ORDER BY name ASC');
};

export const addProductToDB = (name: string, aliases: string, unit: string, unit_price: number) => {
  const database = getDB();
  database.runSync(
    'INSERT INTO products (name, aliases, unit, unit_price) VALUES (?, ?, ?, ?)',
    [name, aliases, unit, unit_price]
  );
};

export const updateProductInDB = (id: number, name: string, aliases: string, unit: string, unit_price: number) => {
  const database = getDB();
  database.runSync(
    'UPDATE products SET name = ?, aliases = ?, unit = ?, unit_price = ? WHERE id = ?',
    [name, aliases, unit, unit_price, id]
  );
};

export const deleteProductFromDB = (id: number) => {
  const database = getDB();
  database.runSync('DELETE FROM products WHERE id = ?', [id]);
};

export const saveInvoiceToDB = (invoice: Invoice): number => {
  const database = getDB();
  const totals = calculateInvoiceTotals(invoice.items, invoice.discount_amount, invoice.paid_amount);

  const result = database.runSync(
    `INSERT INTO invoices (invoice_code, customer_name, total_quantity, subtotal_amount, discount_amount, final_amount, paid_amount, change_amount, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoice.invoice_code,
      invoice.customer_name || null,
      totals.total_quantity,
      totals.subtotal_amount,
      totals.discount_amount,
      totals.final_amount,
      totals.paid_amount || null,
      totals.change_amount || null,
      invoice.payment_method || 'chuyển khoản',
    ]
  );

  const invoiceId = result.lastInsertRowId;

  for (const item of invoice.items) {
    database.runSync(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit, unit_price, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, item.product_id, item.product_name, item.quantity, item.unit, item.unit_price, item.quantity * item.unit_price]
    );
  }

  return invoiceId;
};

export const getInvoicesFromDB = (range: 'today' | 'week' | 'month' | 'all' = 'all'): Invoice[] => {
  const database = getDB();
  let dateQuery = '';

  if (range === 'today') {
    dateQuery = "WHERE date(created_at) = date('now', 'localtime')";
  } else if (range === 'week') {
    dateQuery = "WHERE date(created_at) >= date('now', '-7 days', 'localtime')";
  } else if (range === 'month') {
    dateQuery = "WHERE date(created_at) >= date('now', 'start of month', 'localtime')";
  }

  const invoices = database.getAllSync<Invoice>(`SELECT * FROM invoices ${dateQuery} ORDER BY created_at DESC`);

  return invoices.map((inv) => {
    const items = database.getAllSync<InvoiceItem>(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [inv.id!]
    );
    return { ...inv, items };
  });
};
