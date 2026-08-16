import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TabletInvoicePanel } from '../src/components/TabletInvoicePanel';
import { InvoiceDraft } from '../src/hooks/useInvoiceDraft';
import { MatchedItem } from '../src/types';

const makeDraft = (over: Partial<InvoiceDraft> = {}): InvoiceDraft => ({
  items: [],
  paid: '',
  paymentMethod: 'chuyển khoản',
  totals: {
    total_quantity: 0,
    subtotal_amount: 0,
    discount_amount: 0,
    final_amount: 0,
    paid_amount: undefined,
    change_amount: 0,
  },
  savedInvoice: null,
  addItems: jest.fn(),
  changeQty: jest.fn(),
  removeItem: jest.fn(),
  setPaid: jest.fn(),
  setPaymentMethod: jest.fn(),
  clear: jest.fn(),
  save: jest.fn(),
  reset: jest.fn(),
  ...over,
});

const sampleItem: MatchedItem = {
  product_id: 1,
  product_name: 'Gạo ST25',
  quantity: 2,
  unit: 'kg',
  unit_price: 30000,
  amount: 60000,
  confidence: 0.97,
};

describe('TabletInvoicePanel', () => {
  it('shows an empty state and a disabled confirm when there are no items', () => {
    const draft = makeDraft();
    const { getByTestId, getByText } = render(<TabletInvoicePanel draft={draft} />);

    expect(getByTestId('tablet-invoice-empty')).toBeTruthy();
    expect(getByText('Thông tin đơn hàng')).toBeTruthy();
    expect(getByTestId('tablet-confirm').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('renders items with price/unit and total, and wires stepper/remove/save', () => {
    const draft = makeDraft({
      items: [sampleItem],
      totals: { total_quantity: 2, subtotal_amount: 60000, discount_amount: 0, final_amount: 60000, paid_amount: undefined, change_amount: 0 },
    });
    const { getByTestId, getByText } = render(<TabletInvoicePanel draft={draft} />);

    expect(getByText('Gạo ST25')).toBeTruthy();
    expect(getByText('30.000đ/kg')).toBeTruthy();
    expect(getByTestId('tablet-total').props.children).toBe('60.000đ');

    fireEvent.press(getByTestId('tablet-item-0-plus'));
    expect(draft.changeQty).toHaveBeenCalledWith(0, 1);
    fireEvent.press(getByTestId('tablet-item-0-remove'));
    expect(draft.removeItem).toHaveBeenCalledWith(0);
    fireEvent.press(getByTestId('tablet-confirm'));
    expect(draft.save).toHaveBeenCalled();
  });

  it('shows Khách đưa / Tiền thừa only for cash payment', () => {
    const cash = makeDraft({ items: [sampleItem], paymentMethod: 'tiền mặt' });
    const { queryByTestId, rerender } = render(<TabletInvoicePanel draft={cash} />);
    expect(queryByTestId('tablet-paid-input')).toBeTruthy();

    const transfer = makeDraft({ items: [sampleItem], paymentMethod: 'chuyển khoản' });
    rerender(<TabletInvoicePanel draft={transfer} />);
    expect(queryByTestId('tablet-paid-input')).toBeNull();
  });

  it('shows the success overlay after saving', () => {
    const draft = makeDraft({
      items: [sampleItem],
      savedInvoice: {
        invoiceCode: 'VOICE-0123',
        savedAt: new Date('2026-08-16T00:00:00Z'),
        totalQuantity: 2,
        finalAmount: 60000,
        paymentMethod: 'tiền mặt',
      },
    });
    const onSaved = jest.fn();
    const { getByTestId, getByText } = render(<TabletInvoicePanel draft={draft} onSaved={onSaved} />);

    expect(getByTestId('tablet-success')).toBeTruthy();
    expect(getByText('VOICE-0123')).toBeTruthy();

    fireEvent.press(getByTestId('tablet-success-new'));
    expect(draft.reset).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });
});
