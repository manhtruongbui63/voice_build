import { act, renderHook } from '@testing-library/react-native';
import { useInvoiceDraft } from '../src/hooks/useInvoiceDraft';
import { saveInvoiceToDB } from '../src/services/db';
import { MatchedItem } from '../src/types';

jest.mock('../src/services/db', () => ({
  saveInvoiceToDB: jest.fn(),
  calculateInvoiceTotals: (
    items: { quantity: number; unit_price: number }[],
    discount = 0,
    paid?: number
  ) => {
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const final = Math.max(0, subtotal - discount);
    return {
      total_quantity: items.reduce((s, i) => s + i.quantity, 0),
      subtotal_amount: subtotal,
      discount_amount: discount,
      final_amount: final,
      paid_amount: paid,
      change_amount: paid != null ? Math.max(0, paid - final) : 0,
    };
  },
}));

const item = (over: Partial<MatchedItem>): MatchedItem => ({
  product_id: 1,
  product_name: 'Gạo ST25',
  quantity: 1,
  unit: 'kg',
  unit_price: 30000,
  amount: 30000,
  confidence: 0.97,
  ...over,
});

const mockedSave = saveInvoiceToDB as jest.MockedFunction<typeof saveInvoiceToDB>;

describe('useInvoiceDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accumulates items and merges duplicates by product_id', () => {
    const { result } = renderHook(() => useInvoiceDraft());

    act(() => result.current.addItems([item({ product_id: 1, quantity: 2 })]));
    act(() => result.current.addItems([item({ product_id: 2, product_name: 'Nếp', quantity: 1, unit_price: 40000 })]));
    act(() => result.current.addItems([item({ product_id: 1, quantity: 3 })]));

    expect(result.current.items).toHaveLength(2);
    const first = result.current.items.find((i) => i.product_id === 1)!;
    expect(first.quantity).toBe(5); // 2 + 3 cộng dồn
    expect(first.amount).toBe(5 * 30000);
    expect(result.current.totals.total_quantity).toBe(6);
    expect(result.current.totals.final_amount).toBe(5 * 30000 + 1 * 40000);
  });

  it('changes quantity (min 1) and removes items', () => {
    const { result } = renderHook(() => useInvoiceDraft());
    act(() => result.current.addItems([item({ quantity: 2 })]));

    act(() => result.current.changeQty(0, 1));
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.items[0].amount).toBe(90000);

    act(() => result.current.changeQty(0, -10));
    expect(result.current.items[0].quantity).toBe(1); // không xuống dưới 1

    act(() => result.current.removeItem(0));
    expect(result.current.items).toHaveLength(0);
  });

  it('saves the invoice and exposes a success summary, then resets', () => {
    const { result } = renderHook(() => useInvoiceDraft());
    act(() => result.current.addItems([item({ quantity: 2 })]));
    act(() => result.current.setPaymentMethod('tiền mặt'));

    act(() => result.current.save(1720000000123));

    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(result.current.savedInvoice).toMatchObject({
      invoiceCode: 'VOICE-0123',
      totalQuantity: 2,
      finalAmount: 60000,
      paymentMethod: 'tiền mặt',
    });

    act(() => result.current.reset());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.savedInvoice).toBeNull();
  });

  it('does not save an empty invoice', () => {
    const { result } = renderHook(() => useInvoiceDraft());
    act(() => result.current.save());
    expect(mockedSave).not.toHaveBeenCalled();
    expect(result.current.savedInvoice).toBeNull();
  });

  it('clear() empties items but keeps success state untouched', () => {
    const { result } = renderHook(() => useInvoiceDraft());
    act(() => result.current.addItems([item({})]));
    act(() => result.current.setPaid('100000'));
    act(() => result.current.clear());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.paid).toBe('');
  });
});
