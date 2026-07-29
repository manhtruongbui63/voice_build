import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
} from '../src/services/geminiSettingsService';

jest.mock('../src/services/geminiSettingsService');

const mockedGet = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedSave = saveGeminiApiKey as jest.MockedFunction<typeof saveGeminiApiKey>;
const mockedDelete = deleteGeminiApiKey as jest.MockedFunction<typeof deleteGeminiApiKey>;
const mockedValidate = validateGeminiApiKey as jest.MockedFunction<typeof validateGeminiApiKey>;

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

  it('validates before saving the trimmed key', async () => {
    const { getByTestId, getByText } = render(<SettingsScreen />);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), '  test-key  ');
    fireEvent.press(getByText('Kiểm tra & Lưu'));

    await waitFor(() => expect(mockedValidate).toHaveBeenCalledWith('test-key'));
    await waitFor(() => expect(mockedSave).toHaveBeenCalledWith('test-key'));
    expect(getByText('Đã kết nối')).toBeTruthy();
  });

  it('does not overwrite the stored key when validation fails', async () => {
    mockedValidate.mockRejectedValue(new Error('API Key không hợp lệ hoặc đã bị thu hồi'));
    const { getByTestId, getByText } = render(<SettingsScreen />);

    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'bad-key');
    fireEvent.press(getByText('Kiểm tra & Lưu'));

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
    fireEvent.press(getByText('Kiểm tra & Lưu'));
    await waitFor(() => expect(getByText('Đã kết nối')).toBeTruthy());

    await act(async () => {
      resolveInitialLoad?.(null);
    });

    expect(getByText('Xóa API Key')).toBeTruthy();
  });
});
