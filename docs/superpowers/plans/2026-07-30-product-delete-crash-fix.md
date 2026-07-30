# Product-Delete Crash Fix + Multi-Select Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa sản phẩm không còn crash, và cho phép xóa nhiều sản phẩm bằng checkbox.

**Architecture:** Migration dựng lại `invoice_items` với khóa ngoại `product_id` `ON DELETE SET NULL` (idempotent, chạy trong `initDB`) để xóa sản phẩm không vi phạm ràng buộc; hóa đơn cũ giữ nguyên nhờ bản chụp. UI bọc `try/catch` làm lưới an toàn và thêm chế độ chọn nhiều + hàm `deleteProductsFromDB` xóa theo nhóm trong một transaction.

**Tech Stack:** React Native (Expo SDK 51), TypeScript, `expo-sqlite` (API sync), Jest (`jest-expo`), `@testing-library/react-native`, `@expo/vector-icons`.

**Spec:** [2026-07-30-product-delete-crash-fix-design.md](../specs/2026-07-30-product-delete-crash-fix-design.md)

## Global Constraints

- Không hard-code mã màu; import từ `src/theme/tokens.ts`.
- Không thêm native dependency mới (chỉ JS/TS thuần).
- Test đặt trong `__tests__/`, chạy bằng `npm test`.
- Giữ `Alert` xác nhận trước khi xóa (đơn lẻ và theo nhóm).
- SQLite đang bị **mock** trong jest — không test hành vi FK thật ở unit; test tập trung vào SQL sinh ra + lưới an toàn UI. FK thật kiểm chứng trên thiết bị.

---

## Task 1: Migration `invoice_items.product_id` → `ON DELETE SET NULL`

**Files:**
- Modify: `src/services/db.ts`
- Modify: `src/types/index.ts`
- Test: `__tests__/dbProductDelete.test.ts` (create)

**Interfaces:**
- Produces:
  - `migrateInvoiceItemsProductFk(database: SQLite.SQLiteDatabase): void` — dựng lại bảng `invoice_items` nếu khóa ngoại `product_id` chưa phải `SET NULL`; idempotent.
  - `initDB` gọi `migrateInvoiceItemsProductFk(database)` sau khi tạo bảng.
  - `InvoiceItem.product_id: number | null`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/dbProductDelete.test.ts
jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
import * as SQLite from 'expo-sqlite';
import { migrateInvoiceItemsProductFk } from '../src/services/db';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dbProductDelete`
Expected: FAIL — `migrateInvoiceItemsProductFk` chưa được export.

- [ ] **Step 3: Modify the type**

Trong `src/types/index.ts`, đổi trường `product_id` của `InvoiceItem`:

```ts
export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}
```

- [ ] **Step 4: Implement the migration**

Trong `src/services/db.ts`, thêm hàm (đặt trước `initDB`):

```ts
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
```

Trong `initDB`, gọi migration ngay sau khối `ALTER TABLE invoices ADD COLUMN payment_method ...` try/catch:

```ts
  try {
    database.execSync(`ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'chuyển khoản';`);
  } catch (e) {
    // Ignore error if column already exists
  }

  migrateInvoiceItemsProductFk(database);
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- dbProductDelete`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "src/services/db.ts|src/types/index.ts" || echo "clean"`
Expected: `clean` (không có lỗi type mới ở 2 file này).

- [ ] **Step 7: Commit**

```bash
git add src/services/db.ts src/types/index.ts __tests__/dbProductDelete.test.ts
git commit -m "fix: migrate invoice_items.product_id to ON DELETE SET NULL"
```

---

## Task 2: `deleteProductsFromDB` — xóa nhiều trong một transaction

**Files:**
- Modify: `src/services/db.ts`
- Test: `__tests__/dbProductDelete.test.ts` (append)

**Interfaces:**
- Consumes: `getDB()` (đã có).
- Produces: `deleteProductsFromDB(ids: number[]): void` — rỗng thì no-op; ngược lại `DELETE FROM products WHERE id IN (?, ...)` trong `withTransactionSync`.

- [ ] **Step 1: Write the failing test** — thêm describe mới vào `__tests__/dbProductDelete.test.ts`

```ts
import { deleteProductsFromDB } from '../src/services/db';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dbProductDelete`
Expected: FAIL — `deleteProductsFromDB` chưa được export.

- [ ] **Step 3: Implement** — thêm vào `src/services/db.ts` sau `deleteProductFromDB`

```ts
export const deleteProductsFromDB = (ids: number[]) => {
  if (ids.length === 0) return;
  const database = getDB();
  const placeholders = ids.map(() => '?').join(', ');
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dbProductDelete`
Expected: PASS (4 tests trong file).

- [ ] **Step 5: Commit**

```bash
git add src/services/db.ts __tests__/dbProductDelete.test.ts
git commit -m "feat: add deleteProductsFromDB for batch product deletion"
```

---

## Task 3: Lưới an toàn xóa đơn lẻ (try/catch) trong `ProductCatalogScreen`

**Files:**
- Modify: `src/screens/ProductCatalogScreen.tsx`
- Test: `__tests__/ProductCatalogScreen.test.tsx` (create)

**Interfaces:**
- Consumes: `deleteProductFromDB`, `getProductsFromDB` (đã có).
- Produces: nút xóa mỗi thẻ có `testID="delete-button-{id}"`; `handleDelete` bọc `try/catch`, lỗi → `Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.')`.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/ProductCatalogScreen.test.tsx
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ProductCatalogScreen } from '../src/screens/ProductCatalogScreen';
import {
  deleteProductFromDB,
  deleteProductsFromDB,
  getProductsFromDB,
} from '../src/services/db';

jest.mock('../src/services/db');
jest.mock('../src/components/AddEditProductModal', () => ({
  AddEditProductModal: () => null,
}));

const sample = [
  { id: 1, name: 'Gạo A', aliases: '', unit: 'kg', unit_price: 1000 },
  { id: 2, name: 'Gạo B', aliases: '', unit: 'kg', unit_price: 2000 },
  { id: 3, name: 'Gạo C', aliases: '', unit: 'kg', unit_price: 3000 },
];

const mockedGet = getProductsFromDB as jest.MockedFunction<typeof getProductsFromDB>;
const mockedDeleteOne = deleteProductFromDB as jest.MockedFunction<typeof deleteProductFromDB>;
const mockedDeleteMany = deleteProductsFromDB as jest.MockedFunction<typeof deleteProductsFromDB>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockReturnValue(sample as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ProductCatalogScreen delete safety net', () => {
  it('shows an error alert instead of crashing when single delete throws', () => {
    mockedDeleteOne.mockImplementation(() => {
      throw new Error('FOREIGN KEY constraint failed');
    });
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementationOnce((_t, _m, buttons) => {
        buttons?.find((b) => b.text === 'Xóa')?.onPress?.();
      });

    const { getByTestId } = render(<ProductCatalogScreen />);
    fireEvent.press(getByTestId('delete-button-1'));

    expect(mockedDeleteOne).toHaveBeenCalledWith(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Lỗi',
      'Không thể xóa sản phẩm. Vui lòng thử lại.'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ProductCatalogScreen`
Expected: FAIL — `getByTestId('delete-button-1')` không tìm thấy (chưa có testID) hoặc lỗi ném ra không được bắt.

- [ ] **Step 3: Implement** — trong `src/screens/ProductCatalogScreen.tsx`

Đổi import db (thêm `deleteProductsFromDB` để dùng ở Task 4, nhưng thêm luôn ở đây cho gọn):

```ts
import { getProductsFromDB, addProductToDB, updateProductInDB, deleteProductFromDB, deleteProductsFromDB } from '../services/db';
```

Thay `handleDelete` bằng bản có try/catch:

```ts
  const handleDelete = (id: number) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa sản phẩm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          try {
            deleteProductFromDB(id);
            loadProducts();
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };
```

Thêm `testID` cho nút xóa mỗi thẻ (trong `renderCard`):

```tsx
          <TouchableOpacity
            testID={`delete-button-${item.id}`}
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            <MaterialIcons name="delete" size={22} color={colors.errorCrimson} />
          </TouchableOpacity>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ProductCatalogScreen`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProductCatalogScreen.tsx __tests__/ProductCatalogScreen.test.tsx
git commit -m "fix: wrap single product delete in try/catch to prevent crash"
```

---

## Task 4: Chế độ chọn nhiều + xóa theo nhóm trong `ProductCatalogScreen`

**Files:**
- Modify: `src/screens/ProductCatalogScreen.tsx`
- Test: `__tests__/ProductCatalogScreen.test.tsx` (append)

**Interfaces:**
- Consumes: `deleteProductsFromDB` (Task 2); `getProductsFromDB`.
- Produces:
  - `testID="select-mode-toggle"` (nút bật/tắt chế độ chọn),
  - `testID="product-card-{id}"` (thẻ; trong chế độ chọn, chạm để toggle),
  - `testID="bulk-delete-button"` (xóa nhóm, no-op khi chưa chọn),
  - `testID="select-all-button"` (chọn/bỏ tất cả).

- [ ] **Step 1: Write the failing test** — thêm describe vào `__tests__/ProductCatalogScreen.test.tsx`

```tsx
describe('ProductCatalogScreen multi-select delete', () => {
  const confirmDeleteAlert = () =>
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Xóa')?.onPress?.();
    });

  it('bulk-deletes the selected products', () => {
    confirmDeleteAlert();
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('product-card-1'));
    fireEvent.press(getByTestId('product-card-3'));
    fireEvent.press(getByTestId('bulk-delete-button'));

    expect(mockedDeleteMany).toHaveBeenCalledWith([1, 3]);
  });

  it('selects all filtered products then deletes them', () => {
    confirmDeleteAlert();
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('select-all-button'));
    fireEvent.press(getByTestId('bulk-delete-button'));

    expect(mockedDeleteMany).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('does nothing when bulk delete is pressed with no selection', () => {
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('bulk-delete-button'));

    expect(mockedDeleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ProductCatalogScreen`
Expected: FAIL — `select-mode-toggle` / `product-card-*` / `bulk-delete-button` chưa tồn tại.

- [ ] **Step 3: Add selection state + handlers**

Trong `ProductCatalogScreen`, thêm state (cạnh các `useState` hiện có):

```ts
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
```

Thêm các handler (sau `handleDelete`):

```ts
  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  };

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Alert.alert('Xác nhận xóa', `Xóa ${ids.length} sản phẩm đã chọn?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          try {
            deleteProductsFromDB(ids);
            loadProducts();
            setSelectionMode(false);
            setSelectedIds(new Set());
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa sản phẩm. Vui lòng thử lại.');
          }
        },
      },
    ]);
  };
```

> `filtered` phải được khai báo TRƯỚC các handler dùng nó (`allSelected`, `toggleSelectAll`). Trong file hiện tại `filtered` (useMemo) nằm trên `renderCard`; đặt các handler này ngay sau `filtered` để không tham chiếu trước khi khai báo.

- [ ] **Step 4: Wire the card for selection**

Sửa `renderCard` — bọc thẻ bằng `TouchableOpacity` có `testID`, thêm checkbox khi ở chế độ chọn, và ẩn hàng nút Sửa/Xóa khi đang chọn:

```tsx
  const renderCard = ({ item }: { item: Product }) => {
    const checked = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        testID={`product-card-${item.id}`}
        activeOpacity={selectionMode ? 0.7 : 1}
        onPress={() => {
          if (selectionMode) toggleSelected(item.id);
        }}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          {selectionMode ? (
            <MaterialIcons
              name={checked ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={checked ? colors.primary : colors.onSurfaceVariant}
              style={{ marginRight: 12 }}
            />
          ) : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.productName}>{item.name}</Text>
            {item.aliases ? (
              <View style={styles.aliasRow}>
                <View style={styles.aliasBadge}>
                  <Text style={styles.aliasBadgeText}>Viết tắt: {item.aliases}</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={styles.thumb}>
            <Text style={styles.thumbLetter}>{item.name.trim().charAt(0).toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.price}>{item.unit_price.toLocaleString('vi-VN')} đ</Text>
          {!selectionMode ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => { setSelectedProduct(item); setModalVisible(true); }}
              >
                <MaterialIcons name="edit" size={22} color={colors.tertiary} />
                <Text style={styles.editText}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`delete-button-${item.id}`}
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id)}
              >
                <MaterialIcons name="delete" size={22} color={colors.errorCrimson} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };
```

- [ ] **Step 5: Add the header toggle + selection action bar**

Trong header, thêm nút chọn (thay khối `avatar` bên phải, hoặc thêm cạnh nó). Đặt nút `testID="select-mode-toggle"`:

```tsx
        <TouchableOpacity
          testID="select-mode-toggle"
          onPress={toggleSelectionMode}
          style={styles.selectToggle}
        >
          <Text style={styles.selectToggleText}>{selectionMode ? 'Xong' : 'Chọn'}</Text>
        </TouchableOpacity>
```

Ngay dưới `searchSection` (trước `FlatList`), thêm thanh hành động khi ở chế độ chọn:

```tsx
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>Đã chọn {selectedIds.size}</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity testID="select-all-button" onPress={toggleSelectAll}>
              <Text style={styles.selectAllText}>{allSelected ? 'Bỏ chọn' : 'Chọn tất cả'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="bulk-delete-button"
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
              style={[styles.bulkDeleteBtn, selectedIds.size === 0 && styles.bulkDeleteBtnDisabled]}
            >
              <MaterialIcons name="delete" size={18} color={colors.white} />
              <Text style={styles.bulkDeleteText}>Xóa ({selectedIds.size})</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
```

Thêm styles (vào `StyleSheet.create`, dùng token màu):

```ts
  selectToggle: { paddingHorizontal: 12, paddingVertical: 8 },
  selectToggleText: { ...typography.labelMd, color: colors.primary },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primaryContainerFaint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.primaryContainerBorder,
  },
  selectionCount: { ...typography.labelMd, color: colors.onSurface },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  selectAllText: { ...typography.labelMd, color: colors.primary },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.errorCrimson,
  },
  bulkDeleteBtnDisabled: { opacity: 0.4 },
  bulkDeleteText: { ...typography.labelMd, color: colors.white },
```

> Nếu token `colors.errorCrimson`, `colors.primaryContainerFaint`, `colors.primaryContainerBorder`, `colors.primary`, `colors.white` chưa có thì kiểm tra `src/theme/tokens.ts` và dùng token tương đương đang tồn tại (các token này đã được dùng ở HomeScreen/ProductCatalog nên có sẵn).

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- ProductCatalogScreen`
Expected: PASS (4 tests: 1 safety-net + 3 multi-select).

- [ ] **Step 7: Full test + typecheck**

Run: `npm test && npx tsc --noEmit 2>&1 | grep -E "src/screens/ProductCatalogScreen.tsx" || echo "screen clean"`
Expected: toàn bộ test PASS; `screen clean`.

- [ ] **Step 8: Commit**

```bash
git add src/screens/ProductCatalogScreen.tsx __tests__/ProductCatalogScreen.test.tsx
git commit -m "feat: multi-select checkbox delete for products"
```

---

## Self-review notes

- **Spec coverage:** Mục 1 (migration SET NULL) → Task 1; mục 3 (type nullable) → Task 1 Step 3; mục 2 (lưới an toàn UI) → Task 3 (đơn lẻ) + Task 4 (nhóm); mục 4 (multi-select + `deleteProductsFromDB`) → Task 2 (DB) + Task 4 (UI). Đủ.
- **Type nhất quán:** `migrateInvoiceItemsProductFk(database)`, `deleteProductsFromDB(ids: number[])`, `InvoiceItem.product_id: number | null`, testID `delete-button-{id}` / `product-card-{id}` / `bulk-delete-button` / `select-all-button` / `select-mode-toggle` dùng đồng nhất giữa test và code.
- **Kiểm chứng runtime:** sau Task 4, build lại lên iPhone 12; xóa loạt sản phẩm (đơn lẻ + multi-select) đã có trong hóa đơn → không crash; Báo Cáo vẫn hiển thị đủ dòng hóa đơn cũ.
