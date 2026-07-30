import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export type VoiceRecognitionStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'stopping';

export type VoiceRecognitionErrorCode =
  | 'permission-denied'
  | 'unavailable'
  | 'no-speech'
  | 'recognition-failed';

export interface VoiceInvoiceRecognition {
  status: VoiceRecognitionStatus;
  interimTranscript: string;
  start(): Promise<void>;
  stop(): void;
  abort(): void;
}

interface VoiceInvoiceRecognitionOptions {
  onFinalTranscript: (transcript: string) => void;
  onError: (code: VoiceRecognitionErrorCode) => void;
}

const mapRecognitionError = (
  nativeCode: string
): VoiceRecognitionErrorCode => {
  if (nativeCode === 'not-allowed') return 'permission-denied';
  if (
    nativeCode === 'service-not-allowed' ||
    nativeCode === 'language-not-supported'
  ) {
    return 'unavailable';
  }
  if (nativeCode === 'no-speech' || nativeCode === 'speech-timeout') {
    return 'no-speech';
  }
  return 'recognition-failed';
};

export const useVoiceInvoiceRecognition = ({
  onFinalTranscript,
  onError,
}: VoiceInvoiceRecognitionOptions): VoiceInvoiceRecognition => {
  const [status, setStatus] = useState<VoiceRecognitionStatus>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(0);
  const activeRef = useRef(false);
  const nativeSessionRef = useRef(false);
  const startPendingRef = useRef(false);
  const awaitingAbortEndRef = useRef(false);
  const queuedStartPromiseRef = useRef<Promise<void> | null>(null);
  const queuedStartResolveRef = useRef<(() => void) | null>(null);
  const finalDeliveredRef = useRef(false);
  const statusRef = useRef<VoiceRecognitionStatus>('idle');
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);

  onFinalTranscriptRef.current = onFinalTranscript;
  onErrorRef.current = onError;

  const updateStatus = useCallback((nextStatus: VoiceRecognitionStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);

  const invalidateSession = useCallback(() => {
    sessionIdRef.current += 1;
    activeRef.current = false;
    nativeSessionRef.current = false;
    startPendingRef.current = false;
    finalDeliveredRef.current = true;
  }, []);

  const takeQueuedStartResolve = useCallback(() => {
    const resolve = queuedStartResolveRef.current;
    queuedStartPromiseRef.current = null;
    queuedStartResolveRef.current = null;
    return resolve;
  }, []);

  const start = useCallback(async () => {
    if (awaitingAbortEndRef.current) {
      if (!queuedStartPromiseRef.current) {
        queuedStartPromiseRef.current = new Promise<void>((resolve) => {
          queuedStartResolveRef.current = resolve;
        });
      }
      return queuedStartPromiseRef.current;
    }

    if (activeRef.current || startPendingRef.current) return;

    const sessionId = sessionIdRef.current + 1;
    sessionIdRef.current = sessionId;
    startPendingRef.current = true;
    finalDeliveredRef.current = false;
    setInterimTranscript('');
    updateStatus('requesting-permission');

    let permission;
    try {
      permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } catch {
      if (
        !mountedRef.current ||
        sessionIdRef.current !== sessionId ||
        !startPendingRef.current
      ) {
        return;
      }
      invalidateSession();
      setInterimTranscript('');
      updateStatus('idle');
      onErrorRef.current('recognition-failed');
      return;
    }

    if (
      !mountedRef.current ||
      sessionIdRef.current !== sessionId ||
      !startPendingRef.current
    ) {
      return;
    }

    if (!permission.granted) {
      invalidateSession();
      setInterimTranscript('');
      updateStatus('idle');
      onErrorRef.current('permission-denied');
      return;
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'vi-VN',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch {
      if (
        !mountedRef.current ||
        sessionIdRef.current !== sessionId ||
        !startPendingRef.current
      ) {
        return;
      }
      invalidateSession();
      setInterimTranscript('');
      updateStatus('idle');
      onErrorRef.current('recognition-failed');
      return;
    }

    if (
      !mountedRef.current ||
      sessionIdRef.current !== sessionId ||
      !startPendingRef.current
    ) {
      return;
    }

    activeRef.current = true;
    nativeSessionRef.current = true;
    startPendingRef.current = false;
    updateStatus('listening');
  }, [invalidateSession, updateStatus]);

  const stop = useCallback(() => {
    if (!activeRef.current || statusRef.current !== 'listening') return;

    updateStatus('stopping');
    ExpoSpeechRecognitionModule.stop();
  }, [updateStatus]);

  const abort = useCallback(() => {
    const shouldAbort = nativeSessionRef.current || startPendingRef.current;
    const shouldWaitForEnd = nativeSessionRef.current;
    takeQueuedStartResolve()?.();
    invalidateSession();
    setInterimTranscript('');
    updateStatus('idle');

    if (shouldWaitForEnd) {
      awaitingAbortEndRef.current = true;
    }

    if (shouldAbort) {
      ExpoSpeechRecognitionModule.abort();
    }
  }, [invalidateSession, takeQueuedStartResolve, updateStatus]);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript.trim() ?? '';
    if (
      !mountedRef.current ||
      !activeRef.current ||
      finalDeliveredRef.current ||
      !transcript
    ) {
      return;
    }

    if (!event.isFinal) {
      setInterimTranscript(transcript);
      return;
    }

    finalDeliveredRef.current = true;
    activeRef.current = false;
    startPendingRef.current = false;
    sessionIdRef.current += 1;
    setInterimTranscript('');
    updateStatus('idle');
    onFinalTranscriptRef.current(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!mountedRef.current || !activeRef.current) return;

    invalidateSession();
    setInterimTranscript('');
    updateStatus('idle');
    onErrorRef.current(mapRecognitionError(event.error));
  });

  useSpeechRecognitionEvent('end', () => {
    if (awaitingAbortEndRef.current) {
      awaitingAbortEndRef.current = false;
      const resumeQueuedStart = takeQueuedStartResolve();
      if (resumeQueuedStart) {
        void start().then(resumeQueuedStart);
      }
      return;
    }

    if (!mountedRef.current || !activeRef.current) return;

    invalidateSession();
    setInterimTranscript('');
    updateStatus('idle');
    onErrorRef.current('no-speech');
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      const shouldAbort = activeRef.current || startPendingRef.current;
      mountedRef.current = false;
      takeQueuedStartResolve()?.();
      invalidateSession();

      if (shouldAbort) {
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, [invalidateSession, takeQueuedStartResolve]);

  return {
    status,
    interimTranscript,
    start,
    stop,
    abort,
  };
};
