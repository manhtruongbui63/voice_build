# VoiceBill - Google Stitch Mobile App Design Specification

**Target Tool**: Google Stitch / AI Mobile UI Generator  
**Design Aesthetic**: Deep Navy Voice AI & Glassmorphism  
**Platform**: iOS & Android Mobile App (375x812 pt baseline)  

---

## 🎨 1. Design System & Style Tokens

### Color Palette
- **Primary / Brand**: Deep Navy `#05163A`
- **Secondary / Premium Accent**: Warm Gold `#B29469`
- **Tertiary / Voice AI Accent**: Sky Cyan `#62B3EC`
- **Neutral / Support**: Soft Blue `#76AAD1`
- **White / Surface**: Pure White `#FFFFFF`
- **Warnings / AI Confidence**: Amber Yellow `#F59E0B` (Warning Surface: `#FEF3C7`, Border: `#F59E0B`)
- **Errors**: Crimson Red `#EF4444`
- **Text Primary**: Deep Navy `#05163A`
- **Text Secondary**: Soft Blue `#76AAD1`

### Typography & Shapes
- **Font Family**: `Inter` / `Plus Jakarta Sans`
- **Border Radius**: Cards: `16px`, Buttons: `12px`, Input Badges: `8px`, Micro Circle: `70px` (Full circle)
- **Shadows & Glassmorphism**: `shadow-lg` (0px 10px 25px rgba(15, 23, 42, 0.08)), Backdrop blur: `blur(12px)`

---

## 📱 2. Screen Breakdown & Google Stitch Prompts

### Screen 1: Voice Billing / Home Screen (Màn hình Bán Hàng)

#### Visual Layout & Elements
1. **Top Bar**:
   - Left: App Logo + Title "VoiceBill" (Bold 20pt, Emerald `#10B981`).
   - Right: Status Pill Badge (Green dot + "Gemini 2.0 Ready" or Red dot + "Chưa có Key").
2. **Central Hero Voice Recording Section**:
   - Massive 140x140px circular button in Emerald Green `#10B981` with white Microphone icon `🎙️`.
   - Concentric pulse animated soundwave rings surrounding the button when recording.
   - Subtitle: *"Nhấn Nút Micro Để Nói Khẩu Lệnh Bán Hàng"*.
3. **Live Transcript Box**:
   - Glassmorphic translucent card with quotes.
   - Title: *"Văn bản vừa đọc:"* (13pt Gray).
   - Content: *"bán cho chị 1kg ST, à không lấy 2kg ST với 2 cân rưỡi Bắc Hướng"* (16pt Italic Charcoal).
4. **Draft Invoice Modal (Hiển thị khi AI bóc tách xong)**:
   - Sheet Header: "HÓA ĐƠN NHÁP" (Bold 18pt) + Close `✕` button.
   - Optional Customer Name Input: *"Tên / Ghi chú khách hàng (Ví dụ: Chị Hoa)"*.
   - **Line Items Table**:
     - Regular Rows: Product Name | Quantity Stepper | Unit Price | Amount.
     - **AI Low-Confidence Row**: Yellow background `#FEF3C7` with Amber border `#F59E0B` + Warning Icon `⚠️` (Dành cho sản phẩm đọc chưa chắc chắn để người bán soi lại).
   - **Summary & Cash Panel**:
     - Subtotal, Discount Input (`Giảm giá`), Net Total (`Khách phải trả` - Highlighted in Emerald Bold 20pt).
     - Cash Input (`Khách đưa`) & Return Change (`Tiền thừa`).
   - Primary Action Button: "Xác nhận & Lưu Hóa Đơn" (Emerald Gradient Full Width Button).

#### 🤖 Google Stitch Prompt for Screen 1
> **Prompt**: "Design a modern mobile app home screen for a voice-activated retail billing app named 'VoiceBill'. Top bar has an emerald green logo and an API connection status pill badge. The main hero area features a large, glowing emerald green 140px circular microphone button with pulsating soundwave ripple effects around it. Below the mic, a modern glassmorphic card displays live speech-to-text transcript in italic quotes. When activated, a sleek bottom sheet invoice modal pops up showing a retail line-item table. Low-confidence AI items are highlighted with a soft yellow amber warning background card and a warning icon. Bottom of modal features subtotal, discount input, customer cash paid input, change calculation, and a prominent green 'Xác nhận & Lưu' button. Emerald, slate, and glassmorphic aesthetic."

---

### Screen 2: Product Catalog Screen (Màn hình Quản Lý Sản Phẩm)

#### Visual Layout & Elements
1. **Top Bar**:
   - Search bar: *"Tìm kiếm sản phẩm hoặc từ viết tắt..."*.
   - FAB Button: `+ Thêm SP` (Emerald Floating Action Button at bottom right).
2. **Product List Cards**:
   - Card Header: Product Name (Bold 17pt, e.g. "Gạo ST25").
   - Aliases Badge: Gray Pill Badge displaying shorthand keywords (e.g. `Viết tắt: ST, ST25, Sóc Trăng`).
   - Unit Price Tag: Emerald Green text (e.g. `33.000 đ / kg`).
   - Right Side Actions: `Sửa` (Blue text button), `Xóa` (Red trash icon).
3. **Add/Edit Product Modal**:
   - Form Fields: Tên sản phẩm, Tên gọi ngắn (Aliases), Đơn vị tính (`kg`, `túi`, `bao`), Đơn giá (VNĐ).
   - Action Buttons: `Hủy` & `Lưu sản phẩm`.

#### 🤖 Google Stitch Prompt for Screen 2
> **Prompt**: "Design a mobile product catalog management screen for a retail store app. Clean top search bar with a magnifying glass icon. List of elegant product cards. Each card displays the product title (e.g. 'Gạo ST25'), a muted gray alias badge tag showing shorthand spoken keywords ('ST, ST25'), and a bold emerald green unit price ('33.000 đ / kg'). Right actions feature Blue edit text and Red delete trash icon. Bottom right features a floating emerald green FAB button with '+ Thêm SP'. Clean white background, slate text, modern rounded corners."

---

### Screen 3: Invoices History & Reports Screen (Màn hình Báo Cáo)

#### Visual Layout & Elements
1. **Period Segmented Control Tab**:
   - Tabs: `Hôm Nay` | `Tuần Này` | `Tháng Này` | `Tất Cả`. Active tab has Emerald white pill background.
2. **Summary Metric Cards (Bảng Thống Kê Doanh Thu)**:
   - Full-width Emerald Gradient Card `#10B981` -> `#059669`.
   - Left Metric: Total Revenue (e.g. `1.250.000 đ`).
   - Middle Metric: Total Quantity (e.g. `45 kg`).
   - Right Action: **"📊 Xuất Excel"** button in dark green `#047857` with share icon.
3. **Invoice History Cards**:
   - Invoice Header: Code `HD-20260729-001` + Date timestamp `10:30 29/07/2026`.
   - Customer Tag: `Khách hàng: Chị Hoa`.
   - Bullet items list: `• Gạo ST25: 1 kg x 33.000 đ = 33.000 đ`.
   - Bottom Right Total: Bold Emerald Net Amount `Thực thu: 75.000 đ`.

#### 🤖 Google Stitch Prompt for Screen 3
> **Prompt**: "Design a mobile invoice history and report screen. Top features a segmented control bar (Hôm Nay, Tuần Này, Tháng Này, Tất Cả). Below is a striking hero metrics banner card in emerald green gradient displaying 'Doanh Thu' total revenue in large bold white text, 'Tổng Kg Bán' volume, and a dark green '📊 Xuất Excel' export button. Below is a list of clean invoice transaction cards showing invoice code, date timestamp, line items breakdown, and net total amount in bold green. Modern UI, dark slate and emerald accents."

---

### Screen 4: Settings Screen (Màn hình Cài Đặt API Key)

#### Visual Layout & Elements
1. **Header**: "CÀI ĐẶT HỆ THỐNG" (Bold 20pt Slate).
2. **Gemini API Key Setup Card**:
   - Icon: Key / Security Shield Icon.
   - Title: *"Cấu hình Gemini API Key"*.
   - Description: *"Nhập Google Gemini API Key để kích hoạt tính năng bóc tách hóa đơn giọng nói AI"*.
   - Password/Masked Input: `••••••••••••••••••••••••` with Eye toggle icon.
   - Status Indicator: Verified Green checkmark badge `✓ API Key hợp lệ` or Amber warning `⚠️ Chưa cấu hình`.
   - Action Buttons: `Kiểm Tra & Lưu` (Emerald Button) & `Xóa Key` (Outline Gray Button).

#### 🤖 Google Stitch Prompt for Screen 4
> **Prompt**: "Design a mobile settings screen for configuring Google Gemini AI API key. Clean card container with a key security icon. Contains a masked password input field for API Key with an eye toggle icon. Status pill badge showing '✓ API Key hợp lệ' in green. Two action buttons: an emerald green 'Kiểm Tra & Lưu' primary button and a secondary outline button. Modern minimalist settings layout with slate background and emerald highlights."

---

## 🧭 3. Global Navigation Architecture

- **Bottom Navigation Bar**:
  - Tab 1: `🎙️ Bán Hàng` (Home / Voice Billing)
  - Tab 2: `📦 Sản Phẩm` (Product Catalog)
  - Tab 3: `📊 Báo Cáo` (Invoices & Excel Export)
  - Tab 4: `⚙️ Cài Đặt` (API Key & Settings)
