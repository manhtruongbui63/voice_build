# VoiceBill — Tài liệu thiết kế (Design Documentation)

Nguồn chân lý về giao diện của VoiceBill. Thiết kế được tạo trên **Google Stitch**
rồi export về repo. Tài liệu này gom các export đó thành dạng dùng được cho lập trình.

## Liên kết

- **Dự án Stitch (bản gốc, chỉnh sửa online):**
  https://stitch.withgoogle.com/projects/2493439233827675734
  *(cần đăng nhập tài khoản Google của bạn)*
- **Design tokens dùng trong code:** [`src/theme/tokens.ts`](../../src/theme/tokens.ts)
- **Export gốc từ Stitch (HTML + PNG):** [`stitch_emerald_ai_retail_pos/`](../../stitch_emerald_ai_retail_pos)

## Cấu trúc

| File | Nội dung |
|---|---|
| [design-system.md](design-system.md) | Design tokens: màu, typography, bo góc, spacing, đổ bóng — **nguồn chân lý** |
| [screens/ban-hang.md](screens/ban-hang.md) | Màn Bán Hàng (voice billing) — phone & tablet |
| [screens/san-pham.md](screens/san-pham.md) | Màn Sản Phẩm (catalog) + modal Thêm/Sửa sản phẩm |
| [screens/bao-cao.md](screens/bao-cao.md) | Màn Báo Cáo (reports) |
| [screens/cai-dat.md](screens/cai-dat.md) | Màn Cài Đặt (settings, gồm Gemini API key) |

## Quy trình cập nhật thiết kế

Khi bạn chỉnh thiết kế trên Stitch:

1. Trong Stitch, mở màn cần cập nhật → **Export** code (HTML/Tailwind) và **screenshot**.
2. Ghi đè file tương ứng trong `stitch_emerald_ai_retail_pos/<màn>/` (`code.html`, `screen.png`).
3. Nếu đổi tokens (màu/font): **Export design system** → cập nhật `design-system.md` và
   đồng bộ lại [`src/theme/tokens.ts`](../../src/theme/tokens.ts).
4. Cập nhật file mô tả màn trong `screens/` nếu bố cục/luồng thay đổi.

> Stitch không có API chính thức để tự kéo về — export thủ công như trên là cách bền nhất.

## Nguyên tắc dùng trong code

- **Không hard-code mã màu** trong màn hình. Import từ `src/theme/tokens.ts`.
- Màu chủ đạo thống nhất: **primary `#006C49`** (theo tokens Stitch). Emerald sáng
  `#10B981` là `primaryContainer` (nền/nhấn phụ).
- Responsive: `< 768pt` = phone (1 cột, bottom tab), `>= 768pt` = tablet (split view, side rail).
