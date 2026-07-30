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

const mockStart = jest.fn<Promise<void>, []>();
const mockStop = jest.fn<void, []>();
const mockAbort = jest.fn<void, []>();
let mockHandlers: {
  onFinalTranscript: (transcript: string) => void;
  onError: (code: string) => void;
};

jest.mock('../src/hooks/useVoiceInvoiceRecognition', () => ({
  useVoiceInvoiceRecognition: (handlers: typeof mockHandlers) => {
    mockHandlers = handlers;
    return {
      status: 'idle',
      interimTranscript: '',
      start: mockStart,
      stop: mockStop,
      abort: mockAbort,
    };
  },
}));

const mockedGetKey = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedParse = parseVoiceTranscript as jest.MockedFunction<typeof parseVoiceTranscript>;

describe('HomeScreen Gemini configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not start parsing without a stored key and can open Settings', async () => {
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
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('does not display arbitrary parser errors', async () => {
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
      mockHandlers.onFinalTranscript('bán một ký gạo ST');
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

    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  });

  it('cancels the recognition if Home unmounts during key lookup', async () => {
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

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockedParse).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

