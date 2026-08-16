import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { parseVoiceTranscript } from '../src/services/aiParser';
import { localFastParse } from '../src/services/localInvoiceParser';
import { getGeminiApiKey } from '../src/services/geminiSettingsService';

jest.mock('../src/services/geminiSettingsService');
jest.mock('../src/services/aiParser');
jest.mock('../src/services/localInvoiceParser');
jest.mock('../src/services/db', () => ({
  getProductsFromDB: jest.fn(() => []),
  saveInvoiceToDB: jest.fn(),
  calculateInvoiceTotals: () => ({
    total_quantity: 0,
    subtotal_amount: 0,
    discount_amount: 0,
    final_amount: 0,
    paid_amount: 0,
    change_amount: 0,
  }),
}));
jest.mock('../src/components/DraftInvoiceModal', () => ({
  DraftInvoiceModal: () => null,
}));

const mockStart = jest.fn<Promise<void>, []>();
const mockStop = jest.fn<void, []>();
const mockAbort = jest.fn<void, []>();
let mockHandlers: {
  onFinalTranscript: (alternatives: string[]) => void;
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
const mockedFastParse = localFastParse as jest.MockedFunction<typeof localFastParse>;

describe('HomeScreen Gemini configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFastParse.mockReturnValue(null);
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
      mockHandlers.onFinalTranscript(['bán một ký gạo ST']);
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

  it('prefers the local fast-path and skips Gemini when parsing is certain', async () => {
    mockedGetKey.mockResolvedValue('stored-test-key');
    mockedFastParse.mockReturnValue({
      matched_items: [
        {
          product_id: 1,
          product_name: 'Gạo ST25',
          quantity: 2,
          unit: 'kg',
          confidence: 0.97,
        },
      ],
      unmatched_text: [],
    });

    const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);
    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    await act(async () => {
      mockHandlers.onFinalTranscript(['2 cân gạo st']);
    });

    expect(mockedFastParse).toHaveBeenCalledWith(['2 cân gạo st'], []);
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('shows a warning toast and does not open the draft when no product matches', async () => {
    mockedGetKey.mockResolvedValue('stored-test-key');
    mockedFastParse.mockReturnValue(null);
    mockedParse.mockResolvedValue({ matched_items: [], unmatched_text: [] });

    const { getByTestId, getByText } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );
    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    await act(async () => {
      mockHandlers.onFinalTranscript(['xyz lạ hoắc']);
    });

    await waitFor(() =>
      expect(
        getByText('Không nhận diện được sản phẩm nào. Vui lòng nói lại.')
      ).toBeTruthy()
    );
  });

  it('keeps the microphone pulse animation centered in a shared stage', () => {
    const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);

    const stage = getByTestId('voice-microphone-stage');
    const outerRing = getByTestId('voice-pulse-ring-outer');
    const middleRing = getByTestId('voice-pulse-ring-middle');

    expect(StyleSheet.flatten(stage.props.style)).toMatchObject({
      width: 256,
      height: 256,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(StyleSheet.flatten(outerRing.props.style)).toMatchObject({
      top: 0,
      left: 0,
    });
    expect(StyleSheet.flatten(middleRing.props.style)).toMatchObject({
      top: 36,
      left: 36,
    });
  });

  it('renders the tablet split layout with the invoice panel at >=1024px', () => {
    const rn = require('react-native');
    const spy = jest
      .spyOn(rn, 'useWindowDimensions')
      .mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

    const { getByTestId, queryByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);

    expect(getByTestId('home-tablet-layout')).toBeTruthy();
    expect(getByTestId('tablet-invoice-panel')).toBeTruthy();
    // Layout mobile (scroll body) không render ở tablet.
    expect(queryByTestId('home-scroll-body')).toBeNull();

    spy.mockRestore();
  });

  it('uses compact vertical spacing so suggestions fit before scrolling is needed', () => {
    const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);

    expect(StyleSheet.flatten(getByTestId('home-scroll-body').props.contentContainerStyle)).toMatchObject({
      paddingTop: 48,
      flexGrow: 1,
    });
    expect(StyleSheet.flatten(getByTestId('voice-transcript-card').props.style)).toMatchObject({
      minHeight: 188,
      marginBottom: 28,
    });
  });
});
