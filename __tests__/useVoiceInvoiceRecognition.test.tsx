import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-modules-core';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import {
  useVoiceInvoiceRecognition,
  VoiceRecognitionErrorCode,
} from '../src/hooks/useVoiceInvoiceRecognition';

jest.mock('expo-speech-recognition', () => {
  const listeners: Record<string, ((event: unknown) => void) | undefined> = {};
  return {
    ExpoSpeechRecognitionModule: {
      requestPermissionsAsync: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
    useSpeechRecognitionEvent: jest.fn(
      (eventName: string, listener: (event: unknown) => void) => {
        listeners[eventName] = listener;
      }
    ),
    __mockSpeechListeners: listeners,
  };
});

const speechModule = ExpoSpeechRecognitionModule as jest.Mocked<
  typeof ExpoSpeechRecognitionModule
>;
const listeners = (
  jest.requireMock('expo-speech-recognition') as {
    __mockSpeechListeners: Record<string, ((event: unknown) => void) | undefined>;
  }
).__mockSpeechListeners;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('useVoiceInvoiceRecognition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(listeners).forEach((name) => delete listeners[name]);
    speechModule.start.mockReset();
    speechModule.stop.mockReset();
    speechModule.abort.mockReset();
    speechModule.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: PermissionStatus.GRANTED,
      canAskAgain: true,
      expires: 'never',
    });
  });

  it('requests permission and starts one Vietnamese recognition session', async () => {
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError: jest.fn(),
      })
    );

    await act(async () => result.current.start());

    expect(speechModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.start).toHaveBeenCalledWith({
      lang: 'vi-VN',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
    expect(result.current.status).toBe('listening');
  });

  it('does not start a second session while permission is pending', async () => {
    const permission = createDeferred<{
      granted: boolean;
      status: PermissionStatus;
      canAskAgain: boolean;
      expires: 'never';
    }>();
    speechModule.requestPermissionsAsync.mockReturnValue(permission.promise);
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError: jest.fn(),
      })
    );

    let firstStart!: Promise<void>;
    act(() => {
      firstStart = result.current.start();
      void result.current.start();
    });

    expect(speechModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      permission.resolve({
        granted: true,
        status: PermissionStatus.GRANTED,
        canAskAgain: true,
        expires: 'never',
      });
      await firstStart;
    });
    expect(speechModule.start).toHaveBeenCalledTimes(1);
  });

  it('reports a denied permission without starting recognition', async () => {
    const onError = jest.fn<void, [VoiceRecognitionErrorCode]>();
    speechModule.requestPermissionsAsync.mockResolvedValue({
      granted: false,
      status: PermissionStatus.DENIED,
      canAskAgain: false,
      expires: 'never',
    });
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError,
      })
    );

    await act(async () => result.current.start());

    expect(speechModule.start).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('permission-denied');
    expect(result.current.status).toBe('idle');
  });

  it('maps a thrown permission failure without exposing its native message', async () => {
    const onError = jest.fn<void, [VoiceRecognitionErrorCode]>();
    speechModule.requestPermissionsAsync.mockRejectedValue(
      new Error('SENTINEL_NATIVE_SECRET')
    );
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError,
      })
    );

    await act(async () => result.current.start());

    expect(speechModule.start).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('recognition-failed');
    expect(JSON.stringify(onError.mock.calls)).not.toContain('SENTINEL');
    expect(result.current.status).toBe('idle');
  });

  it('maps a thrown start failure without exposing its native message', async () => {
    const onError = jest.fn<void, [VoiceRecognitionErrorCode]>();
    speechModule.start.mockImplementation(() => {
      throw new Error('SENTINEL_NATIVE_SECRET');
    });
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError,
      })
    );

    await act(async () => result.current.start());

    expect(onError).toHaveBeenCalledWith('recognition-failed');
    expect(JSON.stringify(onError.mock.calls)).not.toContain('SENTINEL');
    expect(result.current.status).toBe('idle');
  });

  it('updates interim text without delivering a final transcript', async () => {
    const onFinalTranscript = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript,
        onError: jest.fn(),
      })
    );
    await act(async () => result.current.start());

    act(() => {
      listeners.result?.({
        isFinal: false,
        results: [
          {
            transcript: 'bán một ký gạo ST',
            confidence: 0,
            segments: [],
          },
        ],
      });
    });

    expect(result.current.interimTranscript).toBe('bán một ký gạo ST');
    expect(onFinalTranscript).not.toHaveBeenCalled();
  });

  it('delivers a final transcript to the latest callback', async () => {
    const initialCallback = jest.fn();
    const latestCallback = jest.fn();
    const { result, rerender } = renderHook(
      ({
        finalCallback,
      }: {
        finalCallback: (transcript: string) => void;
      }) =>
        useVoiceInvoiceRecognition({
          onFinalTranscript: finalCallback,
          onError: jest.fn(),
        }),
      { initialProps: { finalCallback: initialCallback } }
    );
    await act(async () => result.current.start());

    rerender({ finalCallback: latestCallback });
    act(() => {
      listeners.result?.({
        isFinal: true,
        results: [{ transcript: 'ba ký gạo', confidence: 1, segments: [] }],
      });
    });

    expect(initialCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledWith('ba ký gạo');
  });

  it('delivers an error to the latest callback', async () => {
    const initialCallback = jest.fn<void, [VoiceRecognitionErrorCode]>();
    const latestCallback = jest.fn<void, [VoiceRecognitionErrorCode]>();
    const { result, rerender } = renderHook(
      ({
        errorCallback,
      }: {
        errorCallback: (code: VoiceRecognitionErrorCode) => void;
      }) =>
        useVoiceInvoiceRecognition({
          onFinalTranscript: jest.fn(),
          onError: errorCallback,
        }),
      { initialProps: { errorCallback: initialCallback } }
    );
    await act(async () => result.current.start());

    rerender({ errorCallback: latestCallback });
    act(() => {
      listeners.error?.({
        error: 'network',
        message: 'SENTINEL_NATIVE_SECRET',
      });
    });

    expect(initialCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledWith('recognition-failed');
  });

  it('delivers one trimmed final transcript and ignores duplicates', async () => {
    const onFinalTranscript = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript,
        onError: jest.fn(),
      })
    );
    await act(async () => result.current.start());

    const finalEvent = {
      isFinal: true,
      results: [
        {
          transcript: '  bán hai ký gạo ST  ',
          confidence: 0.9,
          segments: [],
        },
      ],
    };
    act(() => {
      listeners.result?.(finalEvent);
      listeners.result?.(finalEvent);
    });

    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
    expect(onFinalTranscript).toHaveBeenCalledWith('bán hai ký gạo ST');
    expect(result.current.interimTranscript).toBe('');
    expect(result.current.status).toBe('idle');
  });

  it('stops early and waits for the native final event', async () => {
    const onFinalTranscript = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript,
        onError: jest.fn(),
      })
    );
    await act(async () => result.current.start());
    act(() => result.current.stop());

    expect(speechModule.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('stopping');
    expect(onFinalTranscript).not.toHaveBeenCalled();
  });

  it.each([
    ['not-allowed', 'permission-denied'],
    ['service-not-allowed', 'unavailable'],
    ['language-not-supported', 'unavailable'],
    ['no-speech', 'no-speech'],
    ['speech-timeout', 'no-speech'],
    ['network', 'recognition-failed'],
  ] as const)(
    'maps %s without exposing native messages',
    async (nativeCode, appCode) => {
      const onError = jest.fn<void, [VoiceRecognitionErrorCode]>();
      const { result } = renderHook(() =>
        useVoiceInvoiceRecognition({
          onFinalTranscript: jest.fn(),
          onError,
        })
      );
      await act(async () => result.current.start());
      act(() => {
        listeners.error?.({
          error: nativeCode,
          message: 'SENTINEL_NATIVE_SECRET',
        });
      });

      expect(onError).toHaveBeenCalledWith(appCode);
      expect(JSON.stringify(onError.mock.calls)).not.toContain('SENTINEL');
    }
  );

  it('reports no speech when an active session ends without a final result', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError,
      })
    );
    await act(async () => result.current.start());
    act(() => listeners.end?.(null));

    expect(onError).toHaveBeenCalledWith('no-speech');
    expect(result.current.status).toBe('idle');
  });

  it('aborts on unmount and ignores late native events', async () => {
    const onFinalTranscript = jest.fn();
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useVoiceInvoiceRecognition({ onFinalTranscript, onError })
    );
    await act(async () => result.current.start());
    unmount();
    act(() => {
      listeners.result?.({
        isFinal: true,
        results: [{ transcript: 'late text', confidence: 1, segments: [] }],
      });
    });

    expect(speechModule.abort).toHaveBeenCalledTimes(1);
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not start when permission resolves after unmount', async () => {
    const permission = createDeferred<{
      granted: boolean;
      status: PermissionStatus;
      canAskAgain: boolean;
      expires: 'never';
    }>();
    speechModule.requestPermissionsAsync.mockReturnValue(permission.promise);
    const onFinalTranscript = jest.fn();
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useVoiceInvoiceRecognition({ onFinalTranscript, onError })
    );

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start();
    });
    await waitFor(() =>
      expect(result.current.status).toBe('requesting-permission')
    );
    unmount();
    await act(async () => {
      permission.resolve({
        granted: true,
        status: PermissionStatus.GRANTED,
        canAskAgain: true,
        expires: 'never',
      });
      await startPromise;
    });

    expect(speechModule.abort).toHaveBeenCalledTimes(1);
    expect(speechModule.start).not.toHaveBeenCalled();
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('invalidates a pending permission request when intentionally aborted', async () => {
    const permission = createDeferred<{
      granted: boolean;
      status: PermissionStatus;
      canAskAgain: boolean;
      expires: 'never';
    }>();
    speechModule.requestPermissionsAsync.mockReturnValue(permission.promise);
    const onFinalTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({ onFinalTranscript, onError })
    );

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start();
    });
    act(() => result.current.abort());
    await act(async () => {
      permission.resolve({
        granted: true,
        status: PermissionStatus.GRANTED,
        canAskAgain: true,
        expires: 'never',
      });
      await startPromise;
    });

    expect(speechModule.abort).toHaveBeenCalledTimes(1);
    expect(speechModule.start).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('ignores aborted, end, and result events after an intentional abort', async () => {
    const onFinalTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({ onFinalTranscript, onError })
    );
    await act(async () => result.current.start());

    act(() => result.current.abort());
    act(() => {
      listeners.error?.({
        error: 'aborted',
        message: 'SENTINEL_NATIVE_SECRET',
      });
      listeners.end?.(null);
      listeners.result?.({
        isFinal: true,
        results: [{ transcript: 'late text', confidence: 1, segments: [] }],
      });
    });

    expect(speechModule.abort).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('waits for an aborted native session to end before starting a replacement', async () => {
    const onFinalTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({ onFinalTranscript, onError })
    );
    await act(async () => result.current.start());

    let replacementStart!: Promise<void>;
    act(() => {
      result.current.abort();
      replacementStart = result.current.start();
    });

    expect(speechModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speechModule.start).toHaveBeenCalledTimes(1);
    act(() => {
      listeners.result?.({
        isFinal: true,
        results: [
          { transcript: 'late old text', confidence: 1, segments: [] },
        ],
      });
      listeners.error?.({
        error: 'aborted',
        message: 'SENTINEL_NATIVE_SECRET',
      });
    });

    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(speechModule.start).toHaveBeenCalledTimes(1);

    await act(async () => {
      listeners.end?.(null);
      await replacementStart;
    });

    expect(speechModule.requestPermissionsAsync).toHaveBeenCalledTimes(2);
    expect(speechModule.start).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('listening');
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports only the first terminal event when error arrives before end', async () => {
    const onError = jest.fn<void, [VoiceRecognitionErrorCode]>();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError,
      })
    );
    await act(async () => result.current.start());

    act(() => {
      listeners.error?.({
        error: 'network',
        message: 'SENTINEL_NATIVE_SECRET',
      });
      listeners.end?.(null);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('recognition-failed');
  });

  it('reports only the first terminal event when end arrives before error', async () => {
    const onError = jest.fn<void, [VoiceRecognitionErrorCode]>();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError,
      })
    );
    await act(async () => result.current.start());

    act(() => {
      listeners.end?.(null);
      listeners.error?.({
        error: 'network',
        message: 'SENTINEL_NATIVE_SECRET',
      });
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('no-speech');
  });

  it('ignores late error and end events after a final transcript', async () => {
    const onFinalTranscript = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({ onFinalTranscript, onError })
    );
    await act(async () => result.current.start());

    act(() => {
      listeners.result?.({
        isFinal: true,
        results: [{ transcript: 'một ký gạo', confidence: 1, segments: [] }],
      });
      listeners.error?.({
        error: 'network',
        message: 'SENTINEL_NATIVE_SECRET',
      });
      listeners.end?.(null);
    });

    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
    expect(onFinalTranscript).toHaveBeenCalledWith('một ký gạo');
    expect(onError).not.toHaveBeenCalled();
  it('passes contextualStrings to the native module start method', async () => {
    const { result } = renderHook(() =>
      useVoiceInvoiceRecognition({
        onFinalTranscript: jest.fn(),
        onError: jest.fn(),
        contextualStrings: ['Gạo ST25', 'Bắc Hương'],
      })
    );

    await act(async () => result.current.start());

    expect(speechModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'vi-VN',
        contextualStrings: ['Gạo ST25', 'Bắc Hương'],
      })
    );
  });
});
