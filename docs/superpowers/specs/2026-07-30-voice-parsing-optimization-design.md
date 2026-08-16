# Voice Parsing Optimization Design

**Goal:** Improve the speed and accuracy of the Vietnamese voice-to-text and AI parsing pipeline by introducing native contextual biasing and AI few-shot prompt tuning.

## Architecture & Data Flow

1. **Native Speech Contextual Biasing:**
   - The `useVoiceInvoiceRecognition` hook will accept an array of strings called `contextualStrings`.
   - `HomeScreen` will map the SQLite `Product` database into a flat array of `name` and `aliases`.
   - This array will be passed into the hook and ultimately forwarded to `ExpoSpeechRecognitionModule.start({ contextualStrings })`.
   - **Result:** iOS and Android speech recognition engines will heavily bias their phonetic matching toward the provided product names, filtering out homophones and general vocabulary noise.

2. **Gemini Few-Shot Prompt Tuning:**
   - The system prompt in `buildGeminiSystemInstruction` (`src/services/aiParser.ts`) will be updated to include 2-3 explicit few-shot examples.
   - Example 1 (Simple): Direct mapping of text to JSON.
   - Example 2 (Complex/Correction): Mapping text with "à không", "nhầm" to demonstrate quantity/product correction in JSON.
   - **Result:** By providing concrete input/output examples, the LLM (`gemini-1.5-flash`) bypasses exploratory formatting logic, drastically reducing Time To First Token (TTFT) and increasing JSON schema compliance.

## Components Modified

1. **`src/hooks/useVoiceInvoiceRecognition.ts`**
   - Add `contextualStrings?: string[]` to `VoiceInvoiceRecognitionOptions`.
   - Pass `contextualStrings` to `ExpoSpeechRecognitionModule.start({ ..., contextualStrings })`.

2. **`src/screens/HomeScreen.tsx`**
   - Extract product names and aliases into a `useMemo` string array.
   - Pass the array into the `useVoiceInvoiceRecognition` hook.

3. **`src/services/aiParser.ts`**
   - Append "VÍ DỤ MẪU (FEW-SHOT EXAMPLES)" section to the system prompt in `buildGeminiSystemInstruction`.

## Error Handling & Edge Cases

- **Massive Product Catalogs:** If the product database grows beyond typical API limits for `contextualStrings` (e.g., thousands of items), the native speech module might ignore them or crash. In this phase, we assume a reasonable SMB catalog size (e.g., < 500 items).
- **Prompt Token Limits:** Adding few-shot examples increases the system instruction size marginally. This is negligible for modern LLMs context windows and is offset by the speed gain.

## Testing

- Unit tests for the hook must verify that `contextualStrings` is correctly passed to the mock `ExpoSpeechRecognitionModule.start`.
- Unit tests for the AI parser must verify that the generated prompt includes the few-shot examples.
