import XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Invoice } from '../types';

export const formatInvoiceRowsForExcel = (invoices: Invoice[]) => {
  const rows: any[] = [];

  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      rows.push({
        'Mã Hóa Đơn': inv.invoice_code,
        'Ngày Tạo': inv.created_at || '',
        'Khách Hàng': inv.customer_name || 'Khách lẻ',
        'Tên Sản Phẩm': item.product_name,
        'Số Lượng': item.quantity,
        'Đơn Vị': item.unit,
        'Đơn Giá (VNĐ)': item.unit_price,
        'Thành Tiền (VNĐ)': item.amount,
        'Chiết Khấu (VNĐ)': inv.discount_amount,
        'Tổng Hóa Đơn (VNĐ)': inv.final_amount,
      });
    });
  });

  return rows;
};

export const generateExcelReport = async (invoices: Invoice[], periodName: string): Promise<string> => {
  const rows = formatInvoiceRowsForExcel(invoices);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo Cáo Bán Hàng');

  const base64Buffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const filename = `VoiceBill_BaoCao_${periodName}_${Date.now()}.xlsx`;
  const uri = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, base64Buffer, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Xuất Báo Cáo Excel - ${periodName}`,
      UTI: 'com.microsoft.excel.xlsx',
    });
  }

  return uri;
};
