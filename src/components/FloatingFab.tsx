import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { colors } from "../theme/tokens";
import { Typography } from "./ui/Typography";

type FloatingFabProps = {
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
	label?: string;
	extended?: boolean;
};

export function FloatingFab({ onPress, style, label = "+", extended = false }: FloatingFabProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Add note"
			onPress={onPress}
			style={({ pressed }) => [
				styles.fabBase,
				extended ? styles.extendedFab : styles.roundFab,
				pressed ? styles.pressed : null,
				style,
			]}
		>
			{extended ? (
				<>
					<Typography variant="h2" style={styles.plusLabel}>
						+
					</Typography>
					<Typography variant="body" style={styles.extendedLabel}>
						{label}
					</Typography>
				</>
			) : (
				<Typography variant="h1" style={styles.roundLabel}>
					{label}
				</Typography>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	fabBase: {
		position: "absolute",
		right: 24,
		bottom: 32,
		zIndex: 50,
		borderRadius: 999,
		backgroundColor: colors.primaryAction,
		borderWidth: 1,
		borderColor: colors.primaryAction,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.18,
		shadowRadius: 16,
		elevation: 8,
	},
	roundFab: {
		width: 64,
		height: 64,
	},
	extendedFab: {
		minHeight: 56,
		minWidth: 180,
		paddingHorizontal: 20,
	},
	roundLabel: {
		color: colors.background,
		lineHeight: 30,
		marginTop: -2,
	},
	plusLabel: {
		color: colors.background,
	},
	extendedLabel: {
		color: colors.background,
		fontWeight: "700",
	},
	pressed: {
		opacity: 0.9,
	},
});
