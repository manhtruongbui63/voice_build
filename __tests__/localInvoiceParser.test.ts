import { localFastParse } from '../src/services/localInvoiceParser';
import { Product } from '../src/types';

const products: Product[] = [
  { id: 1, name: 'Gạo ST', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
  { id: 2, name: 'Nước mắm', aliases: 'NM', unit: 'chai', unit_price: 45000 },
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
    const r = localFastParse(['2 gạo st 1 chai nước mắm tiền mặt'], products)!;
    expect(r.matched_items).toHaveLength(2);
    expect(r.payment_method).toBe('tiền mặt');
  });

  it('handles "rưỡi" and "nửa"', () => {
    expect(localFastParse(['2 rưỡi gạo st'], products)!.matched_items[0].quantity).toBe(2.5);
    expect(localFastParse(['nửa cân gạo st'], products)!.matched_items[0].quantity).toBe(0.5);
  });

  it('returns null when a correction word appears', () => {
    expect(localFastParse(['2 gạo st à không 3 gạo st'], products)).toBeNull();
  });

  it('returns null when a token cannot be matched', () => {
    expect(localFastParse(['2 cân xyz lạ hoắc'], products)).toBeNull();
  });

  it('returns null when no quantity precedes a product', () => {
    expect(localFastParse(['cho gạo st'], products)).toBeNull();
  });
});
