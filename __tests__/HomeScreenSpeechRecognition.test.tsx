import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { parseVoiceTranscript } from '../src/services/aiParser';
import { localFastParse } from '../src/services/localInvoiceParser';
import { getGeminiApiKey } from '../src/services/geminiSettingsService';
import type {
  VoiceRecognitionErrorCode,
  VoiceRecognitionStatus,
} from '../src/hooks/useVoiceInvoiceRecognition';

jest.mock('../src/services/geminiSettingsService');
jest.mock('../src/services/aiParser');
jest.mock('../src/services/localInvoiceParser');
const mockProducts = [
  { id: 1, name: 'Gạo ST25', aliases: 'st25, gạo sóc trăng' },
  { id: 2, name: 'Bắc Hương', aliases: '' },
];

jest.mock('../src/services/db', () => ({
  getProductsFromDB: jest.fn(() => mockProducts),
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
let mockStatus: VoiceRecognitionStatus = 'idle';
let mockInterimTranscript = '';
let mockHandlers: {
  onFinalTranscript: (alternatives: string[]) => void;
  onError: (code: VoiceRecognitionErrorCode) => void;
  contextualStrings?: string[];
};

jest.mock('../src/hooks/useVoiceInvoiceRecognition', () => ({
  useVoiceInvoiceRecognition: (handlers: typeof mockHandlers) => {
    mockHandlers = handlers;
    return {
      status: mockStatus,
      interimTranscript: mockInterimTranscript,
      start: mockStart,
      stop: mockStop,
      abort: mockAbort,
    };
  },
}));

// Transcript được render thành nhiều <Text> (để highlight keyword),
// nên ghép lại toàn bộ chuỗi con để kiểm tra nội dung.
const flattenText = (node: unknown): string => {
  if (node == null || node === false) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  const props = (node as { props?: { children?: unknown } }).props;
  return props ? flattenText(props.children) : '';
};

const mockedGetKey = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedParse = parseVoiceTranscript as jest.MockedFunction<typeof parseVoiceTranscript>;
const mockedFastParse = localFastParse as jest.MockedFunction<typeof localFastParse>;

describe('HomeScreen native Vietnamese speech recognition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'idle';
    mockInterimTranscript = '';
    mockedGetKey.mockResolvedValue('stored-test-key');
    mockedParse.mockResolvedValue({ matched_items: [], unmatched_text: [] });
    mockedFastParse.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the key then starts recognition', async () => {
    const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);
    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    expect(mockedGetKey).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('renders interim words without parsing', () => {
    mockInterimTranscript = 'bán cho chị một ký gạo ST';
    const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);
    expect(flattenText(getByTestId('voice-transcript-text'))).toContain('bán cho chị một ký gạo ST');
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('parses the final transcript with the request-local key', async () => {
    const { getByTestId } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );
    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    await act(async () => {
      mockHandlers.onFinalTranscript(['bán cho chị một ký gạo ST']);
    });
    await waitFor(() =>
      expect(mockedParse).toHaveBeenCalledWith(
        ['bán cho chị một ký gạo ST'],
        mockProducts,
        'stored-test-key'
      )
    );
    expect(flattenText(getByTestId('voice-transcript-text'))).toContain('bán cho chị một ký gạo ST');
  });

  it('canonicalizes the displayed transcript against the catalog', async () => {
    const { getByTestId } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );
    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    await act(async () => {
      mockHandlers.onFinalTranscript(['1 kg bắc hướng']);
    });
    await waitFor(() =>
      expect(mockedParse).toHaveBeenCalledWith(
        ['1 kg bắc hướng'],
        mockProducts,
        'stored-test-key'
      )
    );
    expect(flattenText(getByTestId('voice-transcript-text'))).toContain('1 kg Bắc Hương');
  });

  it('clears the previous transcript when starting a new voice session', async () => {
    const { getByTestId, queryByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);

    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });
    await act(async () => {
      mockHandlers.onFinalTranscript(['1 kg bắc hướng']);
    });
    await waitFor(() =>
      expect(flattenText(getByTestId('voice-transcript-text'))).toContain('1 kg Bắc Hương')
    );

    // Bấm mic lần nữa để bắt đầu hóa đơn mới -> transcript cũ phải bị xóa.
    await act(async () => {
      fireEvent.press(getByTestId('voice-microphone-button'));
    });

    expect(queryByTestId('voice-transcript-text')).toBeNull();
  });

  it('uses a second microphone tap to stop an active session', () => {
    mockStatus = 'listening';
    const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);
    fireEvent.press(getByTestId('voice-microphone-button'));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockedGetKey).not.toHaveBeenCalled();
  });

  it.each([
    ['permission-denied', 'Cần quyền Microphone và Nhận dạng giọng nói để sử dụng tính năng này.'],
    ['unavailable', 'Nhận dạng giọng nói hiện không khả dụng trên thiết bị.'],
    ['no-speech', 'Không nghe thấy nội dung. Vui lòng thử lại.'],
    ['recognition-failed', 'Không thể nhận dạng giọng nói. Vui lòng thử lại.'],
  ] as const)('shows exact alert for %s error', (code, message) => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<HomeScreen onOpenSettings={jest.fn()} />);
    
    act(() => {
      mockHandlers.onError(code);
    });

    expect(alertSpy).toHaveBeenCalledWith('Lỗi nhận dạng giọng nói', message);
  });

  it('passes flattened product names and aliases as contextualStrings', () => {
    render(<HomeScreen onOpenSettings={jest.fn()} />);
    expect(mockHandlers.contextualStrings).toEqual(['Gạo ST25', 'st25', 'gạo sóc trăng', 'Bắc Hương']);
  });
});
