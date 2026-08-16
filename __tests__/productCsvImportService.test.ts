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

  it.each(['1.2.3', '12,34', '1d2'])('rejects malformed price %s', (price) => {
    const result = parseProductCsvForPreview(
      `name,aliases,unit,unit_price\nA,,ly,${price}`,
      []
    );

    expect(result.createRows).toEqual([]);
    expect(result.errors).toEqual([{ line: 2, message: 'Giá bán không hợp lệ' }]);
  });

  it('parses a quoted field that spans multiple physical lines', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\nTrà đào,"trà\nđào,td",ly,45000',
      []
    );

    expect(result.totalRows).toBe(1);
    expect(result.createRows).toEqual([
      {
        line: 2,
        name: 'Trà đào',
        aliases: 'trà\nđào,td',
        unit: 'ly',
        unit_price: 45000,
        mode: 'create',
      },
    ]);
    expect(result.errors).toEqual([]);
  });

  it('reports the opening line for an unterminated quoted field', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\nTrà đào,"trà đào,td,ly,45000',
      []
    );

    expect(result.totalRows).toBe(1);
    expect(result.createRows).toEqual([]);
    expect(result.errors).toEqual([{ line: 2, message: 'CSV có dấu nháy kép chưa đóng' }]);
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

  it('excludes an invalid first duplicate and imports the valid final row', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\nA,old,,1000\nA,new,ly,2000',
      []
    );

    expect(result.createRows).toEqual([
      {
        line: 3,
        name: 'A',
        aliases: 'new',
        unit: 'ly',
        unit_price: 2000,
        mode: 'create',
      },
    ]);
    expect(result.errors).toEqual([
      { line: 2, message: 'Tên sản phẩm bị trùng trong file CSV; dòng cuối cùng sẽ được sử dụng' },
    ]);
  });

  it('excludes a valid first duplicate when the final duplicate is invalid', () => {
    const result = parseProductCsvForPreview(
      'name,aliases,unit,unit_price\nA,old,ly,1000\nA,new,,2000',
      []
    );

    expect(result.createRows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 2, message: 'Tên sản phẩm bị trùng trong file CSV; dòng cuối cùng sẽ được sử dụng' },
      { line: 3, message: 'Thiếu đơn vị' },
    ]);
  });
});
