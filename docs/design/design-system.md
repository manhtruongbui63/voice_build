# VoiceBill — Design System

**Phong cách:** Modern Emerald & Dark Slate Glassmorphism
**Form factor:** Phone (375×812 pt) & Tablet/iPad (768×1024 pt, 1024×768 pt POS)
**Font:** `Plus Jakarta Sans` (tiêu đề) + `Inter` (nội dung)

> Đây là **nguồn chân lý** về style. Mã token tương ứng nằm ở
> [`src/theme/tokens.ts`](../../src/theme/tokens.ts) — sửa ở đây thì đồng bộ luôn file đó.

---

## 1. Màu (Color tokens)

Màu chủ đạo đã thống nhất theo tokens Stitch: **primary `#006C49`**.
Emerald sáng `#10B981` là **primaryContainer** (nền/nhấn phụ), không phải primary.

### Brand
| Token | Mã | Dùng cho |
|---|---|---|
| `primary` | `#006C49` | Nút chính, nhấn mạnh, active tab |
| `onPrimary` | `#FFFFFF` | Chữ/icon trên nền primary |
| `primaryContainer` | `#10B981` | Nền container, nút micro |
| `onPrimaryContainer` | `#00422B` | Chữ trên primaryContainer |
| `primaryActive` | `#059669` | Trạng thái nhấn/hover |
| `primarySoft` | `#D1FAE5` | Nền nhạt (badge, highlight) |

### Surface / nền
| Token | Mã | Dùng cho |
|---|---|---|
| `background` | `#F4FBF4` | Nền màn hình |
| `surfaceContainerLowest` | `#FFFFFF` | Card, modal |
| `surfaceContainer` | `#E8F0E9` | Vùng nhóm |
| `slateBg` | `#F8FAFC` | Nền slate thay thế |

### Text
| Token | Mã | Dùng cho |
|---|---|---|
| `onSurface` | `#161D19` | Chữ chính |
| `onSurfaceVariant` | `#3C4A42` | Chữ phụ |
| `textSecondary` | `#64748B` | Chú thích, placeholder |

### Trạng thái ngữ nghĩa
| Token | Mã | Dùng cho |
|---|---|---|
| `warningAmber` | `#F59E0B` | Cảnh báo AI confidence < 0.8 |
| `warningSurface` | `#FEF3C7` | Nền dòng cần kiểm tra |
| `errorCrimson` | `#EF4444` | Xóa / lỗi |
| `tertiary` | `#0053DB` | Sửa / thông tin |
| `mint` | `#34D399` | Nhấn phụ |

---

## 2. Typography

| Style | Font | Size / Line | Weight |
|---|---|---|---|
| `headlineLg` | Plus Jakarta Sans | 32 / 40 | 700 |
| `headlineLgMobile` | Plus Jakarta Sans | 24 / 32 | 700 |
| `headlineMd` | Plus Jakarta Sans | 20 / 28 | 600 |
| `bodyLg` | Inter | 18 / 28 | 400 |
| `bodyMd` | Inter | 16 / 24 | 400 |
| `bodySm` | Inter | 14 / 20 | 400 |
| `labelMd` | Inter | 14 / 20 | 600 (letter-spacing 0.02em) |
| `labelSm` | Inter | 12 / 16 | 500 |

---

## 3. Bo góc (radius)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `sm` | 4px | Chi tiết nhỏ |
| `md` | 8px | Badge, input |
| `lg` | 12px | Button |
| `card` | 16px | Card |
| `xl` | 24px | Modal, side panel |
| `full` | 9999px | Nút micro tròn (140px phone / 180px tablet) |

## 4. Spacing

| Token | Giá trị |
|---|---|
| `marginMobile` | 16px |
| `marginTablet` | 32px |
| `gutter` | 16px |
| `stackSm / Md / Lg` | 8 / 16 / 24px |

## 5. Đổ bóng & Glassmorphism

- **Soft card:** `0 10px 25px rgba(15,23,42,0.06)` → token `elevation.softCard`
- **Mic pulse (đang ghi âm):** `0 0 40px rgba(16,185,129,0.4)` → token `elevation.micPulse`
- **Glass backdrop:** `backdrop-filter: blur(12px)`, nền `rgba(255,255,255,0.85)`

---

## 6. Chiến lược responsive

| | Phone (< 768pt) | Tablet (≥ 768pt) |
|---|---|---|
| Layout | 1 cột, xếp dọc | Split view / grid nhiều cột |
| Navigation | Bottom tab (4 tab) | Left side rail / top bar |
| Modal | Bottom sheet | Center modal / side panel |
| Nút chính | Sticky đáy màn | Trong panel |

**4 tab:** 🎙️ Bán Hàng · 📦 Sản Phẩm · 📊 Báo Cáo · ⚙️ Cài Đặt

---

## 7. Business rules ảnh hưởng UI

1. **Voice-to-text + biasing:** khớp giọng nói tiếng Việt với alias sản phẩm (vd `ST` → `Gạo ST25`).
2. **Confidence alert:** dòng có độ tin cậy AI `< 0.8` phải tô nền `warningSurface #FEF3C7`,
   viền `warningAmber #F59E0B`, kèm icon ⚠️ để chủ shop kiểm tra lại SL/giá.
3. **Phương thức thanh toán:** "Tiền mặt" và "Chuyển khoản". Khi chọn "Chuyển khoản",
   ẩn ô "Khách đưa" và "Tiền thừa".
