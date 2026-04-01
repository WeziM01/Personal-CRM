import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { colors, layout, radius } from "../../theme/tokens";
import { Typography } from "./Typography";

type ButtonVariant = "primary" | "ghost";

type ButtonSize = "default" | "compact";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  disabled,
  loading,
  fullWidth = true,
  leftIcon,
  variant = "primary",
  size = "default",
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const primary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        size === "compact" ? styles.compact : null,
        primary ? styles.primary : styles.ghost,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.background : colors.primaryAction} />
      ) : (
        <>
          {leftIcon}
          <Typography
            variant="body"
            style={primary ? styles.primaryLabel : styles.ghostLabel}
          >
            {label}
          </Typography>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.button,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  compact: {
    minHeight: 38,
    paddingHorizontal: 14,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: colors.primaryAction,
    borderWidth: 1,
    borderColor: colors.primaryAction,
  },
  ghost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: "700",
  },
  ghostLabel: {
    color: colors.primaryAction,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.45,
  },
});
