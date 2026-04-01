import { useEffect, useMemo, useState } from "react";
import {
	Modal,
	Pressable,
	SafeAreaView,
	StyleSheet,
	View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { GhostInput } from "../components/ui/GhostInput";
import { Typography } from "../components/ui/Typography";
import { colors, layout, radius } from "../theme/tokens";

export type ParsedPersonDraft = {
	name: string;
	event: string;
	notes: string;
	followUp: string;
	rawInput: string;
};

type CaptureModalProps = {
	visible: boolean;
	onClose: () => void;
	onSave: (draft: ParsedPersonDraft) => void;
	isSaving?: boolean;
};

const exampleText =
	"Met Sarah from Stripe at React Native EU. Notes: talked about Expo analytics and onboarding. Follow up: send her the mobile metrics deck.";

function cleanValue(value: string) {
	return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function readTaggedValue(text: string, label: string) {
	const regex = new RegExp(`${label}\\s*[:.-]\\s*(.+)`, "i");
	const match = text.match(regex);
	return match ? cleanValue(match[1]) : "";
}

function parseDraft(input: string): ParsedPersonDraft {
	const trimmed = input.trim();

	const explicitName = readTaggedValue(trimmed, "name");
	const explicitEvent = readTaggedValue(trimmed, "event");
	const explicitNotes = readTaggedValue(trimmed, "notes?");
	const explicitFollowUp = readTaggedValue(trimmed, "follow\s*up");

	const nameMatch =
		trimmed.match(/met\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i) ||
		trimmed.match(/name\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i);

	const eventMatch =
		trimmed.match(/at\s+([A-Z][A-Za-z0-9+&\-\s]{2,40})[\.,]/) ||
		trimmed.match(/event\s+[:.-]\s*([^\n\.]+)/i);

	const followUpMatch =
		trimmed.match(/follow\s*up\s*[:.-]\s*([^\.\n]+)/i) ||
		trimmed.match(/follow up\s+to\s+([^\.\n]+)/i);

	const name = cleanValue(explicitName || nameMatch?.[1] || "Unknown contact");
	const event = cleanValue(explicitEvent || eventMatch?.[1] || "No event");
	const followUp = cleanValue(explicitFollowUp || followUpMatch?.[1] || "None yet");

	const notes = cleanValue(
		explicitNotes ||
			trimmed
				.replace(/follow\s*up\s*[:.-]\s*([^\.\n]+)/i, "")
				.replace(/name\s*[:.-]\s*([^\n]+)/i, "")
				.replace(/event\s*[:.-]\s*([^\n]+)/i, "")
	);

	return {
		name,
		event,
		notes: notes || trimmed,
		followUp,
		rawInput: trimmed,
	};
}

export function CaptureModal({ visible, onClose, onSave, isSaving = false }: CaptureModalProps) {
	const [rawInput, setRawInput] = useState("");
	const [isRecording, setRecording] = useState(false);
	const [step, setStep] = useState<"capture" | "confirm">("capture");

	useEffect(() => {
		if (!visible) {
			setRawInput("");
			setRecording(false);
			setStep("capture");
		}
	}, [visible]);

	const parsedDraft = useMemo(() => parseDraft(rawInput), [rawInput]);

	const canContinue = rawInput.trim().length > 0;

	function handleContinue() {
		if (!canContinue) {
			return;
		}

		setStep("confirm");
	}

	function handleSave() {
		if (isSaving) {
			return;
		}

		onSave(parsedDraft);
	}

	function handleMicPress() {
		setRecording((current) => !current);

		if (!rawInput.trim()) {
			setRawInput(exampleText);
		}
	}

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.container}>
					{step === "capture" ? (
						<>
							<View style={styles.headerRow}>
								<Typography variant="h1">Add Person</Typography>
								<Pressable onPress={onClose} hitSlop={12}>
									<Typography variant="body" style={styles.closeText}>
										Close
									</Typography>
								</Pressable>
							</View>

							<Pressable
								onPress={handleMicPress}
								style={[styles.micButton, isRecording ? styles.micButtonActive : null]}
							>
								<Typography variant="display" style={styles.micIcon}>
									{isRecording ? "■" : "●"}
								</Typography>
							</Pressable>

							<View style={styles.micCopyWrap}>
								<Typography variant="h2" style={styles.centerText}>
									{isRecording ? "Recording stub on" : "Tap to dictate"}
								</Typography>
								<Typography variant="body" style={styles.helperText}>
									Fast path: speak or paste a rough brain dump. The text field below is the fallback.
								</Typography>
							</View>

							<Card>
								<Typography variant="caption">Example</Typography>
								<Typography variant="body" style={styles.exampleText}>
									{exampleText}
								</Typography>
							</Card>

							<GhostInput
								placeholder={exampleText}
								value={rawInput}
								onChangeText={setRawInput}
								autoFocus
								style={styles.input}
							/>

							<View style={styles.footerButtons}>
								<Button label="Parse" onPress={handleContinue} disabled={!canContinue} />
								<Button label="Cancel" onPress={onClose} variant="ghost" />
							</View>
						</>
					) : (
						<>
							<View style={styles.headerRow}>
								<Typography variant="h1">Confirm</Typography>
								<Pressable onPress={() => setStep("capture")} hitSlop={12}>
									<Typography variant="body" style={styles.closeText}>
										Edit
									</Typography>
								</Pressable>
							</View>

							<View style={styles.confirmStack}>
								<Card>
									<Typography variant="caption">Name</Typography>
									<Typography variant="h2" style={styles.confirmValue}>
										{parsedDraft.name}
									</Typography>
								</Card>

								<Card>
									<Typography variant="caption">Event</Typography>
									<Typography variant="h2" style={styles.confirmValue}>
										{parsedDraft.event}
									</Typography>
								</Card>

								<Card>
									<Typography variant="caption">Notes</Typography>
									<Typography variant="body" style={styles.confirmValue}>
										{parsedDraft.notes}
									</Typography>
								</Card>

								<Card>
									<Typography variant="caption">Follow Up</Typography>
									<Typography variant="body" style={styles.confirmValue}>
										{parsedDraft.followUp}
									</Typography>
								</Card>
							</View>

							<View style={styles.footerButtons}>
								<Button label="Save Person" onPress={handleSave} loading={isSaving} />
								<Button label="Back" onPress={() => setStep("capture")} variant="ghost" />
							</View>
						</>
					)}
				</View>
			</SafeAreaView>
		</Modal>
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
		paddingBottom: layout.stackGap,
		gap: layout.stackGap,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	closeText: {
		color: colors.textSecondary,
		fontWeight: "600",
	},
	micButton: {
		alignSelf: "center",
		width: 144,
		height: 144,
		borderRadius: 72,
		backgroundColor: colors.primaryAction,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 14 },
		shadowOpacity: 0.18,
		shadowRadius: 20,
		elevation: 10,
	},
	micButtonActive: {
		backgroundColor: colors.destructive,
	},
	micIcon: {
		color: colors.background,
		lineHeight: 38,
	},
	micCopyWrap: {
		gap: 6,
	},
	centerText: {
		textAlign: "center",
	},
	helperText: {
		color: colors.textSecondary,
		textAlign: "center",
	},
	exampleText: {
		marginTop: 8,
		color: colors.textSecondary,
	},
	input: {
		minHeight: 180,
		fontSize: 22,
		lineHeight: 30,
		backgroundColor: colors.surface,
		borderRadius: radius.card,
		paddingHorizontal: 16,
	},
	footerButtons: {
		gap: 12,
	},
	confirmStack: {
		flex: 1,
		gap: 12,
	},
	confirmValue: {
		marginTop: 8,
	},
});
