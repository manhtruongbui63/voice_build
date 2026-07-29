# VoiceBill Gemini API Key Settings Design

**Date:** 2026-07-29
**Status:** Approved

## Problem

The Voice Billing screen calls Gemini with
`process.env.EXPO_PUBLIC_GEMINI_API_KEY`. The current project has no configured
key, so tapping the microphone always ends with:

> Chưa cài đặt Gemini API Key trong Cài đặt.

The message points to a Settings screen that does not exist. In addition, an
`EXPO_PUBLIC_*` value would be embedded in the application bundle and is not an
appropriate place to persist a user's API credential.

## Goal

Let the device owner create their own Gemini API key, enter it inside VoiceBill,
validate it, and store it in the device keychain. The Voice Billing flow must
load that stored key before calling Gemini and provide actionable Vietnamese
errors when configuration or connectivity is invalid.

## Scope

### Included

- A new `Cài đặt` navigation tab.
- A masked Gemini API key input.
- `Kiểm tra & Lưu` and `Xóa API Key` actions.
- Key storage through Expo Secure Store and iOS Keychain.
- A small settings service that owns read, validate, save, and delete behavior.
- Migration from the legacy `@google/generative-ai` client and obsolete
  `gemini-1.5-flash` model to `@google/genai` and
  `gemini-3.5-flash-lite`, a current stable model suitable for structured
  extraction.
- Voice Billing integration that loads the credential from secure storage.
- Vietnamese error messages for missing key, rejected key, quota/rate limit,
  network failure, and unexpected API responses.
- Automated tests for the settings service, Gemini client boundary, and
  microphone-to-parser configuration flow.

### Not Included

- Creating or managing the user's Google account.
- Sending an API key through chat, logs, analytics, source control, or SQLite.
- A shared server-side Gemini proxy.
- Default measurement-unit settings.
- General redesign of the existing navigation or Voice Billing screen.

## Architecture

### Settings Screen

`SettingsScreen` owns presentation state only:

- masked API key input;
- optional reveal/hide control;
- connection status;
- save/test progress;
- delete confirmation;
- concise Vietnamese success and failure messages.

It delegates credential and Gemini operations to services and never logs the
key.

### Secure Settings Service

`geminiSettingsService` is the only module allowed to persist the key. It
exposes a narrow interface:

```ts
getGeminiApiKey(): Promise<string | null>
validateGeminiApiKey(apiKey: string): Promise<void>
saveGeminiApiKey(apiKey: string): Promise<void>
deleteGeminiApiKey(): Promise<void>
```

The service stores the credential with `expo-secure-store`. Validation trims
the input, rejects an empty value locally, and performs a minimal Gemini request
before persistence. A failed validation never overwrites a previously working
key.

### Gemini Parser

The parser receives an API key explicitly from its caller; it does not read
global environment variables. Gemini client creation is isolated behind a
small boundary so tests can exercise error mapping without making live network
requests.

The implementation will use `@google/genai` with
`gemini-3.5-flash-lite`. Structured JSON output will be constrained with
`responseMimeType: "application/json"` and a response JSON schema, then
validated again inside VoiceBill before invoice mapping.

### App Navigation

`App` adds a fourth `Cài đặt` tab. When Home mounts or returns to the foreground,
it loads the key from secure storage. Pressing the microphone without a stored
key produces an action that navigates directly to Settings instead of referring
to a nonexistent destination.

## Data Flow

### Configure Key

1. User opens `Cài đặt`.
2. User pastes a Gemini API key and taps `Kiểm tra & Lưu`.
3. Settings validates the non-empty value.
4. Gemini receives a minimal validation request.
5. On success, Secure Store persists the key and Settings displays
   `Đã kết nối`.
6. On failure, the old stored key remains unchanged and the UI displays an
   actionable Vietnamese error.

### Parse Voice Transcript

1. User taps the microphone.
2. Home obtains the latest key from Secure Store.
3. If absent, Home offers to open `Cài đặt`.
4. If present, Home passes the transcript, catalog, and key to the parser.
5. Gemini returns structured JSON.
6. The parser validates and maps the response into the existing invoice draft.

## Error Handling

The Gemini client boundary maps failures into stable application errors:

- missing key: `Chưa có Gemini API Key`;
- authentication/rejected key: `API Key không hợp lệ hoặc đã bị thu hồi`;
- quota/rate limit: `Gemini đang giới hạn lượt sử dụng`;
- offline/timeout: `Không thể kết nối Gemini`;
- malformed response: `Gemini trả về dữ liệu không hợp lệ`;
- unknown failure: a safe generic message without credential or payload data.

Settings shows validation failures inline. Home continues using an alert for
runtime parsing failures, preserving the existing interaction pattern.

## Security and Privacy

- Store the key only with Secure Store/Keychain.
- Never place the key in an `EXPO_PUBLIC_*` environment variable.
- Never print the key or include it in error text.
- Keep the input masked by default.
- Do not copy an existing environment key automatically.
- Deleting the key removes it from Secure Store and immediately disables Gemini
  parsing until a new key is validated.
- The direct-to-Gemini architecture is intended for a device owner using their
  own key. A shared production key would require a server-side proxy, which is
  outside this change.

## Testing

### Automated

- Settings service rejects blank keys.
- Successful validation persists the trimmed key.
- Failed validation preserves the previous key.
- Stored key can be read and deleted.
- Gemini API errors map to the expected Vietnamese application errors.
- Home does not call the parser when no key exists.
- Home passes the stored key to the parser when configured.
- Existing parser response and invoice draft tests remain green.

### Manual

1. Create a Gemini API key in Google AI Studio without sharing it in chat.
2. Enter an invalid key and verify it is rejected and not saved.
3. Enter the valid key and verify `Đã kết nối`.
4. Leave Settings, tap the microphone, and confirm an invoice draft appears.
5. Relaunch the app and confirm the stored key still works.
6. Delete the key and confirm Home routes back to Settings on the next attempt.

## External References

- [Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
