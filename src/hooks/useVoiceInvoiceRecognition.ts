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
  const startPendingRef = useRef(false);
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
    startPendingRef.current = false;
    finalDeliveredRef.current = true;
  }, []);

  const start = useCallback(async () => {
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

    activeRef.current = true;
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
        !activeRef.current
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
      !activeRef.current
    ) {
      return;
    }

    startPendingRef.current = false;
    updateStatus('listening');
  }, [invalidateSession, updateStatus]);

  const stop = useCallback(() => {
    if (!activeRef.current || statusRef.current !== 'listening') return;

    updateStatus('stopping');
    ExpoSpeechRecognitionModule.stop();
  }, [updateStatus]);

  const abort = useCallback(() => {
    const shouldAbort = activeRef.current || startPendingRef.current;
    invalidateSession();
    setInterimTranscript('');
    updateStatus('idle');

    if (shouldAbort) {
      ExpoSpeechRecognitionModule.abort();
    }
  }, [invalidateSession, updateStatus]);

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
      invalidateSession();

      if (shouldAbort) {
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, [invalidateSession]);

  return {
    status,
    interimTranscript,
    start,
    stop,
    abort,
  };
};
