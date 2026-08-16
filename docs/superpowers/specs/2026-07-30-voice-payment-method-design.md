# Voice Payment Method Specification

## Objective
Enable users to declare the payment method ("tiền mặt" / "chuyển khoản") during voice invoicing. If not mentioned, a default configurable method will be used. The Draft Invoice Modal will feature a segmented control to allow manual corrections and will dynamically hide the cash-tendered fields when "chuyển khoản" is selected.

## Components & Architecture

### 1. Database (SQLite) & Types
- **Type Definitions (`src/types/index.ts`)**: 
  - Add `PaymentMethod = 'tiền mặt' | 'chuyển khoản'` type.
  - Add `payment_method: PaymentMethod` to the `Invoice` interface.
  - Add `payment_method?: PaymentMethod` to the `AIParsingResult` interface.
- **Migration (`src/services/db.ts`)**:
  - Add an `ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'chuyển khoản'` statement inside `initDB` (safely handled using `try-catch` to avoid errors if the column already exists).
  - Update `saveInvoiceToDB` and `getInvoicesFromDB` to insert and read the new column.

### 2. Global Settings (`src/services/geminiSettingsService.ts` & `SettingsScreen.tsx`)
- Implement `getDefaultPaymentMethod` and `setDefaultPaymentMethod` using `AsyncStorage`. Default value if unset is `'chuyển khoản'`.
- Update `SettingsScreen.tsx` to include a UI control (Segmented Control or Dropdown) for users to configure this default.

### 3. AI Parser (`src/services/aiParser.ts`)
- **Schema Update**: Add `payment_method` to `INVOICE_RESPONSE_SCHEMA` as an optional string.
- **Prompting**: Update `buildGeminiSystemInstruction` to instruct the AI to capture "tiền mặt" hoặc "chuyển khoản".
- **Fallback Logic**: Inside `parseVoiceTranscript`, if the returned `payment_method` is missing, explicitly fetch and assign the default from `getDefaultPaymentMethod()`.

### 4. UI Layer (`src/components/DraftInvoiceModal.tsx` & `HomeScreen.tsx`)
- **DraftInvoiceModal**:
  - Receive `paymentMethod` prop and track it via local state.
  - Render a visual Segmented Control (Tiền mặt / Chuyển khoản).
  - Conditionally render the "Khách đưa" & "Tiền thừa" inputs *only* if the selected method is "Tiền mặt".
- **HomeScreen**:
  - Pass the AI-parsed `payment_method` down to the `DraftInvoiceModal`.

## Testing Plan
- **Unit Tests**:
  - `aiParser.test.ts`: Verify that the parser handles both provided payment methods and falls back appropriately when omitted.
  - `DraftInvoiceModal.test.tsx`: Check that toggling the segmented control properly shows/hides the change fields.
- **Manual Verification**: Run the app on the physical device to test the microphone integration, confirm the default setting alters behavior, and ensure the Draft Modal correctly toggles its footer inputs.
