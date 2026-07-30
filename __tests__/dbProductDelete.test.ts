jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
import * as SQLite from 'expo-sqlite';
import { migrateInvoiceItemsProductFk, deleteProductsFromDB } from '../src/services/db';

const fakeDb = {
  execSync: jest.fn(),
  runSync: jest.fn(),
  getAllSync: jest.fn(() => [] as unknown[]),
  withTransactionSync: jest.fn((cb: () => void) => cb()),
};
(SQLite.openDatabaseSync as jest.Mock).mockReturnValue(fakeDb);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('migrateInvoiceItemsProductFk', () => {
  it('rebuilds invoice_items when product_id FK is not yet SET NULL', () => {
    fakeDb.getAllSync.mockReturnValue([{ table: 'products', on_delete: 'NO ACTION' }]);
    migrateInvoiceItemsProductFk(fakeDb as unknown as SQLite.SQLiteDatabase);
    const sql = fakeDb.execSync.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toContain('CREATE TABLE invoice_items_new');
    expect(sql).toContain('ON DELETE SET NULL');
    expect(sql).toContain('DROP TABLE invoice_items');
    expect(sql).toContain('RENAME TO invoice_items');
  });

  it('skips the rebuild when already migrated', () => {
    fakeDb.getAllSync.mockReturnValue([{ table: 'products', on_delete: 'SET NULL' }]);
    migrateInvoiceItemsProductFk(fakeDb as unknown as SQLite.SQLiteDatabase);
    expect(fakeDb.execSync).not.toHaveBeenCalled();
  });
});

describe('deleteProductsFromDB', () => {
  it('does nothing for an empty id list', () => {
    deleteProductsFromDB([]);
    expect(fakeDb.withTransactionSync).not.toHaveBeenCalled();
    expect(fakeDb.runSync).not.toHaveBeenCalled();
  });

  it('deletes selected ids in a transaction using an IN clause', () => {
    deleteProductsFromDB([1, 2, 3]);
    expect(fakeDb.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(fakeDb.runSync).toHaveBeenCalledWith(
      'DELETE FROM products WHERE id IN (?, ?, ?)',
      [1, 2, 3]
    );
  });
});
