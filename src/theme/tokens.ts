/**
 * VoiceBill Design Tokens
 * ------------------------------------------------------------------
 * Nguồn chân lý (single source of truth) cho màu sắc, typography, bo góc,
 * khoảng cách và đổ bóng của app. Được rút ra từ bản thiết kế Google Stitch
 * (xem docs/design/design-system.md).
 *
 * Quy ước: KHÔNG hard-code mã màu trong màn hình nữa — hãy import từ đây:
 *   import { colors, typography, radius, spacing } from '../theme/tokens';
 *
 * Màu chủ đạo (primary) đã thống nhất theo tokens Stitch: #006C49.
 */

/** Bảng màu — theo hệ Material-style tokens xuất từ Stitch. */
export const colors = {
  // Brand / primary
  primary: '#006C49', // màu chủ đạo (nút chính, nhấn mạnh)
  onPrimary: '#FFFFFF',
  primaryContainer: '#10B981', // emerald sáng — nền container/nhấn phụ
  onPrimaryContainer: '#00422B',
  primaryContainerFaint: 'rgba(16, 185, 129, 0.1)', // nền emerald 10% (badge, pill nav active)
  primaryContainerBorder: 'rgba(16, 185, 129, 0.2)', // viền emerald 20%
  primaryContainerGlow: 'rgba(16, 185, 129, 0.7)', // vòng sáng pulse quanh nút micro
  primaryActive: '#059669', // trạng thái nhấn/hover
  primarySoft: '#D1FAE5', // nền nhạt của primary (emerald-soft)
  onPrimaryFixedVariant: '#005236', // chữ đậm trên nền primarySoft (vd badge "Chế độ AI")
  inversePrimary: '#4EDEA3',

  // Secondary / tertiary
  secondary: '#565E74',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#DAE2FD',
  onSecondaryContainer: '#5C647A',
  tertiary: '#0053DB', // Ocean Blue — edit/info
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#7F9FFF',

  // Surfaces / backgrounds
  background: '#F4FBF4',
  onBackground: '#161D19',
  surface: '#F4FBF4',
  surfaceDim: '#D4DCD5',
  surfaceBright: '#F4FBF4',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#EEF6EE',
  surfaceContainer: '#E8F0E9',
  surfaceContainerHigh: '#E3EAE3',
  surfaceContainerHighest: '#DDE4DD',
  surfaceVariant: '#DDE4DD',
  slateBg: '#F8FAFC', // nền slate dùng ở một số màn

  // Text
  onSurface: '#161D19', // text chính
  onSurfaceVariant: '#3C4A42', // text phụ
  textSecondary: '#64748B', // cool gray muted
  inverseSurface: '#2B322D',
  inverseOnSurface: '#EBF3EB',

  // Outline / border
  outline: '#6C7A71',
  outlineVariant: '#BBCABF',

  // Trạng thái ngữ nghĩa
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  errorCrimson: '#EF4444', // Delete/Error dạng sáng
  warningAmber: '#F59E0B', // cảnh báo AI confidence thấp
  warningSurface: '#FEF3C7', // nền cảnh báo
  mint: '#34D399',

  // Thang xám trung tính (neutral) — bộ màu đang dùng trong app (Tailwind gray).
  // Dùng cho text/nền/viền trung tính. Thiết kế Stitch dùng neutral ngả xanh
  // (on-surface #161D19…); ở đây giữ đúng giá trị hiện hành để không đổi giao diện.
  neutral50: '#F9FAFB',
  neutral100: '#F3F4F6',
  neutral200: '#E5E7EB',
  neutral300: '#D1D5DB',
  neutral400: '#9CA3AF',
  neutral500: '#6B7280',
  neutral600: '#4B5563',
  neutral700: '#374151',
  neutral800: '#1F2937',
  neutral900: '#111827',
  white: '#FFFFFF',
  glassSurface: 'rgba(255, 255, 255, 0.7)', // nền thẻ kiểu glass (xấp xỉ backdrop-blur)
  glassBorder: 'rgba(255, 255, 255, 0.85)',
  outlineVariantSoft: 'rgba(187, 202, 191, 0.3)', // viền mảnh header/nav (outline-variant/30)
  primarySoftFaint: 'rgba(209, 250, 229, 0.4)', // nền emerald-soft/20 (khối AI helper)
  errorContainerFaint: 'rgba(255, 218, 214, 0.5)', // nền nút xóa (error-container/30)
} as const;

/**
 * Typography — Plus Jakarta Sans cho tiêu đề, Inter cho nội dung.
 * Mỗi weight là một font family riêng (font tùy biến load qua expo-font),
 * nên đặt fontFamily theo weight thay vì dùng fontWeight.
 */
export const fontFamily = {
  jakartaMedium: 'PlusJakartaSans_500Medium',
  jakartaSemiBold: 'PlusJakartaSans_600SemiBold',
  jakartaBold: 'PlusJakartaSans_700Bold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

export const typography = {
  headlineLg: { fontFamily: fontFamily.jakartaBold, fontSize: 32, lineHeight: 40 },
  headlineLgMobile: { fontFamily: fontFamily.jakartaBold, fontSize: 24, lineHeight: 32 },
  headlineMd: { fontFamily: fontFamily.jakartaSemiBold, fontSize: 20, lineHeight: 28 },
  bodyLg: { fontFamily: fontFamily.interRegular, fontSize: 18, lineHeight: 28 },
  bodyMd: { fontFamily: fontFamily.interRegular, fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: fontFamily.interRegular, fontSize: 14, lineHeight: 20 },
  labelMd: { fontFamily: fontFamily.interSemiBold, fontSize: 14, lineHeight: 20, letterSpacing: 0.28 },
  labelSm: { fontFamily: fontFamily.interMedium, fontSize: 12, lineHeight: 16 },
} as const;

/** Bo góc (px). Card=16, Modal/Panel=24, Button=12, Badge=8, Mic=full. */
export const radius = {
  sm: 4,
  md: 8,
  lg: 12, // button
  card: 16,
  xl: 24, // modal / side panel
  full: 9999,
} as const;

/** Khoảng cách (px). */
export const spacing = {
  marginMobile: 16,
  marginTablet: 32,
  gutter: 16,
  stackSm: 8,
  stackMd: 16,
  stackLg: 24,
} as const;

/** Đổ bóng / glassmorphism — dùng cho iOS (shadow*) và Android (elevation). */
export const elevation = {
  softCard: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 25,
    elevation: 4,
  },
  micPulse: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 12,
  },
} as const;

/** Ngưỡng responsive: < 768 = phone, >= 768 = tablet. */
export const breakpoints = {
  tablet: 768,
} as const;

export const theme = { colors, fontFamily, typography, radius, spacing, elevation, breakpoints } as const;
export type Theme = typeof theme;
export default theme;
