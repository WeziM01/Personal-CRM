import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { colors, typography } from "../../theme/tokens";

type Variant = "display" | "h1" | "h2" | "body" | "caption";

type TypographyProps = {
  children: ReactNode;
  variant?: Variant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const variantStyles: Record<Variant, TextStyle> = {
  display: {
    ...typography.display,
    color: colors.textPrimary,
  },
  h1: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  h2: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
};

export function Typography({
  children,
  variant = "body",
  style,
  numberOfLines,
}: TypographyProps) {
  return (
    <Text
      style={[styles.base, variantStyles[variant], style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
