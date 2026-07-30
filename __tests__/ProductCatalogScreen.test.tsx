// __tests__/ProductCatalogScreen.test.tsx
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ProductCatalogScreen } from '../src/screens/ProductCatalogScreen';
import {
  deleteProductFromDB,
  deleteProductsFromDB,
  getProductsFromDB,
} from '../src/services/db';

jest.mock('../src/services/db');
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockReturnValue(sample as never);
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

  it('selects all filtered products then deletes them', () => {
    confirmDeleteAlert();
    const { getByTestId } = render(<ProductCatalogScreen />);

    fireEvent.press(getByTestId('select-mode-toggle'));
    fireEvent.press(getByTestId('select-all-button'));
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
