import * as SQLite from 'expo-sqlite';
import { Product, Invoice, InvoiceItem } from '../types';
import { ProductImportRow } from './productCsvImportService';
import {
  formatHoChiMinhDateKey,
  formatHoChiMinhDateTime,
  getHoChiMinhDaysAgoDateKey,
  getHoChiMinhMonthStartDateKey,
} from '../utils/hoChiMinhTime';

let db: SQLite.SQLiteDatabase | null = null;

const INVOICE_CREATED_AT_HCM_MIGRATION_KEY = 'invoice_created_at_asia_ho_chi_minh_v1';

export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('voicebill.db');
  }
  return db;
};

const isInvoiceItemsProductFkNullable = (
  database: SQLite.SQLiteDatabase
): boolean => {
  const fks = database.getAllSync<{ table: string; on_delete: string }>(
    'PRAGMA foreign_key_list(invoice_items)'
  );
  return fks.some((fk) => fk.table === 'products' && fk.on_delete === 'SET NULL');
};

export const migrateInvoiceItemsProductFk = (
  database: SQLite.SQLiteDatabase
): void => {
  if (isInvoiceItemsProductFkNullable(database)) return;

  database.execSync('PRAGMA foreign_keys = OFF;');
  database.execSync(`
    BEGIN;
    CREATE TABLE invoice_items_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
    );
    INSERT INTO invoice_items_new (id, invoice_id, product_id, product_name, quantity, unit, unit_price, amount)
      SELECT id, invoice_id, product_id, product_name, quantity, unit, unit_price, amount FROM invoice_items;
    DROP TABLE invoice_items;
    ALTER TABLE invoice_items_new RENAME TO invoice_items;
    COMMIT;
  `);
  database.execSync('PRAGMA foreign_keys = ON;');
};

export const migrateInvoiceCreatedAtToHoChiMinh = (
  database: SQLite.SQLiteDatabase
): void => {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const rows = database.getAllSync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [INVOICE_CREATED_AT_HCM_MIGRATION_KEY]
  );
  if (rows.some((row) => row.value === 'done')) return;

  database.runSync(`
    UPDATE invoices
    SET created_at = datetime(created_at, '+7 hours')
    WHERE created_at IS NOT NULL
  `);
  database.runSync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [INVOICE_CREATED_AT_HCM_MIGRATION_KEY, 'done']
  );
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

  migrateInvoiceItemsProductFk(database);
  migrateInvoiceCreatedAtToHoChiMinh(database);
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

const normalizeProductName = (name: string) =>
  name.trim().toLocaleLowerCase('vi-VN').normalize('NFC');

export const importProductsFromDB = (
  rows: ProductImportRow[]
): { created: number; updated: number } => {
  if (rows.length === 0) {
    return { created: 0, updated: 0 };
  }

  const database = getDB();
  let created = 0;
  let updated = 0;

  database.withTransactionSync(() => {
    rows.forEach((row) => {
      const products = database.getAllSync<Pick<Product, 'id' | 'name'>>(
        'SELECT id, name FROM products'
      );
      const existing = products.find(
        (product) => normalizeProductName(product.name) === normalizeProductName(row.name)
      );

      if (existing) {
        const result = database.runSync(
          'UPDATE products SET aliases = ?, unit = ?, unit_price = ? WHERE id = ?',
          [row.aliases, row.unit, row.unit_price, existing.id]
        );
        updated += result.changes;
        return;
      }

      const result = database.runSync(
        'INSERT INTO products (name, aliases, unit, unit_price) VALUES (?, ?, ?, ?)',
        [row.name.trim(), row.aliases, row.unit, row.unit_price]
      );
      created += result.changes;
    });
  });

  return { created, updated };
};

export const deleteProductFromDB = (id: number) => {
  const database = getDB();
  database.runSync('DELETE FROM products WHERE id = ?', [id]);
};

export const deleteProductsFromDB = (ids: number[]) => {
  if (ids.length === 0) return;
  const database = getDB();
  const placeholders = ids.map(() => '?').join(', ');
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
  });
};

export const saveInvoiceToDB = (invoice: Invoice): number => {
  const database = getDB();
  const totals = calculateInvoiceTotals(invoice.items, invoice.discount_amount, invoice.paid_amount);

  const result = database.runSync(
    `INSERT INTO invoices (invoice_code, customer_name, total_quantity, subtotal_amount, discount_amount, final_amount, paid_amount, change_amount, payment_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      invoice.created_at || formatHoChiMinhDateTime(),
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

/**
 * Xóa toàn bộ hóa đơn + chi tiết hóa đơn (reset dữ liệu báo cáo).
 * KHÔNG động vào bảng products, cũng không đụng SecureStore (API key, cài đặt).
 */
export const clearAllInvoicesFromDB = () => {
  const database = getDB();
  database.execSync(`
    DELETE FROM invoice_items;
    DELETE FROM invoices;
  `);
};

const hydrateInvoices = (invoices: Invoice[]): Invoice[] => {
  const database = getDB();

  return invoices.map((inv) => {
    const items = database.getAllSync<InvoiceItem>(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [inv.id!]
    );
    return { ...inv, items };
  });
};

export const getInvoicesByDateRangeFromDB = (
  startDateKey: string,
  endDateKey: string = startDateKey
): Invoice[] => {
  const database = getDB();
  const invoices = database.getAllSync<Invoice>(
    `SELECT * FROM invoices
     WHERE date(created_at) >= ? AND date(created_at) <= ?
     ORDER BY created_at DESC`,
    [startDateKey, endDateKey]
  );

  return hydrateInvoices(invoices);
};

export const getInvoicesFromDB = (range: 'today' | 'week' | 'month' | 'all' = 'all'): Invoice[] => {
  const database = getDB();
  let dateQuery = '';
  let dateParams: string[] = [];

  if (range === 'today') {
    dateQuery = 'WHERE date(created_at) = ?';
    dateParams = [formatHoChiMinhDateKey()];
  } else if (range === 'week') {
    dateQuery = 'WHERE date(created_at) >= ?';
    dateParams = [getHoChiMinhDaysAgoDateKey(7)];
  } else if (range === 'month') {
    dateQuery = 'WHERE date(created_at) >= ?';
    dateParams = [getHoChiMinhMonthStartDateKey()];
  }

  const invoices = database.getAllSync<Invoice>(
    `SELECT * FROM invoices ${dateQuery} ORDER BY created_at DESC`,
    dateParams
  );

  return hydrateInvoices(invoices);
};
