---
name: VoiceBill Design System
colors:
  surface: '#f4fbf4'
  surface-dim: '#d4dcd5'
  surface-bright: '#f4fbf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef6ee'
  surface-container: '#e8f0e9'
  surface-container-high: '#e3eae3'
  surface-container-highest: '#dde4dd'
  on-surface: '#161d19'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2b322d'
  inverse-on-surface: '#ebf3eb'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#0053db'
  on-tertiary: '#ffffff'
  tertiary-container: '#7f9fff'
  on-tertiary-container: '#00328b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f4fbf4'
  on-background: '#161d19'
  surface-variant: '#dde4dd'
  emerald-active: '#059669'
  emerald-soft: '#D1FAE5'
  warning-amber: '#F59E0B'
  warning-surface: '#FEF3C7'
  error-crimson: '#EF4444'
  mint: '#34D399'
  slate-bg: '#F8FAFC'
  cool-gray-muted: '#64748B'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-mobile: 1rem
  margin-tablet: 2rem
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 1.5rem
---

# VoiceBill - Google Stitch Mobile & Tablet App Master Design Specification

**Target Tool**: Google Stitch / AI Mobile UI Generator  
**Design System Aesthetic**: Modern Emerald & Dark Slate Glassmorphism  
**Target Form Factors**: Mobile Phones (375x812 pt) & Tablets / iPads (768x1024 pt & 1024x768 pt POS view)  
**Primary Color Palette**: Emerald Green (`#10B981`), Dark Slate (`#0F172A`), Amber Yellow (`#F59E0B`), Ocean Blue (`#2563EB`)

---

## 🎨 1. Design System & Responsive Adaptive Tokens

### Form Factor & Adaptive Layout Strategy
- **Mobile Phones (< 768px)**:
  - Single-column stacked layouts, bottom sheet modals, sticky bottom primary buttons, 4-tab bottom navigation bar.
- **Tablets / iPads (≥ 768px)**:
  - Multi-column split views (2-Column POS Split View for Billing, Multi-column Grid for Catalog, Master-Detail View for Reports).
  - Navigation switches to Left Side Rail (Sidebar) or Top Navigation Bar on Landscape view.

### Color Tokens
- **Primary Brand**: Emerald Green `#10B981` (Active: `#059669`, Soft Container: `#D1FAE5`)
- **Background / Surface**: Slate Background `#F8FAFC`, Pure White `#FFFFFF`, Dark Slate Header `#0F172A`
- **AI Warning / Confidence Alert**: Amber Yellow `#F59E0B` (Warning Surface: `#FEF3C7`, Warning Border: `#F59E0B`)
- **Accent & Actions**: Ocean Blue `#2563EB` (Edit/Info), Crimson Red `#EF4444` (Delete/Error), Mint Green `#34D399`
- **Text Hierarchy**:
  - Primary Text: Dark Slate `#0F172A`
  - Secondary Text: Muted Cool Gray `#64748B`
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
2. **AI Line Item Extraction & Confidence Alerting**:
   - Recognized items are rendered in the **Draft Invoice View**.
   - If AI match confidence is **`< 0.8`**, the item row must be styled with a **Yellow Amber background `#FEF3C7`**, warning border `#F59E0B`, and a warning icon `⚠️` to alert the merchant to verify quantity/price.
3. **Flexible Payment Method Handling**:
   - Supports 2 payment options: **"Tiền mặt" (Cash)** and **"Chuyển khoản" (Bank Transfer)**.
   - When **"Chuyển khoản"** is selected, the *"Khách đưa"* (Cash Paid) and *"Tiền thừa"* (Change Due) input fields are dynamically hidden.

---

## 🧭 3. Global Navigation Architecture (Mobile & Tablet)

- **Mobile Phones**: Bottom Navigation Bar (4 Tabs: `🎙️ Bán Hàng`, `📦 Sản Phẩm`, `📊 Báo Cáo`, `⚙️ Cài Đặt`).
- **Tablets / iPads**: Left Side Navigation Rail / Sidebar (Icons + Labels).
