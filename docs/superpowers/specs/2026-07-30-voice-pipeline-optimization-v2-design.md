# Voice Pipeline Optimization v2 — Design

**Ngày:** 2026-07-30
**Mục tiêu:** Tăng độ chính xác nhận giọng nói (STT) và tăng tốc bước text→JSON (Gemini) cho VoiceBill, giữ trải nghiệm mượt cả khi mạng chập chờn.

## Bối cảnh

Vòng tối ưu trước ([2026-07-30-voice-parsing-optimization-design.md](2026-07-30-voice-parsing-optimization-design.md)) đã triển khai **contextual biasing** (`contextualStrings`) và **few-shot prompt** trong `buildGeminiSystemInstruction`. Người dùng vẫn phản ánh: (1) text hiển thị khi nói còn sai, (2) Gemini xử lý text→JSON còn chậm.

Pipeline hiện tại:
- STT: `expo-speech-recognition`, `lang: 'vi-VN'`, `interimResults: true`, `continuous: false`, **`maxAlternatives: 1`**, có `contextualStrings`.
- Gemini: model `gemini-3.5-flash-lite`, gửi **toàn bộ catalog + rules + few-shot** mỗi lần gọi, **không tắt thinking**, không cache, không stream.

## Quyết định phạm vi (đã chốt với người dùng)

- **Độ chính xác:** cần đúng cả text realtime lẫn hóa đơn cuối — nhưng **chấp nhận giới hạn**: text **interim (đang nói)** vẫn do engine trả và có thể sai; chỉ đảm bảo **bản final hiển thị + hóa đơn** đúng.
- **Tốc độ:** làm **cả hai** — tối ưu Gemini **và** thêm fast-path parse cục bộ.
- **Mạng:** ưu tiên có mạng nhưng **chịu lỗi tốt** — mạng chập chờn/timeout thì fast-path cục bộ vẫn dựng được đơn đơn giản.
- **Fast-path an toàn:** chỉ nhận kết quả cục bộ khi **chắc chắn tuyệt đối**, còn lại fallback Gemini.

## Kiến trúc & luồng dữ liệu

```
Mic → STT (maxAlternatives=3) → transcript final + N alternatives
     → [Bước sửa hiển thị] fuzzy-correct bản final theo catalog (accent-insensitive)
     → HomeScreen.handleFinalTranscript(alternatives)
         → localFastParse(alternatives, products)
             ├─ confident? → result (fast-path, không mạng)
             └─ không chắc → parseVoiceTranscript(Gemini: shortlist + thinkingBudget=0, truyền alternatives) → result
     → phân nhánh theo result:
         ├─ matched_items.length ≥ 1 → mở draft (toast success trong draft)
         └─ matched_items.length === 0 → KHÔNG mở draft; toast Warning trên màn giọng nói; ở lại/quay về màn nhập giọng nói
```

## Thành phần

### 1. STT — `src/hooks/useVoiceInvoiceRecognition.ts`
- `ExpoSpeechRecognitionModule.start({ ..., maxAlternatives: 3, addsPunctuation: false })`.
- Đổi callback `onFinalTranscript(transcript: string)` → `onFinalTranscript(alternatives: string[])` (phần tử 0 là phương án tốt nhất; giữ tương thích bằng cách vẫn cung cấp `alternatives[0]`).
- Event `result`: thu thập toàn bộ `event.results[].transcript` (đến 3 phương án) khi `isFinal`, thay vì chỉ `results[0]`.
- `interimTranscript` vẫn dùng `results[0]` như hiện tại (không đổi trải nghiệm realtime).

### 2. Sửa text hiển thị cuối — module mới `src/services/transcriptCorrection.ts`
- `correctTranscript(transcript, products): string` — chuẩn hóa bỏ dấu, so token với tên/alias sản phẩm, thay cụm lệch âm gần đúng bằng tên chuẩn để **hiển thị**.
- Áp cho `visibleTranscript` bản final (không áp cho interim).

### 3. Fast-path parser cục bộ — module mới `src/services/localInvoiceParser.ts`
- `localFastParse(alternatives: string[], products: Product[]): AIParsingResult | null`.
- Chuẩn hóa (lowercase, bỏ dấu), tách số lượng theo quy đổi tiếng Việt (nửa=0.5, lạng=0.1, yến=10, tạ=100, "rưỡi"=+0.5, số + "cân/ký/kg/túi/quả/chai/lon…"), khớp sản phẩm qua alias/tên (accent-insensitive, exact ưu tiên).
- Nhận diện phương thức thanh toán ("tiền mặt"/"chuyển khoản").
- **Cổng an toàn — trả `null` (để Gemini xử lý) nếu:** có từ đính chính ("à không", "nhầm", "bỏ", "thôi", "sửa thành"); có token không khớp sản phẩm; số lượng nhập nhằng; nhiều phương án đọc cho kết quả mâu thuẫn.
- Khớp chắc chắn → trả `AIParsingResult` với `confidence` cao (vd 0.97).

### 4. Gemini — `src/services/geminiClient.ts` + `src/services/aiParser.ts`
- **geminiClient:** thêm `config.thinkingConfig = { thinkingBudget: 0 }` vào `generateContent` (verify model hỗ trợ trong lúc làm plan; nếu model không có thinking thì tham số vô hại/bỏ).
- **aiParser:**
  - `buildGeminiSystemInstruction(products)` nhận **shortlist** thay vì full catalog khi catalog lớn.
  - Thêm hàm `shortlistProducts(alternatives, products, limit)` — fuzzy match cục bộ chọn tối đa `limit` (vd 30) ứng viên; nếu catalog ≤ ngưỡng (vd 30) hoặc shortlist rỗng → gửi full (an toàn, không bỏ sót).
  - `parseVoiceTranscript` nhận `alternatives: string[]`; prompt gộp các phương án đọc để Gemini tự chọn phương án khớp catalog nhất.

### 5. Ghép luồng — `src/screens/HomeScreen.tsx`
- `handleFinalTranscript(alternatives)`: gọi `localFastParse` trước; nếu có kết quả → dùng luôn (không set `loading`). Nếu `null` → set `loading`, gọi `parseVoiceTranscript(alternatives, ...)`.
- Sau khi có `result` (từ fast-path hoặc Gemini), **phân nhánh theo số sản phẩm** (xem Phần 6):
  - `matched_items.length ≥ 1` → set `matchedItems`, mở draft như hiện tại.
  - `matched_items.length === 0` → **không** mở draft; hiện toast Warning; ở lại màn nhập giọng nói.
- Chỉ hiển thị trạng thái "Đang xử lý…" khi thực sự gọi Gemini.
- `visibleTranscript` final chạy qua `correctTranscript`.

### 6. Không tìm thấy sản phẩm → toast Warning + ở lại màn giọng nói
**Vấn đề hiện tại:** `handleFinalTranscript` mở `DraftInvoiceModal` kể cả khi `matched_items` rỗng, nên vẫn thấy toast "success" trong draft.

**Thiết kế:**
- Tách toast trong `DraftInvoiceModal` thành **component dùng chung** `src/components/Toast.tsx` với `variant: 'success' | 'warning' | 'error'` (màu: success=emerald-soft, warning=`warningSurface`/`warningAmber`, error=`errorContainer`/`errorCrimson`), giữ hành vi **trượt vào từ phải + tự đóng sau 3s** (đã có trong draft). `DraftInvoiceModal` tái dùng component này cho ca success.
- `HomeScreen` giữ state toast (variant + message). Khi `matched_items.length === 0`:
  - Không mở draft, đưa recognition về `idle` (đã ở màn giọng nói).
  - Hiện toast **Warning**: `"Không nhận diện được sản phẩm nào. Vui lòng nói lại."` (⚠️ icon).
- Áp dụng cho **cả** fast-path (nếu vì lý do nào đó trả 0 item) lẫn Gemini.
- **Lỗi thật** (Gemini/mạng, `catch`) tiếp tục dùng cơ chế hiện có (`Alert` với `getSafeParserErrorMessage`); tùy chọn sau này có thể chuyển sang toast **Error** để đồng nhất — ghi nhận, không bắt buộc trong phase này.

## Xử lý lỗi & edge cases
- **Gemini timeout/mạng lỗi:** nếu fast-path đã đủ chắc, không cần Gemini. Nếu phải gọi Gemini mà lỗi → giữ nguyên thông báo lỗi hiện có (`getSafeParserErrorMessage`).
- **Shortlist bỏ sót:** chỉ lọc khi catalog lớn; ngưỡng rộng tay; shortlist rỗng thì gửi full → không giảm độ chính xác.
- **maxAlternatives không được engine hỗ trợ:** nếu chỉ trả 1 kết quả, pipeline vẫn chạy với `alternatives.length === 1`.
- **thinkingBudget không hợp lệ với model:** verify khi làm plan; fallback bỏ tham số.

## Kiểm thử
- `localInvoiceParser`: quy đổi số lượng, khớp alias bỏ dấu, **bailout** khi có từ đính chính/không khớp; nhiều alternatives.
- `transcriptCorrection`: sửa cụm lệch âm về tên chuẩn; không phá câu không liên quan.
- `shortlistProducts`: chọn đúng ứng viên; catalog nhỏ trả full; rỗng trả full.
- `geminiClient`: `generateContent` được gọi kèm `thinkingConfig.thinkingBudget === 0`.
- `useVoiceInvoiceRecognition`: `start` truyền `maxAlternatives: 3`; event `result` isFinal gom nhiều phương án và gọi `onFinalTranscript` với mảng.
- Cập nhật các test hiện có của HomeScreen/hook cho chữ ký callback mới.
- **HomeScreen — không tìm thấy sản phẩm:** khi parse trả `matched_items` rỗng → **không** mở `DraftInvoiceModal`, hiện toast Warning, trạng thái về idle. Khi có ≥1 item → mở draft (giữ nguyên).
- `Toast`: render đúng theo `variant` (success/warning/error); tự đóng sau 3s; đóng thủ công.

## Tiêu chí thành công (đo được)
- Đơn đơn giản (1–2 SP, không đính chính): draft hiện **< 300ms**, không cần mạng.
- Đơn qua Gemini: TTFT giảm rõ nhờ `thinkingBudget=0` + prompt nhỏ (mục tiêu giảm ~40–60%).
- Tỉ lệ khớp đúng sản phẩm tăng nhờ 3 phương án đọc + shortlist + sửa hiển thị.

## Kế hoạch theo phase (cho bước writing-plans)
1. **Phase 1 — STT:** maxAlternatives=3, callback trả mảng, `transcriptCorrection`, wiring HomeScreen + tests.
2. **Phase 2 — Gemini:** `thinkingBudget=0`, `shortlistProducts`, prompt nhận alternatives + tests.
3. **Phase 3 — Fast-path + xử lý không tìm thấy:** `localInvoiceParser` + cổng an toàn + ghép luồng ưu tiên fast-path; component `Toast` dùng chung + nhánh `matched_items` rỗng → toast Warning, không mở draft; `DraftInvoiceModal` tái dùng `Toast` + tests.

## Ngoài phạm vi (YAGNI)
- Streaming JSON, context caching tường minh, chế độ STT on-device bắt buộc, offline hoàn toàn không mạng.
