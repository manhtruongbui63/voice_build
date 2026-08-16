# Voice Payment Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to declare the payment method ("tiền mặt" / "chuyển khoản") during voice invoicing, with a default configurable setting and a segmented control in the Draft Invoice Modal for manual correction.

**Architecture:** We will add a `payment_method` column to the `invoices` table. The Gemini AI parser will extract it from voice (falling back to a default setting if not found). The Draft Invoice Modal will conditionally show cash-tendered inputs based on the selected method.

**Tech Stack:** React Native, Expo SQLite, AsyncStorage.

## Global Constraints
- Only two payment methods are allowed: `'tiền mặt'` and `'chuyển khoản'`.
- The default payment method is `'chuyển khoản'`.
- No Simulator may be booted or used; runtime verification is only on device `00008101-001130A63406001E`.

---

### Task 1: Database Migration & Types

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/db.ts`

**Interfaces:**
- Produces: `PaymentMethod` type, `Invoice.payment_method`, `AIParsingResult.payment_method`

- `[ ]` **Step 1: Write the failing test** (or update types)
Update `src/types/index.ts` to include `PaymentMethod`.

- `[ ]` **Step 2: Implement the minimal code**
In `src/services/db.ts`, update `initDB` to run:
```typescript
try {
  database.execSync(`ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'chuyển khoản';`);
} catch (e) {
  // Column might already exist
}
```
Update `saveInvoiceToDB` and `getInvoicesFromDB` queries to include `payment_method`.

---

### Task 2: Global Settings

**Files:**
- Modify: `src/services/geminiSettingsService.ts`
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Produces: `getDefaultPaymentMethod()`, `setDefaultPaymentMethod(method)`

- `[ ]` **Step 1: Write the failing test** (or implement logic)
In `src/services/geminiSettingsService.ts`, add:
```typescript
const PAYMENT_METHOD_KEY = 'VOICEBILL_PAYMENT_METHOD';
export const getDefaultPaymentMethod = async (): Promise<PaymentMethod> => { ... }
export const setDefaultPaymentMethod = async (method: PaymentMethod): Promise<void> => { ... }
```

- `[ ]` **Step 2: Implement the UI**
In `src/screens/SettingsScreen.tsx`, add a UI Picker to select the default method.

---

### Task 3: AI Parser Updates

**Files:**
- Modify: `src/services/aiParser.ts`
- Modify: `__tests__/aiParser.test.ts`

**Interfaces:**
- Consumes: `getDefaultPaymentMethod`

- `[ ]` **Step 1: Write the failing test**
Update `__tests__/aiParser.test.ts` to assert that `parseVoiceTranscript` returns `payment_method`.

- `[ ]` **Step 2: Implement the minimal code**
In `src/services/aiParser.ts`:
- Add `payment_method: { type: 'string' }` to `INVOICE_RESPONSE_SCHEMA`.
- Add instruction to extract "tiền mặt" or "chuyển khoản".
- If `parsed.payment_method` is missing, await `getDefaultPaymentMethod()`.

---

### Task 4: UI Updates

**Files:**
- Modify: `src/components/DraftInvoiceModal.tsx`
- Modify: `src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `AIParsingResult.payment_method`

- `[ ]` **Step 1: Write the failing test**
Update tests to assert the correct UI state depending on `payment_method`.

- `[ ]` **Step 2: Implement the minimal code**
In `DraftInvoiceModal.tsx`:
- Add state `const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);`
- Render Segmented Control.
- Hide `Khách đưa` and `Tiền thừa` UI rows when `paymentMethod === 'chuyển khoản'`.
In `HomeScreen.tsx`:
- Extract `payment_method` from `AIParsingResult` and pass it to `<DraftInvoiceModal paymentMethod={...} />`.
