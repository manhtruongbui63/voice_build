# VoiceBill - Google Stitch Mobile & Tablet App Master Design Specification

**Target Tool**: Google Stitch / AI Mobile UI Generator  
**Design System Aesthetic**: Deep Navy Voice AI & Glassmorphism  
**Target Form Factors**: Mobile Phones (375x812 pt) & Tablets / iPads (768x1024 pt & 1024x768 pt POS view)  
**Primary Color Palette**: Primary `#05163A`, Secondary `#B29469`, Tertiary `#62B3EC`, Neutral `#76AAD1`, White `#FFFFFF`

---

## 🎨 1. Design System & Responsive Adaptive Tokens

### Form Factor & Adaptive Layout Strategy
- **Mobile Phones (< 768px)**:
  - Single-column stacked layouts, bottom sheet modals, sticky bottom primary buttons, 4-tab bottom navigation bar.
- **Tablets / iPads (≥ 768px)**:
  - Multi-column split views (2-Column POS Split View for Billing, Multi-column Grid for Catalog, Master-Detail View for Reports).
  - Navigation switches to Left Side Rail (Sidebar) or Top Navigation Bar on Landscape view.

### Color Tokens
- **Primary Brand**: Deep Navy `#05163A`
- **Secondary Accent**: Warm Gold `#B29469`
- **Tertiary Accent**: Sky Cyan `#62B3EC`
- **Neutral Support**: Soft Blue `#76AAD1`
- **Background / Surface**: Pure White `#FFFFFF`, Deep Navy Header `#05163A`
- **AI Warning / Confidence Alert**: Amber Yellow `#F59E0B` (Warning Surface: `#FEF3C7`, Warning Border: `#F59E0B`)
- **Error Accent**: Crimson Red `#EF4444`
- **Text Hierarchy**:
  - Primary Text: Deep Navy `#05163A`
  - Secondary Text: Soft Blue `#76AAD1`
  - Inverse Text: Pure White `#FFFFFF`

### Typography & Component Specs
- **Font Family**: `Inter` / `Plus Jakarta Sans`
- **Border Radius**: Cards `16px`, Modals/Side Panels `24px`, Action Buttons `12px`, Badges `8px`, Microphone Circle `70px` (Circular 140x140px on phone, 180x180px on tablet hero)
- **Shadows & Glassmorphism**:
  - Soft Card Elevation: `0px 10px 25px rgba(15, 23, 42, 0.06)`
  - Active Mic Pulse Shadow: `0px 0px 40px rgba(16, 185, 129, 0.4)`
  - Glass Backdrop Blur: `backdrop-filter: blur(12px)`, Background `rgba(255, 255, 255, 0.85)`

---

## 📋 2. Business Rules & Functional Requirements Overview

1. **Voice-to-Text & Contextual Biasing**:
   - Spoken Vietnamese voice input is recognized and matched against registered product aliases (e.g. `ST` -> `Gạo ST25`).
   - Supports natural speech corrections (e.g., *"bán 1kg ST à không lấy 2kg"*).

2. **AI Line Item Extraction & Confidence Alerting**:
   - Recognized items are rendered in the **Draft Invoice View**.
   - If AI match confidence is **`< 0.8`**, the item row must be styled with a **Yellow Amber background `#FEF3C7`**, warning border `#F59E0B`, and a warning icon `⚠️` to alert the merchant to verify quantity/price.

3. **Flexible Payment Method Handling**:
   - Supports 2 payment options: **"Tiền mặt" (Cash)** and **"Chuyển khoản" (Bank Transfer)**.
   - When **"Chuyển khoản"** is selected, the *"Khách đưa"* (Cash Paid) and *"Tiền thừa"* (Change Due) input fields are dynamically hidden.
   - Default payment method is configurable in Settings (defaults to *"Chuyển khoản"*).

4. **Product Catalog & Keyword Aliases**:
   - Products contain official names, unit prices, default units (`kg`, `túi`, `bao`), and a list of spoken aliases (`ST`, `ST25`, `Sóc Trăng`).

5. **Invoices History & Excel Reporting**:
   - Track full transaction logs with invoice code (`HD-20260730-001`), payment method badge, customer notes, and item breakdown.
   - Summary statistics banner displays total revenue, total sales volume, and a **"📊 Xuất Excel"** export trigger.

---

## 📱 3. Detailed Screens Breakdown & Google Stitch Prompts (Mobile & Tablet)

### Screen 1: Voice Billing Screen (Màn hình Bán Hàng Giọng Nói)

#### Responsive Layout Behavior
- **Mobile Phone Layout**:
  - Hero centered Mic button (140px) + Live Transcript card below.
  - Tapping mic triggers voice recording; finishing pops up a **Draft Invoice Bottom Sheet Modal**.
- **Tablet / iPad Layout (POS Split Screen)**:
  - **Left Column (40%)**: Hero Recording Console with large 180px Mic button + Live Speech Transcript glass card.
  - **Right Column (60%)**: Permanent POS Checkout Panel displaying the real-time Draft Invoice Table, Payment Method segmented control, Low-confidence Amber warning rows, Subtotal/Cash inputs, and full-height checkout action.

#### 🤖 Google Stitch Prompt for Screen 1 (Mobile & Tablet Responsive)
```text
Design a responsive mobile and tablet app screen for a voice-activated retail POS app named 'VoiceBill' supporting both mobile phone and tablet/iPad form factors.

Mobile View (375x812 pt): Top bar with emerald green logo and green API status badge. Centered 140px emerald green microphone button with animated ripple rings. Below it is a glassmorphic transcript card. Spoken results trigger a slide-up Draft Invoice Bottom Sheet Modal with payment method segmented control ('Tiền mặt' / 'Chuyển khoản'), line items table with amber warning cards (#FEF3C7) for low-confidence AI matches (<0.8 confidence), subtotal, cash paid inputs, and a green primary button.

Tablet View (1024x768 pt POS View): A side-by-side 2-column split POS screen layout. Left 40% column displays the voice console with a 180px glowing emerald mic button and live transcript card. Right 60% column is a permanent dark slate & glassmorphic checkout panel displaying the line item breakdown, amber AI warning cards ⚠️, payment method toggle, cash/change calculations, and large 'Xác Nhận & Lưu Hóa Đơn' confirm button. Emerald green accents, dark slate typography, clean glassmorphic aesthetic.
```

---

### Screen 2: Product Catalog & Aliases Screen (Màn hình Quản Lý Sản Phẩm)

#### Responsive Layout Behavior
- **Mobile Phone Layout**: Single-column vertical list of product cards with search bar at top.
- **Tablet / iPad Layout**: 2-Column or 3-Column responsive Grid Layout for product cards. Tapping "Sửa" or "+ Thêm SP" opens a side drawer panel on the right instead of a full screen popup.

#### 🤖 Google Stitch Prompt for Screen 2 (Mobile & Tablet Responsive)
```text
Design a responsive mobile and tablet product catalog management screen for a retail store app.

Top Section: Search bar with magnifying glass icon 'Tìm sản phẩm hoặc từ viết tắt...' and top right emerald green '+ Thêm SP' button.

Mobile Phone Layout: 1-column list of white product cards with 16px rounded corners. Each card displays product title (e.g. 'Gạo ST25'), light gray alias badge ('Viết tắt: ST, ST25'), bold emerald green price tag ('33.000 đ / kg'), blue edit link, and red trash delete icon.

Tablet / iPad Layout: Responsive 3-column grid of product cards with expanded keyword alias tags and quick action buttons. Side drawer overlay appears on the right for editing or adding new products. Clean slate background, modern typography, emerald green highlights.
```

---

### Screen 3: Invoices History & Excel Reports Screen (Màn hình Lịch Sử & Báo Cáo)

#### Responsive Layout Behavior
- **Mobile Phone Layout**: Vertical list of invoice cards with a top summary banner and period tabs.
- **Tablet / iPad Layout**: Master-Detail split view.
  - Left Panel (40%): Revenue summary banner card + List of completed invoices.
  - Right Panel (60%): Detailed itemized receipt view of the selected invoice, complete with customer notes, payment method breakdown, individual items, subtotal/discount/tax, and print/share options.

#### 🤖 Google Stitch Prompt for Screen 3 (Mobile & Tablet Responsive)
```text
Design a responsive mobile and tablet invoice history and financial reporting screen.

Top Header: Period segmented tab bar ('Hôm Nay', 'Tuần Này', 'Tháng Này', 'Tất Cả') with emerald active state.

Mobile View: Stacked layout with a top emerald green gradient banner (#10B981 to #059669) showing Total Revenue, Volume, and '📊 Xuất Excel' button, followed by a list of invoice cards with payment badges ('Chuyển khoản' / 'Tiền mặt').

Tablet / iPad View: Master-Detail split-screen layout. Left 40% panel displays the revenue metric banner and scrollable list of invoices. Right 60% panel displays the expanded digital receipt preview of the selected invoice with itemized bullet points, payment badge, customer notes, tax/discount details, and an emerald '📊 Xuất Excel' export button at top right. Clean dark slate and glassmorphic UI.
```

---

### Screen 4: Settings & Configuration Screen (Màn hình Cài Đặt)

#### Responsive Layout Behavior
- **Mobile Phone Layout**: Single-column stacked setting cards.
- **Tablet / iPad Layout**: Centered card layout with max-width container (680px max-width) or 2-column side-by-side settings categories (API Key configuration on left, Payment & POS defaults on right).

#### 🤖 Google Stitch Prompt for Screen 4 (Mobile & Tablet Responsive)
```text
Design a responsive mobile and tablet settings screen for Gemini AI API Key configuration and store defaults.

Mobile View: 1-column layout with cards for Gemini API Key (masked input with eye icon, green '✓ API Key hợp lệ' badge, emerald save button) and Default Payment Method ('Chuyển khoản' / 'Tiền mặt' toggle).

Tablet View: A dual-column side-by-side settings dashboard layout (or centered 680px card layout). Left column features the Gemini API Key security card with masked input field and status indicator. Right column features store defaults, payment method toggles, and POS receipt printer settings. Emerald green interactive controls, slate white surface cards, soft shadow drops.
```

---

## 🧭 4. Global Navigation Architecture (Mobile & Tablet)

- **Mobile Phones**: Bottom Navigation Bar (4 Tabs: `🎙️ Bán Hàng`, `📦 Sản Phẩm`, `📊 Báo Cáo`, `⚙️ Cài Đặt`).
- **Tablets / iPads**: Left Side Navigation Rail / Sidebar (Icons + Labels) for quick switching in landscape POS mode, automatically collapsible in portrait.

---
