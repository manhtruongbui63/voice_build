import { calculateInvoiceTotals } from '../src/services/db';

describe('Invoice Calculation Helper', () => {
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
});
