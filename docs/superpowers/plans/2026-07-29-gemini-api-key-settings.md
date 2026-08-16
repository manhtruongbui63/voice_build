# Gemini API Key Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, user-configurable Gemini API key flow so VoiceBill can validate and store a device owner's key, then use it when parsing a voice invoice.

**Architecture:** A focused Secure Store service owns credential persistence, while a separate Gemini client boundary owns SDK calls and error mapping. `SettingsScreen` coordinates validation and persistence; `HomeScreen` reads the key at the point of use and routes missing-key users to the new Settings tab.

**Tech Stack:** Expo 51, React Native 0.74, TypeScript 5.3, Jest 29 with `jest-expo`, Expo Secure Store, `@google/genai`, React Native Testing Library.

## Global Constraints

- Store the key only with Expo Secure Store/iOS Keychain.
- Never put the key in `EXPO_PUBLIC_*`, SQLite, source control, logs, analytics, or error text.
- Keep the API key input masked by default.
- Use `@google/genai` with `gemini-3.5-flash-lite`.
- Constrain Gemini output to `application/json` with a response JSON schema and validate the parsed value again in VoiceBill.
- A failed key validation must not overwrite a previously working key.
- Missing, rejected, rate-limited, offline, malformed-response, and unknown errors must use stable Vietnamese copy from the approved design.
- Do not add default-unit settings or redesign unrelated screens.

## File Structure

- `src/services/geminiSettingsService.ts`: the only module that reads, writes, or deletes the key in Secure Store.
- `src/services/geminiClient.ts`: Gemini SDK construction, model selection, structured generation, key validation, and safe error mapping.
- `src/services/aiParser.ts`: VoiceBill prompt construction and semantic validation of Gemini invoice JSON.
- `src/screens/SettingsScreen.tsx`: masked key entry, validation/save state, connection status, and deletion UI.
- `src/screens/HomeScreen.tsx`: point-of-use key lookup and missing-key navigation.
- `App.tsx`: fourth navigation tab and `onOpenSettings` wiring.
- `__tests__/geminiSettingsService.test.ts`: credential persistence contract.
- `__tests__/geminiClient.test.ts`: validation and error mapping contract.
- `__tests__/aiParser.test.ts`: prompt and structured invoice parsing contract.
- `__tests__/SettingsScreen.test.tsx`: Settings orchestration and credential-safety behavior.
- `__tests__/HomeScreen.test.tsx`: missing-key and configured-key microphone flows.
- `__tests__/App.test.tsx`: Settings navigation contract.

---

### Task 1: Restore a Green Test Harness and Install Feature Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `__tests__/aiParser.test.ts`
- Modify: `__tests__/db.test.ts`
- Modify: `__tests__/excelService.test.ts`

**Interfaces:**
- Consumes: existing `npm test -- --runInBand` script.
- Produces: a green Jest baseline capable of rendering React Native components and mocking Expo native modules.

- [ ] **Step 1: Repair the three pre-existing Jest failures without changing production behavior**

Add the Expo preset to `package.json`:

```json
"jest": {
  "preset": "jest-expo"
}
```

In `__tests__/aiParser.test.ts`, replace the formatting-sensitive alias assertion:

```ts
expect(instruction).toContain('"ST"');
expect(instruction).toContain('"ST25"');
```

At the top of `__tests__/db.test.ts`, before the production import, add:

```ts
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));
```

At the top of `__tests__/excelService.test.ts`, before the production import, add:

```ts
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
```

- [ ] **Step 2: Run the baseline suite**

Run:

```bash
npm test -- --runInBand
```

Expected: 3 suites pass, 4 tests pass, and no Expo ESM parse error remains.

- [ ] **Step 3: Install runtime and test dependencies**

Run:

```bash
npx expo install expo-secure-store
npm install @google/genai
npm uninstall @google/generative-ai
npm install --save-dev @testing-library/react-native@12.5.3 react-test-renderer@18.2.0
```

Confirm `package.json` contains `expo-secure-store`, `@google/genai`,
`@testing-library/react-native`, and `react-test-renderer`, and no longer
contains `@google/generative-ai`.

- [ ] **Step 4: Run the baseline suite after dependency changes**

Run:

```bash
npm test -- --runInBand
```

Expected: the same 3 suites and 4 tests pass.

- [ ] **Step 5: Commit the test harness and dependency baseline**

```bash
git add package.json package-lock.json __tests__/aiParser.test.ts __tests__/db.test.ts __tests__/excelService.test.ts
git commit -m "test: stabilize Expo service test harness"
```

---

### Task 2: Add Secure Gemini Credential Persistence

**Files:**
- Create: `src/services/geminiSettingsService.ts`
- Create: `__tests__/geminiSettingsService.test.ts`

**Interfaces:**
- Consumes: `expo-secure-store` functions `getItemAsync`, `setItemAsync`, and `deleteItemAsync`.
- Produces:
  - `getGeminiApiKey(): Promise<string | null>`
  - `saveGeminiApiKey(apiKey: string): Promise<void>`
  - `deleteGeminiApiKey(): Promise<void>`

- [ ] **Step 1: Write the failing Secure Store contract tests**

Create `__tests__/geminiSettingsService.test.ts`:

```ts
import * as SecureStore from 'expo-secure-store';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
} from '../src/services/geminiSettingsService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('geminiSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a blank key without writing to Secure Store', async () => {
    await expect(saveGeminiApiKey('   ')).rejects.toThrow(
      'Vui lòng nhập Gemini API Key'
    );
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('trims and stores a non-empty key', async () => {
    await saveGeminiApiKey('  test-key  ');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'voicebill.geminiApiKey',
      'test-key'
    );
  });

  it('reads the stored key', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('stored-key');
    await expect(getGeminiApiKey()).resolves.toBe('stored-key');
  });

  it('deletes the stored key', async () => {
    await deleteGeminiApiKey();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'voicebill.geminiApiKey'
    );
  });
});
```

- [ ] **Step 2: Run the service test and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/geminiSettingsService.test.ts
```

Expected: FAIL because `src/services/geminiSettingsService.ts` does not exist.

- [ ] **Step 3: Implement the minimal Secure Store service**

Create `src/services/geminiSettingsService.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

const GEMINI_API_KEY_STORAGE_KEY = 'voicebill.geminiApiKey';

export const getGeminiApiKey = (): Promise<string | null> =>
  SecureStore.getItemAsync(GEMINI_API_KEY_STORAGE_KEY);

export const saveGeminiApiKey = async (apiKey: string): Promise<void> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Vui lòng nhập Gemini API Key');
  }
  await SecureStore.setItemAsync(GEMINI_API_KEY_STORAGE_KEY, trimmedKey);
};

export const deleteGeminiApiKey = (): Promise<void> =>
  SecureStore.deleteItemAsync(GEMINI_API_KEY_STORAGE_KEY);
```

- [ ] **Step 4: Run the focused and full suites**

Run:

```bash
npm test -- --runInBand __tests__/geminiSettingsService.test.ts
npm test -- --runInBand
```

Expected: the focused suite passes and all suites remain green.

- [ ] **Step 5: Commit secure persistence**

```bash
git add src/services/geminiSettingsService.ts __tests__/geminiSettingsService.test.ts
git commit -m "feat: store Gemini key in Secure Store"
```

---

### Task 3: Migrate Gemini Calls and Validate Structured Invoice Output

**Files:**
- Create: `src/services/geminiClient.ts`
- Create: `__tests__/geminiClient.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/services/geminiSettingsService.ts`
- Modify: `src/services/aiParser.ts`
- Modify: `__tests__/aiParser.test.ts`

**Interfaces:**
- Consumes:
  - `GoogleGenAI` from `@google/genai`.
  - `AIParsingResult` and `Product` from `src/types`.
- Produces:
  - `GEMINI_MODEL: "gemini-3.5-flash-lite"`
  - `GeminiRequest`
  - `GeminiJsonGenerator`
  - `generateGeminiJson(apiKey: string, request: GeminiRequest): Promise<string>`
  - `validateGeminiApiKey(apiKey: string, generate?: GeminiJsonGenerator): Promise<void>`
  - `geminiSettingsService.validateGeminiApiKey` re-export for the Settings UI
  - `parseVoiceTranscript(transcript, products, apiKey, generate?): Promise<AIParsingResult>`

- [ ] **Step 1: Write failing Gemini error-mapping and validation tests**

Create `__tests__/geminiClient.test.ts`:

```ts
import {
  mapGeminiError,
  validateGeminiApiKey,
} from '../src/services/geminiClient';

describe('geminiClient', () => {
  it.each([
    [{ status: 401 }, 'API Key không hợp lệ hoặc đã bị thu hồi'],
    [{ status: 403 }, 'API Key không hợp lệ hoặc đã bị thu hồi'],
    [{ status: 429 }, 'Gemini đang giới hạn lượt sử dụng'],
    [{ name: 'TypeError', message: 'Network request failed' }, 'Không thể kết nối Gemini'],
  ])('maps API failures to safe Vietnamese messages', (failure, message) => {
    expect(mapGeminiError(failure).message).toBe(message);
  });

  it('does not include an upstream message in the unknown error', () => {
    const error = mapGeminiError(new Error('request contained secret-key'));
    expect(error.message).toBe('Không thể xử lý yêu cầu Gemini');
    expect(error.message).not.toContain('secret-key');
  });

  it('validates a key with a minimal JSON request', async () => {
    const generate = jest.fn().mockResolvedValue('{"ok":true}');
    await validateGeminiApiKey('test-key', generate);
    expect(generate).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
        prompt: expect.stringContaining('ok'),
      })
    );
  });

  it('rejects a blank key before calling Gemini', async () => {
    const generate = jest.fn();
    await expect(validateGeminiApiKey('   ', generate)).rejects.toThrow(
      'Vui lòng nhập Gemini API Key'
    );
    expect(generate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Add failing parser tests for generator injection and malformed output**

Append to `__tests__/aiParser.test.ts`:

```ts
it('passes the key and structured request to the Gemini boundary', async () => {
  const generate = jest.fn().mockResolvedValue(
    JSON.stringify({ matched_items: [], unmatched_text: [] })
  );

  await parseVoiceTranscript('1kg ST', sampleProducts, 'test-key', generate);

  expect(generate).toHaveBeenCalledWith(
    'test-key',
    expect.objectContaining({
      systemInstruction: expect.stringContaining('Gạo ST25'),
      responseJsonSchema: expect.objectContaining({ type: 'object' }),
    })
  );
});

it('rejects semantically invalid Gemini output', async () => {
  const generate = jest.fn().mockResolvedValue('{"matched_items":"wrong"}');
  await expect(
    parseVoiceTranscript('1kg ST', sampleProducts, 'test-key', generate)
  ).rejects.toThrow('Gemini trả về dữ liệu không hợp lệ');
});
```

Update the test import to include `parseVoiceTranscript`.

- [ ] **Step 3: Run both focused suites and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/geminiClient.test.ts __tests__/aiParser.test.ts
```

Expected: FAIL because `geminiClient.ts` is missing and the parser does not accept an injected generator.

- [ ] **Step 4: Implement the Gemini client boundary**

Create `src/services/geminiClient.ts` with these public types and behavior:

```ts
import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite' as const;

export interface GeminiRequest {
  prompt: string;
  systemInstruction?: string;
  responseJsonSchema: Record<string, unknown>;
}

export type GeminiJsonGenerator = (
  apiKey: string,
  request: GeminiRequest
) => Promise<string>;

export const mapGeminiError = (error: unknown): Error => {
  const candidate = error as {
    status?: number;
    name?: string;
    message?: string;
  };

  if (candidate.status === 401 || candidate.status === 403) {
    return new Error('API Key không hợp lệ hoặc đã bị thu hồi');
  }
  if (candidate.status === 429) {
    return new Error('Gemini đang giới hạn lượt sử dụng');
  }
  if (
    candidate.name === 'TypeError' ||
    candidate.message?.toLowerCase().includes('network')
  ) {
    return new Error('Không thể kết nối Gemini');
  }
  return new Error('Không thể xử lý yêu cầu Gemini');
};

export const generateGeminiJson: GeminiJsonGenerator = async (
  apiKey,
  request
) => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: request.prompt,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: request.responseJsonSchema,
      },
    });
    if (!response.text) {
      throw new Error('empty Gemini response');
    }
    return response.text;
  } catch (error) {
    throw mapGeminiError(error);
  }
};

export const validateGeminiApiKey = async (
  apiKey: string,
  generate: GeminiJsonGenerator = generateGeminiJson
): Promise<void> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Vui lòng nhập Gemini API Key');
  }
  await generate(trimmedKey, {
    prompt: 'Trả về JSON có trường ok bằng true.',
    responseJsonSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    },
  });
};
```

- [ ] **Step 5: Expose validation through the approved settings-service interface**

Append to `src/services/geminiSettingsService.ts`:

```ts
export { validateGeminiApiKey } from './geminiClient';
```

- [ ] **Step 6: Migrate `aiParser.ts` to the Gemini boundary**

Remove the `@google/generative-ai` import. Import
`generateGeminiJson`, `GeminiJsonGenerator`, and define a concrete
`INVOICE_RESPONSE_SCHEMA` with:

```ts
const INVOICE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    matched_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          product_id: { type: 'integer' },
          product_name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'product_id',
          'product_name',
          'quantity',
          'unit',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
    unmatched_text: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['matched_items', 'unmatched_text'],
  additionalProperties: false,
} as const;
```

Change `parseVoiceTranscript` to:

```ts
export const parseVoiceTranscript = async (
  transcript: string,
  products: Product[],
  apiKey: string,
  generate: GeminiJsonGenerator = generateGeminiJson
): Promise<AIParsingResult> => {
  if (!apiKey.trim()) {
    throw new Error('Chưa có Gemini API Key');
  }

  const responseText = await generate(apiKey, {
    prompt: `Ghi âm giọng nói người dùng: "${transcript}"`,
    systemInstruction: buildGeminiSystemInstruction(products),
    responseJsonSchema: INVOICE_RESPONSE_SCHEMA,
  });
  return parseAIResponse(responseText);
};
```

Replace the permissive response parser with semantic guards:

```ts
type ParsedMatchedItem = AIParsingResult['matched_items'][number];

const isMatchedItem = (value: unknown): value is ParsedMatchedItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.product_id === 'number' &&
    typeof item.product_name === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.unit === 'string' &&
    typeof item.confidence === 'number' &&
    item.confidence >= 0 &&
    item.confidence <= 1
  );
};

export const parseAIResponse = (responseText: string): AIParsingResult => {
  try {
    const jsonText = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const value: unknown = JSON.parse(jsonText);
    if (!value || typeof value !== 'object') {
      throw new Error('invalid object');
    }

    const parsed = value as Record<string, unknown>;
    if (
      !Array.isArray(parsed.matched_items) ||
      !parsed.matched_items.every(isMatchedItem) ||
      (parsed.unmatched_text !== undefined &&
        (!Array.isArray(parsed.unmatched_text) ||
          !parsed.unmatched_text.every((item) => typeof item === 'string')))
    ) {
      throw new Error('invalid schema');
    }

    return {
      matched_items: parsed.matched_items,
      unmatched_text: (parsed.unmatched_text as string[] | undefined) ?? [],
    };
  } catch {
    throw new Error('Gemini trả về dữ liệu không hợp lệ');
  }
};
```

The thrown error never includes the raw response text.

- [ ] **Step 7: Remove the legacy SDK in the same production-migration task**

Run:

```bash
npm uninstall @google/generative-ai
rg -n "@google/generative-ai" src package.json
```

Expected: npm removes the legacy dependency and `rg` returns no production or
manifest references. `@google/genai` remains installed.

- [ ] **Step 8: Run focused tests, typecheck, and the full suite**

Run:

```bash
npm test -- --runInBand __tests__/geminiClient.test.ts __tests__/aiParser.test.ts
npx tsc --noEmit
npm test -- --runInBand
```

Expected: focused tests pass, TypeScript exits 0, and the full suite remains green.

- [ ] **Step 9: Commit the Gemini SDK migration**

```bash
git add package.json package-lock.json src/services/geminiClient.ts src/services/geminiSettingsService.ts src/services/aiParser.ts __tests__/geminiClient.test.ts __tests__/aiParser.test.ts
git commit -m "feat: validate Gemini keys and structured output"
```

---

### Task 4: Build the API Key Settings Screen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Create: `__tests__/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `getGeminiApiKey`, `saveGeminiApiKey`, `deleteGeminiApiKey`
  - `validateGeminiApiKey`
- Produces: `SettingsScreen: React.FC` with masked input and deterministic test IDs.

- [ ] **Step 1: Write failing Settings screen tests**

Create `__tests__/SettingsScreen.test.tsx`:

```tsx
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
} from '../src/services/geminiSettingsService';

jest.mock('../src/services/geminiSettingsService');

const mockedGet = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedSave = saveGeminiApiKey as jest.MockedFunction<typeof saveGeminiApiKey>;
const mockedDelete = deleteGeminiApiKey as jest.MockedFunction<typeof deleteGeminiApiKey>;
const mockedValidate = validateGeminiApiKey as jest.MockedFunction<typeof validateGeminiApiKey>;

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue(null);
    mockedValidate.mockResolvedValue();
    mockedSave.mockResolvedValue();
    mockedDelete.mockResolvedValue();
  });

  it('keeps the API key input masked', () => {
    const { getByTestId } = render(<SettingsScreen />);
    expect(getByTestId('gemini-api-key-input').props.secureTextEntry).toBe(true);
  });

  it('validates before saving the trimmed key', async () => {
    const { getByTestId, getByText } = render(<SettingsScreen />);
    fireEvent.changeText(getByTestId('gemini-api-key-input'), '  test-key  ');
    fireEvent.press(getByText('Kiểm tra & Lưu'));

    await waitFor(() => expect(mockedValidate).toHaveBeenCalledWith('test-key'));
    expect(mockedSave).toHaveBeenCalledWith('test-key');
    expect(getByText('Đã kết nối')).toBeTruthy();
  });

  it('does not overwrite the stored key when validation fails', async () => {
    mockedValidate.mockRejectedValue(new Error('API Key không hợp lệ hoặc đã bị thu hồi'));
    const { getByTestId, getByText } = render(<SettingsScreen />);
    fireEvent.changeText(getByTestId('gemini-api-key-input'), 'bad-key');
    fireEvent.press(getByText('Kiểm tra & Lưu'));

    await waitFor(() =>
      expect(getByText('API Key không hợp lệ hoặc đã bị thu hồi')).toBeTruthy()
    );
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('deletes the key after confirmation', async () => {
    mockedGet.mockResolvedValue('stored-key');
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Xóa')?.onPress?.();
    });
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => expect(getByText('Xóa API Key')).toBeTruthy());
    fireEvent.press(getByText('Xóa API Key'));
    await waitFor(() => expect(mockedDelete).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run the screen test and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/SettingsScreen.test.tsx
```

Expected: FAIL because `SettingsScreen` does not exist.

- [ ] **Step 3: Implement the Settings screen**

Create `src/screens/SettingsScreen.tsx` as a focused controlled form:

```tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
} from '../services/geminiSettingsService';

export const SettingsScreen: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    getGeminiApiKey().then((storedKey) => {
      setHasStoredKey(Boolean(storedKey));
      if (storedKey) setMessage('Đã kết nối');
    });
  }, []);

  const handleSave = async () => {
    const trimmedKey = apiKey.trim();
    setIsSaving(true);
    setIsError(false);
    setMessage('');
    try {
      await validateGeminiApiKey(trimmedKey);
      await saveGeminiApiKey(trimmedKey);
      setApiKey('');
      setHasStoredKey(true);
      setMessage('Đã kết nối');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu Gemini');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Xóa API Key', 'VoiceBill sẽ không thể phân tích hóa đơn bằng AI cho đến khi bạn thêm key mới.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await deleteGeminiApiKey();
          setApiKey('');
          setHasStoredKey(false);
          setIsError(false);
          setMessage('Đã xóa API Key');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cài đặt Gemini</Text>
      <Text style={styles.description}>
        Tạo API key trong Google AI Studio rồi dán vào đây. Key chỉ được lưu trong Keychain trên thiết bị này.
      </Text>
      <TextInput
        testID="gemini-api-key-input"
        value={apiKey}
        onChangeText={setApiKey}
        placeholder={hasStoredKey ? 'Nhập key mới để thay thế' : 'Dán Gemini API Key'}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
      />
      <TouchableOpacity
        disabled={isSaving}
        onPress={handleSave}
        style={[styles.primaryButton, isSaving && styles.disabledButton]}
      >
        {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Kiểm tra & Lưu</Text>}
      </TouchableOpacity>
      {message ? <Text style={isError ? styles.errorText : styles.successText}>{message}</Text> : null}
      {hasStoredKey ? (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>Xóa API Key</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
```

Use these local styles:

```ts
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  successText: {
    color: '#059669',
    marginTop: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    marginTop: 14,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
```

Do not render the stored key back into the input and do not add a logging
statement.

- [ ] **Step 4: Run focused tests, typecheck, and full tests**

Run:

```bash
npm test -- --runInBand __tests__/SettingsScreen.test.tsx
npx tsc --noEmit
npm test -- --runInBand
```

Expected: Settings tests pass, TypeScript exits 0, and the full suite remains green.

- [ ] **Step 5: Commit the Settings screen**

```bash
git add src/screens/SettingsScreen.tsx __tests__/SettingsScreen.test.tsx
git commit -m "feat: add secure Gemini settings screen"
```

---

### Task 5: Route Missing-Key Voice Users to Settings

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `App.tsx`
- Create: `__tests__/HomeScreen.test.tsx`
- Create: `__tests__/App.test.tsx`

**Interfaces:**
- Consumes:
  - `getGeminiApiKey(): Promise<string | null>`
  - existing `parseVoiceTranscript(...)`
  - `SettingsScreen`
- Produces:
  - `HomeScreenProps { onOpenSettings: () => void }`
  - `activeTab: "home" | "products" | "history" | "settings"`

- [ ] **Step 1: Write the failing Home missing-key test**

Create `__tests__/HomeScreen.test.tsx` with native dependencies mocked:

```tsx
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';
import { getGeminiApiKey } from '../src/services/geminiSettingsService';
import { parseVoiceTranscript } from '../src/services/aiParser';

jest.mock('../src/services/geminiSettingsService');
jest.mock('../src/services/aiParser');
jest.mock('../src/services/db', () => ({ getProductsFromDB: jest.fn(() => []) }));
jest.mock('../src/components/DraftInvoiceModal', () => ({
  DraftInvoiceModal: () => null,
}));

const mockedGetKey = getGeminiApiKey as jest.MockedFunction<typeof getGeminiApiKey>;
const mockedParse = parseVoiceTranscript as jest.MockedFunction<typeof parseVoiceTranscript>;

describe('HomeScreen Gemini configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not record or parse without a stored key and can open Settings', async () => {
    mockedGetKey.mockResolvedValue(null);
    const onOpenSettings = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Mở Cài đặt')?.onPress?.();
    });

    const { getByTestId } = render(<HomeScreen onOpenSettings={onOpenSettings} />);
    fireEvent.press(getByTestId('voice-microphone-button'));

    await waitFor(() => expect(onOpenSettings).toHaveBeenCalled());
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('passes the stored key to the parser after the recording delay', async () => {
    jest.useFakeTimers();
    mockedGetKey.mockResolvedValue('stored-key');
    mockedParse.mockResolvedValue({ matched_items: [], unmatched_text: [] });

    const { getByTestId } = render(
      <HomeScreen onOpenSettings={jest.fn()} />
    );
    fireEvent.press(getByTestId('voice-microphone-button'));
    await waitFor(() => expect(mockedGetKey).toHaveBeenCalled());

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    await waitFor(() =>
      expect(mockedParse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        'stored-key'
      )
    );
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Write the failing navigation test**

Create `__tests__/App.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';

jest.mock('../src/services/db', () => ({ initDB: jest.fn() }));
jest.mock('../src/screens/HomeScreen', () => ({ HomeScreen: () => null }));
jest.mock('../src/screens/ProductCatalogScreen', () => ({ ProductCatalogScreen: () => null }));
jest.mock('../src/screens/InvoiceHistoryScreen', () => ({ InvoiceHistoryScreen: () => null }));
jest.mock('../src/screens/SettingsScreen', () => ({
  SettingsScreen: () => {
    const { Text } = require('react-native');
    return <Text>Cài đặt Gemini</Text>;
  },
}));

it('opens the Settings tab', () => {
  const { getByText } = render(<App />);
  fireEvent.press(getByText('Cài đặt'));
  expect(getByText('Cài đặt Gemini')).toBeTruthy();
});
```

- [ ] **Step 3: Run both component suites and verify RED**

Run:

```bash
npm test -- --runInBand __tests__/HomeScreen.test.tsx __tests__/App.test.tsx
```

Expected: FAIL because Home has no `onOpenSettings` contract or microphone
test ID and App has no Settings tab.

- [ ] **Step 4: Implement point-of-use key lookup in Home**

In `src/screens/HomeScreen.tsx`:

```ts
interface HomeScreenProps {
  onOpenSettings: () => void;
}
```

Accept the props, remove `process.env.EXPO_PUBLIC_GEMINI_API_KEY`, and import
`getGeminiApiKey`. Add `testID="voice-microphone-button"` to the existing
microphone `TouchableOpacity`.

Change the parser helper signature so the key is request-local:

```ts
const handleSimulatedVoiceTest = async (
  testVoiceString: string,
  apiKey: string
) => {
  setTranscript(testVoiceString);
  setLoading(true);
  try {
    const products = getProductsFromDB();
    const result = await parseVoiceTranscript(testVoiceString, products, apiKey);
    const mappedItems: MatchedItem[] = result.matched_items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.product_id);
      const unitPrice = product?.unit_price ?? 0;
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: unitPrice,
        amount: item.quantity * unitPrice,
        confidence: item.confidence,
      };
    });
    setMatchedItems(mappedItems);
    setDraftVisible(true);
  } catch (err: unknown) {
    Alert.alert(
      'Lỗi phân tích AI',
      err instanceof Error ? err.message : 'Không thể gọi Gemini API'
    );
  } finally {
    setLoading(false);
  }
};
```

Add this microphone handler:

```ts
const handleMicrophonePress = async () => {
  if (isRecording || loading) return;

  try {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      Alert.alert(
        'Chưa có Gemini API Key',
        'Hãy thêm API Key để VoiceBill có thể phân tích hóa đơn.',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở Cài đặt', onPress: onOpenSettings },
        ]
      );
      return;
    }

    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      void handleSimulatedVoiceTest(
        'bán cho chị 1kg ST, à không lấy 2kg ST với 2 cân rưỡi Bắc Hướng',
        apiKey
      );
    }, 2500);
  } catch {
    Alert.alert(
      'Không thể đọc API Key',
      'Hãy mở Cài đặt và lưu lại Gemini API Key.'
    );
  }
};
```

Set the microphone button to `onPress={handleMicrophonePress}`. Keep the key in
the timeout closure for that request only; do not put it in rendered state.

- [ ] **Step 5: Add Settings navigation**

In `App.tsx`:

```ts
import { SettingsScreen } from './src/screens/SettingsScreen';

type ActiveTab = 'home' | 'products' | 'history' | 'settings';
```

Render:

```tsx
{activeTab === 'home' && (
  <HomeScreen onOpenSettings={() => setActiveTab('settings')} />
)}
{activeTab === 'settings' && <SettingsScreen />}
```

Add a fourth navigation button whose visible text is exactly `Cài đặt`. Do not
add an emoji because the active Simulator runtime is missing
`AppleColorEmoji.ttc`.

- [ ] **Step 6: Run focused tests, typecheck, and full tests**

Run:

```bash
npm test -- --runInBand __tests__/HomeScreen.test.tsx __tests__/App.test.tsx
npx tsc --noEmit
npm test -- --runInBand
```

Expected: focused tests pass, TypeScript exits 0, and the full suite is green.

- [ ] **Step 7: Commit Home and navigation integration**

```bash
git add App.tsx src/screens/HomeScreen.tsx __tests__/HomeScreen.test.tsx __tests__/App.test.tsx
git commit -m "feat: route Gemini setup through Settings"
```

---

### Task 6: Verify on iOS Simulator and Hand Off Key Creation

**Files:**
- Modify only if verification reveals a defect directly caused by Tasks 1-5.

**Interfaces:**
- Consumes: the complete app and the user's own Gemini API key.
- Produces: verified build, green automated suite, and explicit manual steps that never expose the key in chat.

- [ ] **Step 1: Run fresh automated verification**

Run:

```bash
npm test -- --runInBand
npx tsc --noEmit
```

Expected: all suites pass and TypeScript exits 0.

- [ ] **Step 2: Build and launch iOS**

Run:

```bash
npm run ios
```

Expected: native build succeeds with 0 errors, Metro bundles `index.js`, and
VoiceBill opens on the booted iPhone Simulator.

- [ ] **Step 3: Verify the missing-key flow before using a real credential**

On Simulator:

1. Open `Cài đặt`.
2. Confirm the API key input is blank and masked.
3. Enter `invalid-key`, press `Kiểm tra & Lưu`, and confirm it is rejected.
4. Return to Home, press the microphone, choose `Mở Cài đặt`, and confirm the
   Settings screen opens.

Expected: the invalid key is not persisted and no credential appears in Metro
or native logs.

- [ ] **Step 4: Let the user create and enter their key privately**

Direct the user to
[Google AI Studio API Keys](https://aistudio.google.com/app/apikey). The user
must create the key and paste it into the Simulator themselves. Do not request
the value in chat and do not type it through a recorded tool call.

- [ ] **Step 5: Verify the real Gemini flow with the user-entered key**

After the user confirms the key is saved:

1. Press the microphone.
2. Wait for the simulated Vietnamese transcript.
3. Confirm Gemini returns a valid invoice draft.
4. Relaunch the app and repeat once to prove Keychain persistence.
5. Search development logs for common API-key prefixes and confirm no key was
   printed.

Expected: the draft opens, persistence survives relaunch, and logs contain no
credential.

- [ ] **Step 6: Record verification evidence**

Capture:

- Jest suite/test counts.
- TypeScript exit status.
- iOS build error/warning counts.
- Metro bundle completion.
- Simulator screenshot of Settings showing `Đã kết nối` with the input empty.
- Simulator screenshot of the resulting invoice draft.

Do not capture a screenshot while the key input contains text.
