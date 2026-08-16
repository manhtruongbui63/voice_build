import React from 'react';
import { Alert, Animated, Easing, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DraftInvoiceModal } from '../src/components/DraftInvoiceModal';
import { saveInvoiceToDB } from '../src/services/db';
import { colors } from '../src/theme/tokens';

jest.mock('../src/services/db', () => ({
  calculateInvoiceTotals: (
    items: { quantity: number; unit_price: number }[],
    discount = 0,
    paidAmount?: number
  ) => {
    const total_quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal_amount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const final_amount = Math.max(0, subtotal_amount - discount);
    return {
      total_quantity,
      subtotal_amount,
      discount_amount: discount,
      final_amount,
      paid_amount: paidAmount,
      change_amount: paidAmount === undefined ? 0 : Math.max(0, paidAmount - final_amount),
    };
  },
  saveInvoiceToDB: jest.fn(),
}));

const mockedSaveInvoice = saveInvoiceToDB as jest.MockedFunction<typeof saveInvoiceToDB>;

const items = [
  {
    product_id: 1,
    product_name: 'Cà phê sữa đá',
    quantity: 2,
    unit: 'ly',
    unit_price: 29000,
    amount: 58000,
    confidence: 0.95,
  },
  {
    product_id: 2,
    product_name: 'Bánh mì thịt',
    quantity: 1,
    unit: 'ổ',
    unit_price: 25000,
    amount: 25000,
    confidence: 0.91,
  },
];

describe('DraftInvoiceModal mobile confirmation layout', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockedSaveInvoice.mockReturnValue(1);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the step 02 confirmation screen structure from the design', () => {
    const { getByText, getByTestId, getAllByTestId } = render(
      <DraftInvoiceModal
        visible
        items={items}
        paymentMethod="tiền mặt"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(StyleSheet.flatten(getByTestId('draft-confirmation-header-safe').props.style)).toMatchObject({
      backgroundColor: colors.primary,
    });
    expect(getByText('Xác nhận bill')).toBeTruthy();
    expect(getByText('CHI TIẾT ĐƠN HÀNG')).toBeTruthy();
    expect(getByText('AI nhận diện')).toBeTruthy();
    expect(getAllByTestId('draft-line-item')).toHaveLength(2);
    expect(getByText('Cà phê sữa đá')).toBeTruthy();
    expect(getByText('29.000đ / ly')).toBeTruthy();
    expect(getByText('58.000đ')).toBeTruthy();
    expect(getByText('Tiền mặt')).toBeTruthy();
    expect(getByText('Chuyển khoản')).toBeTruthy();
    expect(getByText('Tạm tính (3 món)')).toBeTruthy();
    expect(getByText('Tổng cộng')).toBeTruthy();
    expect(getByText('Xác Nhận & Lưu Bill')).toBeTruthy();

    expect(StyleSheet.flatten(getByTestId('draft-confirmation-scroll').props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      paddingBottom: 24,
    });
    expect(StyleSheet.flatten(getByTestId('draft-confirmation-action').props.style)).toMatchObject({
      paddingHorizontal: 16,
    });
  });

  it('removes an item with the red overlay close button and keeps totals dynamic', () => {
    const { getAllByTestId, getAllByText, getByText, queryByText } = render(
      <DraftInvoiceModal
        visible
        items={items}
        paymentMethod="tiền mặt"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    fireEvent.press(getAllByTestId('draft-remove-item')[0]);

    expect(queryByText('Cà phê sữa đá')).toBeNull();
    expect(getByText('Tạm tính (1 món)')).toBeTruthy();
    expect(getAllByText('25.000đ').length).toBeGreaterThan(0);
  });

  it('shows an empty bill state and disables saving after all items are removed', () => {
    const { getAllByTestId, getByTestId, getByText, queryAllByTestId } = render(
      <DraftInvoiceModal
        visible
        items={items}
        paymentMethod="tiền mặt"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    fireEvent.press(getAllByTestId('draft-remove-item')[0]);
    fireEvent.press(getAllByTestId('draft-remove-item')[0]);

    expect(queryAllByTestId('draft-line-item')).toHaveLength(0);
    expect(getByText('Chưa có sản phẩm nào trong bill.')).toBeTruthy();
    expect(getByTestId('draft-save-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(getByTestId('draft-save-button'));

    expect(mockedSaveInvoice).not.toHaveBeenCalled();
  });

  it('shows the saved invoice success screen and returns to sales after 5 seconds', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-30T14:30:00+07:00'));
    const timingSpy = jest.spyOn(Animated, 'timing');
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    const { getByText, getByTestId, queryByText } = render(
      <DraftInvoiceModal
        visible
        items={items}
        paymentMethod="chuyển khoản"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.press(getByText('Xác Nhận & Lưu Bill'));

    expect(mockedSaveInvoice).toHaveBeenCalledTimes(1);
    expect(queryByText('Xác nhận bill')).toBeNull();
    expect(StyleSheet.flatten(getByTestId('invoice-success-header-safe').props.style)).toMatchObject({
      backgroundColor: colors.primary,
    });
    expect(getByText('Chi Tiết Hóa Đơn')).toBeTruthy();
    expect(getByText('Lưu hóa đơn thành công')).toBeTruthy();
    expect(getByText('Hóa đơn đã được lưu vào hệ thống an toàn và chờ xử lý.')).toBeTruthy();
    expect(getByText('Mã hóa đơn')).toBeTruthy();
    expect(getByText('Thời gian')).toBeTruthy();
    expect(getByText('14:30 - 30/07/2026')).toBeTruthy();
    expect(getByText('Số lượng')).toBeTruthy();
    expect(getByText('3 sản phẩm')).toBeTruthy();
    expect(getByText('Tổng tiền')).toBeTruthy();
    expect(getByText('83.000 đ')).toBeTruthy();
    expect(getByText('Thanh toán')).toBeTruthy();
    expect(getByText('Chuyển khoản')).toBeTruthy();
    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        toValue: 0,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    expect(getByTestId('success-countdown-fill')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns to sales immediately when the new invoice button is pressed', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    const { getByText } = render(
      <DraftInvoiceModal
        visible
        items={items}
        paymentMethod="tiền mặt"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.press(getByText('Xác Nhận & Lưu Bill'));
    fireEvent.press(getByText('Tạo hóa đơn mới'));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
