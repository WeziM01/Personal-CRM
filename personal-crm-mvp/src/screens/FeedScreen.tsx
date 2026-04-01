import { useMemo, useState } from "react";
import { Alert, Modal, SafeAreaView, StyleSheet, View } from "react-native";

import { FloatingFab } from "../components/FloatingFab";
import { NoteCard, NoteCardItem } from "../components/NoteCard";
import {
	buildInteractionNote,
	createInteraction,
	createPerson,
	ensureSessionUserId,
	getOrCreateEvent,
} from "../lib/crm";
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

function cleanValue(value: string) {
	return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function parseQuickCapture(input: string) {
	const trimmed = input.trim();
	const nameMatch =
		trimmed.match(/met\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i) ||
		trimmed.match(/name\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i);

	const eventMatch =
		trimmed.match(/at\s+([A-Z][A-Za-z0-9+&\-\s]{2,40})[\.,]/) ||
		trimmed.match(/event\s*[:.-]\s*([^\n\.]+)/i);

	return {
		name: cleanValue(nameMatch?.[1] || ""),
		event: cleanValue(eventMatch?.[1] || ""),
	};
}

export function FeedScreen() {
	const [isCaptureOpen, setCaptureOpen] = useState(false);
	const [captureText, setCaptureText] = useState("");
	const [isSaving, setSaving] = useState(false);

	const feed = useMemo(() => demoData, []);

	async function handleSaveInteraction() {
		if (!captureText.trim() || isSaving) {
			return;
		}

		setSaving(true);

		try {
			const userId = await ensureSessionUserId();
			const parsed = parseQuickCapture(captureText);
			const person = await createPerson(userId, parsed.name);
			const event = parsed.event ? await getOrCreateEvent(userId, parsed.event) : null;

			await createInteraction({
				userId,
				personId: person.id,
				eventId: event?.id ?? null,
				rawNote: buildInteractionNote(captureText, ""),
			});

			setCaptureText("");
			setCaptureOpen(false);
			Alert.alert("Saved", "Interaction saved to Supabase.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to save interaction.";
			Alert.alert("Save failed", message);
		} finally {
			setSaving(false);
		}
	}

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

						<Button
							label="Save Interaction"
							onPress={handleSaveInteraction}
							disabled={!captureText.trim()}
							loading={isSaving}
						/>
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
