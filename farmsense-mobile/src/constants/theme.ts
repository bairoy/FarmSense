/**
 * Design tokens ported from stitch_farmsense_mobile_ui_design/agri_precision_sunlight_system —
 * a single sunlight-optimized light theme (no dark variant: the brand is built specifically
 * for outdoor daylight legibility, so there is nothing to invert).
 */

/** Brand + functional status colors — flat, not light/dark pairs. */
export const Palette = {
  primary: '#2F6B3A',
  primaryPressed: '#1D4524',
  primaryTint: '#E8F2EA',

  positive: '#16A34A',
  positiveTint: '#DCFCE7',
  warning: '#D97706',
  warningTint: '#FEF3C7',
  danger: '#DC2626',
  dangerTint: '#FEE2E2',
  info: '#0284C7',
  infoTint: '#E0F2FE',
} as const;

export const Colors = {
  text: '#17221A',
  textSecondary: '#4D5E52',
  textTertiary: '#76887B',
  background: '#F7F9F6',
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#E8F2EA',
  border: '#E2E8E2',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

/** Inter, loaded via @expo-google-fonts/inter in the root layout. */
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Type = {
  headlineXl: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.4 },
  headlineLg: { fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  headlineMd: { fontFamily: FontFamily.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  metricDisplay: { fontFamily: FontFamily.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  titleSm: { fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: FontFamily.regular, fontSize: 17, lineHeight: 24 },
  bodyMd: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 22 },
  bodyMdBold: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
  labelMd: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0.2 },
  labelSm: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabHeight = 64;
export const MaxContentWidth = 800;
