import { StyleSheet, View } from "react-native";

import { colors } from "../theme/tokens";
import { Card } from "./ui/Card";
import { Typography } from "./ui/Typography";

export type NoteCardItem = {
	id: string;
	personName?: string | null;
	rawNote: string;
	eventName?: string | null;
	createdAtLabel: string;
};

type NoteCardProps = {
	item: NoteCardItem;
};

export function NoteCard({ item }: NoteCardProps) {
	return (
		<Card>
			<View style={styles.topRow}>
				<Typography variant="h2">{item.personName || "Unknown contact"}</Typography>
				<Typography variant="caption">{item.createdAtLabel}</Typography>
			</View>

			<Typography variant="body" style={styles.note}>
				{item.rawNote}
			</Typography>

			{item.eventName ? (
				<Typography variant="caption" style={styles.tag}>
					{item.eventName}
				</Typography>
			) : null}
		</Card>
	);
}

const styles = StyleSheet.create({
	topRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	note: {
		marginTop: 12,
	},
	tag: {
		marginTop: 14,
		color: colors.textSecondary,
	},
});
