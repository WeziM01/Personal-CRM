import { useMemo, useState } from "react";
import { Modal, SafeAreaView, StyleSheet, View } from "react-native";

import { FloatingFab } from "../components/FloatingFab";
import { NoteCard, NoteCardItem } from "../components/NoteCard";
import { Button } from "../components/ui/Button";
import { GhostInput } from "../components/ui/GhostInput";
import { AppList } from "../components/ui/List";
import { Typography } from "../components/ui/Typography";
import { colors, layout } from "../theme/tokens";

const demoData: NoteCardItem[] = [
	{
		id: "1",
		personName: "Sarah (Stripe)",
		rawNote: "Met at coffee stand. Spoke about Expo Router and analytics stack.",
		eventName: "React Native EU",
		createdAtLabel: "10:30",
	},
	{
		id: "2",
		personName: null,
		rawNote: "Blue blazer, AI infra startup, asked about Supabase edge functions.",
		eventName: "React Native EU",
		createdAtLabel: "11:08",
	},
];

export function FeedScreen() {
	const [isCaptureOpen, setCaptureOpen] = useState(false);
	const [captureText, setCaptureText] = useState("");

	const feed = useMemo(() => demoData, []);

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.container}>
				<Typography variant="h1" style={styles.heading}>
					Interactions
				</Typography>

				<AppList
					data={feed}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => <NoteCard item={item} />}
					ListEmptyComponent={<Typography variant="body">No notes yet.</Typography>}
					showsVerticalScrollIndicator={false}
				/>

				<FloatingFab onPress={() => setCaptureOpen(true)} />
			</View>

			<Modal visible={isCaptureOpen} animationType="slide" onRequestClose={() => setCaptureOpen(false)}>
				<SafeAreaView style={styles.modalSafeArea}>
					<View style={styles.modalContainer}>
						<Typography variant="h1">Quick Capture</Typography>

						<GhostInput
							placeholder="Met someone from..."
							value={captureText}
							onChangeText={setCaptureText}
							autoFocus
						/>

						<Button label="Save Interaction" onPress={() => setCaptureOpen(false)} />
						<Button
							label="Cancel"
							variant="ghost"
							onPress={() => setCaptureOpen(false)}
						/>
					</View>
				</SafeAreaView>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: colors.background,
	},
	container: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: layout.screenPaddingHorizontal,
		paddingTop: layout.stackGap,
	},
	heading: {
		marginBottom: layout.stackGap,
	},
	modalSafeArea: {
		flex: 1,
		backgroundColor: colors.background,
	},
	modalContainer: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: layout.screenPaddingHorizontal,
		paddingTop: layout.stackGap,
		gap: layout.stackGap,
	},
});
