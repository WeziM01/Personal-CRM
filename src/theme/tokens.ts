import { Platform } from "react-native";

export const colors = {
  primaryAction: "#111111",
  background: "#F6F3EE",
  surface: "#FFFFFF",
  surfaceMuted: "#ECE7DE",
  surfaceStrong: "#E2DBD1",
  border: "#D6D0C7",
  textPrimary: "#111111",
  textSecondary: "#5F5A52",
  textTertiary: "#8F897F",
  destructive: "#7F1D1D",
  success: "#202020",
  successSoft: "#EAF8EE",
  accentSoft: "#EFE9DF",
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  card: 22,
  cardLg: 28,
  button: 18,
  pill: 999,
} as const;

const displayFont = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "500" as const,
    fontFamily: displayFont,
  },
  h1: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700" as const,
    fontFamily: displayFont,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 1.1,
  },
} as const;

export const layout = {
  screenPaddingHorizontal: spacing.lg,
  stackGap: spacing.md,
  sectionGap: spacing.lg,
  minTouchTarget: 48,
  stickyBottomInset: 104,
} as const;
