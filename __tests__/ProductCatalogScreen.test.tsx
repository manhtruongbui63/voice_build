// __tests__/ProductCatalogScreen.test.tsx
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { ProductCatalogScreen } from '../src/screens/ProductCatalogScreen';
import {
  deleteProductFromDB,
  deleteProductsFromDB,
  getProductsFromDB,
  importProductsFromDB,
} from '../src/services/db';
import { parseProductCsvForPreview } from '../src/services/productCsvImportService';
import { colors } from '../src/theme/tokens';

jest.mock('../src/services/db');
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: jest.fn(),
}));
jest.mock('../src/services/productCsvImportService', () => ({
  parseProductCsvForPreview: jest.fn(),
}));
jest.mock('../src/components/AddEditProductModal', () => ({
  AddEditProductModal: () => null,
}));

const sample = [
  { id: 1, name: 'Gạo A', aliases: '', unit: 'kg', unit_price: 1000 },
  { id: 2, name: 'Gạo B', aliases: '', unit: 'kg', unit_price: 2000 },
  { id: 3, name: 'Gạo C', aliases: '', unit: 'kg', unit_price: 3000 },
];

const mockedGet = getProductsFromDB as jest.MockedFunction<typeof getProductsFromDB>;
const mockedDeleteOne = deleteProductFromDB as jest.MockedFunction<typeof deleteProductFromDB>;
const mockedDeleteMany = deleteProductsFromDB as jest.MockedFunction<typeof deleteProductsFromDB>;
const mockedImportProducts = importProductsFromDB as jest.MockedFunction<typeof importProductsFromDB>;
const mockedPickDocument = DocumentPicker.getDocumentAsync as jest.MockedFunction<typeof DocumentPicker.getDocumentAsync>;
const mockedReadFile = FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>;
const mockedParseCsv = parseProductCsvForPreview as jest.MockedFunction<typeof parseProductCsvForPreview>;

const designSample = [
  { id: 11, name: 'Cà phê sữa đá', aliases: 'cf sữa, nâu đá', unit: 'ly', unit_price: 25000 },
  { id: 12, name: 'Bạc xỉu', aliases: 'bx', unit: 'ly', unit_price: 29000 },
  { id: 13, name: 'Trà đào cam sả', aliases: 'trà đào, đào cam sả', unit: 'ly', unit_price: 45000 },
  { id: 14, name: 'Trà Oolong vải', aliases: 'ô long vải, trà vải', unit: 'ly', unit_price: 45000 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockReturnValue(sample as never);
  mockedImportProducts.mockReturnValue({ created: 0, updated: 0 });
  mockedPickDocument.mockResolvedValue({ canceled: true, assets: null } as never);
  mockedReadFile.mockResolvedValue('');
  mockedParseCsv.mockReturnValue({
    totalRows: 0,
    createRows: [],
    updateRows: [],
    errors: [],
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ProductCatalogScreen delete safety net', () => {
  it('shows an error alert instead of crashing when single delete throws', () => {
    mockedDeleteOne.mockImplementation(() => {
      throw new Error('FOREIGN KEY constraint failed');
    });
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementationOnce((_t, _m, buttons) => {
        buttons?.find((b) => b.text === 'Xóa')?.onPress?.();
      });

    const { getByTestId } = render(<ProductCatalogScreen />);
    fireEvent.press(getByTestId('delete-button-1'));

    expect(mockedDeleteOne).toHaveBeenCalledWith(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Lỗi',
      'Không thể xóa sản phẩm. Vui lòng thử lại.'
    );
  });
});

describe('ProductCatalogScreen Stitch product list design', () => {
  it('renders the product list state with the new search, chip, card, alias, and FAB layout', () => {
    mockedGet.mockReturnValue(designSample as never);

    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(<ProductCatalogScreen />);

    expect(getByPlaceholderText('Tìm tên hoặc mã rút gọn (alias)...')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('product-search-box').props.style)).toMatchObject({
      backgroundColor: '#EBF5FF',
      borderRadius: 12,
    });
    expect(StyleSheet.flatten(getByTestId('product-card-11').props.style)).toMatchObject({
      borderRadius: 12,
      backgroundColor: colors.white,
    });
    expect(getByText('Cà phê sữa đá')).toBeTruthy();
    expect(getByText('25.000đ')).toBeTruthy();
    expect(getByText('cf sữa')).toBeTruthy();
    expect(getByText('nâu đá')).toBeTruthy();
    expect(getByTestId('product-more-button-11')).toBeTruthy();
    expect(getByTestId('product-add-button')).toBeTruthy();
    expect(getByTestId('product-import-button')).toBeTruthy();
    expect(queryByText('Đã hiển thị hết sản phẩm')).toBeNull();
  });

  it('renders the new inventory empty state when there are no products', () => {
    mockedGet.mockReturnValue([] as never);

    const { getByText, getByTestId } = render(<ProductCatalogScreen />);

    expect(getByText('Chưa có sản phẩm nào')).toBeTruthy();
    expect(getByText('Kho hàng của bạn đang trống. Hãy thêm sản phẩm đầu tiên để bắt đầu tạo hóa đơn nhanh chóng.')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('product-empty-card').props.style)).toMatchObject({
      borderRadius: 16,
      backgroundColor: colors.white,
    });
  });
});

describe('ProductCatalogScreen tablet master-detail', () => {
  const asTablet = () =>
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

  it('renders the list + inline form panel and auto-selects the first product', () => {
    asTablet();
    mockedGet.mockReturnValue(designSample as never);

    const { getByText, getByTestId } = render(<ProductCatalogScreen />);

    expect(getByText('Sản phẩm')).toBeTruthy();
    expect(getByTestId('product-add-button')).toBeTruthy();
    // list items
    expect(getByTestId('product-card-11')).toBeTruthy();
    // right panel shows the auto-selected first product (edit mode)
    expect(getByTestId('product-form-panel')).toBeTruthy();
  });

  it('switches the panel into add mode when pressing the add button', () => {
    asTablet();
    mockedGet.mockReturnValue(designSample as never);

    const { getByTestId } = render(<ProductCatalogScreen />);
    fireEvent.press(getByTestId('product-add-button'));

    // add mode keeps the form panel but shows the upload placeholder
    expect(getByTestId('product-image-upload')).toBeTruthy();
  });

  it('locks the detail panel by default and unlocks it after pressing "Cập nhật"', () => {
    asTablet();
    mockedGet.mockReturnValue(designSample as never);

    const { getByTestId, queryByTestId } = render(<ProductCatalogScreen />);

    // Selected product renders read-only: name not editable, no save button yet.
    expect(getByTestId('product-form-name').props.editable).toBe(false);
    expect(queryByTestId('product-form-save')).toBeNull();
    expect(getByTestId('product-form-edit')).toBeTruthy();

    // Press "Cập nhật" -> fields become editable, save button appears.
    fireEvent.press(getByTestId('product-form-edit'));
    expect(getByTestId('product-form-name').props.editable).toBe(true);
    expect(getByTestId('product-form-save')).toBeTruthy();
    expect(queryByTestId('product-form-edit')).toBeNull();
  });

  it('exposes the CSV import button and opens the preview modal', async () => {
    asTablet();
    mockedGet.mockReturnValue(designSample as never);
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://products.csv', name: 'products.csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('name,price\nGạo D,4000');
    mockedParseCsv.mockReturnValue({
      totalRows: 1,
      createRows: [{ name: 'Gạo D', aliases: '', unit: 'kg', unit_price: 4000 }],
      updateRows: [],
      errors: [],
    } as never);

    const { getByTestId, findByTestId } = render(<ProductCatalogScreen />);
    fireEvent.press(getByTestId('product-import-button'));

    expect(await findByTestId('product-import-preview-modal')).toBeTruthy();
  });

  it('enters multi-select mode and bulk-deletes the checked products', () => {
    asTablet();
    mockedGet.mockReturnValue(designSample as never);
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) => {
        buttons?.find((b) => b.text === 'Xóa')?.onPress?.();
      });

    const { getByTestId } = render(<ProductCatalogScreen />);
    // enter selection mode
    fireEvent.press(getByTestId('select-mode-toggle'));
    // check two products
    fireEvent.press(getByTestId('product-card-11'));
    fireEvent.press(getByTestId('product-card-12'));
    // bulk delete
    fireEvent.press(getByTestId('tablet-bulk-delete'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockedDeleteMany).toHaveBeenCalledWith([11, 12]);
  });
});

describe('ProductCatalogScreen multi-select delete', () => {
  const confirmDeleteAlert = () =>
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Xóa')?.onPress?.();
    });

  it('bulk-deletes the selected products', () => {
    confirmDeleteAlert();
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('product-card-1'));
    fireEvent.press(getByTestId('product-card-3'));
    fireEvent.press(getByTestId('bulk-delete-button'));

    expect(mockedDeleteMany).toHaveBeenCalledWith([1, 3]);
  });

  it('selects several products individually then deletes them', () => {
    confirmDeleteAlert();
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('product-card-1'));
    fireEvent.press(getByTestId('product-card-2'));
    fireEvent.press(getByTestId('product-card-3'));
    fireEvent.press(getByTestId('bulk-delete-button'));

    expect(mockedDeleteMany).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('does nothing when bulk delete is pressed with no selection', () => {
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('bulk-delete-button'));

    expect(mockedDeleteMany).not.toHaveBeenCalled();
  });
});

describe('ProductCatalogScreen CSV import', () => {
  it('opens a CSV file and renders the import preview summary', async () => {
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/products.csv', name: 'products.csv', mimeType: 'text/csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('name,aliases,unit,unit_price\nTrà đào,td,ly,45000');
    mockedParseCsv.mockReturnValue({
      totalRows: 2,
      createRows: [
        { line: 2, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 45000, mode: 'create' },
      ],
      updateRows: [
        { line: 3, id: 1, name: 'Cà phê sữa đá', aliases: 'cfsd', unit: 'ly', unit_price: 25000, mode: 'update' },
      ],
      errors: [{ line: 4, message: 'Thiếu tên sản phẩm' }],
    });

    const { findByTestId, getByTestId, getByText } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));

    expect(await findByTestId('product-import-preview-modal')).toBeTruthy();
    expect(mockedPickDocument).toHaveBeenCalledWith({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
      copyToCacheDirectory: true,
    });
    expect(mockedReadFile).toHaveBeenCalledWith('file:///tmp/products.csv', { encoding: FileSystem.EncodingType.UTF8 });
    expect(mockedParseCsv).toHaveBeenCalledWith(
      'name,aliases,unit,unit_price\nTrà đào,td,ly,45000',
      sample
    );
    expect(getByText('Import sản phẩm từ CSV')).toBeTruthy();
    expect(getByText('Tổng dòng: 2')).toBeTruthy();
    expect(getByText('Tạo mới: 1')).toBeTruthy();
    expect(getByText('Cập nhật: 1')).toBeTruthy();
    expect(getByText('Lỗi: 1')).toBeTruthy();
    expect(getByText('Dòng 4: Thiếu tên sản phẩm')).toBeTruthy();
  });

  it('imports valid preview rows, reloads products, and shows the result alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/products.csv', name: 'products.csv', mimeType: 'text/csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('name,aliases,unit,unit_price\nTrà đào,td,ly,45000');
    mockedParseCsv.mockReturnValue({
      totalRows: 1,
      createRows: [
        { line: 2, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 45000, mode: 'create' },
      ],
      updateRows: [],
      errors: [],
    });
    mockedImportProducts.mockReturnValue({ created: 1, updated: 0 });

    const { findByTestId, getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));
    await findByTestId('product-import-preview-modal');
    fireEvent.press(getByTestId('product-import-confirm-button'));

    expect(mockedImportProducts).toHaveBeenCalledWith([
      { line: 2, name: 'Trà đào', aliases: 'td', unit: 'ly', unit_price: 45000, mode: 'create' },
    ]);
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenCalledWith('Import thành công', 'Đã tạo mới 1 sản phẩm và cập nhật 0 sản phẩm.');
  });

  it('disables confirm when the preview has no valid rows', async () => {
    mockedPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/products.csv', name: 'products.csv', mimeType: 'text/csv' }],
    } as never);
    mockedReadFile.mockResolvedValue('bad,header\nA,1000');
    mockedParseCsv.mockReturnValue({
      totalRows: 1,
      createRows: [],
      updateRows: [],
      errors: [{ line: 1, message: 'Header CSV không hợp lệ. Cần name, aliases, unit, unit_price hoặc Tên sản phẩm, Alias, Đơn vị, Giá bán' }],
    });

    const { findByTestId, getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));
    await findByTestId('product-import-preview-modal');

    expect(getByTestId('product-import-confirm-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('does not show an error when the file picker is cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedPickDocument.mockResolvedValue({ canceled: true, assets: null } as never);

    const { getByTestId, queryByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('product-import-button'));

    expect(queryByTestId('product-import-preview-modal')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
