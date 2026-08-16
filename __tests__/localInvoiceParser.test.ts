import { localFastParse } from '../src/services/localInvoiceParser';
import { Product } from '../src/types';

const products: Product[] = [
  { id: 1, name: 'Gạo ST', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
  { id: 2, name: 'Gạo Nếp', aliases: 'nếp, gạo nếp', unit: 'kg', unit_price: 45000 },
  { id: 3, name: 'Gạo Tám Thái', aliases: 'tám thái', unit: 'kg', unit_price: 40000 },
  { id: 4, name: 'Bắc Hương', aliases: 'bắc hương', unit: 'kg', unit_price: 38000 },
];

describe('localFastParse', () => {
  it('parses a simple "<qty> <unit> <product>" utterance', () => {
    const r = localFastParse(['2 cân gạo st'], products)!;
    expect(r).not.toBeNull();
    expect(r.matched_items).toHaveLength(1);
    expect(r.matched_items[0].product_id).toBe(1);
    expect(r.matched_items[0].quantity).toBe(2);
    expect(r.matched_items[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses multiple items and payment method', () => {
    const r = localFastParse(['2 gạo st 1 ký nếp tiền mặt'], products)!;
    expect(r.matched_items).toHaveLength(2);
    expect(r.payment_method).toBe('tiền mặt');
  });

  it('handles "rưỡi" and "nửa"', () => {
    expect(localFastParse(['2 rưỡi gạo st'], products)!.matched_items[0].quantity).toBe(2.5);
    expect(localFastParse(['nửa cân gạo st'], products)!.matched_items[0].quantity).toBe(0.5);
  });

  it('parses quantities written as Vietnamese number words', () => {
    expect(localFastParse(['hai cân gạo st'], products)!.matched_items[0].quantity).toBe(2);
    expect(localFastParse(['ba ký nếp'], products)!.matched_items[0].quantity).toBe(3);
    expect(localFastParse(['mười cân gạo st'], products)!.matched_items[0].quantity).toBe(10);
    expect(localFastParse(['mười lăm gạo st'], products)!.matched_items[0].quantity).toBe(15);
    expect(localFastParse(['hai mươi gạo st'], products)!.matched_items[0].quantity).toBe(20);
    expect(localFastParse(['hai mươi lăm gạo st'], products)!.matched_items[0].quantity).toBe(25);
  });

  it('parses "<number word> <unit> rưỡi"', () => {
    expect(localFastParse(['hai cân rưỡi gạo st'], products)!.matched_items[0].quantity).toBe(2.5);
  });

  it('parses multiple items mixing digits and number words', () => {
    const r = localFastParse(['hai gạo st ba ký nếp'], products)!;
    expect(r.matched_items).toHaveLength(2);
    expect(r.matched_items[0].quantity).toBe(2);
    expect(r.matched_items[1].quantity).toBe(3);
  });

  it('returns null when a correction word appears', () => {
    expect(localFastParse(['2 gạo st à không 3 gạo st'], products)).toBeNull();
  });

  it('returns null when a token cannot be matched', () => {
    expect(localFastParse(['2 cân xyz lạ hoắc'], products)).toBeNull();
  });

  it('defaults quantity to 1 when a product has no leading number', () => {
    const r = localFastParse(['cho gạo st'], products)!;
    expect(r.matched_items).toHaveLength(1);
    expect(r.matched_items[0].product_id).toBe(1);
    expect(r.matched_items[0].quantity).toBe(1);
  });

  it('matches a rice name containing "tám" as a product, not the number 8', () => {
    const r = localFastParse(['tám thái'], products)!;
    expect(r.matched_items).toHaveLength(1);
    expect(r.matched_items[0].product_id).toBe(3);
    expect(r.matched_items[0].quantity).toBe(1);
  });

  it('still reads "tám" as the number 8 when it precedes another product', () => {
    const r = localFastParse(['tám gạo st'], products)!;
    expect(r.matched_items).toHaveLength(1);
    expect(r.matched_items[0].product_id).toBe(1);
    expect(r.matched_items[0].quantity).toBe(8);
  });

  it('parses "<qty> cân <tám product>" correctly', () => {
    const r = localFastParse(['3 cân tám thái'], products)!;
    expect(r.matched_items[0].product_id).toBe(3);
    expect(r.matched_items[0].quantity).toBe(3);
  });

  it('matches "Bắc Hương" even when misheard as "bác hương" (tone-insensitive)', () => {
    const r = localFastParse(['2 cân bác hương'], products)!;
    expect(r.matched_items[0].product_id).toBe(4);
    expect(r.matched_items[0].quantity).toBe(2);
  });
});
