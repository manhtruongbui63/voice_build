import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { InvoiceHistoryScreen } from '../src/screens/InvoiceHistoryScreen';
import { getInvoicesByDateRangeFromDB, getInvoicesFromDB } from '../src/services/db';
import { generateExcelReport } from '../src/services/excelService';
import { colors, typography } from '../src/theme/tokens';
import { Invoice } from '../src/types';

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    DateTimePickerAndroid: {
      open: jest.fn(),
    },
    default: ({ testID, value, display, onChange }: { testID?: string; value: Date; display?: string; onChange: (event: unknown, date?: Date) => void }) => (
      <Text
        testID={testID}
        accessibilityLabel={display}
        onPress={() => onChange({ type: 'set' }, new Date('2026-08-12T00:00:00.000Z'))}
      >
        {value.toISOString()}
      </Text>
    ),
  };
}, { virtual: true });

jest.mock('../src/services/db');
jest.mock('../src/services/excelService');

const sampleInvoices: Invoice[] = [
  {
    id: 42,
    invoice_code: 'HD-042',
    total_quantity: 3,
    subtotal_amount: 1250000,
    discount_amount: 0,
    final_amount: 1250000,
    payment_method: 'tiền mặt',
    created_at: '2026-08-13 14:30:00',
    items: [
      { product_id: 1, product_name: 'Cà phê sữa đá', quantity: 2, unit: 'ly', unit_price: 35000, amount: 70000 },
      { product_id: 2, product_name: 'Bánh mì thịt', quantity: 1, unit: 'ổ', unit_price: 25000, amount: 25000 },
    ],
  },
  {
    id: 41,
    invoice_code: 'HD-041',
    total_quantity: 2,
    subtotal_amount: 850000,
    discount_amount: 0,
    final_amount: 850000,
    payment_method: 'chuyển khoản',
    created_at: '2026-08-12 13:15:00',
    items: [
      { product_id: 1, product_name: 'Cà phê sữa đá', quantity: 1, unit: 'ly', unit_price: 35000, amount: 35000 },
      { product_id: 3, product_name: 'Trà đào cam sả', quantity: 1, unit: 'ly', unit_price: 45000, amount: 45000 },
    ],
  },
];

const mockedGetInvoices = getInvoicesFromDB as jest.MockedFunction<typeof getInvoicesFromDB>;
const mockedGetInvoicesByDateRange = getInvoicesByDateRangeFromDB as jest.MockedFunction<typeof getInvoicesByDateRangeFromDB>;
const mockedGenerateReport = generateExcelReport as jest.MockedFunction<typeof generateExcelReport>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-13T05:00:00.000Z'));
  jest.clearAllMocks();
  mockedGetInvoices.mockReturnValue(sampleInvoices);
  mockedGetInvoicesByDateRange.mockReturnValue(sampleInvoices);
  mockedGenerateReport.mockResolvedValue('report.xlsx');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('InvoiceHistoryScreen report design', () => {
  it('renders the Stitch statistics tab', () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    expect(StyleSheet.flatten(getByTestId('report-tab-statistics').props.style)).toMatchObject({
      backgroundColor: colors.primary,
    });
    expect(getByText('Doanh thu')).toBeTruthy();
    expect(getByText('Tổng doanh thu')).toBeTruthy();
    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo ngày');
    expect(getByTestId('report-top-products-filter-label').props.children).toBe('Hôm nay');
    expect(getByTestId('report-total-revenue').props.children).toBe('1.250.000đ');
    expect(getByText('+47,1% so với ngày trước')).toBeTruthy();
    expect(getByTestId('report-revenue-chart')).toBeTruthy();
    expect(getByText('Bán chạy nhất')).toBeTruthy();
    expect(getByText('Cà phê sữa đá')).toBeTruthy();
    expect(getByText('3 ly')).toBeTruthy();
  });

  it('breaks revenue down into cash and bank transfer for the selected period', () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    // "Theo ngày" (hôm nay = 2026-08-13): chỉ HD-042 (tiền mặt) rơi vào hôm nay.
    expect(getByText('Tiền mặt')).toBeTruthy();
    expect(getByText('Chuyển khoản')).toBeTruthy();
    expect(getByTestId('report-revenue-cash').props.children).toBe('1.250.000đ');
    expect(getByTestId('report-revenue-transfer').props.children).toBe('0đ');
  });

  it('places the export button in the revenue header and lets the chart flex on tablet', () => {
    const rn = require('react-native');
    const spy = jest
      .spyOn(rn, 'useWindowDimensions')
      .mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

    const { getByTestId } = render(<InvoiceHistoryScreen />);

    // Export button exists (moved next to the range dropdown) and the chart grows to fill space.
    expect(getByTestId('report-export-button')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('report-revenue-chart').props.style)).toMatchObject({
      flex: 1,
    });

    spy.mockRestore();
  });

  it('renders the tablet master-detail invoices layout and auto-selects the first invoice', async () => {
    const rn = require('react-native');
    const spy = jest
      .spyOn(rn, 'useWindowDimensions')
      .mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

    const { getByText, getAllByText, getByTestId, queryByTestId } = render(<InvoiceHistoryScreen />);
    fireEvent.press(getByText('Hóa đơn'));

    await waitFor(() => expect(getByTestId('invoice-detail-panel')).toBeTruthy());
    // Chi tiết inline, không dùng bottom-sheet modal như mobile.
    expect(queryByTestId('invoice-detail-sheet')).toBeNull();
    // Mã hóa đơn xuất hiện ở cả card danh sách và panel chi tiết.
    expect(getAllByText('HD-042').length).toBeGreaterThanOrEqual(2);

    spy.mockRestore();
  });

  it('opens the export modal with day defaults and only two report types', () => {
    const { getByTestId, getByText, queryByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Xuất báo cáo'));
    expect(getByTestId('report-export-modal')).toBeTruthy();
    expect(getByText('Xuất báo cáo Excel')).toBeTruthy();
    // Subtitle cũ đã bị loại bỏ.
    expect(queryByText('Chọn mốc thời gian để tạo file Excel và lưu trên thiết bị')).toBeNull();
    expect(getByTestId('report-export-type-day')).toBeTruthy();
    expect(getByTestId('report-export-type-month')).toBeTruthy();
    expect(queryByText('Xuất theo tuần')).toBeNull();

    // Mặc định: xuất theo ngày, chưa chọn ngày bắt đầu, ngày kết thúc là hôm nay.
    expect(getByText('Chọn khoảng ngày')).toBeTruthy();
    expect(getByText('Chọn ngày')).toBeTruthy();
    expect(getByText('13/08/2026')).toBeTruthy();
    expect(getByText('Chọn ngày bắt đầu để xem phạm vi')).toBeTruthy();
    // Chưa chọn ngày bắt đầu -> không cho xuất.
    expect(getByTestId('report-export-confirm').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('exports a day range after picking the start date', async () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Xuất báo cáo'));
    fireEvent.press(getByTestId('report-export-day-start'));
    // Chọn ngày bắt đầu (mock trả về 12/08/2026).
    fireEvent.press(getByTestId('report-export-native-date-picker'));

    expect(getByText('Phạm vi: 12/08/2026 - 13/08/2026')).toBeTruthy();
    expect(getByTestId('report-export-confirm').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(getByText('Xuất file'));
    await waitFor(() => {
      expect(mockedGetInvoicesByDateRange).toHaveBeenCalledWith('2026-08-12', '2026-08-13');
      expect(mockedGenerateReport).toHaveBeenCalledWith(sampleInvoices, 'TỪ 12/08/2026 ĐẾN 13/08/2026');
    });
  });

  it('exports a whole month with the current month selected by default', async () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Xuất báo cáo'));
    fireEvent.press(getByTestId('report-export-type-month'));

    // Tháng hiện tại (8) được chọn mặc định, kết thúc ở hôm nay.
    expect(getByText('Phạm vi: 01/08/2026 - 13/08/2026')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('report-export-month-8').props.style)).toMatchObject({
      backgroundColor: colors.secondary,
    });
    // Tháng quá khứ dùng viền + chữ primary trên nền trắng.
    expect(StyleSheet.flatten(getByTestId('report-export-month-2').props.style)).toMatchObject({
      backgroundColor: colors.white,
      borderColor: colors.primary,
    });
    // Tháng tương lai bị disable.
    expect(getByTestId('report-export-month-10').props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(getByText('Xuất file'));
    await waitFor(() => {
      expect(mockedGetInvoicesByDateRange).toHaveBeenCalledWith('2026-08-01', '2026-08-13');
      expect(mockedGenerateReport).toHaveBeenCalledWith(sampleInvoices, 'THÁNG 8/2026');
    });
  });

  it('selects a past month button and exports its full range', async () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Xuất báo cáo'));
    fireEvent.press(getByTestId('report-export-type-month'));
    fireEvent.press(getByTestId('report-export-month-2'));

    expect(getByText('Phạm vi: 01/02/2026 - 28/02/2026')).toBeTruthy();

    fireEvent.press(getByText('Xuất file'));
    await waitFor(() => {
      expect(mockedGetInvoicesByDateRange).toHaveBeenCalledWith('2026-02-01', '2026-02-28');
      expect(mockedGenerateReport).toHaveBeenCalledWith(sampleInvoices, 'THÁNG 2/2026');
    });
  });

  it('resets the export form to defaults each time the modal opens', () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Xuất báo cáo'));
    fireEvent.press(getByTestId('report-export-type-month'));
    fireEvent.press(getByTestId('report-export-month-2'));
    fireEvent.press(getByTestId('report-export-cancel'));

    fireEvent.press(getByText('Xuất báo cáo'));
    // Quay lại mặc định "xuất theo ngày".
    expect(getByText('Chọn khoảng ngày')).toBeTruthy();
    expect(getByText('Chọn ngày')).toBeTruthy();
    expect(getByTestId('report-export-confirm').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('keeps chart, top products, and invoice history filters independent', () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo ngày');
    expect(getByTestId('report-top-products-filter-label').props.children).toBe('Hôm nay');

    fireEvent.press(getByTestId('report-top-products-filter'));
    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo ngày');
    expect(getByTestId('report-top-products-filter-label').props.children).toBe('Tuần này');

    fireEvent.press(getByText('Hóa đơn'));
    expect(getByTestId('report-invoices-filter-label').props.children).toBe('Theo ngày');

    fireEvent.press(getByTestId('report-invoices-filter'));
    fireEvent.press(getByTestId('report-invoices-filter-option-week'));
    expect(getByTestId('report-invoices-filter-label').props.children).toBe('Theo tuần');

    fireEvent.press(getByText('Thống kê'));
    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo ngày');
    expect(getByTestId('report-top-products-filter-label').props.children).toBe('Tuần này');
  });

  it('renders the chart range options in a top layer so chart touches cannot block selection', () => {
    const { getByTestId, queryByTestId } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByTestId('report-chart-filter'));

    expect(getByTestId('report-chart-filter-options-layer')).toBeTruthy();
    fireEvent.press(getByTestId('report-chart-filter-option-week'));

    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo tuần');
    expect(queryByTestId('report-chart-filter-options-layer')).toBeNull();
  });

  it('builds revenue chart bars and growth from the selected statistics option', () => {
    const chartInvoices: Invoice[] = [
      { ...sampleInvoices[0], id: 50, final_amount: 300000, created_at: '2026-08-13 09:30:00' },
      { ...sampleInvoices[1], id: 51, final_amount: 100000, created_at: '2026-08-12 14:15:00' },
      { ...sampleInvoices[0], id: 52, final_amount: 50000, created_at: '2026-08-10 08:00:00' },
      { ...sampleInvoices[1], id: 53, final_amount: 70000, created_at: '2026-08-03 10:00:00' },
      { ...sampleInvoices[0], id: 54, final_amount: 200000, created_at: '2026-07-20 10:00:00' },
    ];
    mockedGetInvoices.mockImplementation((range) => (range === 'all' ? chartInvoices : sampleInvoices));

    const { getByTestId, getByText, queryByText } = render(<InvoiceHistoryScreen />);

    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo ngày');
    expect(getByTestId('report-chart-bar-0-label').props.children).toBe('T2');
    expect(getByTestId('report-chart-bar-6-label').props.children).toBe('CN');
    expect(getByTestId('report-chart-bar-3-value').props.children).toBe('300k');
    expect(StyleSheet.flatten(getByTestId('report-chart-bar-3-fill').props.style)).toMatchObject({
      backgroundColor: colors.secondary,
    });
    expect(getByTestId('report-total-revenue').props.children).toBe('300.000đ');
    expect(getByText('+200% so với ngày trước')).toBeTruthy();
    expect(queryByText('8.0tr')).toBeNull();

    fireEvent.press(getByTestId('report-chart-filter'));
    fireEvent.press(getByTestId('report-chart-filter-option-week'));

    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo tuần');
    expect(getByTestId('report-chart-bar-4-label').props.children).toBe('08/16');
    expect(getByTestId('report-chart-bar-4-value').props.children).toBe('450k');
    expect(StyleSheet.flatten(getByTestId('report-chart-bar-4-fill').props.style)).toMatchObject({
      backgroundColor: colors.secondary,
    });
    expect(getByText('450.000đ')).toBeTruthy();
    expect(getByText('+542,9% so với tuần trước')).toBeTruthy();

    fireEvent.press(getByTestId('report-chart-filter'));
    fireEvent.press(getByTestId('report-chart-filter-option-month'));

    expect(getByTestId('report-chart-filter-label').props.children).toBe('Theo tháng');
    expect(getByTestId('report-chart-bar-0-label').props.children).toBe('T1');
    expect(getByTestId('report-chart-bar-11-label').props.children).toBe('T12');
    expect(StyleSheet.flatten(getByTestId('report-chart-bar-7-fill').props.style)).toMatchObject({
      backgroundColor: colors.secondary,
    });
    expect(getByText('520.000đ')).toBeTruthy();
    expect(getByText('+160% so với tháng trước')).toBeTruthy();
  });

  it('renders invoice tab cards and opens the invoice detail bottom sheet', () => {
    const { getByTestId, getByText, queryByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Hóa đơn'));

    expect(StyleSheet.flatten(getByTestId('report-tab-invoices').props.style)).toMatchObject({
      backgroundColor: colors.primary,
    });
    expect(getByText('Lịch sử giao dịch')).toBeTruthy();
    expect(getByText('HD-042')).toBeTruthy();
    expect(getByText('1.250.000 ₫')).toBeTruthy();
    expect(getByText('Chuyển khoản')).toBeTruthy();
    expect(queryByText('Tổng doanh thu')).toBeNull();

    fireEvent.press(getByTestId('invoice-card-42'));
    expect(getByTestId('invoice-detail-sheet')).toBeTruthy();
    expect(getByText('13/08/2026 - 14:30')).toBeTruthy();
    expect(getByText('Chi tiết sản phẩm')).toBeTruthy();
    expect(getByText('Tổng cộng')).toBeTruthy();
    expect(getByTestId('invoice-detail-print-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(getByTestId('invoice-detail-cancel-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('keeps invoice card typography and compact sizing after grouping by date', () => {
    const { getByTestId, getByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Hóa đơn'));

    expect(StyleSheet.flatten(getByTestId('invoice-card-42').props.style)).toMatchObject({
      minHeight: 92,
    });
    expect(StyleSheet.flatten(getByTestId('invoice-card-42-code').props.style)).toMatchObject(
      typography.labelMd
    );
    expect(StyleSheet.flatten(getByTestId('invoice-card-42-time').props.style)).toMatchObject(
      typography.bodySm
    );
    expect(StyleSheet.flatten(getByTestId('invoice-card-42-amount').props.style)).toMatchObject({
      fontSize: 20,
      lineHeight: 28,
    });
    expect(StyleSheet.flatten(getByTestId('invoice-card-42-payment-badge').props.style)).toMatchObject({
      minHeight: 28,
      paddingHorizontal: 10,
      gap: 4,
    });
    expect(StyleSheet.flatten(getByTestId('invoice-card-42-payment-text').props.style)).toMatchObject(
      typography.labelSm
    );
  });

  it('groups invoice history by date and filters it from a top-layer range dropdown', () => {
    const groupedInvoices: Invoice[] = [
      sampleInvoices[0],
      {
        ...sampleInvoices[1],
        id: 40,
        invoice_code: 'HD-040',
        final_amount: 2100000,
        payment_method: 'tiền mặt',
        created_at: '2026-08-13 11:05:00',
        items: [
          {
            product_id: 4,
            product_name: 'Sản phẩm cần kiểm tra',
            quantity: 1,
            unit: 'cái',
            unit_price: 2100000,
            amount: 2100000,
            confidence: 0.62,
          } as Invoice['items'][number] & { confidence: number },
        ],
      },
      {
        ...sampleInvoices[1],
        id: 39,
        invoice_code: 'HD-039',
        final_amount: 450000,
        created_at: '2026-08-12 18:20:00',
      },
    ];
    mockedGetInvoices.mockImplementation((range) =>
      range === 'today'
        ? groupedInvoices.filter((invoice) => invoice.created_at?.startsWith('2026-08-13'))
        : groupedInvoices
    );

    const { getByTestId, getByText, queryByText } = render(<InvoiceHistoryScreen />);

    fireEvent.press(getByText('Hóa đơn'));

    expect(getByText('HÔM NAY')).toBeTruthy();
    expect(getByTestId('invoice-date-group-2026-08-13')).toBeTruthy();
    expect(queryByText('12/08/2026')).toBeNull();
    expect(getByTestId('report-invoices-filter-label').props.children).toBe('Theo ngày');
    expect(StyleSheet.flatten(getByTestId('invoice-card-40').props.style)).toMatchObject({
      backgroundColor: colors.warningSurface,
    });

    fireEvent.press(getByTestId('report-invoices-filter'));
    expect(getByTestId('report-invoices-filter-options-layer')).toBeTruthy();
    fireEvent.press(getByTestId('report-invoices-filter-option-month'));

    expect(getByTestId('report-invoices-filter-label').props.children).toBe('Theo tháng');
    expect(getByText('12/08/2026')).toBeTruthy();
    expect(getByTestId('invoice-date-group-2026-08-12')).toBeTruthy();

    fireEvent.press(getByTestId('report-invoices-filter'));
    expect(getByTestId('report-invoices-filter-options-layer')).toBeTruthy();
    fireEvent.press(getByTestId('report-invoices-filter-option-today'));

    expect(getByTestId('report-invoices-filter-label').props.children).toBe('Theo ngày');
    expect(queryByText('12/08/2026')).toBeNull();
  });
});
