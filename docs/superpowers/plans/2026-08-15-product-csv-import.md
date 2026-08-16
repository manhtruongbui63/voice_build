# Product CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe CSV bulk import to the Product tab, including preview validation, create/update classification, transactional DB writes, and iPhone 12 verification.

**Architecture:** Keep parsing and validation in `src/services/productCsvImportService.ts` so the UI only orchestrates file selection and preview state. Add a focused DB helper in `src/services/db.ts` for transactional upsert by product name. Extend `ProductCatalogScreen` with a native CSV picker, preview modal, and import confirmation while preserving existing header/menu/form behavior.

**Tech Stack:** Expo React Native 0.74, TypeScript, Jest, `expo-document-picker`, existing `expo-file-system`, `expo-sqlite`.

## Global Constraints

- CSV supports both English headers: `name,aliases,unit,unit_price`.
- CSV supports Vietnamese headers: `Tên sản phẩm,Alias,Đơn vị,Giá bán`.
- Required fields: product name, unit, unit price.
- Optional field: aliases.
- Match existing products by trimmed product name, case-insensitive.
- Existing products keep their original `name`; CSV updates only `aliases`, `unit`, and `unit_price`.
- If the CSV contains the same product name multiple times, the last row wins and earlier duplicate rows are reported as errors.
- Import must preview before writing to DB.
- Confirm import is disabled when there are no valid rows.
- DB writes must run inside `withTransactionSync`.
- Do not change the common header or bottom menu behavior.
- Do not commit changes unless the user explicitly asks; Git is currently deferred for this project.
- Native verification must include `npm run ios -- --device "iPhone 12"` after dependency/native changes.

---

## File Structure

- Create `src/services/productCsvImportService.ts` for CSV parsing, header normalization, value normalization, preview classification, and exported types.
- Create `__tests__/productCsvImportService.test.ts` for parser and classification tests.
- Modify `src/services/db.ts` to export `importProductsFromDB(rows)`.
- Modify `__tests__/db.test.ts` to cover transactional insert/update behavior.
- Modify `src/screens/ProductCatalogScreen.tsx` to add Import CSV button, file picker orchestration, preview modal, and import confirmation.
- Modify `__tests__/ProductCatalogScreen.test.tsx` to mock `expo-document-picker`, `expo-file-system`, parser service, and DB import helper.
- Modify `package.json` and `package-lock.json` through `npx expo install expo-document-picker`.

---

### Task 1: CSV Parser And Preview Classification

**Files:**
- Create: `src/services/productCsvImportService.ts`
- Test: `__tests__/productCsvImportService.test.ts`

**Interfaces:**
- Consumes: `Product` from `src/types`.
- Produces:
  - `ProductImportRow`
  - `ProductImportError`
  - `ProductImportPreview`
  - `parseProductCsvForPreview(csvText: string, existingProducts: Product[]): ProductImportPreview`

- [ ] **Step 1: Write parser tests**

Create `__tests__/productCsvImportService.test.ts` with this coverage:

```ts
import { parseProductCsvForPreview } from '../src/services/productCsvImportService';
import { Product } from '../src/types';

const existingProducts: Product[] = [
  { id: 1, name: 'Cà phê sữa đá', aliases: 'cf sua', unit: 'ly', unit_price: 25000 },
  { id: 2, name: 'Bạc xỉu', aliases: 'bx', unit: 'ly', unit_price: 29000 },
];

describe('productCsvImportService', () => {
  it('parses English CSV headers and classifies create rows', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\nTrà đào cam sả,"tra dao,td",ly,45000',
      existingProducts
    );

    expect(result.totalRows).toBe(1);
    expect(result.createRows).toEqual([
      {
        line: 2,
        name: 'Trà đào cam sả',
        aliases: 'tra dao,td',
        unit: 'ly',
        unit_price: 45000,
        mode: 'create',
      },
    ]);
    expect(result.updateRows).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('parses Vietnamese CSV headers and classifies update rows case-insensitively', () => {
    const result = parseProductCsvForPreview(
      'Tên sản phẩm,Alias,Đơn vị,Giá bán\ncà phê sữa đá,"nau da,cfsd",Ly,25.000đ',
      existingProducts
    );

    expect(result.totalRows).toBe(1);
    expect(result.createRows).toEqual([]);
    expect(result.updateRows).toEqual([
      {
        line: 2,
        id: 1,
        name: 'Cà phê sữa đá',
        aliases: 'nau da,cfsd',
        unit: 'Ly',
        unit_price: 25000,
        mode: 'update',
      },
    ]);
    expect(result.errors).toEqual([]);
  });

  it('accepts comma and dot price separators with currency suffixes', () => {
    expect(parseProductCsvForPreview('name,aliases,unit,unit_price\nA,,ly,25,000', []).createRows[0].unit_price).toBe(25000);
    expect(parseProductCsvForPreview('name,aliases,unit,unit_price\nA,,ly,25.000', []).createRows[0].unit_price).toBe(25000);
    expect(parseProductCsvForPreview('name,aliases,unit,unit_price\nA,,ly,25,000 d', []).createRows[0].unit_price).toBe(25000);
  });

  it('reports row-level errors for missing required fields and invalid prices', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\n,,ly,12000\nTrà vải,,ly,abc\nTrà chanh,,,\n',
      existingProducts
    );

    expect(result.totalRows).toBe(3);
    expect(result.createRows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 2, message: 'Thiếu tên sản phẩm' },
      { line: 3, message: 'Giá bán không hợp lệ' },
      { line: 4, message: 'Thiếu đơn vị' },
    ]);
  });

  it('reports invalid headers and disables import by returning no valid rows', () => {
    const result = parseProductCsvForPreview('product,price\nA,1000', existingProducts);

    expect(result.totalRows).toBe(1);
    expect(result.createRows).toEqual([]);
    expect(result.updateRows).toEqual([]);
    expect(result.errors).toEqual([
      {
        line: 1,
        message: 'Header CSV không hợp lệ. Cần name, aliases, unit, unit_price hoặc Tên sản phẩm, Alias, Đơn vị, Giá bán',
      },
    ]);
  });

  it('uses the last duplicate CSV row and reports earlier duplicates as errors', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\nTrà đào,old,ly,30000\nTrà đào,new,ly,35000',
      existingProducts
    );

    expect(result.totalRows).toBe(2);
    expect(result.createRows).toEqual([
      {
        line: 3,
        name: 'Trà đào',
        aliases: 'new',
        unit: 'ly',
        unit_price: 35000,
        mode: 'create',
      },
    ]);
    expect(result.errors).toEqual([
      { line: 2, message: 'Tên sản phẩm bị trùng trong file CSV; dòng cuối cùng sẽ được sử dụng' },
    ]);
  });
});
```

- [ ] **Step 2: Run parser tests and verify failure**

Run:

```bash
npm test -- --runInBand productCsvImportService.test.ts
```

Expected: FAIL because `src/services/productCsvImportService.ts` does not exist.

- [ ] **Step 3: Implement parser service**

Create `src/services/productCsvImportService.ts` with these exported types and functions:

```ts
import { Product } from '../types';

export type ProductImportMode = 'create' | 'update';

export type ProductImportRow = {
  line: number;
  id?: number;
  name: string;
  aliases: string;
  unit: string;
  unit_price: number;
  mode: ProductImportMode;
};

export type ProductImportError = {
  line: number;
  message: string;
};

export type ProductImportPreview = {
  totalRows: number;
  createRows: ProductImportRow[];
  updateRows: ProductImportRow[];
  errors: ProductImportError[];
};

const INVALID_HEADER_MESSAGE =
  'Header CSV không hợp lệ. Cần name, aliases, unit, unit_price hoặc Tên sản phẩm, Alias, Đơn vị, Giá bán';

const normalizeKey = (value: string) =>
  value.trim().toLocaleLowerCase('vi-VN').normalize('NFC');

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

const parseCsv = (csvText: string): string[][] =>
  csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line, index, lines) => index < lines.length - 1 || line.trim().length > 0)
    .map(splitCsvLine);

const getColumnMap = (header: string[]) => {
  const normalizedHeader = header.map(normalizeKey);
  const english = ['name', 'aliases', 'unit', 'unit_price'];
  const vietnamese = ['tên sản phẩm', 'alias', 'đơn vị', 'giá bán'];
  const selected = english.every((column) => normalizedHeader.includes(column))
    ? english
    : vietnamese.every((column) => normalizedHeader.includes(column))
      ? vietnamese
      : null;

  if (!selected) return null;

  return {
    name: normalizedHeader.indexOf(selected[0]),
    aliases: normalizedHeader.indexOf(selected[1]),
    unit: normalizedHeader.indexOf(selected[2]),
    unit_price: normalizedHeader.indexOf(selected[3]),
  };
};

const normalizeAliases = (value: string) =>
  value
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)
    .join(',');

const parsePrice = (value: string) => {
  const normalized = value.replace(/[đdĐD\s]/g, '').replace(/[.,]/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

const getCsvCell = (row: string[], index: number, isLastSupportedColumn = false) =>
  isLastSupportedColumn ? row.slice(index).join(',').trim() : (row[index] ?? '').trim();

export const parseProductCsvForPreview = (
  csvText: string,
  existingProducts: Product[]
): ProductImportPreview => {
  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  const preview: ProductImportPreview = {
    totalRows: dataRows.length,
    createRows: [],
    updateRows: [],
    errors: [],
  };

  if (!header) {
    return {
      ...preview,
      errors: [{ line: 1, message: INVALID_HEADER_MESSAGE }],
    };
  }

  const columnMap = getColumnMap(header);
  if (!columnMap) {
    return {
      ...preview,
      errors: [{ line: 1, message: INVALID_HEADER_MESSAGE }],
    };
  }

  const existingByName = new Map(
    existingProducts.map((product) => [normalizeKey(product.name), product])
  );
  const latestByName = new Map<string, ProductImportRow>();

  dataRows.forEach((row, index) => {
    const line = index + 2;
    const nameInput = getCsvCell(row, columnMap.name);
    const aliases = normalizeAliases(getCsvCell(row, columnMap.aliases));
    const unit = getCsvCell(row, columnMap.unit);
    const rawPrice = getCsvCell(row, columnMap.unit_price, true);

    if (!nameInput) {
      preview.errors.push({ line, message: 'Thiếu tên sản phẩm' });
      return;
    }
    if (!unit) {
      preview.errors.push({ line, message: 'Thiếu đơn vị' });
      return;
    }
    const unitPrice = parsePrice(rawPrice);
    if (unitPrice === null) {
      preview.errors.push({ line, message: 'Giá bán không hợp lệ' });
      return;
    }

    const normalizedName = normalizeKey(nameInput);
    const existing = existingByName.get(normalizedName);
    const rowResult: ProductImportRow = existing
      ? {
          line,
          id: existing.id,
          name: existing.name,
          aliases,
          unit,
          unit_price: unitPrice,
          mode: 'update',
        }
      : {
          line,
          name: nameInput,
          aliases,
          unit,
          unit_price: unitPrice,
          mode: 'create',
        };

    const earlier = latestByName.get(normalizedName);
    if (earlier) {
      preview.errors.push({
        line: earlier.line,
        message: 'Tên sản phẩm bị trùng trong file CSV; dòng cuối cùng sẽ được sử dụng',
      });
    }
    latestByName.set(normalizedName, rowResult);
  });

  latestByName.forEach((row) => {
    if (row.mode === 'create') preview.createRows.push(row);
    else preview.updateRows.push(row);
  });

  return preview;
};
```

- [ ] **Step 4: Run parser tests and verify pass**

Run:

```bash
npm test -- --runInBand productCsvImportService.test.ts
```

Expected: PASS.

---

### Task 2: Transactional Product Import DB Helper

**Files:**
- Modify: `src/services/db.ts`
- Modify: `__tests__/db.test.ts`

**Interfaces:**
- Consumes: `ProductImportRow[]` from `src/services/productCsvImportService`.
- Produces: `importProductsFromDB(rows: ProductImportRow[]): { created: number; updated: number }`.

- [ ] **Step 1: Write DB helper tests**

Modify the import list in `__tests__/db.test.ts`:

```ts
import {
  calculateInvoiceTotals,
  getInvoicesByDateRangeFromDB,
  getInvoicesFromDB,
  importProductsFromDB,
  migrateInvoiceCreatedAtToHoChiMinh,
  saveInvoiceToDB,
} from '../src/services/db';
```

Add these tests inside the existing `describe('Invoice Calculation Helper', () => { ... })` block:

```ts
  it('imports products in a transaction with create and update rows', () => {
    fakeDb.withTransactionSync = jest.fn((callback) => callback());

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

  it('returns zero counts and skips transactions when there are no import rows', () => {
    fakeDb.withTransactionSync = jest.fn((callback) => callback());

    const result = importProductsFromDB([]);

    expect(fakeDb.withTransactionSync).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, updated: 0 });
  });
```

- [ ] **Step 2: Run DB tests and verify failure**

Run:

```bash
npm test -- --runInBand db.test.ts
```

Expected: FAIL because `importProductsFromDB` is not exported.

- [ ] **Step 3: Implement DB helper**

Modify `src/services/db.ts`:

```ts
import { Product, Invoice, InvoiceItem } from '../types';
import { ProductImportRow } from './productCsvImportService';
```

Add after `updateProductInDB`:

```ts
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
      if (row.mode === 'update' && row.id !== undefined) {
        database.runSync(
          'UPDATE products SET aliases = ?, unit = ?, unit_price = ? WHERE id = ?',
          [row.aliases, row.unit, row.unit_price, row.id]
        );
        updated += 1;
        return;
      }

      database.runSync(
        'INSERT INTO products (name, aliases, unit, unit_price) VALUES (?, ?, ?, ?)',
        [row.name, row.aliases, row.unit, row.unit_price]
      );
      created += 1;
    });
  });

  return { created, updated };
};
```

- [ ] **Step 4: Run DB tests and verify pass**

Run:

```bash
npm test -- --runInBand db.test.ts
```

Expected: PASS.

---

### Task 3: Product Screen Import UI And File Picker Flow

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/screens/ProductCatalogScreen.tsx`
- Modify: `__tests__/ProductCatalogScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `parseProductCsvForPreview(csvText, products)`.
  - `importProductsFromDB(validRows)`.
  - `DocumentPicker.getDocumentAsync`.
  - `FileSystem.readAsStringAsync`.
- Produces:
  - Product screen button with `testID="product-import-button"`.
  - Preview modal with `testID="product-import-preview-modal"`.
  - Confirm button with `testID="product-import-confirm-button"`.

- [ ] **Step 1: Install native file picker dependency**

Run:

```bash
npx expo install expo-document-picker
```

Expected: `package.json` and `package-lock.json` include `expo-document-picker` compatible with Expo SDK 51.

- [ ] **Step 2: Write UI tests for import flow**

Modify imports in `__tests__/ProductCatalogScreen.test.tsx`:

```ts
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  deleteProductFromDB,
  deleteProductsFromDB,
  getProductsFromDB,
  importProductsFromDB,
} from '../src/services/db';
import { parseProductCsvForPreview } from '../src/services/productCsvImportService';
```

Add mocks near existing mocks:

```ts
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
}));

jest.mock('../src/services/productCsvImportService', () => ({
  parseProductCsvForPreview: jest.fn(),
}));
```

Add typed mocks:

```ts
const mockedImportProducts = importProductsFromDB as jest.MockedFunction<typeof importProductsFromDB>;
const mockedPickDocument = DocumentPicker.getDocumentAsync as jest.MockedFunction<typeof DocumentPicker.getDocumentAsync>;
const mockedReadFile = FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>;
const mockedParseCsv = parseProductCsvForPreview as jest.MockedFunction<typeof parseProductCsvForPreview>;
```

Extend `beforeEach`:

```ts
  mockedImportProducts.mockReturnValue({ created: 0, updated: 0 });
  mockedPickDocument.mockResolvedValue({ canceled: true, assets: null } as never);
  mockedReadFile.mockResolvedValue('');
  mockedParseCsv.mockReturnValue({
    totalRows: 0,
    createRows: [],
    updateRows: [],
    errors: [],
  });
```

Add UI tests:

```ts
describe('ProductCatalogScreen CSV import', () => {
  it('opens a CSV file and renders the import preview summary', async () => {
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/products.csv', name: 'products.csv', mimeType: 'text/csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('name,aliases,unit,unit_price\nTrà đào,td,ly,45000');
    mockedParseCsv.mockReturnValue({
      totalRows: 2,
      createRows: [
        { line: 2, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 45000, mode: 'create' },
      ],
      updateRows: [
        { line: 3, id: 1, name: 'Cà phê sữa đá', aliases: 'cfsd', unit: 'ly', unit_price: 25000, mode: 'update' },
      ],
      errors: [{ line: 4, message: 'Thiếu tên sản phẩm' }],
    });

    const { findByTestId, getByTestId, getByText } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));

    expect(await findByTestId('product-import-preview-modal')).toBeTruthy();
    expect(mockedPickDocument).toHaveBeenCalledWith({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
      copyToCacheDirectory: true,
    });
    expect(mockedReadFile).toHaveBeenCalledWith('file:///tmp/products.csv', { encoding: FileSystem.EncodingType.UTF8 });
    expect(mockedParseCsv).toHaveBeenCalledWith(
      'name,aliases,unit,unit_price\nTrà đào,td,ly,45000',
      sample
    );
    expect(getByText('Import sản phẩm từ CSV')).toBeTruthy();
    expect(getByText('Tổng dòng: 2')).toBeTruthy();
    expect(getByText('Tạo mới: 1')).toBeTruthy();
    expect(getByText('Cập nhật: 1')).toBeTruthy();
    expect(getByText('Lỗi: 1')).toBeTruthy();
    expect(getByText('Dòng 4: Thiếu tên sản phẩm')).toBeTruthy();
  });

  it('imports valid preview rows, reloads products, and shows the result alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/products.csv', name: 'products.csv', mimeType: 'text/csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('name,aliases,unit,unit_price\nTrà đào,td,ly,45000');
    mockedParseCsv.mockReturnValue({
      totalRows: 1,
      createRows: [
        { line: 2, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 45000, mode: 'create' },
      ],
      updateRows: [],
      errors: [],
    });
    mockedImportProducts.mockReturnValue({ created: 1, updated: 0 });

    const { findByTestId, getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));
    await findByTestId('product-import-preview-modal');
    fireEvent.press(getByTestId('product-import-confirm-button'));

    expect(mockedImportProducts).toHaveBeenCalledWith([
      { line: 2, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 45000, mode: 'create' },
    ]);
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenCalledWith('Import thành công', 'Đã tạo mới 1 sản phẩm và cập nhật 0 sản phẩm.');
  });

  it('disables confirm when the preview has no valid rows', async () => {
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/products.csv', name: 'products.csv', mimeType: 'text/csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('bad,header\nA,1000');
    mockedParseCsv.mockReturnValue({
      totalRows: 1,
      createRows: [],
      updateRows: [],
      errors: [{ line: 1, message: 'Header CSV không hợp lệ. Cần name, aliases, unit, unit_price hoặc Tên sản phẩm, Alias, Đơn vị, Giá bán' }],
    });

    const { findByTestId, getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));
    await findByTestId('product-import-preview-modal');

    expect(getByTestId('product-import-confirm-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('does not show an error when the file picker is cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedPickDocument.mockResolvedValue({ canceled: true, assets: null } as never);

    const { getByTestId, queryByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));

    expect(queryByTestId('product-import-preview-modal')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run UI tests and verify failure**

Run:

```bash
npm test -- --runInBand ProductCatalogScreen.test.tsx
```

Expected: FAIL because UI imports and import controls do not exist.

- [ ] **Step 4: Implement ProductCatalogScreen import flow**

Modify `src/screens/ProductCatalogScreen.tsx` imports:

```ts
import {
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  getProductsFromDB,
  addProductToDB,
  updateProductInDB,
  deleteProductFromDB,
  deleteProductsFromDB,
  importProductsFromDB,
} from '../services/db';
import {
  parseProductCsvForPreview,
  ProductImportPreview,
} from '../services/productCsvImportService';
```

Add state:

```ts
  const [importPreview, setImportPreview] = useState<ProductImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
```

Add derived values:

```ts
  const validImportRows = importPreview
    ? [...importPreview.createRows, ...importPreview.updateRows]
    : [];
  const canConfirmImport = validImportRows.length > 0 && !importing;
```

Add handlers:

```ts
  const handleImportCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Lỗi', 'Không thể đọc file CSV.');
        return;
      }

      const csvText = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setImportPreview(parseProductCsvForPreview(csvText, products));
    } catch {
      Alert.alert('Lỗi', 'Không thể đọc file CSV.');
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const rows = [...importPreview.createRows, ...importPreview.updateRows];
    if (rows.length === 0) return;

    setImporting(true);
    try {
      const result = importProductsFromDB(rows);
      loadProducts();
      setImportPreview(null);
      Alert.alert(
        'Import thành công',
        `Đã tạo mới ${result.created} sản phẩm và cập nhật ${result.updated} sản phẩm.`
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể import sản phẩm. Vui lòng thử lại.');
    } finally {
      setImporting(false);
    }
  };
```

Add a button in the non-empty search section under the chips:

```tsx
          <TouchableOpacity
            testID="product-import-button"
            style={styles.importButton}
            onPress={handleImportCsv}
            activeOpacity={0.9}
          >
            <MaterialIcons name="upload-file" size={20} color={colors.primary} />
            <Text style={styles.importButtonText}>Import CSV</Text>
          </TouchableOpacity>
```

Add the same action to the empty state below `Thêm sản phẩm ngay`:

```tsx
              <TouchableOpacity
                testID="product-import-button"
                style={styles.emptyImportCta}
                activeOpacity={0.9}
                onPress={handleImportCsv}
              >
                <MaterialIcons name="upload-file" size={20} color={colors.primary} />
                <Text style={styles.emptyImportCtaText}>Import CSV</Text>
              </TouchableOpacity>
```

Add preview modal before `AddEditProductModal`:

```tsx
      <Modal
        transparent
        visible={Boolean(importPreview)}
        animationType="fade"
        onRequestClose={() => setImportPreview(null)}
      >
        <View style={styles.importOverlay}>
          <View testID="product-import-preview-modal" style={styles.importModal}>
            <View style={styles.importHeader}>
              <Text style={styles.importTitle}>Import sản phẩm từ CSV</Text>
              <TouchableOpacity onPress={() => setImportPreview(null)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={28} color={colors.outline} />
              </TouchableOpacity>
            </View>

            <View style={styles.importStats}>
              <Text style={styles.importStatText}>Tổng dòng: {importPreview?.totalRows ?? 0}</Text>
              <Text style={styles.importStatText}>Tạo mới: {importPreview?.createRows.length ?? 0}</Text>
              <Text style={styles.importStatText}>Cập nhật: {importPreview?.updateRows.length ?? 0}</Text>
              <Text style={[styles.importStatText, styles.importErrorText]}>
                Lỗi: {importPreview?.errors.length ?? 0}
              </Text>
            </View>

            {importPreview?.errors.length ? (
              <ScrollView style={styles.importErrors} contentContainerStyle={styles.importErrorsContent}>
                {importPreview.errors.map((error) => (
                  <Text key={`${error.line}-${error.message}`} style={styles.importErrorLine}>
                    Dòng {error.line}: {error.message}
                  </Text>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.importSuccessHint}>File hợp lệ và sẵn sàng import.</Text>
            )}

            <View style={styles.importActions}>
              <TouchableOpacity style={styles.importCancelButton} onPress={() => setImportPreview(null)}>
                <Text style={styles.importCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="product-import-confirm-button"
                style={[styles.importConfirmButton, !canConfirmImport && styles.importConfirmButtonDisabled]}
                onPress={handleConfirmImport}
                disabled={!canConfirmImport}
                accessibilityState={{ disabled: !canConfirmImport }}
              >
                {importing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.importConfirmText}>Xác nhận import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
```

Add styles using existing tokens:

```ts
  importButton: {
    minHeight: 40,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
  },
  importButtonText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  emptyImportCta: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
  },
  emptyImportCtaText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  importOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(5, 22, 58, 0.42)',
  },
  importModal: {
    maxHeight: '78%',
    borderRadius: 24,
    padding: 20,
    backgroundColor: colors.white,
  },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  importTitle: {
    flex: 1,
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  importStats: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F1F7FF',
    marginBottom: 14,
  },
  importStatText: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  importErrorText: {
    color: colors.errorCrimson,
  },
  importErrors: {
    maxHeight: 180,
    borderRadius: 14,
    backgroundColor: '#FFF7F7',
  },
  importErrorsContent: {
    padding: 12,
    gap: 8,
  },
  importErrorLine: {
    ...typography.bodySm,
    color: colors.errorCrimson,
  },
  importSuccessHint: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  importActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  importCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  importCancelText: {
    ...typography.labelMd,
    color: colors.outline,
  },
  importConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  importConfirmButtonDisabled: {
    opacity: 0.45,
  },
  importConfirmText: {
    ...typography.labelMd,
    color: colors.white,
  },
```

- [ ] **Step 5: Run UI tests and verify pass**

Run:

```bash
npm test -- --runInBand ProductCatalogScreen.test.tsx
```

Expected: PASS.

---

### Task 4: Focused Regression And Native Verification

**Files:**
- Verify only; no source edits expected unless tests expose a bug.

**Interfaces:**
- Consumes all outputs from Tasks 1-3.
- Produces verified app build on iPhone 12.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand productCsvImportService.test.ts db.test.ts ProductCatalogScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Run full Jest**

Run:

```bash
npm test -- --runInBand
```

Expected: all test suites pass. Existing `act(...)` warnings from animation tests may remain, but no failed tests are acceptable.

- [ ] **Step 4: Build and install on iPhone 12**

Run:

```bash
npm run ios -- --device "iPhone 12"
```

Expected: `Build Succeeded` and exit code 0.

- [ ] **Step 5: Manual smoke test on iPhone 12**

Use a small CSV file with this content:

```csv
Tên sản phẩm,Alias,Đơn vị,Giá bán
Cà phê sữa đá,"cfsd,nâu đá",ly,25.000đ
Trà đào cam sả,"td,tra dao",ly,45.000
```

Expected app behavior:

- Tap tab `Sản Phẩm`.
- Tap `Import CSV`.
- Pick the CSV file.
- Preview shows `Tạo mới: 1`, `Cập nhật: 1`, `Lỗi: 0`.
- Tap `Xác nhận import`.
- Alert says `Đã tạo mới 1 sản phẩm và cập nhật 1 sản phẩm.`
- Product list reloads and shows `Trà đào cam sả`.
- Existing `Cà phê sữa đá` keeps the same display name and receives updated alias/unit/price.

---

## Self-Review

- Spec coverage: CSV bilingual headers, required fields, price normalization, duplicate file rows, create/update preview, disabled confirm, DB transaction, UI placement, tests, and iPhone 12 verification are covered.
- Red-flag scan: this plan contains no vague implementation markers.
- Type consistency: `ProductImportRow`, `ProductImportPreview`, `parseProductCsvForPreview`, and `importProductsFromDB` are named consistently across tasks.
