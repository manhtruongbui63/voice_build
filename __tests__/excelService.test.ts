jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));

import { formatInvoiceRowsForExcel } from '../src/services/excelService';
import { Invoice } from '../src/types';

describe('Excel Formatting Service', () => {
  it('formats invoice list into spreadsheet row objects correctly', () => {
    const mockInvoices: Invoice[] = [
      {
        id: 1,
        invoice_code: 'HD-20260729-001',
        customer_name: 'Chị Hoa',
        total_quantity: 3,
        subtotal_amount: 77000,
        discount_amount: 2000,
        final_amount: 75000,
        created_at: '2026-07-29 10:00:00',
        items: [
          { product_id: 1, product_name: 'Gạo ST25', quantity: 1, unit: 'kg', unit_price: 33000, amount: 33000 },
          { product_id: 2, product_name: 'Gạo Tám Thái', quantity: 2, unit: 'kg', unit_price: 22000, amount: 44000 },
        ],
      },
    ];

    const rows = formatInvoiceRowsForExcel(mockInvoices);
    expect(rows.length).toBe(2);
    expect(rows[0]['Mã Hóa Đơn']).toBe('HD-20260729-001');
    expect(rows[0]['Tên Sản Phẩm']).toBe('Gạo ST25');
    expect(rows[0]['Thành Tiền (VNĐ)']).toBe(33000);
  });
});
