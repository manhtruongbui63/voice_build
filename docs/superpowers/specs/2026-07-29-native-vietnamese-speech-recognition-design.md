# Native Vietnamese Speech Recognition Design

**Date:** 2026-07-29

**Status:** Approved design
**Target:** VoiceBill on a physical iPhone 12 running iOS 26.3.1

## Problem

The Home microphone currently does not capture or recognize speech. Pressing it
reads the stored Gemini key, waits 2.5 seconds, and sends a hardcoded Vietnamese
sentence to the parser. Consequently, words spoken by the user cannot appear in
the transcript.

The native iOS project also lacks `NSSpeechRecognitionUsageDescription` and
`NSMicrophoneUsageDescription` in `ios/VoiceBill/Info.plist`, even though both
descriptions exist in `app.json`. A real permission request therefore cannot be
shipped safely until the native configuration is synchronized and the app is
rebuilt.

## Goals

- Recognize the user's real Vietnamese speech on a physical iPhone.
- Show interim recognition text while the user is speaking.
- Stop automatically after speech ends, while allowing a second microphone tap
  to stop early.
- Send only the final recognized sentence to Gemini, exactly once.
- Preserve secure, request-local Gemini key handling.
- Handle permissions, recognition errors, duplicate events, and lifecycle
  cleanup without exposing raw native or SDK error text.

## Non-Goals

- Audio recording files or playback.
- Background speech recognition.
- Continuous dictation across multiple invoices.
- Cloud storage of transcripts or audio.
- A custom Apple Speech native module.
- Changes to Gemini parsing, product matching, or Secure Store.

## Chosen Architecture

Introduce a focused `useVoiceInvoiceRecognition` hook that owns native speech
recognition lifecycle. `HomeScreen` remains responsible for the screen,
Gemini-key lookup, rendering the current transcript, and invoking the existing
invoice parser after a final result.

The hook depends on `expo-speech-recognition` and exposes a small interface:

```ts
type VoiceRecognitionStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'stopping';

interface VoiceInvoiceRecognition {
  status: VoiceRecognitionStatus;
  interimTranscript: string;
  start(): Promise<void>;
  stop(): void;
  abort(): void;
}
```

The hook reports a final transcript through a callback supplied by
`HomeScreen`. It reports only stable application-level error codes or messages,
never arbitrary native exception text.

This boundary is preferred over wiring the module directly into `HomeScreen`
because it keeps permissions, native events, deduplication, and cleanup
independently testable.

## Interaction and State Flow

### Start

1. The user presses the microphone while the screen is idle.
2. `HomeScreen` reads the Gemini key from Secure Store.
3. If the key is absent, the existing alert routes the user to Settings and
   recognition does not start.
4. The hook requests microphone and speech-recognition permission.
5. On approval, recognition starts with:
   - `lang: 'vi-VN'`
   - `interimResults: true`
   - `continuous: false`
   - one best alternative
6. The UI changes from idle to `Đang nghe`.

### Interim Results

- Each non-final result replaces the visible interim transcript.
- The transcript box remains visible and updates while the user speaks.
- Interim results never invoke Gemini.

### Automatic Stop

- The native recognizer determines that speech has ended and emits a final
  result or an end event.
- The final non-empty transcript is accepted once.
- Recognition returns to idle and `HomeScreen` changes to the analyzing state.
- `HomeScreen` invokes the existing parser with the final transcript, current
  product catalog, and the request-local Gemini key.

### Manual Stop

- Pressing the microphone while listening calls `stop()`.
- The screen enters `stopping` and waits for the native final result.
- The final result follows the same single-delivery path as automatic stop.
- Repeated taps while stopping have no effect.

### Empty Speech

- If recognition ends without a non-empty final transcript, Gemini is not
  called.
- The UI returns to idle and shows a stable Vietnamese no-speech message.

## Concurrency and Lifecycle Rules

- At most one recognition session may exist.
- At most one final transcript may be accepted per session.
- The Gemini key is captured only for the active session and is not stored in
  React-rendered state.
- Duplicate or late final events are ignored using a session identifier and
  final-delivered guard.
- Navigating away or unmounting aborts the native recognizer and invalidates the
  session.
- A late permission response, native event, or parser response cannot update an
  unmounted screen.
- The existing protection against duplicate Gemini parsing remains in force.

## Error Handling

User-visible errors use stable Vietnamese copy:

- Permission denied: `Cần quyền Microphone và Nhận dạng giọng nói để sử dụng tính năng này.`
- Recognition unavailable: `Nhận dạng giọng nói hiện không khả dụng trên thiết bị.`
- No speech: `Không nghe thấy nội dung. Vui lòng thử lại.`
- Generic recognition failure: `Không thể nhận dạng giọng nói. Vui lòng thử lại.`

The implementation may map known native error codes to these messages, but it
must not render arbitrary `error.message`, log transcripts as diagnostics, or
log credentials.

## Native iOS Configuration

The built iOS target must contain:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>VoiceBill cần quyền truy cập Micro để thu âm khẩu lệnh tạo hóa đơn.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>VoiceBill cần quyền sử dụng Nhận dạng giọng nói để bóc tách hóa đơn bằng giọng nói.</string>
```

`app.json` must declare the `expo-speech-recognition` config plugin so future
native regeneration preserves these values. Because the current iOS project is
checked out as native files, `ios/VoiceBill/Info.plist` must also be updated
directly and verified in the built app.

## Testing Strategy

### Automated

The focused regression suite must prove:

- Pressing the microphone requests permission and starts `vi-VN` recognition.
- Interim results render immediately and never call Gemini.
- A final result is rendered and passed once to the parser with the stored key.
- A second microphone press stops the active session.
- Permission denial never starts recognition or Gemini.
- Empty/no-speech completion never calls Gemini.
- Duplicate final events invoke Gemini once.
- Unmount aborts recognition and ignores late events.
- Stable error mapping never exposes a sentinel native error string.
- Native configuration contains both required iOS usage descriptions.

Run the focused suite, the full Jest suite, TypeScript validation, and an iOS
bundle export before installing on the device.

### Physical iPhone 12

1. Rebuild and reinstall VoiceBill on the connected iPhone 12.
2. Accept the microphone and speech-recognition permission prompts.
3. Speak a Vietnamese sales sentence and confirm interim words appear live.
4. Pause speaking and confirm automatic finalization opens the invoice draft.
5. Repeat and tap the microphone a second time to confirm manual stop.
6. Deny or disable permission once and verify the stable guidance message.
7. Relaunch the app and confirm the Gemini key remains in Keychain.
8. Inspect development logs for credential-like values and confirm no key is
   printed.

No Simulator result may substitute for these physical-device checks.

## Success Criteria

- Real spoken Vietnamese text appears while the user is speaking.
- Automatic and manual stop both produce a single final transcript.
- Gemini parses only that final transcript and opens the correct invoice draft.
- Permission and no-speech failures are understandable and recoverable.
- The app survives navigation, repeated taps, and late events without duplicate
  requests or stale UI.
- The physical iPhone build contains the required native permissions and does
  not expose the Gemini key.
