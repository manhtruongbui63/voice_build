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

type CsvRow = {
  cells: string[];
  line: number;
};

type CsvParseResult = {
  rows: CsvRow[];
  unterminatedQuoteLine?: number;
};

const parseCsv = (csvText: string): CsvParseResult => {
  const source = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let current = '';
  let line = 1;
  let rowStartLine = 1;
  let quoteStartLine: number | undefined;
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
      if (inQuotes) quoteStartLine = line;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else if (char === '\n' && !inQuotes) {
      cells.push(current.trim());
      rows.push({ cells, line: rowStartLine });
      cells = [];
      current = '';
      line += 1;
      rowStartLine = line;
    } else {
      current += char;
      if (char === '\n') line += 1;
    }
  }

  if (inQuotes) return { rows, unterminatedQuoteLine: quoteStartLine };

  if (cells.length > 0 || current.length > 0) {
    cells.push(current.trim());
    rows.push({ cells, line: rowStartLine });
  }

  return { rows };
};

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
  const trimmed = value.trim();
  const validInteger = /^(?:\d+|\d{1,3}([.,])\d{3}(?:\1\d{3})*)\s*(?:đ|d)?$/i;
  if (!validInteger.test(trimmed)) return null;
  const normalized = trimmed.replace(/[đd\s.,]/gi, '');
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

const getCsvCell = (row: string[], index: number, isLastSupportedColumn = false) =>
  isLastSupportedColumn ? row.slice(index).join(',').trim() : (row[index] ?? '').trim();

export const parseProductCsvForPreview = (
  csvText: string,
  existingProducts: Product[]
): ProductImportPreview => {
  const { rows, unterminatedQuoteLine } = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  const preview: ProductImportPreview = {
    totalRows: dataRows.length + (unterminatedQuoteLine ? 1 : 0),
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

  const columnMap = getColumnMap(header.cells);
  if (!columnMap) {
    return {
      ...preview,
      errors: [{ line: 1, message: INVALID_HEADER_MESSAGE }],
    };
  }

  if (unterminatedQuoteLine) {
    return {
      ...preview,
      errors: [{ line: unterminatedQuoteLine, message: 'CSV có dấu nháy kép chưa đóng' }],
    };
  }

  const existingByName = new Map(
    existingProducts.map((product) => [normalizeKey(product.name), product])
  );
  const lastLineByName = new Map<string, number>();

  dataRows.forEach((row) => {
    const name = getCsvCell(row.cells, columnMap.name);
    if (name) lastLineByName.set(normalizeKey(name), row.line);
  });

  dataRows.forEach((row) => {
    const line = row.line;
    const nameInput = getCsvCell(row.cells, columnMap.name);
    const normalizedName = nameInput ? normalizeKey(nameInput) : null;

    if (normalizedName && lastLineByName.get(normalizedName) !== line) {
      preview.errors.push({
        line,
        message: 'Tên sản phẩm bị trùng trong file CSV; dòng cuối cùng sẽ được sử dụng',
      });
      return;
    }

    const aliases = normalizeAliases(getCsvCell(row.cells, columnMap.aliases));
    const unit = getCsvCell(row.cells, columnMap.unit);
    const rawPrice = getCsvCell(row.cells, columnMap.unit_price, true);

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

    const existing = existingByName.get(normalizeKey(nameInput));
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

    if (rowResult.mode === 'create') preview.createRows.push(rowResult);
    else preview.updateRows.push(rowResult);
  });

  return preview;
};
