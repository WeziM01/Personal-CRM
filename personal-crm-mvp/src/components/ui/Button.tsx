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

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  variant?: ButtonVariant;
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
    minHeight: 56,
    borderRadius: radius.button,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: colors.primaryAction,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.textSecondary,
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
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
