# VoiceBill Implementation Progress Ledger

| Task | Status | Commits | Notes |
|---|---|---|---|
| Task 1: Scaffold Expo Project | Complete | `98aff27` | Expo app & core domain types (`src/types/index.ts`) |
| Task 2: SQLite DB Service | Complete | `4ba892c` | SQLite schema, migration & invoice calculation helpers |
| Task 3: Gemini AI Parser | Complete | `051855d` | Gemini 2.0 Flash AI invoice parser & confidence scoring |
| Task 4: Excel Report Service | Complete | `f84988a` | SheetJS Excel report generation & native file sharing |
| Task 5: Product Catalog UI | Complete | `b0365fc` | Product management screen & Add/Edit modal |
| Task 6: Voice Billing UI & Modal | Complete | `d9a3906` | Voice billing screen & editable draft invoice modal |
| Task 7: Invoice History UI | Complete | `58f2ca3` | Invoice history screen with period filter & Excel export |
| Task 8: App Navigation & Entry | Complete | `a6b9099` | Main tab navigation & app entry point (`App.tsx`) |

## Voice Pipeline Optimization v2 (plan 2026-07-30) — baseline 1dceb6b
| Task | Status | Commits | Notes |
|---|---|---|---|
| Task 1: transcriptCorrection | Complete | `2d0c576` | review clean; Minor: prefer-const, single-fixture test coverage |
| Task 2: hook maxAlternatives + array callback | Complete | `58995ac` | review clean; fixed pre-existing broken test/mock; HomeScreen type err deferred to Task 3 |
| Task 4: gemini thinkingBudget=0 | Complete | `ae9e848` | review clean; ⚠️ verify live SDK accepts thinkingConfig on model at runtime |
| Task 5: shortlistProducts | Complete | `96e7f0b` | review clean; NOTE pre-existing failing test "includes few-shot examples" (baseline, unrelated) |
| Task 6: parseVoiceTranscript(alternatives)+shortlist | Complete | `3491b0c` | review clean; Minor: whitespace-only alt not trimmed; HomeScreen call fixed in Task 3 |
| Task 3: HomeScreen alternatives + correctTranscript | Complete | `97099ed` | review clean; fixed 2 genuinely-broken pre-existing test assertions |
| Task 7: localInvoiceParser | Complete | `35ac242` | review clean; fixture fixed (brief inconsistent); LIMITATION: bare-alias mid-phrase (e.g. "gạo ST") not fast-matched, falls back to Gemini |
| Task 8: shared Toast (success/warning/error) | Complete | `e8d2bec`, `36ad68d` | DraftInvoiceModal reuses Toast; shadowColor → `colors.neutral900` token |
| Task 9: HomeScreen fast-path + no-match Warning toast | Complete | `d01d05d` | localFastParse preferred before Gemini; empty matches → Warning toast, no draft; shared `finalizeResult` mapping |

## Product-Delete Crash Fix + Multi-Select (plan 2026-07-30) — baseline a72d683
| Task | Status | Commits | Notes |
|---|---|---|---|
| Task 1: migrate invoice_items.product_id SET NULL + nullable type | Complete | `461726b` | review clean; Minor: no regression test for PRAGMA-outside-transaction ordering |
| Task 2: deleteProductsFromDB batch delete | Complete | `f48e6b6` | review clean; Minor: no single-id test (optional) |
| Task 3: single-delete try/catch safety net | Complete | `c7dde9f` | review clean; Minor: silent catch (brief-mandated), unused mock var (used in Task 4) |
| Task 4: multi-select checkbox delete UI | Complete | `976b42c` | review clean; Minor: unused avatar style, silent catch (matches existing pattern) |
