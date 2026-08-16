import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
  setDefaultPaymentMethod,
} from '../src/services/geminiSettingsService';
import {
  saveStoreProfile,
  saveCurrencyFormat,
} from '../src/services/storeSettingsService';
import { clearAllInvoicesFromDB } from '../src/services/db';

jest.mock('../src/services/db', () => ({
  clearAllInvoicesFromDB: jest.fn(),
}));
jest.mock('../src/services/geminiSettingsService');
jest.mock('../src/services/storeSettingsService', () => ({
  getStoreProfile: jest.fn().mockResolvedValue({ name: '', phone: '', address: '' }),
  saveStoreProfile: jest.fn().mockResolvedValue(undefined),
  getCurrencyFormat: jest.fn().mockResolvedValue('symbol'),
  saveCurrencyFormat: jest.fn().mockResolvedValue(undefined),
  formatCurrencyPreview: (value: number, format: string) =>
    format === 'code' ? `${value} VND` : `${value} đ`,
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

const mockedGet = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedSave = saveGeminiApiKey as jest.MockedFunction<typeof saveGeminiApiKey>;
const mockedDelete = deleteGeminiApiKey as jest.MockedFunction<typeof deleteGeminiApiKey>;
const mockedValidate = validateGeminiApiKey as jest.MockedFunction<typeof validateGeminiApiKey>;
const mockedClearInvoices = clearAllInvoicesFromDB as jest.MockedFunction<typeof clearAllInvoicesFromDB>;

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedGet.mockResolvedValue(null);
    mockedValidate.mockResolvedValue();
    mockedSave.mockResolvedValue();
    mockedDelete.mockResolvedValue();
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the API key input masked', () => {
    const { getByTestId } = render(<SettingsScreen />);

    expect(getByTestId('gemini-api-key-input').props.secureTextEntry).toBe(true);
  });

  it('renders the two-column tablet layout at >=1024px', async () => {
    const rn = require('react-native');
    const spy = jest
      .spyOn(rn, 'useWindowDimensions')
      .mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

    const { getByText, getByTestId } = render(<SettingsScreen />);
    await act(async () => {});

    expect(getByText('Cài đặt hệ thống')).toBeTruthy();
    expect(getByTestId('store-name-input')).toBeTruthy();
    expect(getByTestId('gemini-test-connection')).toBeTruthy();
    expect(getByTestId('settings-save-button')).toBeTruthy();
    expect(getByText('Dấu chấm (1.000)')).toBeTruthy();

    spy.mockRestore();
  });

  it('validates before saving the trimmed key', async () => {
    let resolveValidation: (() => void) | undefined;
    mockedValidate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveValidation = resolve;
        })
    );
    const { getByTestId, getByText } = render(<SettingsScreen />);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), '  test-key  ');
    fireEvent.press(getByText('Kiểm tra kết nối'));

    await waitFor(() => expect(mockedValidate).toHaveBeenCalledWith('test-key'));
    expect(mockedSave).not.toHaveBeenCalled();
    await act(async () => {
      resolveValidation?.();
    });
    await waitFor(() => expect(mockedSave).toHaveBeenCalledWith('test-key'));
    expect(getByText('Đã kết nối')).toBeTruthy();
  });

  it('does not overwrite the stored key when validation fails', async () => {
    mockedValidate.mockRejectedValue(new Error('API Key không hợp lệ hoặc đã bị thu hồi'));
    const { getByTestId, getByText } = render(<SettingsScreen />);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'bad-key');
    fireEvent.press(getByText('Kiểm tra kết nối'));

    await waitFor(() =>
      expect(getByText('API Key không hợp lệ hoặc đã bị thu hồi')).toBeTruthy()
    );
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('deletes the key after confirmation', async () => {
    mockedGet.mockResolvedValue('stored-key');
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa')?.onPress?.();
    });
    const { getByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText('Xóa API Key')).toBeTruthy());
    fireEvent.press(getByText('Xóa API Key'));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalled());
    expect(getByText('Đã xóa API Key')).toBeTruthy();
  });

  it('does not allow deletion while saving is pending', async () => {
    mockedGet.mockResolvedValue('stored-key');
    let resolveSave: (() => void) | undefined;
    mockedSave.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    let confirmPreviouslyOpenedDelete: (() => void) | undefined;
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const destructiveButton = buttons?.find((button) => button.text === 'Xóa');
        confirmPreviouslyOpenedDelete = () => destructiveButton?.onPress?.();
      });
    const { getByTestId, getByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText('Xóa API Key')).toBeTruthy());
    fireEvent.press(getByText('Xóa API Key'));
    expect(alertSpy).toHaveBeenCalledTimes(1);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'replacement-test-key');
    fireEvent.press(getByText('Kiểm tra kết nối'));
    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith('replacement-test-key')
    );

    fireEvent.press(getByText('Xóa API Key'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    await act(async () => {
      confirmPreviouslyOpenedDelete?.();
    });
    expect(mockedDelete).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.();
    });
    await waitFor(() => expect(getByText('Đã kết nối')).toBeTruthy());
  });

  it('blocks saving while deletion is pending and releases the lock afterward', async () => {
    mockedGet.mockResolvedValue('stored-key');
    let resolveDelete: (() => void) | undefined;
    mockedDelete.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa')?.onPress?.();
    });
    const { getByTestId, getByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText('Xóa API Key')).toBeTruthy());
    fireEvent.press(getByText('Xóa API Key'));
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledTimes(1));

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'blocked-test-key');
    fireEvent.press(getByText('Kiểm tra kết nối'));
    expect(mockedValidate).not.toHaveBeenCalled();
    expect(mockedSave).not.toHaveBeenCalled();

    await act(async () => {
      resolveDelete?.();
    });
    await waitFor(() => expect(getByText('Đã xóa API Key')).toBeTruthy());

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'allowed-test-key');
    fireEvent.press(getByText('Kiểm tra kết nối'));
    await waitFor(() => expect(mockedValidate).toHaveBeenCalledWith('allowed-test-key'));
    await waitFor(() => expect(mockedSave).toHaveBeenCalledWith('allowed-test-key'));
  });

  it('does not display an arbitrary validation error', async () => {
    const sentinel = 'SENTINEL_SECRET_VALIDATION_MUST_NOT_RENDER';
    mockedValidate.mockRejectedValue(new Error(sentinel));
    const { getByTestId, getByText, queryByText } = render(<SettingsScreen />);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'invalid-test-key');
    fireEvent.press(getByText('Kiểm tra kết nối'));

    await waitFor(() =>
      expect(getByText('Không thể kiểm tra hoặc lưu API Key')).toBeTruthy()
    );
    expect(queryByText(sentinel)).toBeNull();
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('does not display an arbitrary deletion error', async () => {
    const sentinel = 'SENTINEL_SECRET_DELETE_MUST_NOT_RENDER';
    mockedGet.mockResolvedValue('stored-key');
    mockedDelete.mockRejectedValue(new Error(sentinel));
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa')?.onPress?.();
    });
    const { getByText, queryByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText('Xóa API Key')).toBeTruthy());
    fireEvent.press(getByText('Xóa API Key'));

    await waitFor(() => expect(getByText('Không thể xóa API Key')).toBeTruthy());
    expect(queryByText(sentinel)).toBeNull();
    expect(getByText('Xóa API Key')).toBeTruthy();
  });

  it('shows a safe error when loading the stored key fails', async () => {
    mockedGet.mockRejectedValue(new Error('storage unavailable'));
    const { getByText } = render(<SettingsScreen />);

    await waitFor(() => expect(getByText('Không thể tải API Key đã lưu')).toBeTruthy());
  });

  it('keeps the saved state when the initial key load resolves late', async () => {
    let resolveInitialLoad: ((value: string | null) => void) | undefined;
    mockedGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInitialLoad = resolve;
        })
    );
    const { getByTestId, getByText } = render(<SettingsScreen />);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'test-key');
    fireEvent.press(getByText('Kiểm tra kết nối'));
    await waitFor(() => expect(getByText('Đã kết nối')).toBeTruthy());

    await act(async () => {
      resolveInitialLoad?.(null);
    });

    expect(getByText('Xóa API Key')).toBeTruthy();
  });

  it('keeps the save button disabled until the store form changes', async () => {
    const mockedSaveProfile = saveStoreProfile as jest.MockedFunction<typeof saveStoreProfile>;
    const mockedSaveCurrency = saveCurrencyFormat as jest.MockedFunction<typeof saveCurrencyFormat>;
    const mockedSetPayment = setDefaultPaymentMethod as jest.MockedFunction<typeof setDefaultPaymentMethod>;
    const { getByTestId, getByText } = render(<SettingsScreen />);
    await act(async () => {});

    expect(getByTestId('settings-save-button').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(getByTestId('store-name-input'), '  Cửa hàng Gạo Sạch  ');
    expect(getByTestId('settings-save-button').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('settings-save-button'));

    await waitFor(() =>
      expect(mockedSaveProfile).toHaveBeenCalledWith({
        name: 'Cửa hàng Gạo Sạch',
        phone: '',
        address: '',
      })
    );
    expect(mockedSaveCurrency).toHaveBeenCalledWith('symbol');
    expect(mockedSetPayment).toHaveBeenCalledWith('chuyển khoản');
    expect(getByText('Đã lưu thay đổi')).toBeTruthy();
  });

  it('updates the currency preview when switching format', async () => {
    const { getByTestId } = render(<SettingsScreen />);
    await act(async () => {});

    expect(getByTestId('currency-preview').props.children).toBe('1250000 đ');
    fireEvent.press(getByTestId('currency-format-code'));
    expect(getByTestId('currency-preview').props.children).toBe('1250000 VND');
  });

  it('requires the admin password in a modal before resetting data', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<SettingsScreen />);
    await act(async () => {});

    // Bấm nút mở modal nhập mật khẩu (chưa xóa gì).
    fireEvent.press(getByTestId('settings-reset-data-button'));
    expect(getByTestId('settings-reset-modal')).toBeTruthy();
    expect(mockedClearInvoices).not.toHaveBeenCalled();

    // Mặc định ẩn mật khẩu; bấm icon eye để hiện.
    expect(getByTestId('settings-reset-password-input').props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId('settings-reset-password-eye'));
    expect(getByTestId('settings-reset-password-input').props.secureTextEntry).toBe(false);

    // Nhập đúng mật khẩu (phân biệt hoa/thường) rồi xác nhận.
    fireEvent.changeText(getByTestId('settings-reset-password-input'), 'Admin0961980030');
    fireEvent.press(getByTestId('settings-reset-confirm'));

    expect(mockedClearInvoices).toHaveBeenCalledTimes(1);
    expect(getByText('Đã xóa toàn bộ dữ liệu hóa đơn & báo cáo')).toBeTruthy();
    expect(queryByTestId('settings-reset-modal')).toBeNull();
    // Không đụng tới API key.
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('rejects a wrong password and does not reset data', async () => {
    const { getByTestId } = render(<SettingsScreen />);
    await act(async () => {});

    fireEvent.press(getByTestId('settings-reset-data-button'));
    fireEvent.changeText(getByTestId('settings-reset-password-input'), 'admin0961980030');
    fireEvent.press(getByTestId('settings-reset-confirm'));

    expect(mockedClearInvoices).not.toHaveBeenCalled();
    expect(getByTestId('settings-reset-password-error')).toBeTruthy();
    // Modal vẫn mở để nhập lại.
    expect(getByTestId('settings-reset-modal')).toBeTruthy();
  });
});
