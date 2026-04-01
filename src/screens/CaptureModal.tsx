import { useEffect, useMemo, useState } from "react";
import {
	Modal,
	Pressable,
	SafeAreaView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import { EVENT_CATEGORY_OPTIONS, EventCategory, formatCategoryLabel } from "../lib/crm";
import { colors, layout, radius } from "../theme/tokens";

export type ParsedPersonDraft = {
	name: string;
	company: string;
	linkedinUrl: string;
	phoneNumber: string;
	event: string;
	eventCategory: EventCategory | "";
	notes: string;
	followUp: string;
	rawInput: string;
};

const emptyDraft: ParsedPersonDraft = {
	name: "",
	company: "",
	linkedinUrl: "",
	phoneNumber: "",
	event: "",
	eventCategory: "",
	notes: "",
	followUp: "",
	rawInput: "",
};

export type LockedEventDraft = {
	name: string;
	category: EventCategory;
};

type CaptureModalProps = {
	visible: boolean;
	onClose: () => void;
	onSave: (draft: ParsedPersonDraft) => void;
	title?: string;
	saveLabel?: string;
	isSaving?: boolean;
	initialDraft?: Partial<ParsedPersonDraft> | null;
	lockedEvent?: LockedEventDraft | null;
};

function cleanValue(value: string) {
	return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function buildDraftSentence(draft: ParsedPersonDraft) {
	const name = cleanValue(draft.name) || "someone";
	const company = cleanValue(draft.company) || "their company";
	const event = cleanValue(draft.event) || "somewhere memorable";
	const notes = cleanValue(draft.notes) || "what clicked between you";
	const followUp = cleanValue(draft.followUp) || "what to do next";

	return `I met ${name} from ${company} at ${event}. We talked about ${notes} and I need to ${followUp}.`;
}

export function CaptureModal({
	visible,
	onClose,
	onSave,
	title = "Add Person",
	saveLabel = "Save Person",
	isSaving = false,
	initialDraft,
	lockedEvent,
}: CaptureModalProps) {
	const [draft, setDraft] = useState<ParsedPersonDraft>(emptyDraft);
	const [showContactLinks, setShowContactLinks] = useState(false);

	useEffect(() => {
		if (visible) {
			setDraft({
				...emptyDraft,
				event: lockedEvent?.name || "",
				eventCategory: lockedEvent?.category || "",
				...initialDraft,
				event: lockedEvent?.name || initialDraft?.event || "",
				eventCategory: lockedEvent?.category || initialDraft?.eventCategory || "",
				rawInput: initialDraft?.rawInput || "",
			});
			setShowContactLinks(Boolean(initialDraft?.linkedinUrl || initialDraft?.phoneNumber));
		}
	}, [initialDraft, lockedEvent, visible]);

	const sentencePreview = useMemo(() => buildDraftSentence(draft), [draft]);

	const canSave = cleanValue(draft.name).length > 0 && cleanValue(draft.notes).length > 0;

	function updateField(field: keyof ParsedPersonDraft, value: string) {
		setDraft((current) => ({
			...current,
			[field]: value,
		}));
	}

	function handleSave() {
		if (isSaving || !canSave) {
			return;
		}

		onSave({
			...draft,
			name: cleanValue(draft.name),
			company: cleanValue(draft.company),
			linkedinUrl: cleanValue(draft.linkedinUrl),
			phoneNumber: cleanValue(draft.phoneNumber),
			event: cleanValue(draft.event) || "No event",
			eventCategory: draft.eventCategory,
			notes: cleanValue(draft.notes),
			followUp: cleanValue(draft.followUp) || "None yet",
			rawInput: sentencePreview,
		});
	}

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.container}>
					<View style={styles.headerRow}>
						<Typography variant="h1">{title}</Typography>
						<Pressable onPress={onClose} hitSlop={12}>
							<Typography variant="body" style={styles.closeText}>
								Close
							</Typography>
						</Pressable>
					</View>

					<View style={styles.copyWrap}>
						<Typography variant="caption">Fill in the blanks</Typography>
						<Typography variant="body" style={styles.helperText}>
							No syntax to memorise. Fill the blanks and the app builds the memory for you.
						</Typography>
					</View>

					<Card style={styles.sentenceCard}>
						{lockedEvent ? (
							<Card style={styles.lockedEventCard}>
								<Typography variant="caption">Current event active</Typography>
								<Typography variant="body" style={styles.previewText}>
									Every save in this flow will be tagged to {lockedEvent.name} · {formatCategoryLabel(lockedEvent.category)}.
								</Typography>
							</Card>
						) : null}

						<View style={styles.sentenceWrap}>
							<Typography variant="body">I met</Typography>
							<TextInput
								autoFocus
								placeholder="Sarah"
								placeholderTextColor={colors.textTertiary}
								style={[styles.inlineInput, styles.shortInput]}
								value={draft.name}
								onChangeText={(value) => updateField("name", value)}
							/>
							<Typography variant="body">from</Typography>
							<TextInput
								placeholder="Stripe"
								placeholderTextColor={colors.textTertiary}
								style={[styles.inlineInput, styles.shortInput]}
								value={draft.company}
								onChangeText={(value) => updateField("company", value)}
							/>
							<Typography variant="body">at</Typography>
							<TextInput
								placeholder="React Native EU"
								placeholderTextColor={colors.textTertiary}
								style={[styles.inlineInput, styles.longInput]}
								value={draft.event}
								onChangeText={(value) => updateField("event", value)}
								editable={!lockedEvent}
							/>
							<Typography variant="body">.</Typography>
						</View>

						<View style={styles.optionalSection}>
							<View style={styles.optionalSectionHeader}>
								<View style={styles.optionalCopy}>
									<Typography variant="caption">Optional private contact links</Typography>
									<Typography variant="body" style={styles.helperText}>
										Only add these if they were explicitly shared and you want quick follow-up.
									</Typography>
								</View>
								<Button
									label={showContactLinks ? "Hide" : "Add"}
									onPress={() => setShowContactLinks((current) => !current)}
									variant="ghost"
									fullWidth={false}
									size="compact"
								/>
							</View>

							{showContactLinks ? (
								<View style={styles.metaInputsRow}>
									<View style={styles.metaInputBlock}>
										<Typography variant="caption">LinkedIn</Typography>
										<TextInput
											placeholder="linkedin.com/in/sarah"
											placeholderTextColor={colors.textTertiary}
											style={styles.metaInput}
											value={draft.linkedinUrl}
											onChangeText={(value) => updateField("linkedinUrl", value)}
											autoCapitalize="none"
											autoCorrect={false}
										/>
									</View>
									<View style={styles.metaInputBlock}>
										<Typography variant="caption">Phone / WhatsApp</Typography>
										<TextInput
											placeholder="+44 7700 900123"
											placeholderTextColor={colors.textTertiary}
											style={styles.metaInput}
											value={draft.phoneNumber}
											onChangeText={(value) => updateField("phoneNumber", value)}
											keyboardType="phone-pad"
										/>
									</View>
								</View>
							) : null}
						</View>

						<View style={styles.sentenceWrap}>
							<Typography variant="body">We talked about</Typography>
							<TextInput
								placeholder="Expo analytics"
								placeholderTextColor={colors.textTertiary}
								style={[styles.inlineInput, styles.wideInput]}
								value={draft.notes}
								onChangeText={(value) => updateField("notes", value)}
								multiline
							/>
							<Typography variant="body">and I need to</Typography>
							<TextInput
								placeholder="send the metrics deck"
								placeholderTextColor={colors.textTertiary}
								style={[styles.inlineInput, styles.wideInput]}
								value={draft.followUp}
								onChangeText={(value) => updateField("followUp", value)}
								multiline
							/>
							<Typography variant="body">.</Typography>
						</View>

						<View style={styles.categorySection}>
							<Typography variant="caption">Event type</Typography>
							<View style={styles.chipRow}>
								{EVENT_CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
									<Button
										key={option.value}
										label={option.label}
										onPress={() => updateField("eventCategory", option.value)}
										variant={draft.eventCategory === option.value ? "primary" : "ghost"}
										fullWidth={false}
										size="compact"
										disabled={Boolean(lockedEvent)}
									/>
								))}
							</View>
						</View>
					</Card>

					<Card>
						<Typography variant="caption">Preview</Typography>
						<Typography variant="body" style={styles.previewText}>
							{sentencePreview}
						</Typography>
					</Card>

					<View style={styles.footerButtons}>
						<Button label={saveLabel} onPress={handleSave} loading={isSaving} disabled={!canSave} />
						<Button label="Cancel" onPress={onClose} variant="ghost" />
					</View>
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
		gap: 18,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	copyWrap: {
		gap: 6,
	},
	closeText: {
		color: colors.textSecondary,
		fontWeight: "600",
	},
	helperText: {
		color: colors.textSecondary,
	},
	sentenceCard: {
		gap: 18,
	},
	lockedEventCard: {
		backgroundColor: colors.surfaceMuted,
		padding: 14,
	},
	sentenceWrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: 10,
	},
	inlineInput: {
		minHeight: 46,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: radius.button,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surfaceMuted,
		color: colors.textPrimary,
		fontSize: 16,
		lineHeight: 22,
	},
	shortInput: {
		minWidth: 110,
		maxWidth: 150,
	},
	longInput: {
		minWidth: 180,
		maxWidth: 260,
	},
	wideInput: {
		minWidth: 220,
		maxWidth: "100%",
	},
	metaInputsRow: {
		flexDirection: "row",
		gap: 10,
		flexWrap: "wrap",
	},
	optionalSection: {
		gap: 10,
	},
	optionalSectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		gap: 12,
	},
	optionalCopy: {
		flex: 1,
		gap: 6,
	},
	metaInputBlock: {
		flex: 1,
		minWidth: 180,
		gap: 8,
	},
	metaInput: {
		minHeight: 46,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: radius.button,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surfaceMuted,
		color: colors.textPrimary,
		fontSize: 15,
	},
	categorySection: {
		gap: 10,
	},
	chipRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	footerButtons: {
		gap: 12,
	},
	previewText: {
		marginTop: 10,
		color: colors.textSecondary,
	},
});
