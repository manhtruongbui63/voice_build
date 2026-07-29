# Native Vietnamese Speech Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simulated microphone timer with real Vietnamese speech recognition that displays interim words, auto-finalizes after speech ends, supports tap-to-stop, and parses one final transcript with Gemini.

**Architecture:** A focused `useVoiceInvoiceRecognition` hook owns permissions, native events, session state, deduplication, and cleanup for `expo-speech-recognition`. `HomeScreen` owns the request-local Gemini key, visible transcript, parser call, invoice draft, and user alerts. Expo configuration is the committed source of truth; the generated local iOS `Info.plist` is synchronized for the physical-device build without staging the otherwise-untracked native tree.

**Tech Stack:** React Native 0.74, Expo SDK 51, TypeScript 5.3, `expo-speech-recognition` 1.0.1, Jest 29, React Native Testing Library 12, Xcode 26.3, physical iPhone 12 on iOS 26.3.1.

## Global Constraints

- Recognition locale is exactly `vi-VN`.
- Recognition uses `interimResults: true`, `continuous: false`, and `maxAlternatives: 1`.
- A non-final result updates the screen but never invokes Gemini.
- Each recognition session delivers at most one non-empty final transcript.
- A second microphone tap while listening invokes native `stop()` and waits for the final result.
- The Gemini key remains request-local in a ref and is never placed in React-rendered state, logs, fixtures, or source.
- Native exception text and recognition transcripts must not be logged or rendered as diagnostic detail.
- Permission copy is exactly:
  - `VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn.`
  - `VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói.`
- User-facing recognition copy is exactly:
  - Permission denied: `Cần quyền Microphone và Nhận dạng giọng nói để sử dụng tính năng này.`
  - Unavailable: `Nhận dạng giọng nói hiện không khả dụng trên thiết bị.`
  - No speech: `Không nghe thấy nội dung. Vui lòng thử lại.`
  - Generic failure: `Không thể nhận dạng giọng nói. Vui lòng thử lại.`
- No Simulator may be booted or used; runtime verification is only on device `00008101-001130A63406001E`.
- Preserve unrelated untracked files and never stage the pasted/compromised Gemini key.

## File Map

- Create `src/hooks/useVoiceInvoiceRecognition.ts`: native recognition lifecycle and stable error-code boundary.
- Create `__tests__/useVoiceInvoiceRecognition.test.tsx`: hook-level permissions, event, deduplication, stop, error, and cleanup coverage.
- Create `__tests__/speechRecognitionConfig.test.ts`: committed Expo configuration contract.
- Modify `src/screens/HomeScreen.tsx`: remove the simulated timer and integrate the hook with Secure Store and Gemini parsing.
- Modify `__tests__/HomeScreenSpeechRecognition.test.tsx`: screen-level live transcript, final parse, and tap-to-stop behavior.
- Modify `__tests__/HomeScreen.test.tsx`: retain missing-key, concurrency, safe parser-error, and unmount coverage without fake recording timers.
- Modify `app.json`: register the speech-recognition config plugin and exact usage descriptions.
- Modify local generated `ios/VoiceBill/Info.plist`: synchronize the two iOS usage-description keys for the device build; do not stage the otherwise-untracked `ios` tree.

---

### Task 1: Lock the Expo and Local iOS Permission Configuration

**Files:**
- Create: `__tests__/speechRecognitionConfig.test.ts`
- Modify: `app.json`
- Modify locally, do not stage: `ios/VoiceBill/Info.plist`

**Interfaces:**
- Consumes: Expo app configuration and the installed `expo-speech-recognition` config plugin.
- Produces: an Expo plugin entry with exact permission strings and a local native target that can legally request microphone and speech-recognition access.

- [ ] **Step 1: Write the failing Expo configuration contract**

Create `__tests__/speechRecognitionConfig.test.ts`:

```ts
const appConfig = require('../app.json') as {
  expo: {
    plugins?: Array<string | [string, Record<string, string>]>;
    ios?: {
      infoPlist?: Record<string, string>;
    };
  };
};

const microphonePermission =
  'VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn.';
const speechPermission =
  'VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói.';

describe('speech recognition Expo configuration', () => {
  it('registers the plugin with the approved iOS permission copy', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-speech-recognition',
      {
        microphonePermission,
        speechRecognitionPermission: speechPermission,
      },
    ]);
  });

  it('keeps the same copy in ios.infoPlist', () => {
    expect(appConfig.expo.ios?.infoPlist).toMatchObject({
      NSMicrophoneUsageDescription: microphonePermission,
      NSSpeechRecognitionUsageDescription: speechPermission,
    });
  });
});
```

- [ ] **Step 2: Run the contract and confirm the plugin assertion is red**

Run:

```bash
npm test -- --runInBand __tests__/speechRecognitionConfig.test.ts
```

Expected: FAIL because `appConfig.expo.plugins` is absent and the current speech permission copy does not match.

- [ ] **Step 3: Add the exact plugin and permission values**

Update the relevant parts of `app.json` to:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn.",
          "speechRecognitionPermission": "VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói."
        }
      ]
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.voicebill.app",
      "infoPlist": {
        "NSSpeechRecognitionUsageDescription": "VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói.",
        "NSMicrophoneUsageDescription": "VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn."
      }
    }
  }
}
```

Keep all unrelated existing Expo fields unchanged.

- [ ] **Step 4: Run the contract and confirm green**

Run:

```bash
npm test -- --runInBand __tests__/speechRecognitionConfig.test.ts
```

Expected: 1 suite and 2 tests PASS.

- [ ] **Step 5: Synchronize the currently generated native plist**

Insert these entries inside the root `<dict>` in `ios/VoiceBill/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói.</string>
```

Verify:

```bash
plutil -lint ios/VoiceBill/Info.plist
plutil -p ios/VoiceBill/Info.plist
```

Expected: lint reports `OK`; printed output contains both keys and exact approved values.

- [ ] **Step 6: Commit only the reusable configuration source and test**

```bash
git add app.json __tests__/speechRecognitionConfig.test.ts
git diff --cached --check
git commit -m "config: add speech recognition permissions"
```

Before committing, verify `git diff --cached --name-only` does not include `ios/`; the local generated native file remains available for the device build but is not added to source control.

---

### Task 2: Build the Recognition Hook with a Native Lifecycle Boundary

**Files:**
- Create: `src/hooks/useVoiceInvoiceRecognition.ts`
- Create: `__tests__/useVoiceInvoiceRecognition.test.tsx`

**Interfaces:**
- Consumes:

```ts
useVoiceInvoiceRecognition({
  onFinalTranscript: (transcript: string) => void,
  onError: (code: VoiceRecognitionErrorCode) => void,
})
```

- Produces:

```ts
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
```

- [ ] **Step 1: Write a module mock and the first failing permission/start test**

Create `__tests__/useVoiceInvoiceRecognition.test.tsx` with a listener registry:

```tsx
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

describe('useVoiceInvoiceRecognition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(listeners).forEach((name) => delete listeners[name]);
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
});
```

- [ ] **Step 2: Run the focused test and confirm the missing hook is red**

Run:

```bash
npm test -- --runInBand __tests__/useVoiceInvoiceRecognition.test.tsx
```

Expected: FAIL because `src/hooks/useVoiceInvoiceRecognition.ts` does not exist.

- [ ] **Step 3: Add the minimal typed hook shell and permission/start flow**

Create `src/hooks/useVoiceInvoiceRecognition.ts` with:

```ts
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
```

Implement `start()` so it uses synchronous refs to reject concurrent starts, sets `requesting-permission`, awaits `requestPermissionsAsync()`, reports `permission-denied` when `granted` is false, and otherwise calls:

```ts
ExpoSpeechRecognitionModule.start({
  lang: 'vi-VN',
  interimResults: true,
  continuous: false,
  maxAlternatives: 1,
});
```

After the native `start()` call, set status to `listening`. Catch thrown permission/start failures, invalidate the active session, return to `idle`, and report `recognition-failed` without forwarding the exception text.

- [ ] **Step 4: Run the first test and TypeScript validation**

Run:

```bash
npm test -- --runInBand __tests__/useVoiceInvoiceRecognition.test.tsx
npx tsc --noEmit
```

Expected: the first hook test PASS and TypeScript exits 0.

- [ ] **Step 5: Add failing result, stop, deduplication, error, and cleanup tests**

Extend the hook suite with tests that emit through `listeners`:

```tsx
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
      results: [{ transcript: 'bán một ký gạo ST', confidence: 0, segments: [] }],
    });
  });

  expect(result.current.interimTranscript).toBe('bán một ký gạo ST');
  expect(onFinalTranscript).not.toHaveBeenCalled();
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
    results: [{ transcript: '  bán hai ký gạo ST  ', confidence: 0.9, segments: [] }],
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
  ['network', 'recognition-failed'],
] as const)('maps %s without exposing native messages', async (nativeCode, appCode) => {
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
});

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
```

Also add a denial test asserting `start()` is not called and `onError('permission-denied')` fires.

- [ ] **Step 6: Run the expanded suite and confirm the new cases are red**

Run:

```bash
npm test -- --runInBand __tests__/useVoiceInvoiceRecognition.test.tsx
```

Expected: the initial start test passes; the event, stop, error, and cleanup cases fail until lifecycle logic is implemented.

- [ ] **Step 7: Implement the minimal complete lifecycle**

Use refs for `mounted`, monotonically increasing `sessionId`, `active`, `startPending`, `finalDelivered`, and latest callbacks. Register `result`, `error`, and `end` via `useSpeechRecognitionEvent`.

The result listener must:

```ts
const transcript = event.results[0]?.transcript.trim() ?? '';
if (!activeRef.current || finalDeliveredRef.current || !transcript) return;

if (!event.isFinal) {
  setInterimTranscript(transcript);
  return;
}

finalDeliveredRef.current = true;
activeRef.current = false;
setInterimTranscript('');
setStatus('idle');
onFinalTranscriptRef.current(transcript);
```

The error mapping must be exhaustive at the application boundary:

```ts
const mapRecognitionError = (nativeCode: string): VoiceRecognitionErrorCode => {
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
```

Ignore an `aborted` error after intentional `abort()`. `stop()` changes `listening` to `stopping` before calling the module. `abort()` invalidates the session before calling the module. Cleanup invalidates the session, marks unmounted, and aborts only when recognition is active or permission/start is pending.

- [ ] **Step 8: Run hook tests and TypeScript validation**

Run:

```bash
npm test -- --runInBand __tests__/useVoiceInvoiceRecognition.test.tsx
npx tsc --noEmit
```

Expected: all hook tests PASS and TypeScript exits 0.

- [ ] **Step 9: Commit the isolated hook**

```bash
git add src/hooks/useVoiceInvoiceRecognition.ts __tests__/useVoiceInvoiceRecognition.test.tsx
git diff --cached --check
git commit -m "feat: add native voice recognition hook"
```

---

### Task 3: Replace Home’s Simulated Timer with Real Recognition

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `__tests__/HomeScreenSpeechRecognition.test.tsx`
- Modify: `__tests__/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `useVoiceInvoiceRecognition(options)` and its `status`, `interimTranscript`, `start()`, and `stop()` values from Task 2.
- Produces: real microphone interaction, visible interim Vietnamese text, exactly one final Gemini parse, safe alerts, and draft-invoice opening.

- [ ] **Step 1: Rewrite the existing red speech suite around the hook boundary**

In `__tests__/HomeScreenSpeechRecognition.test.tsx`, mock the hook with mutable state and capture its callbacks:

```tsx
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { parseVoiceTranscript } from '../src/services/aiParser';
import { getGeminiApiKey } from '../src/services/geminiSettingsService';
import type {
  VoiceRecognitionErrorCode,
  VoiceRecognitionStatus,
} from '../src/hooks/useVoiceInvoiceRecognition';

const mockStart = jest.fn<Promise<void>, []>();
const mockStop = jest.fn<void, []>();
const mockAbort = jest.fn<void, []>();
let mockStatus: VoiceRecognitionStatus = 'idle';
let mockInterimTranscript = '';
let mockHandlers: {
  onFinalTranscript: (transcript: string) => void;
  onError: (code: VoiceRecognitionErrorCode) => void;
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
```

Retain the existing service and database mocks. Add these screen-level cases:

```tsx
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
  const { getByText } = render(<HomeScreen onOpenSettings={jest.fn()} />);
  expect(getByText('"bán cho chị một ký gạo ST"')).toBeTruthy();
  expect(mockedParse).not.toHaveBeenCalled();
});

it('parses the final transcript with the request-local key', async () => {
  const { getByTestId, getByText } = render(
    <HomeScreen onOpenSettings={jest.fn()} />
  );
  await act(async () => {
    fireEvent.press(getByTestId('voice-microphone-button'));
  });
  await act(async () => {
    mockHandlers.onFinalTranscript('bán cho chị một ký gạo ST');
  });
  await waitFor(() =>
    expect(mockedParse).toHaveBeenCalledWith(
      'bán cho chị một ký gạo ST',
      [],
      'stored-test-key'
    )
  );
  expect(getByText('"bán cho chị một ký gạo ST"')).toBeTruthy();
});

it('uses a second microphone tap to stop an active session', () => {
  mockStatus = 'listening';
  const { getByTestId } = render(<HomeScreen onOpenSettings={jest.fn()} />);
  fireEvent.press(getByTestId('voice-microphone-button'));
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(mockedGetKey).not.toHaveBeenCalled();
});
```

Add a parameterized alert test that invokes `mockHandlers.onError(code)` and asserts the exact four messages from Global Constraints with alert title `Lỗi nhận dạng giọng nói`.

- [ ] **Step 2: Run the Home suites and confirm they fail against the simulated implementation**

Run:

```bash
npm test -- --runInBand __tests__/HomeScreenSpeechRecognition.test.tsx __tests__/HomeScreen.test.tsx
```

Expected: FAIL because `HomeScreen` does not call the hook, still waits 2.5 seconds, and cannot stop native recognition.

- [ ] **Step 3: Integrate the hook and remove every simulated-voice path**

In `src/screens/HomeScreen.tsx`:

- Delete `isRecording`, `recordingTimerRef`, `handleSimulatedVoiceTest`, the 2.5-second timeout, and the hardcoded Vietnamese sentence.
- Add `apiKeyRef = useRef<string | null>(null)` for only the active recognition request.
- Rename the parser function to `handleFinalTranscript`.
- Keep the existing mounted guard and safe Gemini parser error mapping.
- Use a stable error-code-to-copy map:

```ts
const RECOGNITION_ERROR_MESSAGES: Record<VoiceRecognitionErrorCode, string> = {
  'permission-denied':
    'Cần quyền Microphone và Nhận dạng giọng nói để sử dụng tính năng này.',
  unavailable:
    'Nhận dạng giọng nói hiện không khả dụng trên thiết bị.',
  'no-speech':
    'Không nghe thấy nội dung. Vui lòng thử lại.',
  'recognition-failed':
    'Không thể nhận dạng giọng nói. Vui lòng thử lại.',
};
```

Initialize the hook with memoized callbacks:

```ts
const recognition = useVoiceInvoiceRecognition({
  onFinalTranscript: handleFinalTranscript,
  onError: handleRecognitionError,
});
```

`handleFinalTranscript` must trim the transcript, read and clear `apiKeyRef.current`, set the final visible transcript, and invoke the existing product lookup/parser/mapping flow only when both transcript and key are present. A parser-pending ref must prevent duplicate final callbacks from starting overlapping Gemini requests.

`handleMicrophonePress` must:

```ts
if (loading) return;
if (recognition.status === 'listening') {
  recognition.stop();
  return;
}
if (recognition.status !== 'idle' || microphonePendingRef.current) return;

microphonePendingRef.current = true;
try {
  const apiKey = await getGeminiApiKey();
  if (!isMountedRef.current) return;
  if (!apiKey) {
    // Keep the existing missing-key alert and Settings action.
    return;
  }
  apiKeyRef.current = apiKey;
  await recognition.start();
} catch {
  // Keep the existing stable key-read alert.
} finally {
  microphonePendingRef.current = false;
}
```

On recognition error, clear `apiKeyRef`, show the stable alert, and never include native text. On unmount, clear key and pending refs; hook cleanup owns native abort.

Render:

```ts
const visibleTranscript = recognition.interimTranscript || transcript;
const isListening =
  recognition.status === 'listening' || recognition.status === 'stopping';
```

Use `visibleTranscript` in the transcript box. While listening or stopping, the microphone label must clearly communicate the second action, for example `⏹️ Dừng`; while permission is pending use `Đang xin quyền...`; otherwise use `🎙️`.

- [ ] **Step 4: Update legacy Home tests to remove timer assumptions**

In `__tests__/HomeScreen.test.tsx`, mock `useVoiceInvoiceRecognition` as idle with `start`, `stop`, and `abort` spies.

Keep and adapt these behaviors:

- Missing key opens Settings and never starts recognition or Gemini.
- Rapid presses during a pending key lookup perform one Secure Store read.
- A key lookup resolving after unmount does not start recognition or show an alert.
- An arbitrary parser error still renders only `Không thể xử lý yêu cầu Gemini`.

For the parser-error case, capture `onFinalTranscript`, press once to load the key, then invoke the callback instead of advancing timers:

```tsx
await act(async () => {
  fireEvent.press(getByTestId('voice-microphone-button'));
});
await act(async () => {
  mockRecognitionHandlers.onFinalTranscript('bán một ký gạo ST');
});
await waitFor(() =>
  expect(alertSpy).toHaveBeenCalledWith(
    'Lỗi phân tích AI',
    'Không thể xử lý yêu cầu Gemini'
  )
);
```

Delete all `jest.useFakeTimers()`, `advanceTimersByTime(2500)`, and simulated hardcoded-transcript assertions.

- [ ] **Step 5: Run focused Home tests and TypeScript**

Run:

```bash
npm test -- --runInBand __tests__/HomeScreenSpeechRecognition.test.tsx __tests__/HomeScreen.test.tsx
npx tsc --noEmit
```

Expected: both suites PASS and TypeScript exits 0.

- [ ] **Step 6: Run the combined speech regression slice**

Run:

```bash
npm test -- --runInBand __tests__/speechRecognitionConfig.test.ts __tests__/useVoiceInvoiceRecognition.test.tsx __tests__/HomeScreenSpeechRecognition.test.tsx __tests__/HomeScreen.test.tsx
```

Expected: all four suites PASS; no test contains the hardcoded simulated sale sentence or a real credential.

- [ ] **Step 7: Commit the Home integration**

```bash
git add src/screens/HomeScreen.tsx __tests__/HomeScreenSpeechRecognition.test.tsx __tests__/HomeScreen.test.tsx
git diff --cached --check
git commit -m "feat: transcribe Vietnamese voice invoices"
```

---

### Task 4: Regression Verification and Physical iPhone Acceptance

**Files:**
- Verify only: all committed source and test files
- Verify locally: `ios/VoiceBill/Info.plist`
- Update during execution: `.superpowers/sdd/2026-07-29-gemini-api-key-settings/progress.md`

**Interfaces:**
- Consumes: the completed native configuration, recognition hook, Home integration, connected iPhone, and a replacement Gemini key entered privately in the app.
- Produces: evidence that automated checks pass, the physical build contains permission keys, interim speech is visible, auto-stop and manual stop both work, and Gemini receives one final transcript.

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: every Jest suite and test PASS with no open-handle warning.

- [ ] **Step 2: Run static and bundle validation**

Run:

```bash
npx tsc --noEmit
```

Then create a temporary directory and export the iOS bundle:

```bash
voicebill_export_dir=$(mktemp -d /tmp/voicebill-ios-export.XXXXXX)
npx expo export --platform ios --output-dir "$voicebill_export_dir"
```

Expected: TypeScript exits 0 and Expo completes the iOS export without an error.

- [ ] **Step 3: Verify the local native target before building**

Run:

```bash
plutil -extract NSMicrophoneUsageDescription raw ios/VoiceBill/Info.plist
plutil -extract NSSpeechRecognitionUsageDescription raw ios/VoiceBill/Info.plist
xcrun devicectl list devices
```

Expected: both exact approved Vietnamese descriptions print, and device `00008101-001130A63406001E` is available.

- [ ] **Step 4: Rebuild and reinstall on the physical iPhone**

Run:

```bash
npx expo run:ios --device 00008101-001130A63406001E
```

Expected: build and install succeed for the connected iPhone 12. Do not substitute an iOS Simulator target.

- [ ] **Step 5: Launch the installed app and inspect the running process**

Run:

```bash
xcrun devicectl device process launch \
  --device 00008101-001130A63406001E \
  org.name.VoiceBill
xcrun devicectl device info processes \
  --device 00008101-001130A63406001E
```

Expected: the launch succeeds and a `VoiceBill.app/VoiceBill` process is listed.

- [ ] **Step 6: Perform the physical-device speech acceptance checks**

On the iPhone:

1. Open Settings in VoiceBill and enter only a newly generated replacement Gemini key; never paste it into terminal, chat, tests, or source.
2. Accept both microphone and speech-recognition prompts.
3. Tap the microphone and say `bán cho chị một ký gạo ST`.
4. Confirm words appear in the transcript box before the sentence is complete.
5. Pause and confirm recognition finalizes automatically and the invoice draft opens once.
6. Start a second sentence and tap `⏹️ Dừng`; confirm the final draft opens once.
7. Temporarily disable microphone or speech permission in iOS Settings and confirm VoiceBill shows the approved permission guidance rather than native error detail.
8. Restore permission, relaunch, and confirm the replacement Gemini key remains in Keychain.

Record each check as PASS or the exact visible failure. A missing user gesture or permission decision remains unverified rather than being reported as successful.

- [ ] **Step 7: Run a credential and simulation residue scan**

Run:

```bash
rg -n \
  "AQ\\.|stored-test-key|SENTINEL_NATIVE_SECRET|bán cho chị 1kg ST, à không lấy 2kg" \
  src app.json ios/VoiceBill/Info.plist
```

Expected: no matches in production source or native configuration.

- [ ] **Step 8: Review final branch scope**

Run:

```bash
git status --short
git log --oneline -6
git diff HEAD~3..HEAD --stat
```

Expected: speech work is represented by focused configuration, hook, and Home commits; unrelated untracked native/generated files remain unstaged.

- [ ] **Step 9: Update the SDD progress ledger with evidence**

Append task status, commit hashes, test totals, TypeScript result, iOS export result, physical build result, and each device acceptance result to:

```text
.superpowers/sdd/2026-07-29-gemini-api-key-settings/progress.md
```

Do not include the Gemini key, transcript content beyond the harmless acceptance sentence, signing email, or private account identifiers.
