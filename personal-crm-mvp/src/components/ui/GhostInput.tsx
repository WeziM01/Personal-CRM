import { forwardRef } from "react";
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle } from "react-native";

import { colors, layout, typography } from "../../theme/tokens";

type GhostInputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

export const GhostInput = forwardRef<TextInput, GhostInputProps>(
  ({ style, placeholderTextColor = colors.textSecondary, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        multiline
        textAlignVertical="top"
        placeholderTextColor={placeholderTextColor}
        style={[styles.input, style]}
        {...props}
      />
    );
  }
);

GhostInput.displayName = "GhostInput";

const styles = StyleSheet.create({
  input: {
    ...typography.display,
    color: colors.textPrimary,
    minHeight: 160,
    width: "100%",
    paddingVertical: layout.stackGap,
  },
});
