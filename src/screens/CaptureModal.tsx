import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  EVENT_CATEGORY_OPTIONS,
  EventCategory,
  FollowUpPreset,
  formatCategoryLabel,
  formatFollowUpDate,
  getPresetDate,
  getSuggestedFollowUpPreset,
  PERSON_TAG_SUGGESTIONS,
  PersonPriority,
} from "../lib/crm";
import { colors, layout, radius } from "../theme/tokens";

export type ParsedPersonDraft = {
  name: string;
  priority: PersonPriority;
  tags: string[];
  company: string;
  linkedinUrl: string;
  phoneNumber: string;
  event: string;
  eventCategory: EventCategory | "";
  whatMatters: string;
  nextStep: string;
  nextFollowUpAt: string;
  followUpPreset: FollowUpPreset | "";
  rawInput: string;
};

const emptyDraft: ParsedPersonDraft = {
  name: "",
  priority: "medium",
  tags: [],
  company: "",
  linkedinUrl: "",
  phoneNumber: "",
  event: "",
  eventCategory: "",
  whatMatters: "",
  nextStep: "",
  nextFollowUpAt: "",
  followUpPreset: "",
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
  const context = cleanValue(draft.whatMatters) || "what clicked";
  const nextStep = cleanValue(draft.nextStep) || "a thoughtful follow-up";
  const followUpDate = draft.nextFollowUpAt ? ` Follow up on ${formatFollowUpDate(draft.nextFollowUpAt)}.` : "";

  return `I met ${name} from ${company} at ${event}. What matters: ${context}. Next step: ${nextStep}.${followUpDate}`;
}

function getSuggestedPresetLabel(category: EventCategory | "" | null | undefined) {
  const preset = getSuggestedFollowUpPreset(category || null);
  if (preset === "tomorrow") {
    return "Tomorrow";
  }
  if (preset === "in3days") {
    return "In 3 days";
  }
  if (preset === "nextWeek") {
    return "Next week";
  }
  return "Custom";
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
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 720;
  const [draft, setDraft] = useState<ParsedPersonDraft>(emptyDraft);
  const [isFollowUpManuallySet, setFollowUpManuallySet] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const eventCategory = lockedEvent?.category || initialDraft?.eventCategory || "";
    const followUpPreset = initialDraft?.followUpPreset || getSuggestedFollowUpPreset(eventCategory || null);
    const nextFollowUpAt = initialDraft?.nextFollowUpAt || getPresetDate(followUpPreset);

    setDraft({
      ...emptyDraft,
      ...initialDraft,
      event: lockedEvent?.name || initialDraft?.event || "",
      eventCategory,
      whatMatters: initialDraft?.whatMatters || "",
      nextStep: initialDraft?.nextStep || "",
      followUpPreset,
      nextFollowUpAt,
      rawInput: initialDraft?.rawInput || "",
    });
    setFollowUpManuallySet(Boolean(initialDraft?.nextFollowUpAt || initialDraft?.followUpPreset));
  }, [initialDraft, lockedEvent, visible]);

  useEffect(() => {
    if (!visible || isFollowUpManuallySet) {
      return;
    }

    const preset = getSuggestedFollowUpPreset(draft.eventCategory || null);
    setDraft((current) => ({
      ...current,
      followUpPreset: preset,
      nextFollowUpAt: getPresetDate(preset),
    }));
  }, [draft.eventCategory, isFollowUpManuallySet, visible]);

  const sentencePreview = useMemo(() => buildDraftSentence(draft), [draft]);
  const canSave = cleanValue(draft.name).length > 0;
  const suggestedPresetLabel = getSuggestedPresetLabel(draft.eventCategory || lockedEvent?.category || null);

  function updateField(field: keyof ParsedPersonDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleEventCategoryChange(value: EventCategory) {
    setDraft((current) => ({
      ...current,
      eventCategory: value,
    }));
  }

  function handleFollowUpPresetSelect(preset: FollowUpPreset) {
    setFollowUpManuallySet(true);
    setDraft((current) => ({
      ...current,
      followUpPreset: preset,
      nextFollowUpAt: getPresetDate(preset),
    }));
  }

  function handleCustomFollowUp() {
    setFollowUpManuallySet(true);
    setDraft((current) => ({
      ...current,
      followUpPreset: "custom",
      nextFollowUpAt: current.nextFollowUpAt || getPresetDate("nextWeek"),
    }));
  }

  function toggleTag(tag: string) {
    setDraft((current) => {
      const hasTag = current.tags.includes(tag);
      return {
        ...current,
        tags: hasTag ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
      };
    });
  }

  function handleSave() {
    if (isSaving || !canSave) {
      return;
    }

    onSave({
      ...draft,
      name: cleanValue(draft.name),
      priority: draft.priority,
      tags: draft.tags,
      company: cleanValue(draft.company),
      linkedinUrl: cleanValue(draft.linkedinUrl),
      phoneNumber: cleanValue(draft.phoneNumber),
      event: cleanValue(draft.event) || "No event",
      eventCategory: draft.eventCategory,
      whatMatters: cleanValue(draft.whatMatters),
      nextStep: cleanValue(draft.nextStep),
      nextFollowUpAt: cleanValue(draft.nextFollowUpAt),
      followUpPreset: draft.followUpPreset,
      rawInput: sentencePreview,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              Capture who they are, what matters, what should happen next, and when you want to follow up.
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

            {isCompactLayout ? (
              <View style={styles.mobileFormStack}>
                <View style={styles.fieldBlock}>
                  <Typography variant="caption">Name</Typography>
                  <TextInput
                    autoFocus
                    placeholder="Sarah"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.name}
                    onChangeText={(value) => updateField("name", value)}
                  />
                </View>
                <View style={styles.fieldBlock}>
                  <Typography variant="caption">Company</Typography>
                  <TextInput
                    placeholder="Stripe"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.company}
                    onChangeText={(value) => updateField("company", value)}
                  />
                </View>
                <View style={styles.fieldBlock}>
                  <Typography variant="caption">Event</Typography>
                  <TextInput
                    placeholder="React Native EU"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.event}
                    onChangeText={(value) => updateField("event", value)}
                    editable={!lockedEvent}
                  />
                </View>
              </View>
            ) : (
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
            )}

            <View style={styles.tagSection}>
              <Typography variant="caption">Quick tags</Typography>
              <Typography variant="body" style={styles.helperText}>
                Tap the tags that best fit this contact. They can be filtered later in People.
              </Typography>
              <View style={styles.chipRow}>
                {PERSON_TAG_SUGGESTIONS.map((tag) => (
                  <Button
                    key={tag}
                    label={tag}
                    onPress={() => toggleTag(tag)}
                    variant={draft.tags.includes(tag) ? "primary" : "ghost"}
                    fullWidth={false}
                    size="compact"
                  />
                ))}
              </View>
              {draft.tags.length ? (
                <Typography variant="caption" style={styles.tagSummary}>
                  Selected: {draft.tags.join(", ")}
                </Typography>
              ) : null}
            </View>

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
                <Typography variant="caption">WhatsApp</Typography>
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

            <View style={styles.fieldBlock}>
              <Typography variant="caption">What matters / Context</Typography>
              <TextInput
                placeholder="What clicked here?"
                placeholderTextColor={colors.textTertiary}
                style={[styles.fieldInput, styles.textAreaInput]}
                value={draft.whatMatters}
                onChangeText={(value) => updateField("whatMatters", value)}
                multiline
              />
            </View>

            <View style={styles.fieldBlock}>
              <Typography variant="caption">What should happen next</Typography>
              <TextInput
                placeholder="Send deck, make intro, check in next week..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.fieldInput, styles.textAreaInput]}
                value={draft.nextStep}
                onChangeText={(value) => updateField("nextStep", value)}
                multiline
              />
            </View>

            <View style={styles.categorySection}>
              <Typography variant="caption">Event type</Typography>
              <View style={styles.chipRow}>
				{EVENT_CATEGORY_OPTIONS
				.filter((option): option is { label: string; value: EventCategory } => option.value !== "all")
				.map((option) => (
                  <Button
                    key={option.value}
                    label={option.label}
                    onPress={() => handleEventCategoryChange(option.value)}
                    variant={draft.eventCategory === option.value ? "primary" : "ghost"}
                    fullWidth={false}
                    size="compact"
                    disabled={Boolean(lockedEvent)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.followUpSection}>
              <Typography variant="caption">Follow up when?</Typography>
              <Typography variant="body" style={styles.helperText}>
                Suggested based on event type: {suggestedPresetLabel}
              </Typography>
              <View style={styles.chipRow}>
                <Button
                  label="Tomorrow"
                  onPress={() => handleFollowUpPresetSelect("tomorrow")}
                  variant={draft.followUpPreset === "tomorrow" ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="In 3 days"
                  onPress={() => handleFollowUpPresetSelect("in3days")}
                  variant={draft.followUpPreset === "in3days" ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Next week"
                  onPress={() => handleFollowUpPresetSelect("nextWeek")}
                  variant={draft.followUpPreset === "nextWeek" ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Custom"
                  onPress={handleCustomFollowUp}
                  variant={draft.followUpPreset === "custom" ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
              </View>
              {draft.nextFollowUpAt ? (
                <Typography variant="caption" style={styles.tagSummary}>
                  Follow-up date: {formatFollowUpDate(draft.nextFollowUpAt)}
                </Typography>
              ) : null}
              {draft.followUpPreset === "custom" ? (
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.metaInput}
                  value={draft.nextFollowUpAt}
                  onChangeText={(value) => updateField("nextFollowUpAt", value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : null}
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
        </ScrollView>
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
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: layout.stackGap,
    paddingBottom: layout.stackGap * 2,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  copyWrap: {
    flex: 1,
    gap: 6,
  },
  mobileFormStack: {
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  textAreaInput: {
    minHeight: 88,
    textAlignVertical: "top",
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
  metaInputsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  tagSection: {
    gap: 10,
  },
  tagSummary: {
    color: colors.textSecondary,
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
  followUpSection: {
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
