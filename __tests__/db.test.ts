jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

import {
  calculateInvoiceTotals,
  clearAllInvoicesFromDB,
  getInvoicesByDateRangeFromDB,
  getInvoicesFromDB,
  importProductsFromDB,
  migrateInvoiceCreatedAtToHoChiMinh,
  saveInvoiceToDB,
} from '../src/services/db';
import * as SQLite from 'expo-sqlite';

const fakeDb = {
  execSync: jest.fn(),
  runSync: jest.fn(),
  getAllSync: jest.fn(() => [] as unknown[]),
  withTransactionSync: jest.fn(),
};

type TestProduct = {
  id: number;
  name: string;
  aliases: string;
  unit: string;
  unit_price: number;
};

const useTransactionalProductDb = (initialProducts: TestProduct[], failForName?: string) => {
  let committedProducts = initialProducts.map((product) => ({ ...product }));
  let transactionProducts: TestProduct[] | null = null;

  fakeDb.getAllSync.mockImplementation(() => {
    return (transactionProducts ?? committedProducts).map(({ id, name }) => ({ id, name }));
  });
  fakeDb.runSync.mockImplementation((sql: string, params: unknown[]) => {
    const products = transactionProducts ?? committedProducts;

    if (sql.startsWith('INSERT INTO products')) {
      const [name, aliases, unit, unitPrice] = params as [string, string, string, number];
      if (name === failForName) throw new Error('later write failed');
      const id = Math.max(0, ...products.map((product) => product.id)) + 1;
      products.push({ id, name, aliases, unit, unit_price: unitPrice });
      return { changes: 1, lastInsertRowId: id };
    }

    if (sql.startsWith('UPDATE products')) {
      const [aliases, unit, unitPrice, id] = params as [string, string, number, number];
      const product = products.find((item) => item.id === id);
      if (product) Object.assign(product, { aliases, unit, unit_price: unitPrice });
      return { changes: product ? 1 : 0, lastInsertRowId: 0 };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });
  fakeDb.withTransactionSync.mockImplementation((callback: () => void) => {
    const workingCopy = committedProducts.map((product) => ({ ...product }));
    transactionProducts = workingCopy;
    try {
      callback();
      committedProducts = workingCopy;
    } finally {
      transactionProducts = null;
    }
  });

  return {
    getProducts: () => committedProducts.map((product) => ({ ...product })),
  };
};

describe('Invoice Calculation Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SQLite.openDatabaseSync as jest.Mock).mockReturnValue(fakeDb);
    fakeDb.runSync.mockReturnValue({ lastInsertRowId: 99 });
    fakeDb.getAllSync.mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calculates totals, discount, and customer change correctly', () => {
    const items = [
      { product_id: 1, product_name: 'Gạo ST25', quantity: 1, unit: 'kg', unit_price: 33000, amount: 33000 },
      { product_id: 2, product_name: 'Gạo Tám Thái', quantity: 2, unit: 'kg', unit_price: 22000, amount: 44000 },
    ];
    const discount = 2000;
    const paid = 100000;
    const result = calculateInvoiceTotals(items, discount, paid);

    expect(result.total_quantity).toBe(3);
    expect(result.subtotal_amount).toBe(77000);
    expect(result.final_amount).toBe(75000);
    expect(result.change_amount).toBe(25000);
  });

  it('stores invoice creation time in Asia/Ho_Chi_Minh instead of SQLite UTC', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-30T10:45:12.000Z'));

    saveInvoiceToDB({
      invoice_code: 'HD-TEST',
      total_quantity: 1,
      subtotal_amount: 35000,
      discount_amount: 0,
      final_amount: 35000,
      payment_method: 'tiền mặt',
      items: [
        {
          product_id: 1,
          product_name: 'Cà phê sữa đá',
          quantity: 1,
          unit: 'ly',
          unit_price: 35000,
          amount: 35000,
        },
      ],
    });

    expect(fakeDb.runSync.mock.calls[0][0]).toContain('created_at');
    expect(fakeDb.runSync.mock.calls[0][1]).toContain('2026-07-30 17:45:12');
  });

  it('clears invoices and invoice_items only, leaving products untouched', () => {
    clearAllInvoicesFromDB();

    const sql = fakeDb.execSync.mock.calls.map((call) => call[0]).join('\n');
    expect(sql).toContain('DELETE FROM invoice_items');
    expect(sql).toContain('DELETE FROM invoices');
    expect(sql).not.toContain('DELETE FROM products');
  });

  it('filters invoice ranges using Asia/Ho_Chi_Minh calendar dates', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-30T17:30:00.000Z'));

    getInvoicesFromDB('today');
    expect(fakeDb.getAllSync).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE date(created_at) = ?'),
      ['2026-07-31']
    );

    getInvoicesFromDB('week');
    expect(fakeDb.getAllSync).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE date(created_at) >= ?'),
      ['2026-07-24']
    );

    getInvoicesFromDB('month');
    expect(fakeDb.getAllSync).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE date(created_at) >= ?'),
      ['2026-07-01']
    );
  });

  it('filters invoices by an explicit inclusive date range', () => {
    getInvoicesByDateRangeFromDB('2026-02-01', '2026-02-28');

    expect(fakeDb.getAllSync).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE date(created_at) >= ? AND date(created_at) <= ?'),
      ['2026-02-01', '2026-02-28']
    );
  });

  it('migrates existing UTC invoice timestamps to Ho Chi Minh time only once', () => {
    fakeDb.getAllSync.mockReturnValueOnce([]);

    migrateInvoiceCreatedAtToHoChiMinh(fakeDb as never);

    const executedSql = fakeDb.runSync.mock.calls.map((call) => String(call[0])).join('\n');
    expect(fakeDb.execSync.mock.calls.map((call) => String(call[0])).join('\n')).toContain('app_meta');
    expect(executedSql).toContain("datetime(created_at, '+7 hours')");
    expect(executedSql).toContain('INSERT OR REPLACE INTO app_meta');
  });

  it('skips Ho Chi Minh timestamp migration after the marker is saved', () => {
    fakeDb.getAllSync.mockReturnValueOnce([{ value: 'done' }]);

    migrateInvoiceCreatedAtToHoChiMinh(fakeDb as never);

    const executedSql = fakeDb.runSync.mock.calls.map((call) => String(call[0])).join('\n');
    expect(executedSql).not.toContain("datetime(created_at, '+7 hours')");
  });

  it('imports products in a transaction with create and update rows', () => {
    useTransactionalProductDb([
      { id: 1, name: 'Cà phê sữa đá', aliases: 'old', unit: 'ly', unit_price: 20000 },
    ]);

    const result = importProductsFromDB([
      {
        line: 2,
        name: 'Trà đào cam sả',
        aliases: 'tra dao,td',
        unit: 'ly',
        unit_price: 45000,
        mode: 'create',
      },
      {
        line: 3,
        id: 1,
        name: 'Cà phê sữa đá',
        aliases: 'cfsd,nau da',
        unit: 'ly',
        unit_price: 25000,
        mode: 'update',
      },
    ]);

    expect(fakeDb.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(fakeDb.runSync).toHaveBeenCalledWith(
      'INSERT INTO products (name, aliases, unit, unit_price) VALUES (?, ?, ?, ?)',
      ['Trà đào cam sả', 'tra dao,td', 'ly', 45000]
    );
    expect(fakeDb.runSync).toHaveBeenCalledWith(
      'UPDATE products SET aliases = ?, unit = ?, unit_price = ? WHERE id = ?',
      ['cfsd,nau da', 'ly', 25000, 1]
    );
    expect(result).toEqual({ created: 1, updated: 1 });
  });

  it('matches products inside the transaction instead of trusting stale preview mode or id', () => {
    const database = useTransactionalProductDb([
      { id: 5, name: 'Cà phê sữa đá', aliases: 'old', unit: 'ly', unit_price: 20000 },
    ]);

    const result = importProductsFromDB([
      {
        line: 2,
        name: '  CÀ PHÊ SỮA ĐÁ  ',
        aliases: 'cfsd',
        unit: 'cốc',
        unit_price: 25000,
        mode: 'create',
      },
      {
        line: 3,
        id: 999,
        name: 'Trà đào',
        aliases: 'td',
        unit: 'ly',
        unit_price: 30000,
        mode: 'update',
      },
    ]);

    expect(result).toEqual({ created: 1, updated: 1 });
    expect(fakeDb.runSync).toHaveBeenCalledWith(
      'UPDATE products SET aliases = ?, unit = ?, unit_price = ? WHERE id = ?',
      ['cfsd', 'cốc', 25000, 5]
    );
    expect(fakeDb.runSync).toHaveBeenCalledWith(
      'INSERT INTO products (name, aliases, unit, unit_price) VALUES (?, ?, ?, ?)',
      ['Trà đào', 'td', 'ly', 30000]
    );
    expect(database.getProducts()).toEqual([
      { id: 5, name: 'Cà phê sữa đá', aliases: 'cfsd', unit: 'cốc', unit_price: 25000 },
      { id: 6, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 30000 },
    ]);
  });

  it('rolls back all imported products and propagates a later write failure', () => {
    const database = useTransactionalProductDb([], 'Trà vải');

    expect(() =>
      importProductsFromDB([
        {
          line: 2,
          name: 'Trà đào',
          aliases: 'td',
          unit: 'ly',
          unit_price: 30000,
          mode: 'create',
        },
        {
          line: 3,
          name: 'Trà vải',
          aliases: 'tv',
          unit: 'ly',
          unit_price: 35000,
          mode: 'create',
        },
      ])
    ).toThrow('later write failed');

    expect(database.getProducts()).toEqual([]);
  });

  it('returns zero counts and skips transactions when there are no import rows', () => {
    fakeDb.withTransactionSync.mockImplementation((callback) => callback());

    const result = importProductsFromDB([]);

    expect(fakeDb.withTransactionSync).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, updated: 0 });
  });
});
