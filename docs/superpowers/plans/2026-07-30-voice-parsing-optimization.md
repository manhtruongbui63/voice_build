# Voice Parsing Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the speed and accuracy of the Vietnamese voice-to-text and AI parsing pipeline by introducing native contextual biasing and AI few-shot prompt tuning.

**Architecture:** We will inject an array of product names and aliases (`contextualStrings`) into the native `expo-speech-recognition` hook. Then, we will append concrete JSON few-shot examples to the Gemini system prompt to bypass exploratory formatting logic.

**Tech Stack:** React Native 0.74, Expo SDK 51, TypeScript 5.3, `expo-speech-recognition`, Jest 29.

## Global Constraints

- No Simulator may be booted or used; runtime verification is only on device `00008101-001130A63406001E`.
- Do not modify existing Gemini API request structure besides the system instruction string.
- The contextual strings array must include both `name` and `aliases` for all products, flattened.
- Do not use any placeholders (TBD, TODO). All tests must be exact and self-contained.

---

### Task 1: Add Contextual Biasing to the Recognition Hook

**Files:**
- Modify: `src/hooks/useVoiceInvoiceRecognition.ts`
- Modify: `__tests__/useVoiceInvoiceRecognition.test.tsx`

**Interfaces:**
- Consumes: `ExpoSpeechRecognitionModule.start(options)` where options includes `contextualStrings`.
- Produces: `VoiceInvoiceRecognitionOptions` interface updated to include `contextualStrings?: string[]`.

- [ ] **Step 1: Write the failing test**

```tsx
// In __tests__/useVoiceInvoiceRecognition.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand __tests__/useVoiceInvoiceRecognition.test.tsx -t "passes contextualStrings"`
Expected: FAIL, missing `contextualStrings` in `start` options.

- [ ] **Step 3: Write minimal implementation**

Update `VoiceInvoiceRecognitionOptions` in `src/hooks/useVoiceInvoiceRecognition.ts`:
```ts
interface VoiceInvoiceRecognitionOptions {
  onFinalTranscript: (transcript: string) => void;
  onError: (code: VoiceRecognitionErrorCode) => void;
  contextualStrings?: string[];
}
```
Update the destructured parameter:
```ts
export const useVoiceInvoiceRecognition = ({
  onFinalTranscript,
  onError,
  contextualStrings,
}: VoiceInvoiceRecognitionOptions): VoiceInvoiceRecognition => {
```
Update the `start` call:
```ts
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'vi-VN',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        ...(contextualStrings && { contextualStrings }),
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand __tests__/useVoiceInvoiceRecognition.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVoiceInvoiceRecognition.ts __tests__/useVoiceInvoiceRecognition.test.tsx
git commit -m "feat: add contextualStrings support to voice hook"
```

---

### Task 2: Inject Product Aliases in HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `__tests__/HomeScreenSpeechRecognition.test.tsx`

**Interfaces:**
- Consumes: `getProductsFromDB()` from `src/services/db`.
- Produces: A flattened array of product names and aliases passed into `useVoiceInvoiceRecognition`.

- [ ] **Step 1: Write the failing test**

```tsx
// In __tests__/HomeScreenSpeechRecognition.test.tsx
import { getProductsFromDB } from '../src/services/db';

// Update the jest.mock for db to include aliases:
jest.mock('../src/services/db', () => ({
  getProductsFromDB: jest.fn(() => [
    { id: 1, name: 'Gạo ST25', aliases: 'st25, gạo sóc trăng' },
    { id: 2, name: 'Bắc Hương', aliases: '' }
  ]),
}));

it('passes flattened product names and aliases as contextualStrings', () => {
  render(<HomeScreen onOpenSettings={jest.fn()} />);
  expect(mockHandlers.contextualStrings).toEqual(['Gạo ST25', 'st25', 'gạo sóc trăng', 'Bắc Hương']);
});
```
Update `mockHandlers` in `__tests__/HomeScreenSpeechRecognition.test.tsx`:
```tsx
let mockHandlers: {
  onFinalTranscript: (transcript: string) => void;
  onError: (code: VoiceRecognitionErrorCode) => void;
  contextualStrings?: string[];
};
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand __tests__/HomeScreenSpeechRecognition.test.tsx -t "passes flattened product names"`
Expected: FAIL, `contextualStrings` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/screens/HomeScreen.tsx`:
```tsx
  const productContextStrings = React.useMemo(() => {
    try {
      const products = getProductsFromDB();
      return products.flatMap(p => {
        const aliases = p.aliases ? p.aliases.split(',').map(a => a.trim()).filter(Boolean) : [];
        return [p.name, ...aliases];
      });
    } catch {
      return [];
    }
  }, []);

  const recognition = useVoiceInvoiceRecognition({
    onFinalTranscript: handleFinalTranscript,
    onError: handleRecognitionError,
    contextualStrings: productContextStrings,
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand __tests__/HomeScreenSpeechRecognition.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx __tests__/HomeScreenSpeechRecognition.test.tsx
git commit -m "feat: inject product aliases as speech contextual strings"
```

---

### Task 3: Apply Few-Shot Prompt Tuning in AI Parser

**Files:**
- Modify: `src/services/aiParser.ts`
- Modify: `__tests__/aiParser.test.ts`

**Interfaces:**
- Consumes: The existing `INVOICE_RESPONSE_SCHEMA`.
- Produces: An updated system instruction string with concrete examples.

- [ ] **Step 1: Write the failing test**

```tsx
// In __tests__/aiParser.test.ts
it('includes few-shot examples in the system instruction', () => {
  const instruction = buildGeminiSystemInstruction([]);
  expect(instruction).toContain('VÍ DỤ MẪU (FEW-SHOT EXAMPLES):');
  expect(instruction).toContain('cho 2 cân gạo ST');
  expect(instruction).toContain('lấy 1 túi Bắc Hương, à thôi lấy 2 túi đi');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand __tests__/aiParser.test.ts -t "few-shot"`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

In `src/services/aiParser.ts`, update the returned string in `buildGeminiSystemInstruction`:
```ts
return \`Bạn là trợ lý AI thông minh cho ứng dụng bán lẻ VoiceBill. Nhiệm vụ của bạn là bóc tách thông tin sản phẩm và số lượng từ văn bản giọng nói tiếng Việt của người bán hàng.

DANH SÁCH SẢN PHẨM HỢP LỆ (AVAILABLE PRODUCTS):
\${JSON.stringify(catalogList, null, 2)}

QUY TẮC BẮT BUỘC:
1. BẠN CHỈ ĐƯỢC PHÉP KHỚP VỚI CÁC SẢN PHẨM TRONG DANH SÁCH CÓ SẴN Ở TRÊN (Dựa vào field 'name' hoặc 'aliases').
2. XỬ LÝ ĐÍNH CHÍNH / SỬA KHẨU LỆNH:
   - Nếu xuất hiện các từ đính chính như "à không", "thôi bỏ", "nhầm", "sửa thành", hãy cập nhật lại số lượng mới hoặc loại bỏ sản phẩm đứng trước đó.
3. QUY ĐỔI ĐẠI LƯỢNG SỐ LƯỢNG TIẾNG VIỆT:
   - "nửa cân", "nửa ký" -> 0.5
   - "lạng" -> 0.1
   - "yến" -> 10
   - "tạ" -> 100
   - "chục cân" -> 10
   - "cân", "ký", "kg", "kí", "quả", "túi" -> quy đổi ra số thực (ví dụ "2 cân rưỡi" -> 2.5).
4. CHỈ SỐ TIN CẬY (CONFIDENCE):
   - Trả về 'confidence' từ 0.0 đến 1.0 cho mỗi sản phẩm.
   - Nếu từ đọc bị lệch âm nhẹ (ví dụ "Bắc Hướng" -> "Bắc Hương"), gán confidence = 0.6.
5. Trả về đúng định dạng JSON Schema yêu cầu.

VÍ DỤ MẪU (FEW-SHOT EXAMPLES):
- Giọng nói: "cho 2 cân gạo ST"
  JSON: {"matched_items": [{"product_id": 1, "product_name": "Gạo ST25", "quantity": 2, "unit": "kg", "confidence": 0.9}], "unmatched_text": []}

- Giọng nói: "lấy 1 túi Bắc Hương, à thôi lấy 2 túi đi"
  JSON: {"matched_items": [{"product_id": 2, "product_name": "Bắc Hương", "quantity": 2, "unit": "túi", "confidence": 0.95}], "unmatched_text": []}\`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand __tests__/aiParser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/aiParser.ts __tests__/aiParser.test.ts
git commit -m "feat: add few-shot examples to gemini prompt"
```
