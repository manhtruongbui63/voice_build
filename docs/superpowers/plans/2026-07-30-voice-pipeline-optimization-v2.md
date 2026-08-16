# Voice Pipeline Optimization v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tăng độ chính xác STT (nhiều phương án đọc + sửa hiển thị) và tăng tốc Gemini (tắt thinking + prompt shortlist), thêm fast-path parse cục bộ và xử lý ca không tìm thấy sản phẩm bằng toast Warning.

**Architecture:** STT trả 3 phương án đọc → thử `localFastParse` cục bộ (không mạng) trước → nếu không chắc mới gọi Gemini (thinking off, catalog shortlist). Kết quả có ≥1 sản phẩm thì mở draft; rỗng thì hiện toast Warning và ở lại màn giọng nói.

**Tech Stack:** React Native (Expo SDK 51), TypeScript, `expo-speech-recognition`, `@google/genai`, Jest (`jest-expo`), `@testing-library/react-native`.

**Spec:** [2026-07-30-voice-pipeline-optimization-v2-design.md](../specs/2026-07-30-voice-pipeline-optimization-v2-design.md)

## Global Constraints

- Không hard-code mã màu; import từ `src/theme/tokens.ts`.
- Không thêm native dependency mới (chỉ JS/TS thuần trong phase này).
- `parseVoiceTranscript` giữ tham số `generate` cuối cùng để test inject được.
- `localFastParse` chỉ trả kết quả khi **chắc chắn tuyệt đối**; mọi trường hợp nhập nhằng trả `null` để Gemini xử lý.
- Test đặt trong `__tests__/`, chạy bằng `npm test`.

---

## Phase 1 — STT accuracy

### Task 1: Module `transcriptCorrection`

**Files:**
- Create: `src/services/transcriptCorrection.ts`
- Test: `__tests__/transcriptCorrection.test.ts`

**Interfaces:**
- Produces:
  - `normalizeVietnamese(input: string): string` — bỏ dấu, đổi đ→d, lowercase, gộp khoảng trắng.
  - `correctTranscript(transcript: string, products: Product[]): string` — sửa cụm lệch dấu trùng tên sản phẩm về đúng tên chuẩn.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/transcriptCorrection.test.ts
import { normalizeVietnamese, correctTranscript } from '../src/services/transcriptCorrection';
import { Product } from '../src/types';

const products: Product[] = [
  { id: 1, name: 'Bắc Hương', aliases: 'BH', unit: 'túi', unit_price: 21000 },
  { id: 2, name: 'Gạo ST25', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
];

describe('transcriptCorrection', () => {
  it('normalizes Vietnamese diacritics and case', () => {
    expect(normalizeVietnamese('Gạo ST25 Đỏ')).toBe('gao st25 do');
  });

  it('fixes a mis-accented product name to the canonical name', () => {
    expect(correctTranscript('lấy 1 túi Bắc Hướng', products)).toBe('lấy 1 túi Bắc Hương');
  });

  it('leaves unrelated words untouched', () => {
    expect(correctTranscript('cho 2 cân gạo', products)).toBe('cho 2 cân gạo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- transcriptCorrection`
Expected: FAIL — "Cannot find module '../src/services/transcriptCorrection'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/transcriptCorrection.ts
import { Product } from '../types';

export const normalizeVietnamese = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const correctTranscript = (transcript: string, products: Product[]): string => {
  let words = transcript.split(/\s+/).filter(Boolean);
  const canon = products
    .map((p) => {
      const norm = normalizeVietnamese(p.name);
      return { name: p.name, norm, len: norm.split(' ').length };
    })
    .sort((a, b) => b.len - a.len);

  for (const p of canon) {
    for (let i = 0; i + p.len <= words.length; i++) {
      const window = words.slice(i, i + p.len).join(' ');
      if (normalizeVietnamese(window) === p.norm && window !== p.name) {
        words.splice(i, p.len, ...p.name.split(' '));
      }
    }
  }
  return words.join(' ');
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- transcriptCorrection`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/transcriptCorrection.ts __tests__/transcriptCorrection.test.ts
git commit -m "feat: add Vietnamese transcript correction against catalog"
```

---

### Task 2: Hook trả nhiều phương án đọc

**Files:**
- Modify: `src/hooks/useVoiceInvoiceRecognition.ts`
- Test: `__tests__/useVoiceInvoiceRecognition.test.tsx` (update)

**Interfaces:**
- Consumes: nothing new.
- Produces: callback đổi thành `onFinalTranscript: (alternatives: string[]) => void` (phần tử 0 là phương án tốt nhất). `start` truyền `maxAlternatives: 3, addsPunctuation: false`.

- [ ] **Step 1: Write the failing test** — thêm vào describe hiện có

```ts
// __tests__/useVoiceInvoiceRecognition.test.tsx
it('passes maxAlternatives to the native start call', async () => {
  speechModule.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  const onFinalTranscript = jest.fn();
  const onError = jest.fn();
  const { result } = renderHook(() =>
    useVoiceInvoiceRecognition({ onFinalTranscript, onError })
  );
  await act(async () => {
    await result.current.start();
  });
  expect(speechModule.start).toHaveBeenCalledWith(
    expect.objectContaining({ maxAlternatives: 3 })
  );
});

it('delivers all final alternatives to onFinalTranscript', async () => {
  speechModule.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  const onFinalTranscript = jest.fn();
  const onError = jest.fn();
  const { result } = renderHook(() =>
    useVoiceInvoiceRecognition({ onFinalTranscript, onError })
  );
  await act(async () => {
    await result.current.start();
  });
  act(() => {
    listeners.result?.({
      isFinal: true,
      results: [{ transcript: 'gạo st' }, { transcript: 'gạo sờ tê' }],
    });
  });
  expect(onFinalTranscript).toHaveBeenCalledWith(['gạo st', 'gạo sờ tê']);
});
```

> Note: nếu file test hiện có đang lỗi cú pháp (pre-existing), sửa dấu ngoặc để test chạy được trước khi thêm case mới.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useVoiceInvoiceRecognition`
Expected: FAIL — `start` chưa có `maxAlternatives: 3`; callback nhận string thay vì mảng.

- [ ] **Step 3: Implement**

Trong `src/hooks/useVoiceInvoiceRecognition.ts`:

1. Đổi kiểu callback:
```ts
interface VoiceInvoiceRecognitionOptions {
  onFinalTranscript: (alternatives: string[]) => void;
  onError: (code: VoiceRecognitionErrorCode) => void;
  contextualStrings?: string[];
}
```

2. Trong `start`, thêm option:
```ts
ExpoSpeechRecognitionModule.start({
  lang: 'vi-VN',
  interimResults: true,
  continuous: false,
  maxAlternatives: 3,
  addsPunctuation: false,
  ...(contextualStrings && { contextualStrings }),
});
```

3. Trong listener `result`, gom nhiều phương án khi final:
```ts
const subResult = ExpoSpeechRecognitionModule.addListener('result', (event) => {
  const best = event.results[0]?.transcript.trim() ?? '';
  if (!mountedRef.current || !activeRef.current || finalDeliveredRef.current || !best) {
    return;
  }
  if (!event.isFinal) {
    setInterimTranscript(best);
    return;
  }
  const alternatives = event.results
    .map((r: { transcript: string }) => r.transcript.trim())
    .filter((t: string) => t.length > 0);
  finalDeliveredRef.current = true;
  activeRef.current = false;
  startPendingRef.current = false;
  sessionIdRef.current += 1;
  setInterimTranscript('');
  updateStatus('idle');
  onFinalTranscriptRef.current(alternatives.length > 0 ? alternatives : [best]);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useVoiceInvoiceRecognition`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVoiceInvoiceRecognition.ts __tests__/useVoiceInvoiceRecognition.test.tsx
git commit -m "feat: capture multiple STT alternatives (maxAlternatives=3)"
```

---

### Task 3: HomeScreen dùng alternatives + sửa hiển thị final

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Test: `__tests__/HomeScreenSpeechRecognition.test.tsx` (update callback shape)

**Interfaces:**
- Consumes: `onFinalTranscript(alternatives: string[])` từ Task 2; `correctTranscript` từ Task 1.
- Produces: `handleFinalTranscript(alternatives: string[])`; `visibleTranscript` final đã qua `correctTranscript`.

- [ ] **Step 1: Update the failing test**

Trong `__tests__/HomeScreenSpeechRecognition.test.tsx`, sửa mọi chỗ gọi callback final để truyền **mảng**. Ví dụ:
```ts
// trước: capturedOnFinal('2 cân gạo ST');
// sau:
act(() => {
  capturedOnFinal(['2 cân gạo ST']);
});
```
Thêm assertion: transcript hiển thị được canonical hóa (nếu test có sản phẩm 'Bắc Hương' và đầu vào 'bắc hướng', kỳ vọng hiển thị 'Bắc Hương').

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- HomeScreenSpeechRecognition`
Expected: FAIL — `handleFinalTranscript` vẫn nhận string.

- [ ] **Step 3: Implement**

Trong `src/screens/HomeScreen.tsx`:

1. Import: `import { correctTranscript } from '../services/transcriptCorrection';`
2. Đổi chữ ký:
```ts
const handleFinalTranscript = useCallback(async (alternatives: string[]) => {
  if (!isMountedRef.current) return;
  const best = (alternatives[0] ?? '').trim();
  const apiKey = apiKeyRef.current;
  apiKeyRef.current = null;
  if (!best || !apiKey || parserPendingRef.current) return;

  const products = getProductsFromDB();
  setTranscript(correctTranscript(best, products));
  setLoading(true);
  parserPendingRef.current = true;
  try {
    const result = await parseVoiceTranscript(alternatives, products, apiKey);
    if (!isMountedRef.current) return;
    // ... (mapping giữ nguyên như hiện tại) ...
  } catch (err: unknown) {
    // ... giữ nguyên ...
  } finally {
    // ... giữ nguyên ...
  }
}, []);
```
> `parseVoiceTranscript` đổi tham số đầu thành `alternatives` ở Task 6. Nếu Task 6 chưa xong, tạm truyền `best` — nhưng thứ tự thực thi là Task 6 trước Task 3 khi ghép; ở phase này giữ `alternatives` và hoàn tất Task 6 cùng phase 2 trước khi chạy app.

3. `apiKeyRef` được set trong `handleMicrophonePress` (giữ nguyên).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- HomeScreenSpeechRecognition`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx __tests__/HomeScreenSpeechRecognition.test.tsx
git commit -m "feat: wire STT alternatives and final-transcript correction into HomeScreen"
```

---

## Phase 2 — Gemini latency

### Task 4: Tắt "thinking" trong geminiClient

**Files:**
- Modify: `src/services/geminiClient.ts`
- Test: `__tests__/geminiClient.test.ts` (create nếu chưa có)

**Interfaces:**
- Produces: `generateGeminiJson` gọi `ai.models.generateContent` với `config.thinkingConfig = { thinkingBudget: 0 }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/geminiClient.test.ts
const generateContent = jest.fn().mockResolvedValue({ text: '{"ok":true}' });
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent } })),
}));

import { generateGeminiJson } from '../src/services/geminiClient';

describe('geminiClient', () => {
  it('disables thinking to reduce latency', async () => {
    await generateGeminiJson('key', {
      prompt: 'x',
      responseJsonSchema: { type: 'object' },
    });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ thinkingConfig: { thinkingBudget: 0 } }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- geminiClient`
Expected: FAIL — config thiếu `thinkingConfig`.

- [ ] **Step 3: Implement** — trong `generateGeminiJson`, thêm vào `config`:

```ts
config: {
  systemInstruction: request.systemInstruction,
  responseMimeType: 'application/json',
  responseJsonSchema: request.responseJsonSchema,
  thinkingConfig: { thinkingBudget: 0 },
},
```

> Verify: `GEMINI_MODEL` (`gemini-3.5-flash-lite`) là model hợp lệ và hỗ trợ `thinkingConfig`. Nếu SDK báo lỗi tham số, đổi sang `gemini-2.5-flash-lite` hoặc bỏ `thinkingConfig` (ghi lại trong commit).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- geminiClient`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/geminiClient.ts __tests__/geminiClient.test.ts
git commit -m "perf: disable Gemini thinking budget for faster JSON responses"
```

---

### Task 5: Shortlist sản phẩm cho prompt

**Files:**
- Modify: `src/services/aiParser.ts`
- Test: `__tests__/aiParser.test.ts` (update)

**Interfaces:**
- Consumes: `normalizeVietnamese` từ Task 1.
- Produces: `shortlistProducts(alternatives: string[], products: Product[], limit?: number): Product[]` — trả ứng viên; catalog ≤ `limit` (mặc định 30) hoặc không có ứng viên nào khớp → trả toàn bộ `products`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/aiParser.test.ts (thêm)
import { shortlistProducts } from '../src/services/aiParser';

it('returns the full catalog when it is small', () => {
  const list = shortlistProducts(['gạo st'], sampleProducts, 30);
  expect(list).toHaveLength(sampleProducts.length);
});

it('filters to matching candidates for a large catalog', () => {
  const big: Product[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1, name: `SP ${i}`, aliases: '', unit: 'cái', unit_price: 1000,
  }));
  big.push({ id: 999, name: 'Gạo ST25', aliases: 'ST', unit: 'kg', unit_price: 33000 });
  const list = shortlistProducts(['2 cân gạo st'], big, 30);
  expect(list.some((p) => p.id === 999)).toBe(true);
  expect(list.length).toBeLessThan(big.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- aiParser`
Expected: FAIL — `shortlistProducts` chưa tồn tại.

- [ ] **Step 3: Implement** — thêm vào `src/services/aiParser.ts`:

```ts
import { normalizeVietnamese } from './transcriptCorrection';

export const shortlistProducts = (
  alternatives: string[],
  products: Product[],
  limit = 30
): Product[] => {
  if (products.length <= limit) return products;
  const haystack = normalizeVietnamese(alternatives.join(' '));
  const scored = products.filter((p) => {
    const keys = [p.name, ...(p.aliases ? p.aliases.split(',') : [])]
      .map((k) => normalizeVietnamese(k))
      .filter(Boolean);
    return keys.some((k) => k.length > 1 && haystack.includes(k));
  });
  return scored.length > 0 ? scored.slice(0, limit) : products;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- aiParser`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiParser.ts __tests__/aiParser.test.ts
git commit -m "perf: shortlist catalog candidates to shrink Gemini prompt"
```

---

### Task 6: `parseVoiceTranscript` nhận alternatives + shortlist

**Files:**
- Modify: `src/services/aiParser.ts`
- Test: `__tests__/aiParser.test.ts` (update)

**Interfaces:**
- Consumes: `shortlistProducts` (Task 5).
- Produces: `parseVoiceTranscript(alternatives: string[], products: Product[], apiKey: string, generate?): Promise<AIParsingResult>`.

- [ ] **Step 1: Update tests** — đổi các lời gọi `parseVoiceTranscript('...', ...)` thành mảng, và thêm case:

```ts
it('accepts multiple alternatives and includes them in the prompt', async () => {
  const generate = jest.fn().mockResolvedValue(
    JSON.stringify({ matched_items: [], unmatched_text: [] })
  );
  await parseVoiceTranscript(['gạo st', 'gạo sờ tê'], sampleProducts, 'k', generate);
  expect(generate).toHaveBeenCalledWith(
    'k',
    expect.objectContaining({ prompt: expect.stringContaining('gạo sờ tê') })
  );
});
```
(Cập nhật các test cũ: `parseVoiceTranscript(['1kg ST'], ...)`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- aiParser`
Expected: FAIL — chữ ký cũ nhận string.

- [ ] **Step 3: Implement** — đổi `parseVoiceTranscript`:

```ts
export const parseVoiceTranscript = async (
  alternatives: string[],
  products: Product[],
  apiKey: string,
  generate: GeminiJsonGenerator = generateGeminiJson
): Promise<AIParsingResult> => {
  if (!apiKey.trim()) throw new Error('Chưa có Gemini API Key');
  const best = (alternatives[0] ?? '').trim();
  const others = alternatives.slice(1).filter(Boolean);
  const catalog = shortlistProducts(alternatives, products);

  const altBlock = others.length
    ? `\nCác cách nghe khác (chọn phương án khớp danh mục nhất): ${others.map((a) => `"${a}"`).join(', ')}`
    : '';

  const responseText = await generate(apiKey, {
    prompt: `Ghi âm giọng nói người dùng: "${best}"${altBlock}`,
    systemInstruction: buildGeminiSystemInstruction(catalog),
    responseJsonSchema: INVOICE_RESPONSE_SCHEMA,
  });
  const parsed = parseAIResponse(responseText);
  const productById = new Map(products.map((product) => [product.id, product]));
  const matchedItems = parsed.matched_items.map((item) => {
    const product = productById.get(item.product_id);
    if (!product) throw new Error('Gemini trả về dữ liệu không hợp lệ');
    return { ...item, product_name: product.name, unit: product.unit };
  });
  return {
    matched_items: matchedItems,
    payment_method: parsed.payment_method || (await getDefaultPaymentMethod()),
    unmatched_text: parsed.unmatched_text,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- aiParser`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiParser.ts __tests__/aiParser.test.ts
git commit -m "feat: parse from multiple STT alternatives with shortlisted catalog"
```

---

## Phase 3 — Fast-path cục bộ + xử lý không tìm thấy

### Task 7: Module `localInvoiceParser`

**Files:**
- Create: `src/services/localInvoiceParser.ts`
- Test: `__tests__/localInvoiceParser.test.ts`

**Interfaces:**
- Consumes: `normalizeVietnamese` (Task 1); `Product`, `AIParsingResult`, `PaymentMethod`.
- Produces: `localFastParse(alternatives: string[], products: Product[]): AIParsingResult | null` — trả kết quả chỉ khi phân tích **chắc chắn**; ngược lại `null`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/localInvoiceParser.test.ts
import { localFastParse } from '../src/services/localInvoiceParser';
import { Product } from '../src/types';

const products: Product[] = [
  { id: 1, name: 'Gạo ST25', aliases: 'ST, ST25', unit: 'kg', unit_price: 33000 },
  { id: 2, name: 'Nước mắm', aliases: 'NM', unit: 'chai', unit_price: 45000 },
];

describe('localFastParse', () => {
  it('parses a simple "<qty> <unit> <product>" utterance', () => {
    const r = localFastParse(['2 cân gạo st'], products)!;
    expect(r).not.toBeNull();
    expect(r.matched_items).toHaveLength(1);
    expect(r.matched_items[0].product_id).toBe(1);
    expect(r.matched_items[0].quantity).toBe(2);
    expect(r.matched_items[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses multiple items and payment method', () => {
    const r = localFastParse(['2 gạo st 1 chai nước mắm tiền mặt'], products)!;
    expect(r.matched_items).toHaveLength(2);
    expect(r.payment_method).toBe('tiền mặt');
  });

  it('handles "rưỡi" and "nửa"', () => {
    expect(localFastParse(['2 rưỡi gạo st'], products)!.matched_items[0].quantity).toBe(2.5);
    expect(localFastParse(['nửa cân gạo st'], products)!.matched_items[0].quantity).toBe(0.5);
  });

  it('returns null when a correction word appears', () => {
    expect(localFastParse(['2 gạo st à không 3 gạo st'], products)).toBeNull();
  });

  it('returns null when a token cannot be matched', () => {
    expect(localFastParse(['2 cân xyz lạ hoắc'], products)).toBeNull();
  });

  it('returns null when no quantity precedes a product', () => {
    expect(localFastParse(['cho gạo st'], products)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- localInvoiceParser`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Write implementation**

```ts
// src/services/localInvoiceParser.ts
import { Product, AIParsingResult, PaymentMethod } from '../types';
import { normalizeVietnamese } from './transcriptCorrection';

const CORRECTION_PHRASES = ['a khong', 'khong lay', 'nham', 'thoi bo', 'thoi khong', 'sua thanh', 'sua lai'];
const FILLER = new Set(['cho', 'lay', 'them', 'a', 'nhe', 'oi', 'va', 'voi', 'di', 'minh', 'ban', 'em', 'chi', 'anh', 'gia']);
const UNIT_WORDS = new Set(['kg', 'ky', 'ki', 'can', 'tui', 'qua', 'chai', 'lon', 'goi', 'hop', 'bao', 'lang', 'yen', 'ta']);
const MULTIPLIER: Record<string, number> = { lang: 0.1, yen: 10, ta: 100 };

const buildAliasIndex = (products: Product[]) => {
  const entries: { key: string; len: number; product: Product }[] = [];
  for (const p of products) {
    const keys = [p.name, ...(p.aliases ? p.aliases.split(',') : [])];
    for (const raw of keys) {
      const norm = normalizeVietnamese(raw);
      if (norm) entries.push({ key: norm, len: norm.split(' ').length, product: p });
    }
  }
  return entries.sort((a, b) => b.len - a.len);
};

const readQuantity = (tokens: string[], i: number): { qty: number; next: number } | null => {
  let qty: number | null = null;
  let j = i;
  const num = Number(tokens[j]);
  if (tokens[j] === 'nua') {
    qty = 0.5;
    j += 1;
  } else if (!Number.isNaN(num) && tokens[j] !== '') {
    qty = num;
    j += 1;
    if (tokens[j] === 'ruoi') {
      qty += 0.5;
      j += 1;
    }
  }
  if (qty === null) return null;
  if (UNIT_WORDS.has(tokens[j])) {
    if (MULTIPLIER[tokens[j]]) qty *= MULTIPLIER[tokens[j]];
    j += 1;
  }
  return { qty, next: j };
};

const readProduct = (
  tokens: string[],
  i: number,
  index: ReturnType<typeof buildAliasIndex>
): { product: Product; next: number } | null => {
  for (const entry of index) {
    const window = tokens.slice(i, i + entry.len).join(' ');
    if (window && window === entry.key) return { product: entry.product, next: i + entry.len };
  }
  return null;
};

const tryParse = (transcript: string, products: Product[]): AIParsingResult | null => {
  let norm = normalizeVietnamese(transcript);
  if (CORRECTION_PHRASES.some((phrase) => norm.includes(phrase))) return null;

  let paymentMethod: PaymentMethod | undefined;
  if (norm.includes('tien mat')) {
    paymentMethod = 'tiền mặt';
    norm = norm.replace(/tien mat/g, ' ');
  } else if (norm.includes('chuyen khoan')) {
    paymentMethod = 'chuyển khoản';
    norm = norm.replace(/chuyen khoan/g, ' ');
  }

  const tokens = norm.split(' ').filter(Boolean);
  const index = buildAliasIndex(products);
  const items: AIParsingResult['matched_items'] = [];
  let i = 0;
  while (i < tokens.length) {
    if (FILLER.has(tokens[i])) {
      i += 1;
      continue;
    }
    const q = readQuantity(tokens, i);
    if (!q) return null;
    const prod = readProduct(tokens, q.next, index);
    if (!prod) return null;
    items.push({
      product_id: prod.product.id,
      product_name: prod.product.name,
      quantity: q.qty,
      unit: prod.product.unit,
      confidence: 0.97,
    });
    i = prod.next;
  }
  if (items.length === 0) return null;
  return { matched_items: items, payment_method: paymentMethod, unmatched_text: [] };
};

export const localFastParse = (
  alternatives: string[],
  products: Product[]
): AIParsingResult | null => {
  for (const transcript of alternatives) {
    const result = tryParse(transcript, products);
    if (result) return result;
  }
  return null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- localInvoiceParser`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/localInvoiceParser.ts __tests__/localInvoiceParser.test.ts
git commit -m "feat: add on-device fast-path invoice parser with strict safety gate"
```

---

### Task 8: Component `Toast` dùng chung

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/components/DraftInvoiceModal.tsx` (tái dùng `Toast` cho ca success)
- Test: `__tests__/Toast.test.tsx`

**Interfaces:**
- Produces: `Toast: React.FC<{ visible: boolean; variant: 'success' | 'warning' | 'error'; title: string; subtitle?: string; onClose: () => void }>` — overlay trượt vào từ phải, tự đóng sau 3s, nút đóng thủ công.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/Toast.test.tsx
import { render, act } from '@testing-library/react-native';
import { Toast } from '../src/components/Toast';

jest.useFakeTimers();

describe('Toast', () => {
  it('renders title and subtitle by variant', () => {
    const { getByText } = render(
      <Toast visible variant="warning" title="Cảnh báo" subtitle="Chi tiết" onClose={() => {}} />
    );
    expect(getByText('Cảnh báo')).toBeTruthy();
    expect(getByText('Chi tiết')).toBeTruthy();
  });

  it('auto-closes after 3 seconds', () => {
    const onClose = jest.fn();
    render(<Toast visible variant="success" title="OK" onClose={onClose} />);
    act(() => {
      jest.advanceTimersByTime(3400);
    });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Toast`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement `Toast.tsx`**

```tsx
// src/components/Toast.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme/tokens';

type Variant = 'success' | 'warning' | 'error';

const VARIANT: Record<Variant, { bg: string; border: string; fg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  success: { bg: colors.primarySoft, border: colors.primaryContainerBorder, fg: colors.onPrimaryContainer, icon: 'check-circle' },
  warning: { bg: colors.warningSurface, border: colors.warningAmber, fg: colors.onSurface, icon: 'warning' },
  error: { bg: colors.errorContainerFaint, border: colors.errorCrimson, fg: colors.onSurface, icon: 'error' },
};

interface Props {
  visible: boolean;
  variant: Variant;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ visible, variant, title, subtitle, onClose }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = VARIANT[variant];

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(onClose);
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, anim, onClose]);

  if (!visible) return null;
  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: style.bg, borderColor: style.border },
        { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
      ]}
    >
      <View style={styles.left}>
        <MaterialIcons name={style.icon} size={22} color={style.border} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: style.fg }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: style.fg }]}>{subtitle}</Text> : null}
        </View>
      </View>
      <TouchableOpacity onPress={onClose}>
        <MaterialIcons name="close" size={20} color={style.fg} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  title: { ...typography.labelMd },
  subtitle: { ...typography.bodySm, opacity: 0.8 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Toast`
Expected: PASS.

- [ ] **Step 5: Refactor DraftInvoiceModal to reuse Toast**

Trong `src/components/DraftInvoiceModal.tsx`, thay khối toast tự chế bằng:
```tsx
<Toast
  visible={bannerVisible}
  variant="success"
  title="Giọng nói đã được xử lý"
  subtitle={`Tìm thấy ${items.length} sản phẩm trong yêu cầu`}
  onClose={() => setBannerVisible(false)}
/>
```
Xóa state/animation/style toast cũ (`toastAnim`, `closeToast`, `styles.toast`, `styles.banner*`, `ping`), import `Toast`. Chạy `npx tsc --noEmit` để chắc không còn tham chiếu thừa.

- [ ] **Step 6: Commit**

```bash
git add src/components/Toast.tsx src/components/DraftInvoiceModal.tsx __tests__/Toast.test.tsx
git commit -m "refactor: extract shared Toast (success/warning/error) reused by draft"
```

---

### Task 9: Ghép fast-path + toast Warning khi không tìm thấy

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Test: `__tests__/HomeScreen.test.tsx` (update/add)

**Interfaces:**
- Consumes: `localFastParse` (Task 7); `Toast` (Task 8); `parseVoiceTranscript` (Task 6).
- Produces: luồng ưu tiên fast-path; nhánh `matched_items` rỗng → toast Warning, không mở draft.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/HomeScreen.test.tsx (thêm)
it('shows a warning toast and does not open the draft when no product matches', async () => {
  // mock parseVoiceTranscript trả matched_items rỗng; mock localFastParse trả null
  // render HomeScreen, kích hoạt onFinalTranscript(['xyz lạ']) qua hook mock
  // expect: KHÔNG có testID draft modal; có text 'Không nhận diện được sản phẩm nào. Vui lòng nói lại.'
});
```
(Điền cụ thể theo cách các test HomeScreen hiện có mock `useVoiceInvoiceRecognition` và `parseVoiceTranscript`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- HomeScreen.test`
Expected: FAIL — hiện tại luôn mở draft.

- [ ] **Step 3: Implement**

Trong `src/screens/HomeScreen.tsx`:

1. Import: `import { localFastParse } from '../services/localInvoiceParser';` và `import { Toast } from '../components/Toast';`
2. Thêm state: `const [warning, setWarning] = useState(false);`
3. Tách hàm hoàn tất kết quả dùng chung cho cả 2 đường:
```ts
const finalizeResult = useCallback((result: AIParsingResult, products: Product[]) => {
  const productById = new Map(products.map((p) => [p.id, p]));
  const mapped: MatchedItem[] = result.matched_items.map((item) => {
    const prod = productById.get(item.product_id);
    const unit_price = prod ? prod.unit_price : 0;
    return { ...item, unit_price, amount: item.quantity * unit_price };
  });
  if (mapped.length === 0) {
    setWarning(true);
    return;
  }
  setMatchedItems(mapped);
  setPaymentMethod(result.payment_method || 'chuyển khoản');
  setDraftVisible(true);
}, []);
```
4. Trong `handleFinalTranscript`: chạy fast-path trước; nếu có → `finalizeResult` (không loading); nếu `null` → gọi Gemini rồi `finalizeResult`:
```ts
const fast = localFastParse(alternatives, products);
if (fast) {
  finalizeResult(fast, products);
  return;
}
setLoading(true);
parserPendingRef.current = true;
try {
  const result = await parseVoiceTranscript(alternatives, products, apiKey);
  if (!isMountedRef.current) return;
  finalizeResult(result, products);
} catch (err) { /* giữ nguyên Alert */ }
finally { /* giữ nguyên */ }
```
5. Render Toast Warning trong màn:
```tsx
<Toast
  visible={warning}
  variant="warning"
  title="Không nhận diện được sản phẩm nào. Vui lòng nói lại."
  onClose={() => setWarning(false)}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- HomeScreen.test`
Expected: PASS.

- [ ] **Step 5: Full test + typecheck**

Run: `npm test` và `npx tsc --noEmit`
Expected: toàn bộ PASS; không lỗi type trong `src/`.

- [ ] **Step 6: Commit**

```bash
git add src/screens/HomeScreen.tsx __tests__/HomeScreen.test.tsx
git commit -m "feat: prefer fast-path parse and warn on no-match instead of empty draft"
```

---

## Self-review notes
- Spec coverage: Phần 1 (STT alternatives + correction) → Task 1–3; Phần 2 (thinking off + shortlist + alternatives) → Task 4–6; Phần 3 fast-path → Task 7; Phần 6 no-match + Toast dùng chung → Task 8–9. Đủ.
- Type nhất quán: `onFinalTranscript(alternatives: string[])`, `parseVoiceTranscript(alternatives, ...)`, `localFastParse(...) → AIParsingResult | null`, `finalizeResult(result, products)` dùng chung mapping cho cả 2 đường.
- Kiểm chứng runtime bằng simulator sau Phase 3 (nói thử đơn đơn giản → fast-path; câu vô nghĩa → toast Warning).
