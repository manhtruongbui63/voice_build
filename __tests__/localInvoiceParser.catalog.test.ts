import { localFastParse } from '../src/services/localInvoiceParser';
import { Product } from '../src/types';

// Trích một phần danh mục gạo thật (từ import_san_pham_gao.csv) để kiểm chứng
// đường nhận diện local phủ được các câu bán hàng thường gặp mà KHÔNG gọi Gemini.
const catalog: Product[] = [
  { id: 1, name: 'Gạo ST25 đặc sản Sóc Trăng', aliases: 'gạo st, gạo sóc trăng, st25, st sóc trăng, sóc trăng 25', unit: 'kg', unit_price: 33000 },
  { id: 3, name: 'Gạo Tám Thái Sen', aliases: 'gạo tám thái sen, tám thái sen, gạo thái sen, tám sen, gạo tám sen', unit: 'kg', unit_price: 22000 },
  { id: 5, name: 'Gạo Tám Nhật', aliases: 'gạo tám nhật, tám nhật, gạo nhật, tám nhật bản, gạo nhật bản', unit: 'kg', unit_price: 22000 },
  { id: 7, name: 'Gạo Tấm', aliases: 'gạo tấm, tấm gạo, tấm', unit: 'kg', unit_price: 18000 },
  { id: 9, name: 'Gạo Séng Cù đặc sản Mường Khương', aliases: 'gạo séng cù, séng cù, gạo mường khương, séng cù mường khương, gạo séng cù đặc sản', unit: 'kg', unit_price: 37000 },
  { id: 10, name: 'Gạo Khang dân', aliases: 'gạo khang dân, khang dân, gạo khang dân bắc, gạo khang dân miền bắc, khang dân gạo', unit: 'kg', unit_price: 18000 },
  { id: 12, name: 'Gạo Bắc Hương Hải Hậu quê', aliases: 'gạo bắc hương hải hậu, bắc hương hải hậu, gạo bắc hương quê, bắc hương quê, bắc hương hải hậu quê', unit: 'kg', unit_price: 22000 },
  { id: 15, name: 'Gạo Đài Thơm', aliases: 'gạo đài thơm, đài thơm, gạo thơm, đài thơm gạo, gạo thơm đài', unit: 'kg', unit_price: 20000 },
  { id: 19, name: 'Gạo Nếp Cái hoa vàng', aliases: 'gạo nếp cái, nếp cái hoa vàng, gạo hoa vàng, nếp cái, gạo nếp cái hoa vàng', unit: 'kg', unit_price: 33000 },
];

const parseOne = (utterance: string) => {
  const r = localFastParse([utterance], catalog);
  expect(r).not.toBeNull();
  return r!;
};

describe('localFastParse against the real rice catalog', () => {
  it.each([
    ['3 cân bắc hương hải hậu', 12, 3],
    ['hai ký séng cù', 9, 2],
    ['5 cân tám thái sen', 3, 5],
    ['nửa cân gạo tấm', 7, 0.5],
    ['3 cân nếp cái hoa vàng', 19, 3],
    ['tám cân đài thơm', 15, 8], // "tám" = 8 khi đứng trước đơn vị + sản phẩm khác
  ])('parses "%s" locally as product %i x%d', (utterance, productId, qty) => {
    const r = parseOne(utterance);
    expect(r.matched_items).toHaveLength(1);
    expect(r.matched_items[0].product_id).toBe(productId);
    expect(r.matched_items[0].quantity).toBe(qty);
  });

  it('matches "tám nhật" as a product, not the number 8', () => {
    const r = parseOne('tám nhật');
    expect(r.matched_items[0].product_id).toBe(5);
    expect(r.matched_items[0].quantity).toBe(1);
  });

  it('matches even when misheard without tones ("bac huong hai hau")', () => {
    const r = parseOne('2 cân bac huong hai hau');
    expect(r.matched_items[0].product_id).toBe(12);
    expect(r.matched_items[0].quantity).toBe(2);
  });

  it('tolerates an extra "gạo" prefix when the alias has none ("gạo st25")', () => {
    const r = parseOne('gạo st25');
    expect(r.matched_items[0].product_id).toBe(1);
    expect(r.matched_items[0].quantity).toBe(1);
  });

  it('parses two items with payment method locally', () => {
    const r = parseOne('3 cân khang dân 2 ký đài thơm tiền mặt');
    expect(r.matched_items).toHaveLength(2);
    expect(r.matched_items[0].product_id).toBe(10);
    expect(r.matched_items[0].quantity).toBe(3);
    expect(r.matched_items[1].product_id).toBe(15);
    expect(r.matched_items[1].quantity).toBe(2);
    expect(r.payment_method).toBe('tiền mặt');
  });
});
