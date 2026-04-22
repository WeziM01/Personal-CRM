import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from "expo-audio";

import { QRScannerModal } from "../components/QRScannerModal";
import { parseScannedInput } from "../lib/scan";
import { transcribeContactAudio } from "../lib/voice";

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

export type QuickCaptureMethod = "manual" | "paste" | "voice" | "scan";

export type ParsedPersonDraft = {
  name: string;
  priority: PersonPriority;
  tags: string[];
  company: string;
  linkedinUrl: string;
  email: string;
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
  email: "",
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
  initialMethod?: QuickCaptureMethod;
  showQuickCapture?: boolean;
};

function cleanValue(value: string) {
  return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function titleCaseFromSlug(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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

function parsePastedInput(rawValue: string, lockedEvent?: LockedEventDraft | null) {
  const raw = rawValue.trim();
  if (!raw) {
    return null;
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => cleanValue(line))
    .filter(Boolean);

  const linkedinMatch = raw.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[\S]+/i);
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = raw.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  const metFromMatch = raw.match(/met\s+([^,.\n]+?)\s+from\s+([^,.\n]+?)(?:\s+at\s+([^,.\n]+))?(?:[,.\n]|$)/i);
  const fromMatch = raw.match(/\bfrom\s+([^,.\n]+?)(?:\s+at\s+|[,.\n]|$)/i);
  const companyLabelMatch = raw.match(/(?:company|org|organisation|organization)\s*[:\-]\s*([^\n]+)/i);
  const eventMatch = raw.match(/(?:event|met at)\s*[:\-]?\s*([^\n]+)/i);

  let name = "";
  let company = "";
  let event = lockedEvent?.name || "";
  const linkedinUrl = linkedinMatch?.[0] || "";
  const rawLooksLikeLinkedInOnly = Boolean(linkedinUrl) && lines.length <= 2 && !metFromMatch && !companyLabelMatch && !eventMatch;

  const emailOnly =
    Boolean(emailMatch) &&
    raw.trim() === (emailMatch ? emailMatch[0] : "") &&
    !linkedinMatch &&
    !phoneMatch &&
    !metFromMatch &&
    !companyLabelMatch &&
    !eventMatch;

  if (metFromMatch) {
    name = cleanValue(metFromMatch[1]);
    company = cleanValue(metFromMatch[2]);
    event = cleanValue(metFromMatch[3] || event);
  }

  if (!company && companyLabelMatch) {
    company = cleanValue(companyLabelMatch[1]);
  }

  if (!company && fromMatch) {
    company = cleanValue(fromMatch[1]);
  }

  if (!event && eventMatch) {
    event = cleanValue(eventMatch[1]);
  }

  if (!name && linkedinUrl) {
    const slugMatch = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (slugMatch) {
      name = titleCaseFromSlug(slugMatch[1]);
    }
  }

  if (!name && emailMatch) {
    const localPart = emailMatch[0].split("@")[0] || "";
    const candidate = titleCaseFromSlug(localPart.replace(/\d+/g, ""));
    if (candidate.split(" ").length <= 3) {
      name = candidate;
    }
  }

  if (!name && lines.length) {
    const candidate = lines[0];
    if (!candidate.includes("@") && !candidate.includes("http") && candidate.split(" ").length <= 4) {
      name = candidate;
    }
  }

  if (!company && lines.length > 1 && !rawLooksLikeLinkedInOnly) {
    const candidate = lines[1];
    if (!candidate.includes("@") && !candidate.includes("http") && candidate.length <= 48) {
      company = candidate;
    }
  }

  const extractedContext = rawLooksLikeLinkedInOnly
    ? ""
    : lines.length > 2
      ? lines.slice(2).join(" ")
      : lines.join(" ");

  return {
    name,
    company,
    event,
    linkedinUrl,
    email: emailMatch?.[0] || "",
    phoneNumber: phoneMatch?.[0] || "",
    rawInput: raw,
    whatMatters: extractedContext,
  } satisfies Partial<ParsedPersonDraft>;
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
  initialMethod = "manual",
  showQuickCapture = true,
}: CaptureModalProps) {
  const [draft, setDraft] = useState<ParsedPersonDraft>(emptyDraft);
  const [isFollowUpManuallySet, setFollowUpManuallySet] = useState(false);
  const [activeMethod, setActiveMethod] = useState<QuickCaptureMethod>(initialMethod);
  const [pasteInput, setPasteInput] = useState("");

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isScanChoiceVisible, setIsScanChoiceVisible] = useState(false);
  const [isQrScannerVisible, setIsQrScannerVisible] = useState(false);

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
    setActiveMethod(initialMethod);
    setPasteInput(initialDraft?.rawInput || "");
    setIsScanChoiceVisible(false);
    setIsQrScannerVisible(false);
  }, [initialDraft, initialMethod, lockedEvent, visible]);

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

  function handleMethodPress(method: QuickCaptureMethod) {
    setActiveMethod(method);

    if (method === "scan") {
      setIsScanChoiceVisible(true);
    }
  }

  async function handleStartVoiceCapture() {
    try {
      setVoiceError(null);

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceError("Microphone permission was denied.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : "Could not start recording."
      );
    }
  }

  async function handleStopVoiceCapture() {
    try {
      setVoiceError(null);
      setIsTranscribing(true);

      await recorder.stop();

      const uri = recorder.uri;
      if (!uri) {
        throw new Error("No recording file was created.");
      }

      const result = await transcribeContactAudio({
        uri,
        fileName: "contact-note.m4a",
        mimeType: "audio/m4a",
      });

      setDraft((current) => ({
        ...current,
        ...result.draft,
        whatMatters:
          result.draft.whatMatters?.trim() ||
          result.transcript?.trim() ||
          current.whatMatters,
      }));

      setActiveMethod("manual");
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : "Voice transcription failed."
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  function handleChooseScanQr() {
    setIsScanChoiceVisible(false);
    setIsQrScannerVisible(true);
  }

  function handleChooseScanOcr() {
    setIsScanChoiceVisible(false);
    Alert.alert(
      "Business card / badge scan next",
      "OCR with ML Kit is the next step. For now, use QR if available or capture via voice/paste."
    );
  }

  function handleScanResult(value: string) {
    const parsed = parseScannedInput(value, lockedEvent);

    setDraft((current) => ({
      ...current,
      name: parsed.name || current.name,
      company: parsed.company || current.company,
      event: lockedEvent?.name || parsed.event || current.event,
      linkedinUrl: parsed.linkedinUrl || current.linkedinUrl,
      email: parsed.email || current.email,
      phoneNumber: parsed.phoneNumber || current.phoneNumber,
      whatMatters: parsed.whatMatters ? parsed.whatMatters : current.whatMatters,
      rawInput: value,
    }));

    setActiveMethod("manual");
    setIsQrScannerVisible(false);
  }

  function handlePasteParse() {
    const parsed = parsePastedInput(pasteInput, lockedEvent);
    if (!parsed) {
      Alert.alert("Nothing to parse", "Paste a LinkedIn URL, email signature, or copied contact text first.");
      return;
    }

    setDraft((current) => ({
      ...current,
      name: parsed.name || current.name,
      company: parsed.company || current.company,
      event: lockedEvent?.name || parsed.event || current.event,
      linkedinUrl: parsed.linkedinUrl || current.linkedinUrl,
      email: parsed.email || current.email,
      phoneNumber: parsed.phoneNumber || current.phoneNumber,
      whatMatters: parsed.whatMatters ? parsed.whatMatters : current.whatMatters,
      rawInput: pasteInput,
    }));
    setActiveMethod("manual");
  }

  function handleEventCategoryChange(value: EventCategory) {
    setDraft((current) => ({
      ...current,
      eventCategory: value,
    }));
  }

  function handlePriorityChange(value: PersonPriority) {
    setDraft((current) => ({
      ...current,
      priority: value,
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
      email: cleanValue(draft.email),
      phoneNumber: cleanValue(draft.phoneNumber),
      event: cleanValue(draft.event) || "No event",
      eventCategory: draft.eventCategory,
      whatMatters: cleanValue(draft.whatMatters),
      nextStep: cleanValue(draft.nextStep),
      nextFollowUpAt: cleanValue(draft.nextFollowUpAt),
      followUpPreset: draft.followUpPreset,
      rawInput: cleanValue(draft.rawInput) || sentencePreview,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.shell}>
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Typography variant="caption">Capture</Typography>
                <Typography variant="h1">{title}</Typography>
                <Typography variant="body" style={styles.helperText}>
                  Capture quickly now, tidy the details second.
                </Typography>
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closePill}>
                <Typography variant="caption" style={styles.closeText}>
                  Close
                </Typography>
              </Pressable>
            </View>

            {lockedEvent ? (
              <Card style={styles.lockedEventCard}>
                <Typography variant="caption">Current event active</Typography>
                <Typography variant="body" style={styles.previewText}>
                  This person will be tagged to {lockedEvent.name} · {formatCategoryLabel(lockedEvent.category)}.
                </Typography>
              </Card>
            ) : null}

            {showQuickCapture ? (
              <Card style={styles.sectionCard}>
                <View style={styles.sectionIntro}>
                  <Typography variant="caption">Quick capture</Typography>
                  <Typography variant="body" style={styles.helperText}>
                    Choose the fastest way to get this person into Pulse.
                  </Typography>
                </View>

                <View style={styles.chipRow}>
                  <Button
                    label="Paste"
                    onPress={() => handleMethodPress("paste")}
                    variant={activeMethod === "paste" ? "primary" : "ghost"}
                    fullWidth={false}
                    size="compact"
                  />
                  <Button
                    label={
                      isTranscribing
                        ? "Transcribing..."
                        : recorderState.isRecording
                        ? "Stop recording"
                        : "Voice"
                    }
                    onPress={
                      recorderState.isRecording
                        ? handleStopVoiceCapture
                        : async () => {
                            handleMethodPress("voice");
                            await handleStartVoiceCapture();
                          }
                    }
                    variant={
                      recorderState.isRecording || activeMethod === "voice"
                        ? "primary"
                        : "ghost"
                    }
                    fullWidth={false}
                    size="compact"
                    disabled={isTranscribing}
                  />
                  <Button
                    label="Scan"
                    onPress={() => handleMethodPress("scan")}
                    variant={activeMethod === "scan" ? "primary" : "ghost"}
                    fullWidth={false}
                    size="compact"
                  />
                  <Button
                    label="Manual"
                    onPress={() => handleMethodPress("manual")}
                    variant={activeMethod === "manual" ? "primary" : "ghost"}
                    fullWidth={false}
                    size="compact"
                  />
                </View>

                {activeMethod === "paste" ? (
                  <View style={styles.capturePanel}>
                    <Typography variant="caption">Paste LinkedIn or copied contact text</Typography>
                    <TextInput
                      placeholder="Paste a LinkedIn URL, email signature, or copied attendee text"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.fieldInput, styles.textAreaInput]}
                      value={pasteInput}
                      onChangeText={setPasteInput}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Typography variant="body" style={styles.helperText}>
                      We will pull through anything obvious now, then you can review and clean it up below.
                    </Typography>
                    <Button label="Parse pasted text" onPress={handlePasteParse} />
                  </View>
                ) : null}

                {activeMethod === "voice" ? (
                  <View style={styles.placeholderPanel}>
                    <Typography variant="h2">Voice capture placeholder</Typography>
                    <Typography variant="body" style={styles.helperText}>
                      Next up: tap record, transcribe the noisy event note, then review the extracted fields here.
                    </Typography>
                  </View>
                ) : null}

                {activeMethod === "scan" ? (
                  <View style={styles.placeholderPanel}>
                    <Typography variant="h2">Scan capture</Typography>
                    <Typography variant="body" style={styles.helperText}>
                      Scan a QR code now, or use card/badge OCR next. Everything still lands back in this same review form.
                    </Typography>
                  </View>
                ) : null}
              </Card>
            ) : null}

            <Card style={styles.sectionCard}>
              <View style={styles.sectionIntro}>
                <Typography variant="caption">Basics</Typography>
                <Typography variant="body" style={styles.helperText}>
                  Save the minimum context you need to recognize them later.
                </Typography>
              </View>

              <View style={styles.fieldBlock}>
                <Typography variant="caption">Name</Typography>
                <TextInput
                  autoFocus={activeMethod !== "paste"}
                  placeholder="Sarah"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.fieldInput}
                  value={draft.name}
                  onChangeText={(value) => updateField("name", value)}
                />
              </View>

              <View style={styles.twoColumnRow}>
                <View style={styles.metaInputBlock}>
                  <Typography variant="caption">Company</Typography>
                  <TextInput
                    placeholder="Stripe"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.company}
                    onChangeText={(value) => updateField("company", value)}
                  />
                </View>
                <View style={styles.metaInputBlock}>
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

              <View style={styles.chipSection}>
                <Typography variant="caption">Quick tags</Typography>
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
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionIntro}>
                <Typography variant="caption">Context</Typography>
                <Typography variant="body" style={styles.helperText}>
                  This is the memory layer that makes the contact useful later.
                </Typography>
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

              <View style={styles.twoColumnRow}>
                <View style={styles.metaInputBlock}>
                  <Typography variant="caption">LinkedIn</Typography>
                  <TextInput
                    placeholder="linkedin.com/in/sarah"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.linkedinUrl}
                    onChangeText={(value) => updateField("linkedinUrl", value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.metaInputBlock}>
                  <Typography variant="caption">Email</Typography>
                  <TextInput
                    placeholder="sarah@company.com"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.email}
                    onChangeText={(value) => updateField("email", value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.metaInputBlock}>
                  <Typography variant="caption">WhatsApp</Typography>
                  <TextInput
                    placeholder="+44 7700 900123"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.fieldInput}
                    value={draft.phoneNumber}
                    onChangeText={(value) => updateField("phoneNumber", value)}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionIntro}>
                <Typography variant="caption">Follow-up</Typography>
                <Typography variant="body" style={styles.helperText}>
                  Suggested from the event type, but easy to override.
                </Typography>
              </View>

              <View style={styles.chipSection}>
                <Typography variant="caption">Event type</Typography>
                <View style={styles.chipRow}>
                  {EVENT_CATEGORY_OPTIONS.filter(
                    (option): option is { label: string; value: EventCategory } => option.value !== "all"
                  ).map((option) => (
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

              <View style={styles.chipSection}>
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
                    style={styles.fieldInput}
                    value={draft.nextFollowUpAt}
                    onChangeText={(value) => updateField("nextFollowUpAt", value)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                ) : null}
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <Typography variant="caption">Preview</Typography>
              <Typography variant="body" style={styles.previewText}>
                {sentencePreview}
              </Typography>
            </Card>
          </ScrollView>

          <View style={styles.footerWrap}>
            <View style={styles.footerButtons}>
              <Button label={saveLabel} onPress={handleSave} loading={isSaving} disabled={!canSave} />
              <Button label="Cancel" onPress={onClose} variant="ghost" />
            </View>
          </View>
        </View>

        <Modal
          visible={isScanChoiceVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsScanChoiceVisible(false)}
        >
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsScanChoiceVisible(false)} />
            <View style={styles.sheetCard}>
              <Typography variant="h2">Scan</Typography>
              <Typography variant="body" style={styles.helperText}>
                Choose what you want to capture.
              </Typography>
              <View style={styles.sheetButtonStack}>
                <Button label="Scan QR" onPress={handleChooseScanQr} />
                <Button label="Scan business card / badge" onPress={handleChooseScanOcr} variant="ghost" />
                <Button label="Cancel" onPress={() => setIsScanChoiceVisible(false)} variant="ghost" />
              </View>
            </View>
          </View>
        </Modal>

        <QRScannerModal
          visible={isQrScannerVisible}
          onClose={() => setIsQrScannerVisible(false)}
          onScanned={handleScanResult}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: layout.sectionGap,
    paddingBottom: layout.stickyBottomInset + 48,
    gap: layout.sectionGap,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  closePill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeText: {
    color: colors.textSecondary,
  },
  helperText: {
    color: colors.textSecondary,
  },
  sectionCard: {
    gap: 16,
  },
  sectionIntro: {
    gap: 6,
  },
  lockedEventCard: {
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  capturePanel: {
    gap: 12,
  },
  placeholderPanel: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
  },
  fieldBlock: {
    gap: 8,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metaInputBlock: {
    flex: 1,
    minWidth: 180,
    gap: 8,
  },
  fieldInput: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  textAreaInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  chipSection: {
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagSummary: {
    color: colors.textSecondary,
  },
  previewText: {
    color: colors.textSecondary,
  },
  footerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButtons: {
    gap: 10,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
    padding: layout.screenPaddingHorizontal,
    paddingBottom: layout.stickyBottomInset + 24,
  },
  sheetCard: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 24,
    gap: 8,
  },
  sheetButtonStack: {
    gap: 10,
    marginTop: 12,
  },
});