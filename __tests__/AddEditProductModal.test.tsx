import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  AddEditProductModal,
  getProductDrawerClosedOffset,
  getProductDrawerDragOffset,
  getProductDrawerDragHeight,
  getProductDrawerGestureAction,
  getProductDrawerInitialOffset,
  getProductDrawerMaxHeight,
  getUnitDropdownPlacement,
} from '../src/components/AddEditProductModal';
import { colors, fontFamily } from '../src/theme/tokens';

const product = {
  id: 1,
  name: 'Cà phê đen',
  aliases: 'den, cp den',
  unit: 'Ly',
  unit_price: 25000,
};

describe('AddEditProductModal product form design', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the create product bottom sheet from the Stitch design', () => {
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <AddEditProductModal visible product={null} onClose={jest.fn()} onSave={jest.fn()} />
    );

    expect(StyleSheet.flatten(getByTestId('product-form-backdrop-dim').props.style)).toMatchObject({
      backgroundColor: 'rgba(0, 30, 47, 0.4)',
    });
    expect(StyleSheet.flatten(getByTestId('product-form-sheet').props.style)).toMatchObject({
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      backgroundColor: '#F6FAFF',
    });
    expect(getByText('Thêm sản phẩm mới')).toBeTruthy();
    expect(getByPlaceholderText('VD: Gạo ST25')).toBeTruthy();
    // Mặc định bật AI khi tạo mới: input alias bị khóa và hiện placeholder AI.
    expect(getByPlaceholderText('AI sẽ tự tạo tên gọi tắt từ tên sản phẩm')).toBeTruthy();
    expect(getByTestId('product-alias-input').props.editable).toBe(false);
    expect(getByText('kg')).toBeTruthy();
    expect(getByPlaceholderText('0')).toBeTruthy();
    expect(getByText('đ')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('product-save-button').props.style)).toMatchObject({
      backgroundColor: colors.primary,
      borderRadius: 12,
    });
    expect(getByText('Tạo sản phẩm')).toBeTruthy();
    expect(queryByText('Xóa')).toBeNull();
  });

  it('renders the edit product bottom sheet with delete and save-change actions', () => {
    const onDelete = jest.fn();
    const { getByDisplayValue, getByTestId, getByText } = render(
      <AddEditProductModal visible product={product} onClose={jest.fn()} onSave={jest.fn()} onDelete={onDelete} />
    );

    expect(getByText('Sửa sản phẩm')).toBeTruthy();
    expect(getByDisplayValue('Cà phê đen')).toBeTruthy();
    expect(getByDisplayValue('den, cp den')).toBeTruthy();
    expect(getByDisplayValue('25000')).toBeTruthy();
    expect(getByText('Ly')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('product-form-action-bar').props.style)).toMatchObject({
      backgroundColor: colors.white,
    });
    expect(StyleSheet.flatten(getByTestId('product-delete-button').props.style)).toMatchObject({
      backgroundColor: colors.errorCrimson,
    });
    expect(StyleSheet.flatten(getByTestId('product-delete-label').props.style)).toMatchObject({
      color: colors.white,
      fontFamily: fontFamily.interSemiBold,
      fontSize: 16,
    });
    expect(StyleSheet.flatten(getByTestId('product-save-label').props.style)).toMatchObject({
      fontFamily: fontFamily.interSemiBold,
      fontSize: 16,
    });
    expect(StyleSheet.flatten(getByTestId('product-delete-icon').props.style)).toMatchObject({
      fontSize: 16,
    });
    expect(StyleSheet.flatten(getByTestId('product-save-icon').props.style)).toMatchObject({
      fontSize: 16,
    });
    expect(getByTestId('product-delete-icon')).toBeTruthy();
    expect(getByTestId('product-save-icon')).toBeTruthy();
    expect(getByTestId('product-form-close-button')).toBeTruthy();

    fireEvent.press(getByTestId('product-delete-button'));

    expect(onDelete).toHaveBeenCalledWith(product);
    expect(getByText('Lưu thay đổi')).toBeTruthy();
  });

  it('maps drawer drag gestures to expand and close actions', () => {
    expect(getProductDrawerGestureAction({ dy: -56, vy: -0.1 })).toBe('expand');
    expect(getProductDrawerGestureAction({ dy: 72, vy: 0.1 })).toBe('close');
    expect(getProductDrawerGestureAction({ dy: 10, vy: 0.1 })).toBe('none');
  });

  it('updates drawer height while dragging the handle', () => {
    expect(getProductDrawerDragHeight({ startHeight: 390, dy: -120, minHeight: 390, maxHeight: 780 })).toBe(510);
    expect(getProductDrawerDragHeight({ startHeight: 780, dy: 140, minHeight: 390, maxHeight: 780 })).toBe(640);
    expect(getProductDrawerDragHeight({ startHeight: 390, dy: 80, minHeight: 390, maxHeight: 780 })).toBe(390);
    expect(getProductDrawerDragHeight({ startHeight: 780, dy: -80, minHeight: 390, maxHeight: 780 })).toBe(780);
  });

  it('updates drawer translate offset while dragging the bottom sheet handle', () => {
    expect(getProductDrawerDragOffset({ startOffset: 390, dy: -120, minOffset: 0, maxOffset: 390 })).toBe(270);
    expect(getProductDrawerDragOffset({ startOffset: 0, dy: 140, minOffset: 0, maxOffset: 390 })).toBe(140);
    expect(getProductDrawerDragOffset({ startOffset: 390, dy: 80, minOffset: 0, maxOffset: 390 })).toBe(390);
    expect(getProductDrawerDragOffset({ startOffset: 0, dy: -80, minOffset: 0, maxOffset: 390 })).toBe(0);
  });

  it('keeps the fully expanded drawer below the device status/header area', () => {
    expect(getProductDrawerMaxHeight({ windowHeight: 844, topInset: 56 })).toBe(788);
    expect(getProductDrawerMaxHeight({ windowHeight: 40, topInset: 56 })).toBe(1);
  });

  it('opens the drawer at 70 percent of available height', () => {
    expect(getProductDrawerInitialOffset({ maxHeight: 800, minRatio: 0.7 })).toBe(240);
  });

  it('starts the drawer below the screen before sliding up', () => {
    expect(getProductDrawerClosedOffset({ maxHeight: 800 })).toBe(800);
  });

  it('uses a large hit area for the draggable drawer handle', () => {
    const { getByTestId } = render(
      <AddEditProductModal visible product={null} onClose={jest.fn()} onSave={jest.fn()} />
    );

    expect(StyleSheet.flatten(getByTestId('product-drawer-handle').props.style)).toMatchObject({
      minHeight: 56,
    });
  });

  it('renders unit options inside the scrollable sheet instead of behind the footer', () => {
    const { getByTestId, getByText } = render(
      <AddEditProductModal visible product={null} onClose={jest.fn()} onSave={jest.fn()} />
    );

    fireEvent.press(getByTestId('product-unit-select'));

    expect(getByText('Túi')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('product-form-scroll').props.contentContainerStyle)).toMatchObject({
      paddingBottom: 180,
    });
    expect(getByTestId('product-unit-arrow')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('product-unit-dropdown').props.style)).toMatchObject({
      position: 'absolute',
      maxHeight: 220,
    });
    expect(getByTestId('product-unit-dropdown-scroll')).toBeTruthy();
  });

  it('shows the unit select arrow on edit forms too', () => {
    const { getByTestId } = render(
      <AddEditProductModal visible product={product} onClose={jest.fn()} onSave={jest.fn()} />
    );

    expect(getByTestId('product-unit-arrow')).toBeTruthy();
  });

  it('renders price on the left and unit on the right', () => {
    const { getByTestId } = render(
      <AddEditProductModal visible product={null} onClose={jest.fn()} onSave={jest.fn()} />
    );

    const children = getByTestId('product-inline-row').props.children;
    expect(children[0].props.testID).toBe('product-price-field');
    expect(children[1].props.testID).toBe('product-unit-field');
  });

  it('places the unit dropdown above or below based on available drawer space', () => {
    expect(
      getUnitDropdownPlacement({
        selectY: 120,
        selectHeight: 56,
        sheetHeight: 620,
        actionBarHeight: 88,
        dropdownHeight: 220,
      })
    ).toBe('below');
    expect(
      getUnitDropdownPlacement({
        selectY: 310,
        selectHeight: 56,
        sheetHeight: 430,
        actionBarHeight: 96,
        dropdownHeight: 220,
      })
    ).toBe('above');
  });

  it('asks for confirmation before closing a dirty create form', () => {
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByPlaceholderText, getByTestId } = render(
      <AddEditProductModal visible product={null} onClose={onClose} onSave={jest.fn()} />
    );

    fireEvent.changeText(getByPlaceholderText('VD: Gạo ST25'), 'Gạo nếp cái hoa vàng');
    fireEvent.press(getByTestId('product-form-backdrop'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hủy tạo sản phẩm?',
      'Thông tin đã nhập sẽ không được lưu.',
      expect.any(Array)
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('toggles the AI alias checkbox to enable manual alias input', () => {
    const { getByTestId, getByPlaceholderText } = render(
      <AddEditProductModal visible product={null} onClose={jest.fn()} onSave={jest.fn()} />
    );

    // Mặc định: AI bật -> input khóa.
    expect(getByTestId('product-alias-input').props.editable).toBe(false);
    expect(getByTestId('product-alias-ai-hint')).toBeTruthy();

    // Bỏ tick AI -> cho nhập tay, placeholder gạo, không còn ghi chú AI.
    fireEvent.press(getByTestId('product-alias-ai-toggle'));
    expect(getByTestId('product-alias-input').props.editable).toBe(true);
    expect(getByPlaceholderText('VD: st25, gao thom, gao deo')).toBeTruthy();
  });

  it('defaults edit forms to manual alias so existing aliases stay editable', () => {
    const { getByTestId, getByDisplayValue } = render(
      <AddEditProductModal visible product={product} onClose={jest.fn()} onSave={jest.fn()} />
    );

    expect(getByTestId('product-alias-input').props.editable).toBe(true);
    expect(getByDisplayValue('den, cp den')).toBeTruthy();
  });

  it('sends the AI flag through onSave when creating with AI enabled', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, getByPlaceholderText, findByText } = render(
      <AddEditProductModal visible product={null} onClose={jest.fn()} onSave={onSave} />
    );

    fireEvent.changeText(getByPlaceholderText('VD: Gạo ST25'), 'Gạo ST25');
    fireEvent.changeText(getByPlaceholderText('0'), '18000');
    fireEvent.press(getByTestId('product-save-button'));

    // Alias để trống + cờ AI = true (backend sẽ tự sinh).
    await findByText('Tạo sản phẩm thành công!');
    expect(onSave).toHaveBeenCalledWith('Gạo ST25', '', 'kg', 18000, true);
  });
});
