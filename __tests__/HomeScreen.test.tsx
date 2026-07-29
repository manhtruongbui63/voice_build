import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { parseVoiceTranscript } from '../src/services/aiParser';
import { getGeminiApiKey } from '../src/services/geminiSettingsService';

jest.mock('../src/services/geminiSettingsService');
jest.mock('../src/services/aiParser');
jest.mock('../src/services/db', () => ({
  getProductsFromDB: jest.fn(() => []),
}));
jest.mock('../src/components/DraftInvoiceModal', () => ({
  DraftInvoiceModal: () => null,
}));

const mockedGetKey = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedParse = parseVoiceTranscript as jest.MockedFunction<typeof parseVoiceTranscript>;

describe('HomeScreen Gemini configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not start parsing without a stored key and can open Settings', async () => {
    jest.useFakeTimers();
    mockedGetKey.mockResolvedValue(null);
    const onOpenSettings = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Mở Cài đặt')?.onPress?.();
    });

    const { getByTestId } = render(
      <HomeScreen onOpenSettings={onOpenSettings} />
    );
    fireEvent.press(getByTestId('voice-microphone-button'));

    await waitFor(() => expect(onOpenSettings).toHaveBeenCalledTimes(1));
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('passes the stored key to the parser only after the recording delay', async () => {
    jest.useFakeTimers();
    mockedGetKey.mockResolvedValue('stored-test-key');
    mockedParse.mockResolvedValue({ matched_items: [], unmatched_text: [] });

    const { getByTestId } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });

    expect(mockedGetKey).toHaveBeenCalledTimes(1);
    expect(mockedParse).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2499);
    });
    expect(mockedParse).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() =>
      expect(mockedParse).toHaveBeenCalledWith(
        'bán cho chị 1kg ST, à không lấy 2kg ST với 2 cân rưỡi Bắc Hướng',
        [],
        'stored-test-key'
      )
    );
  });

  it('does not display arbitrary parser errors', async () => {
    jest.useFakeTimers();
    mockedGetKey.mockResolvedValue('stored-test-key');
    mockedParse.mockRejectedValue(
      new Error('SENTINEL_SECRET_PARSER_ERROR_MUST_NOT_RENDER')
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Lỗi phân tích AI',
        'Không thể xử lý yêu cầu Gemini'
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('SENTINEL_SECRET')
    );
  });

  it('coalesces rapid presses while the stored-key read is pending', async () => {
    jest.useFakeTimers();
    let resolveKey: ((value: string | null) => void) | undefined;
    const pendingKey = new Promise<string | null>((resolve) => {
      resolveKey = resolve;
    });
    mockedGetKey.mockImplementation(() => pendingKey);
    mockedParse.mockResolvedValue({ matched_items: [], unmatched_text: [] });

    const { getByTestId } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );
    const microphoneButton = getByTestId('voice-microphone-button');

    fireEvent.press(microphoneButton);
    fireEvent.press(microphoneButton);

    expect(mockedGetKey).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveKey?.('stored-test-key');
    });
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    await waitFor(() => expect(mockedParse).toHaveBeenCalledTimes(1));
  });

  it('cancels the recording timer when Home unmounts', async () => {
    jest.useFakeTimers();
    mockedGetKey.mockResolvedValue('stored-test-key');
    mockedParse.mockResolvedValue({ matched_items: [], unmatched_text: [] });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId, unmount } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    unmount();
    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(mockedParse).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the stored-key read resolves after Home unmounts', async () => {
    jest.useFakeTimers();
    let resolveKey: ((value: string | null) => void) | undefined;
    mockedGetKey.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveKey = resolve;
        })
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId, unmount } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );

    fireEvent.press(getByTestId('voice-microphone-button'));
    unmount();
    await act(async () => {
      resolveKey?.('stored-test-key');
    });
    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(mockedParse).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
