/**
 * VoiceBill Design Tokens
 * ------------------------------------------------------------------
 * Nguồn chân lý (single source of truth) cho màu sắc, typography, bo góc,
 * khoảng cách và đổ bóng của app. Được rút ra từ bản thiết kế Google Stitch
 * mới nhất (xem design/design.md).
 *
 * Quy ước: KHÔNG hard-code mã màu trong màn hình nữa — hãy import từ đây:
 *   import { colors, typography, radius, spacing } from '../theme/tokens';
 *
 * Màu chủ đạo đã thống nhất theo design system: Deep Navy #05163A,
 * Warm Gold #B29469, Voice AI Cyan #62B3EC, Soft Blue #76AAD1.
 */

/** Bảng màu — giữ tên token ổn định để toàn app kế thừa design system mới. */
export const colors = {
  // Brand / primary
  primary: '#05163A', // Deep Navy: thương hiệu, header, text/CTA quan trọng
  onPrimary: '#FFFFFF',
  primaryContainer: '#62B3EC', // Voice AI Cyan: micro, pulse, điểm nhấn nhận dạng giọng nói
  onPrimaryContainer: '#05163A',
  primaryContainerFaint: 'rgba(98, 179, 236, 0.12)', // nền cyan nhẹ (badge, pill nav active)
  primaryContainerBorder: 'rgba(98, 179, 236, 0.28)', // viền cyan nhẹ
  primaryContainerGlow: 'rgba(98, 179, 236, 0.55)', // vòng sáng pulse quanh nút micro
  primaryActive: '#B29469', // Warm Gold: trạng thái nhấn/nhấn mạnh doanh thu
  primarySoft: '#EAF4FB', // nền nhạt của voice/brand blocks
  onPrimaryFixedVariant: '#05163A', // chữ đậm trên nền primarySoft (vd badge "Chế độ AI")
  inversePrimary: '#62B3EC',

  // Secondary / tertiary
  secondary: '#B29469',
  onSecondary: '#05163A',
  secondaryContainer: '#F4ECDZ',
  onSecondaryContainer: '#5C4425',
  tertiary: '#62B3EC',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#D9EEFC',

  // Surfaces / backgrounds
  background: '#F7FAFD',
  onBackground: '#05163A',
  surface: '#F7FAFD',
  surfaceDim: '#D7E6F0',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F0F7FC',
  surfaceContainer: '#EAF4FB',
  surfaceContainerHigh: '#DDECF5',
  surfaceContainerHighest: '#D7E6F0',
  surfaceVariant: '#D7E6F0',
  slateBg: '#F7FAFD',

  // Text
  onSurface: '#05163A',
  onSurfaceVariant: '#416C8A',
  textSecondary: '#5E8FB2',
  inverseSurface: '#05163A',
  inverseOnSurface: '#FFFFFF',

  // Outline / border
  outline: '#76AAD1',
  outlineVariant: '#D7E6F0',

  // Trạng thái ngữ nghĩa
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  errorCrimson: '#EF4444', // Delete/Error dạng sáng
  warningAmber: '#F59E0B', // cảnh báo AI confidence thấp
  warningSurface: '#FEF3C7', // nền cảnh báo
  mint: '#62B3EC',

  // Thang neutral ngả xanh theo palette mới, dùng cho text/nền/viền trung tính.
  neutral50: '#F7FAFD',
  neutral100: '#EEF6FB',
  neutral200: '#D7E6F0',
  neutral300: '#B8D3E5',
  neutral400: '#76AAD1',
  neutral500: '#5E8FB2',
  neutral600: '#416C8A',
  neutral700: '#234A66',
  neutral800: '#102B45',
  neutral900: '#05163A',
  white: '#FFFFFF',
  glassSurface: 'rgba(255, 255, 255, 0.82)', // nền thẻ kiểu glass (xấp xỉ backdrop-blur)
  glassBorder: 'rgba(255, 255, 255, 0.92)',
  outlineVariantSoft: 'rgba(118, 170, 209, 0.28)', // viền mảnh header/nav
  primarySoftFaint: 'rgba(234, 244, 251, 0.75)', // nền voice/AI helper
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
    shadowColor: '#62B3EC',
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
