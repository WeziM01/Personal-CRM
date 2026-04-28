import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";

import { CurrentEventValue } from "../components/CurrentEventSheet";
import { FloatingActionBar } from "../components/FloatingActionBar";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  EVENT_CATEGORY_OPTIONS,
  PERSON_TAG_SUGGESTIONS,
  buildReconnectDraft,
  JUST_CONNECTED_THRESHOLD,
  RECENT_CONTACT_THRESHOLD,
  buildInteractionRecord,
  createInteraction,
  createPerson,
  deletePerson,
  ensureSessionUserId,
  getOrCreateEvent,
  listPeopleInsights,
  markPersonContactedToday,
  updateInteraction,
  updatePersonDetails,
  isContactStale,
  formatPreferredChannelLabel,
  PreferredChannel,
} from "../lib/crm";
import { colors, layout } from "../theme/tokens";
import { openFollowUpInCalendar } from "../lib/calendar";

type SortMode = "recent" | "stale" | "name" | "frequency";
type CaptureMode = "createInteraction" | "createPerson" | "edit";
export type PersonStatusMode = "all" | "today" | "recent" | "stale";

type PersonProfileScreenProps = {
  currentEvent: CurrentEventValue | null;
  forcedStatusMode?: PersonStatusMode | null;
  forcedStatusNonce?: number;
};

type DraftPreviewChannel = PreferredChannel;

export function PersonProfileScreen({
  currentEvent,
  forcedStatusMode = null,
  forcedStatusNonce = 0,
}: PersonProfileScreenProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 720;
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [editorMode, setEditorMode] = useState<CaptureMode>("createInteraction");
  const [editorDraft, setEditorDraft] = useState<Partial<ParsedPersonDraft> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [statusMode, setStatusMode] = useState<PersonStatusMode>("all");
  const [categoryMode, setCategoryMode] = useState<(typeof EVENT_CATEGORY_OPTIONS)[number]["value"]>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [people, setPeople] = useState<Awaited<ReturnType<typeof listPeopleInsights>>>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftPreviewPerson, setDraftPreviewPerson] = useState<(typeof people)[number] | null>(null);
  const [draftPreviewText, setDraftPreviewText] = useState("");
  const [draftPreviewChannel, setDraftPreviewChannel] = useState<DraftPreviewChannel | null>(null);
  const [phoneActionPerson, setPhoneActionPerson] = useState<(typeof people)[number] | null>(null);
  const [phoneActionText, setPhoneActionText] = useState("");
  const [personActionMenu, setPersonActionMenu] = useState<(typeof people)[number] | null>(null);
  const [isInteractionPickerOpen, setInteractionPickerOpen] = useState(false);

  const availableTags = useMemo(() => {
    return Array.from(new Set([...PERSON_TAG_SUGGESTIONS, ...people.flatMap((person) => person.tags)])).sort();
  }, [people]);

  const sortLabel =
    sortMode === "name"
      ? "A-Z"
      : sortMode === "recent"
        ? "Recent"
        : sortMode === "stale"
          ? "Need nudge first"
          : "Most logged";

  const filteredPeople = useMemo(() => {
    const statusFiltered = people.filter((person) => {
      if (statusMode === "today") {
        return person.daysSinceLastContact !== null && person.daysSinceLastContact <= JUST_CONNECTED_THRESHOLD;
      }

      if (statusMode === "recent") {
        return person.daysSinceLastContact !== null && person.daysSinceLastContact <= RECENT_CONTACT_THRESHOLD;
      }

      if (statusMode === "stale") {
        return isContactStale(person.daysSinceLastContact, person.priority);
      }

      return true;
    });

    const categoryFiltered = statusFiltered.filter(
      (person) => categoryMode === "all" || person.lastEventCategory === categoryMode
    );

    const tagFiltered = categoryFiltered.filter(
      (person) => selectedTag === "all" || person.tags.includes(selectedTag)
    );

    const query = searchQuery.trim().toLowerCase();
    const searchedPeople = !query
      ? tagFiltered
      : tagFiltered.filter((person) =>
          [person.name, person.company, person.lastInteractionNote, person.followUp, person.lastEventName || "", person.tags.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );

    return searchedPeople.sort((left, right) => {
      if (sortMode === "name") {
        return left.name.localeCompare(right.name);
      }

      if (sortMode === "stale") {
        return (right.daysSinceLastContact || 0) - (left.daysSinceLastContact || 0);
      }

      if (sortMode === "frequency") {
        return right.interactionCount - left.interactionCount;
      }

      const leftValue = left.lastInteractionAt || left.createdAt;
      const rightValue = right.lastInteractionAt || right.createdAt;
      return rightValue.localeCompare(leftValue);
    });
  }, [categoryMode, people, searchQuery, selectedTag, sortMode, statusMode]);

  const selectedPerson = useMemo(() => {
    if (selectedPersonId) {
      return filteredPeople.find((person) => person.id === selectedPersonId) || null;
    }
    // Only show a selected contact if the user has manually selected one
    return null;
  }, [filteredPeople, isCompactLayout, selectedPersonId]);

  async function loadProfileData() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const userId = await ensureSessionUserId();
      const insights = await listPeopleInsights(userId);
      setPeople(insights);
      setSelectedPersonId((current) => {
        if (current && insights.some((person) => person.id === current)) {
          return current;
        }

        return isCompactLayout ? null : insights[0]?.id || null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    if (!forcedStatusMode) {
      return;
    }

    setStatusMode(forcedStatusMode);
  }, [forcedStatusMode, forcedStatusNonce]);

  function openCreateInteractionForPerson(person: (typeof people)[number]) {
    setEditorMode("createInteraction");
    setEditorDraft({
      name: person.name,
      priority: person.priority,
      tags: person.tags,
      company: person.company,
      linkedinUrl: person.linkedinUrl,
      email: person.email,
      phoneNumber: person.phoneNumber,
      preferredChannel: person.preferredChannel,
      preferredChannelOther: person.preferredChannelOther,
      event: person.lastEventName || "",
      whatMatters: "",
      nextStep: "",
      nextFollowUpAt: "",
      followUpPreset: "",
    });
    setCaptureOpen(true);
  }

  function openCreateInteraction() {
    if (selectedPerson) {
      openCreateInteractionForPerson(selectedPerson);
      return;
    }

    if (isCompactLayout) {
      if (!filteredPeople.length) {
        openCreatePerson("");
        return;
      }

      setInteractionPickerOpen(true);
      return;
    }

    Alert.alert("Select a contact first", "No contact is selected yet.");
  }

  function openCreatePerson(initialName = searchQuery.trim()) {
    setEditorMode("createPerson");
    setEditorDraft({
      name: initialName,
      priority: "medium",
      tags: [],
      company: "",
      linkedinUrl: "",
      email: "",
      phoneNumber: "",
      preferredChannel: "",
      preferredChannelOther: "",
      event: currentEvent?.name || "",
      eventCategory: currentEvent?.category || "",
      whatMatters: "",
      nextStep: "",
      nextFollowUpAt: "",
      followUpPreset: "",
    });
    setCaptureOpen(true);
  }

  function openCreatePersonFromSearch() {
    const nameFromSearch = searchQuery.trim();
    if (!nameFromSearch) {
      return;
    }

    setSelectedPersonId(null);
    openCreatePerson(nameFromSearch);
  }

  function openEditPerson(person = selectedPerson) {
    if (!person) {
      return;
    }

    setSelectedPersonId(person.id);
    setEditorMode("edit");
    setEditorDraft({
      name: person.name,
      priority: person.priority,
      tags: person.tags,
      company: person.company,
      linkedinUrl: person.linkedinUrl,
      email: person.email,
      phoneNumber: person.phoneNumber,
      preferredChannel: person.preferredChannel,
      preferredChannelOther: person.preferredChannelOther,
      event: person.lastEventName || "",
      whatMatters: person.whatMatters || person.lastInteractionNote,
      nextStep: person.nextStep || "",
      nextFollowUpAt: person.nextFollowUpAt || "",
      followUpPreset: "",
    });
    setCaptureOpen(true);
  }

  async function handleSaveInteraction(draft: ParsedPersonDraft) {
    if (isSaving) {
      return;
    }

    if (editorMode === "createInteraction" && !draft.whatMatters.trim() && !draft.nextStep.trim()) {
      Alert.alert("Context required", "Add what matters or the next step before saving.");
      return;
    }

    try {
      setSaving(true);
      const userId = await ensureSessionUserId();

      if (editorMode === "edit" && selectedPerson) {
        await updatePersonDetails({
          userId,
          personId: selectedPerson.id,
          name: draft.name,
          priority: draft.priority,
          tags: draft.tags,
          company: draft.company,
          linkedinUrl: draft.linkedinUrl,
          email: draft.email,
          phoneNumber: draft.phoneNumber,
          preferredChannel: draft.preferredChannel,
          preferredChannelOther: draft.preferredChannelOther,
        });

        let eventId: string | null = null;
        const editEventName = draft.event;
        if (editEventName && editEventName !== "No event") {
          eventId = (await getOrCreateEvent(userId, editEventName, draft.eventCategory || null)).id;
        }

        const rawNote = buildInteractionRecord(draft.whatMatters, draft.nextStep, draft.company, draft.nextFollowUpAt);

        if (selectedPerson.lastInteractionId) {
          await updateInteraction({
            userId,
            interactionId: selectedPerson.lastInteractionId,
            eventId,
            rawNote,
          });
        } else {
          await createInteraction({
            userId,
            personId: selectedPerson.id,
            eventId,
            rawNote,
          });
        }

        setCaptureOpen(false);
        await loadProfileData();
        Alert.alert("Saved", `${draft.name} updated.`);
        return;
      }

      let activePersonId = selectedPerson?.id || null;
      if (editorMode === "createPerson" || !selectedPerson) {
        activePersonId = (
          await createPerson(
            userId,
            draft.name === "Unknown contact" ? "New Person" : draft.name,
            draft.company,
            draft.linkedinUrl,
            draft.email,
            draft.phoneNumber,
            draft.preferredChannel,
            draft.preferredChannelOther,
            draft.priority,
            draft.tags
          )
        ).id;
      } else {
        await updatePersonDetails({
          userId,
          personId: selectedPerson.id,
          name: draft.name,
          company: draft.company,
          linkedinUrl: draft.linkedinUrl,
          email: draft.email,
          phoneNumber: draft.phoneNumber,
          preferredChannel: draft.preferredChannel,
          preferredChannelOther: draft.preferredChannelOther,
          priority: draft.priority,
          tags: draft.tags,
        });
      }

      let eventId: string | null = null;
      const eventName = currentEvent?.name || draft.event;
      const eventCategory = currentEvent?.category || draft.eventCategory || null;
      if (eventName && eventName !== "No event") {
        eventId = (await getOrCreateEvent(userId, eventName, eventCategory)).id;
      }

      if (!activePersonId) {
        throw new Error("Unable to determine which contact to save this interaction for.");
      }

      await createInteraction({
        userId,
        personId: activePersonId,
        eventId,
        rawNote: buildInteractionRecord(draft.whatMatters, draft.nextStep, draft.company, draft.nextFollowUpAt),
      });

      setCaptureOpen(false);
      await loadProfileData();
      Alert.alert("Added", "Update logged to the relationship timeline.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save interaction.";
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  function handleToggleExpandedPerson(personId: string) {
    setSelectedPersonId((current) => (current === personId ? null : personId));
  }

  async function handleMarkContactedToday(person = selectedPerson) {
    if (!person) {
      return;
    }

    try {
      const userId = await ensureSessionUserId();
      await markPersonContactedToday(userId, person.id);
      await loadProfileData();
      Alert.alert("Updated", `${person.name} marked as contacted today.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark contact.";
      Alert.alert("Update failed", message);
    }
  }

  async function performDeletePerson(person = selectedPerson) {
    if (!person) {
      return;
    }

    try {
      setDeleting(true);
      const userId = await ensureSessionUserId();
      await deletePerson(userId, person.id);
      setPeople((current) => current.filter((entry) => entry.id !== person.id));
      setSelectedPersonId((current) => (current === person.id ? null : current));
      setPersonActionMenu((current) => (current?.id === person.id ? null : current));
      await loadProfileData();
      Alert.alert("Deleted", `${person.name} removed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete contact.";
      Alert.alert("Delete failed", message);
    } finally {
      setDeleting(false);
    }
  }

  function handleDeletePerson(person = selectedPerson) {
    if (!person) {
      return;
    }

    const confirmDelete = () => {
      void performDeletePerson(person);
    };

    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
      const confirmed = window.confirm(`${person.name} will be removed permanently.`);
      if (confirmed) {
        confirmDelete();
      }
      return;
    }

    Alert.alert(
      "Delete contact?",
      `${person.name} will be removed permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: confirmDelete,
        },
      ]
    );
  }

  async function handleOpenExternal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Open failed", "Could not open that link on this device.");
    }
  }


  function getMomentLabel(count: number) {
    return `${count} logged ${count === 1 ? "moment" : "moments"}`;
  }

  async function handleAddToCalendar(person = selectedPerson) {
    if (!person) {
      return;
    }

    if (!person.nextFollowUpAt) {
      Alert.alert("No follow-up date", `Set a follow-up date for ${person.name} first.`);
      return;
    }

    try {
      await openFollowUpInCalendar({
        name: person.name,
        company: person.company,
        nextFollowUpAt: person.nextFollowUpAt,
        whatMatters: person.whatMatters,
        nextStep: person.nextStep,
        linkedinUrl: person.linkedinUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open the calendar handoff.";
      Alert.alert("Calendar handoff failed", message);
    }
  }

  function buildMessageForPerson(person = selectedPerson) {
    if (!person) {
      return "";
    }

    return buildReconnectDraft({
      name: person.name,
      eventName: person.lastEventName,
      lastInteractionNote: person.lastInteractionNote,
      followUp: person.followUp,
    });
  }

  async function copyTextToClipboard(value: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    await Clipboard.setStringAsync(value);
  }

  function isChannelAvailable(person: (typeof people)[number], channel: DraftPreviewChannel) {
    if (channel === "linkedin") {
      return Boolean(person.linkedinUrl);
    }

    if (channel === "whatsapp") {
      return Boolean(person.phoneNumber);
    }

    if (channel === "email") {
      return Boolean(person.email);
    }

    if (channel === "phone") {
      return Boolean(person.phoneNumber);
    }

    if (channel === "other") {
      return Boolean(person.preferredChannelOther?.trim());
    }

    return false;
  }

  function getPreferredChannelForPerson(person: (typeof people)[number]): DraftPreviewChannel {
    if (person.preferredChannel && isChannelAvailable(person, person.preferredChannel)) {
      return person.preferredChannel;
    }

    if (person.phoneNumber) {
      return "whatsapp";
    }

    if (person.linkedinUrl) {
      return "linkedin";
    }

    if (person.email) {
      return "email";
    }

    if (person.phoneNumber) {
      return "phone";
    }

    return "other";
  }

  function getAvailableChannels(person: (typeof people)[number]) {
    const ordered: DraftPreviewChannel[] = [];
    const preferred = getPreferredChannelForPerson(person);

    const maybePush = (channel: DraftPreviewChannel) => {
      if (isChannelAvailable(person, channel) && !ordered.includes(channel)) {
        ordered.push(channel);
      }
    };

    maybePush(preferred);
    maybePush("linkedin");
    maybePush("whatsapp");
    maybePush("email");
    maybePush("phone");
    maybePush("other");

    return ordered;
  }

  function getDraftButtonLabel(channel: DraftPreviewChannel, person: (typeof people)[number]) {
    if (channel === "linkedin") {
      return "LinkedIn Draft";
    }

    if (channel === "whatsapp") {
      return "WhatsApp Draft";
    }

    if (channel === "email") {
      return "Draft Email";
    }

    if (channel === "phone") {
      return "Phone";
    }

    return person.preferredChannelOther?.trim()
      ? `Copy for ${person.preferredChannelOther.trim()}`
      : "Copy Draft";
  }

  function getChannelMetaLabel(channel: DraftPreviewChannel, person: (typeof people)[number]) {
    if (channel === "linkedin") {
      return person.linkedinUrl || "No LinkedIn URL";
    }

    if (channel === "whatsapp") {
      return person.phoneNumber || "No WhatsApp number";
    }

    if (channel === "email") {
      return person.email || "No email saved";
    }

    if (channel === "phone") {
      return person.phoneNumber || "No phone number saved";
    }

    return person.preferredChannelOther?.trim() || "Copy and paste into their preferred channel";
  }

  async function openWhatsAppOnWeb(browserUrl: string, personName: string) {
    if (typeof window === "undefined") {
      await Linking.openURL(browserUrl);
      return;
    }

    try {
      const openedWindow = window.open(browserUrl, "_blank", "noopener,noreferrer");
      if (openedWindow) {
        openedWindow.opener = null;
        return;
      }
    } catch {
      // fall through to same-tab navigation
    }

    try {
      window.location.assign(browserUrl);
      return;
    } catch {
      Alert.alert("Open failed", `Could not open WhatsApp Web for ${personName}.`);
    }
  }

  async function openWhatsAppDraft(person: (typeof people)[number], messageOverride?: string) {
    const message = messageOverride?.trim() || buildMessageForPerson(person);
    const digits = person.phoneNumber
      ? person.phoneNumber.replace(/[^\d+]/g, "").replace(/^00/, "+")
      : "";
    const normalizedPhone = digits.startsWith("+") ? digits.slice(1) : digits;
    const encodedMessage = encodeURIComponent(message);
    const whatsappAppUrl = normalizedPhone ? `whatsapp://send?phone=${normalizedPhone}&text=${encodedMessage}` : null;
    const whatsappApiUrl = normalizedPhone
      ? `https://api.whatsapp.com/send/?phone=${normalizedPhone}&text=${encodedMessage}&type=phone_number&app_absent=0`
      : null;
    const whatsappWebUrl = normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}` : null;

    try {
      if (Platform.OS === "web") {
        const browserUrl = whatsappWebUrl || whatsappApiUrl;
        if (!browserUrl) {
          Alert.alert("No WhatsApp number", `Add a phone number for ${person.name} before opening WhatsApp.`);
          return;
        }

        await openWhatsAppOnWeb(browserUrl, person.name);
        return;
      }

      if (whatsappAppUrl) {
        const canOpenWhatsApp = await Linking.canOpenURL(whatsappAppUrl);
        if (canOpenWhatsApp) {
          await Linking.openURL(whatsappAppUrl);
          return;
        }
      }

      if (whatsappApiUrl) {
        await Linking.openURL(whatsappApiUrl);
        return;
      }

      if (whatsappWebUrl) {
        await Linking.openURL(whatsappWebUrl);
        return;
      }

      Alert.alert("No supported message app", "Use Copy message and paste it into any app.");
    } catch {
      Alert.alert("Draft failed", "Use Copy message and paste it into any app.");
    }
  }

  async function openLinkedInDraft(person: (typeof people)[number], message: string) {
    if (!person.linkedinUrl) {
      Alert.alert("No LinkedIn saved", `Add a LinkedIn profile for ${person.name} first.`);
      return;
    }

    try {
      await copyTextToClipboard(message);
      await handleOpenExternal(person.linkedinUrl);
      Alert.alert("Message copied", "Paste it into their LinkedIn DMs.");
    } catch {
      Alert.alert("Draft failed", "Could not copy the message and open LinkedIn.");
    }
  }

  async function openEmailDraft(person: (typeof people)[number], message: string) {
    if (!person.email) {
      Alert.alert("No email saved", `Add an email for ${person.name} first.`);
      return;
    }

    const subject = encodeURIComponent(`Great meeting you at ${person.lastEventName || "the event"}`);
    const body = encodeURIComponent(message);
    const emailAddress = encodeURIComponent(person.email);

    try {
      await Linking.openURL(`mailto:${emailAddress}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert("Draft failed", "Could not open the email composer on this device.");
    }
  }

  async function openOtherDraft(person: (typeof people)[number], message: string) {
    try {
      await copyTextToClipboard(message);
      Alert.alert(
        "Message copied",
        `Paste it into ${person.preferredChannelOther?.trim() || "their preferred channel"}.`
      );
    } catch {
      Alert.alert("Copy failed", "Could not copy the message to the clipboard.");
    }
  }

  function handleDraftMessage(person = selectedPerson, forcedChannel?: DraftPreviewChannel) {
    if (!person) {
      return;
    }

    const channel = forcedChannel || getPreferredChannelForPerson(person);
    setDraftPreviewText(buildMessageForPerson(person));
    setDraftPreviewPerson(person);
    setDraftPreviewChannel(channel);
  }

  async function handleExecuteDraftAction(person: (typeof people)[number], channel: DraftPreviewChannel, message: string) {
    if (channel === "whatsapp") {
      await openWhatsAppDraft(person, message);
      return;
    }

    if (channel === "linkedin") {
      await openLinkedInDraft(person, message);
      return;
    }

    if (channel === "email") {
      await openEmailDraft(person, message);
      return;
    }

    if (channel === "phone") {
      setPhoneActionPerson(person);
      setPhoneActionText(message);
      return;
    }

    await openOtherDraft(person, message);
  }

  async function handleCopyDraft(person = selectedPerson, messageOverride?: string) {
    if (!person) {
      return;
    }

    try {
      await copyTextToClipboard(messageOverride?.trim() || buildMessageForPerson(person));
      Alert.alert("Copied", "Draft copied to your clipboard.");
    } catch {
      Alert.alert("Copy failed", "Could not copy the draft to the clipboard.");
    }
  }

  async function handlePhoneCall(person: (typeof people)[number]) {
    if (!person.phoneNumber) {
      Alert.alert("No phone number", `Add a phone number for ${person.name} first.`);
      return;
    }

    try {
      await Linking.openURL(`tel:${person.phoneNumber}`);
    } catch {
      Alert.alert("Call failed", "Could not open the dialer on this device.");
    }
  }

  async function handlePhoneText(person: (typeof people)[number], message: string) {
    if (!person.phoneNumber) {
      Alert.alert("No phone number", `Add a phone number for ${person.name} first.`);
      return;
    }

    try {
      await Linking.openURL(`sms:${person.phoneNumber}?body=${encodeURIComponent(message)}`);
    } catch {
      Alert.alert("Text failed", "Could not open the messaging app on this device.");
    }
  }


  function getCompactPreferredLabel(person: (typeof people)[number]) {
    const channel = getPreferredChannelForPerson(person);
    if (channel === "linkedin") return "DM";
    if (channel === "whatsapp") return "WA";
    if (channel === "email") return "EM";
    if (channel === "phone") return "PH";
    return "CP";
  }

  function renderCommunicationButtons(person: (typeof people)[number]) {
    const preferredChannel = getPreferredChannelForPerson(person);

    return (
      <View style={styles.primaryActionRow}>
        <Button
          label={getDraftButtonLabel(preferredChannel, person)}
          onPress={() => handleDraftMessage(person, preferredChannel)}
          fullWidth={false}
          size="compact"
        />
        <Button
          label="Copy"
          onPress={() => {
            void handleCopyDraft(person);
          }}
          variant="ghost"
          fullWidth={false}
          size="compact"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.headerRow, isCompactLayout ? styles.headerRowCompact : null]}>
            <View style={styles.headerCopy}>
              <Typography variant="caption">People</Typography>
              <Typography variant="h1">Your live contact ledger, sorted by warmth and context.</Typography>
            </View>
            {!isCompactLayout ? (
              <View style={styles.headerActions}>
                <Button label="Add person" onPress={() => openCreatePerson("")} variant="ghost" fullWidth={false} />
                <Button label="Log update" onPress={openCreateInteraction} fullWidth={false} />
              </View>
            ) : null}
          </View>

          <Card>
            <Typography variant="caption">Last connected</Typography>
            <View style={styles.controlRow}>
              <Button
                label="All"
                onPress={() => setStatusMode("all")}
                variant={statusMode === "all" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="Today"
                onPress={() => setStatusMode("today")}
                variant={statusMode === "today" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="Recent"
                onPress={() => setStatusMode("recent")}
                variant={statusMode === "recent" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="Stale"
                onPress={() => setStatusMode("stale")}
                variant={statusMode === "stale" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
            </View>

            <Typography variant="caption" style={styles.subSectionLabel}>
              Event type
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {EVENT_CATEGORY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  label={option.label}
                  onPress={() => setCategoryMode(option.value)}
                  variant={categoryMode === option.value ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
              ))}
            </ScrollView>

            <Typography variant="caption" style={styles.subSectionLabel}>
              Sort order
            </Typography>
            <View style={styles.controlRow}>
              <Button
                label="Recent"
                onPress={() => setSortMode("recent")}
                variant={sortMode === "recent" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="Stale"
                onPress={() => setSortMode("stale")}
                variant={sortMode === "stale" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="A-Z"
                onPress={() => setSortMode("name")}
                variant={sortMode === "name" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="Most logged"
                onPress={() => setSortMode("frequency")}
                variant={sortMode === "frequency" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
            </View>

            <Typography variant="caption" style={styles.subSectionLabel}>
              Search
            </Typography>
            <TextInput
              placeholder="Search name, company, notes, tags"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Typography variant="caption" style={styles.subSectionLabel}>
              Tags
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Button
                label="All tags"
                onPress={() => setSelectedTag("all")}
                variant={selectedTag === "all" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              {availableTags.map((tag) => (
                <Button
                  key={tag}
                  label={tag}
                  onPress={() => setSelectedTag(tag)}
                  variant={selectedTag === tag ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
              ))}
            </ScrollView>
          </Card>

          {!isCompactLayout && selectedPerson ? (
            <Card style={styles.featureCard}>
              <Typography variant="caption">Selected contact</Typography>
              <Typography variant="h1">{selectedPerson.name}</Typography>
              <View style={styles.featureMetaRow}>
                <Typography variant="body" style={styles.featureBody}>
                  {selectedPerson.bannerLabel}
                </Typography>
                {selectedPerson.nextFollowUpAt ? (
                  <>
                    <Typography variant="body" style={styles.metaDivider}>·</Typography>
                    <Pressable onPress={() => void handleAddToCalendar(selectedPerson)} style={styles.inlineMetaAction}>
                      <Typography variant="body" style={styles.inlineMetaActionText}>📅 Add to Calendar</Typography>
                    </Pressable>
                  </>
                ) : null}
                <Typography variant="body" style={styles.metaDivider}>·</Typography>
                <Typography variant="body" style={styles.featureBody}>
                  {getMomentLabel(selectedPerson.interactionCount)}
                </Typography>
              </View>
              {selectedPerson.company ? (
                <Typography variant="caption">{selectedPerson.company}</Typography>
              ) : null}
              {selectedPerson.tags.length ? (
                <View style={styles.tagPillRow}>
                  {selectedPerson.tags.map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Typography variant="caption">{tag}</Typography>
                    </View>
                  ))}
                </View>
              ) : null}
              {selectedPerson.preferredChannel ? (
                <View style={styles.preferencePill}>
                  <Typography variant="caption" style={styles.preferencePillText}>
                    Prefers {formatPreferredChannelLabel(selectedPerson.preferredChannel, selectedPerson.preferredChannelOther)}
                  </Typography>
                </View>
              ) : null}
              {searchQuery ? <Typography variant="caption">Search: {searchQuery}</Typography> : null}

              {renderCommunicationButtons(selectedPerson)}

              <View style={styles.secondaryActionRow}>
                <Button
                  label="✓ Reached out"
                  onPress={() => handleMarkContactedToday(selectedPerson)}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Edit"
                  onPress={() => setPersonActionMenu(selectedPerson)}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                />
              </View>

              <Typography variant="body" style={styles.featureNote}>
                {selectedPerson.lastInteractionNote}
              </Typography>
            </Card>
          ) : null}

          <View style={styles.timelineHeader}>
            <Typography variant="caption">All connections</Typography>
            <Typography variant="body" style={styles.timelineCount}>
              {filteredPeople.length} people in view ({sortLabel}{selectedTag !== "all" ? ` · ${selectedTag}` : ""})
            </Typography>
          </View>

          {errorMessage ? (
            <Card>
              <Typography variant="body">{errorMessage}</Typography>
            </Card>
          ) : null}

          <View style={styles.timelineStack}>
            {filteredPeople.map((person) => (
              <Card key={person.id} style={person.id === selectedPerson?.id ? styles.selectedCard : null}>
                {isCompactLayout ? (
                  <>
                    <View style={styles.compactPersonRow}>
                      <View style={styles.compactPersonMain}>
                        <Typography variant="h2" numberOfLines={1}>{person.name}</Typography>
                        <Typography variant="body" style={styles.compactCompany} numberOfLines={1}>
                          {person.company || "No company"}
                        </Typography>
                      </View>
                      <View style={styles.compactActions}>
                        {person.linkedinUrl ? (
                          <Pressable style={styles.iconButton} onPress={() => handleOpenExternal(person.linkedinUrl)}>
                            <Typography variant="body" style={styles.iconButtonText}>in</Typography>
                          </Pressable>
                        ) : null}
                        {getAvailableChannels(person).length ? (
                          <Pressable style={styles.iconButton} onPress={() => handleDraftMessage(person, getPreferredChannelForPerson(person))}>
                            <Typography variant="body" style={styles.iconButtonText}>{getCompactPreferredLabel(person)}</Typography>
                          </Pressable>
                        ) : null}
                        <Pressable style={styles.expandButton} onPress={() => handleToggleExpandedPerson(person.id)}>
                          <Typography variant="body" style={styles.iconButtonText}>
                            {selectedPersonId === person.id ? "v" : ">"}
                          </Typography>
                        </Pressable>
                      </View>
                    </View>

                    {selectedPersonId === person.id ? (
                      <View style={styles.expandedPersonContent}>
                        <Typography variant="body" style={styles.noteText}>
                          {person.lastInteractionNote}
                        </Typography>
                        <View style={styles.metaRow}>
                          <Typography variant="caption">{person.bannerLabel}</Typography>
                          {person.nextFollowUpAt ? (
                            <Pressable onPress={() => void handleAddToCalendar(person)} style={styles.inlineMetaAction}>
                              <Typography variant="caption" style={styles.inlineMetaActionCaption}>📅 Add to Calendar</Typography>
                            </Pressable>
                          ) : null}
                          {isContactStale(person.daysSinceLastContact, person.priority) ? <Typography variant="caption">Need a nudge</Typography> : null}
                          <Typography variant="caption">{getMomentLabel(person.interactionCount)}</Typography>
                        </View>
                        {person.tags.length ? <Typography variant="caption">Tags: {person.tags.join(", ")}</Typography> : null}
                        {person.preferredChannel ? (
                          <View style={styles.preferencePillCompact}>
                            <Typography variant="caption" style={styles.preferencePillText}>
                              Prefers {formatPreferredChannelLabel(person.preferredChannel, person.preferredChannelOther)}
                            </Typography>
                          </View>
                        ) : null}
                        <View style={styles.compactExpandedActions}>
                          {renderCommunicationButtons(person)}
                        </View>
                        <View style={styles.secondaryActionRow}>
                          <Button label="✓ Reached out" onPress={() => handleMarkContactedToday(person)} variant="ghost" fullWidth={false} size="compact" />
                          <Button label="Edit" onPress={() => setPersonActionMenu(person)} variant="ghost" fullWidth={false} size="compact" />
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={styles.rowTop}>
                      <View style={styles.personCopy}>
                        <Typography variant="h2">{person.name}</Typography>
                        <Typography variant="caption">
                          {[person.company, person.lastEventName || "No event yet"].filter(Boolean).join(" · ")}
                        </Typography>
                        {person.tags.length ? <Typography variant="caption">Tags: {person.tags.join(", ")}</Typography> : null}
                      </View>
                      <Button
                        label="Edit"
                        onPress={() => setPersonActionMenu(person)}
                        variant={person.id === selectedPerson?.id ? "primary" : "ghost"}
                        fullWidth={false}
                        size="compact"
                      />
                    </View>

                    <Typography variant="body" style={styles.noteText} numberOfLines={2}>
                      {person.lastInteractionNote}
                    </Typography>

                    <View style={styles.metaRow}>
                      <Typography variant="caption">{person.bannerLabel}</Typography>
                      {isContactStale(person.daysSinceLastContact, person.priority) ? <Typography variant="caption">Need a nudge</Typography> : null}
                      <Typography variant="caption">{person.interactionCount} notes</Typography>
                    </View>
                  </>
                )}
              </Card>
            ))}
            {!isLoading && filteredPeople.length === 0 ? (
              searchQuery.trim() ? (
                <Card style={styles.emptyStateCard}>
                  <Typography variant="h2">No contact found for "{searchQuery.trim()}"</Typography>
                  <Typography variant="body" style={styles.timelineCount}>
                    Create a new contact with that name and fill in the rest from there.
                  </Typography>
                  <View style={styles.emptyStateActions}>
                    <Button label={`Create ${searchQuery.trim()}`} onPress={openCreatePersonFromSearch} fullWidth={false} size="compact" />
                  </View>
                </Card>
              ) : (
                <Typography variant="body">No contacts match this filter yet.</Typography>
              )
            ) : null}
          </View>
        </ScrollView>

        <CaptureModal
          visible={isCaptureOpen}
          onClose={() => setCaptureOpen(false)}
          onSave={handleSaveInteraction}
          isSaving={isSaving}
          initialDraft={editorDraft}
          lockedEvent={editorMode === "edit" ? null : currentEvent}
          title={editorMode === "edit" ? "Edit Contact" : editorMode === "createPerson" ? "Add Person" : "Log Update"}
          saveLabel={editorMode === "edit" ? "Save Changes" : editorMode === "createPerson" ? "Save Person" : "Save Update"}
          showQuickCapture={editorMode === "createPerson"}
        />

        {isInteractionPickerOpen ? (
          <View style={styles.confirmOverlay}>
            <Pressable style={styles.confirmBackdrop} onPress={() => setInteractionPickerOpen(false)} />
            <View style={styles.confirmCardWrap}>
              <Card style={styles.confirmCard}>
                <Typography variant="h2">Pick a contact to update</Typography>
                <Typography variant="body" style={styles.confirmMeta}>
                  Choose who this update should be saved against.
                </Typography>
                <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
                  {filteredPeople.map((person) => (
                    <Button
                      key={person.id}
                      label={person.name}
                      variant="ghost"
                      fullWidth={false}
                      size="compact"
                      onPress={() => {
                        setSelectedPersonId(person.id);
                        setInteractionPickerOpen(false);
                        openCreateInteractionForPerson(person);
                      }}
                    />
                  ))}
                </ScrollView>
                <View style={styles.confirmActions}>
                  <Button
                    label="Add person instead"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      setInteractionPickerOpen(false);
                      openCreatePerson("");
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => setInteractionPickerOpen(false)}
                  />
                </View>
              </Card>
            </View>
          </View>
        ) : null}

        {draftPreviewPerson && draftPreviewChannel ? (
          <View style={styles.confirmOverlay}>
            <Pressable
              style={styles.confirmBackdrop}
              onPress={() => {
                setDraftPreviewPerson(null);
                setDraftPreviewChannel(null);
              }}
            />
            <View style={styles.confirmCardWrap}>
              <Card style={styles.confirmCard}>
                <Typography variant="h2">Open {getDraftButtonLabel(draftPreviewChannel, draftPreviewPerson)}?</Typography>
                <Typography variant="body" style={styles.confirmMeta}>
                  {draftPreviewPerson.name} · {getChannelMetaLabel(draftPreviewChannel, draftPreviewPerson)}
                </Typography>
                <TextInput
                  value={draftPreviewText}
                  onChangeText={setDraftPreviewText}
                  multiline
                  placeholder="Edit your message before opening the draft"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.draftEditorInput}
                />
                <View style={styles.confirmActions}>
                  <Button
                    label="Edit contact"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = draftPreviewPerson;
                      setDraftPreviewPerson(null);
                      setDraftPreviewChannel(null);
                      openEditPerson(person);
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      setDraftPreviewPerson(null);
                      setDraftPreviewChannel(null);
                    }}
                  />
                  <Button
                    label={draftPreviewChannel === "phone" ? "Continue" : getDraftButtonLabel(draftPreviewChannel, draftPreviewPerson)}
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = draftPreviewPerson;
                      const message = draftPreviewText;
                      const channel = draftPreviewChannel;
                      setDraftPreviewPerson(null);
                      setDraftPreviewChannel(null);
                      setDraftPreviewText("");
                      void handleExecuteDraftAction(person, channel, message);
                    }}
                  />
                </View>
              </Card>
            </View>
          </View>
        ) : null}

        {phoneActionPerson ? (
          <View style={styles.confirmOverlay}>
            <Pressable style={styles.confirmBackdrop} onPress={() => setPhoneActionPerson(null)} />
            <View style={styles.confirmCardWrap}>
              <Card style={styles.confirmCard}>
                <Typography variant="h2">Phone actions</Typography>
                <Typography variant="body" style={styles.confirmMeta}>
                  {phoneActionPerson.name} · {phoneActionPerson.phoneNumber || "No phone number"}
                </Typography>
                <View style={styles.confirmActions}>
                  <Button
                    label="Call"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = phoneActionPerson;
                      setPhoneActionPerson(null);
                      void handlePhoneCall(person);
                    }}
                  />
                  <Button
                    label="Text"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = phoneActionPerson;
                      const message = phoneActionText;
                      setPhoneActionPerson(null);
                      void handlePhoneText(person, message);
                    }}
                  />
                  <Button
                    label="Copy number"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = phoneActionPerson;
                      setPhoneActionPerson(null);
                      if (!person.phoneNumber) {
                        Alert.alert("No phone number", `Add a phone number for ${person.name} first.`);
                        return;
                      }
                      void copyTextToClipboard(person.phoneNumber).then(() => {
                        Alert.alert("Number copied", `${person.name}'s number is on your clipboard.`);
                      });
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => setPhoneActionPerson(null)}
                  />
                </View>
              </Card>
            </View>
          </View>
        ) : null}

        {personActionMenu ? (
          <View style={styles.confirmOverlay}>
            <Pressable style={styles.confirmBackdrop} onPress={() => setPersonActionMenu(null)} />
            <View style={styles.confirmCardWrap}>
              <Card style={styles.confirmCard}>
                <Typography variant="h2">Edit contact</Typography>
                <Typography variant="body" style={styles.confirmMeta}>
                  {personActionMenu.name}
                </Typography>
                <View style={styles.confirmActions}>
                  <Button
                    label="Edit details"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = personActionMenu;
                      setPersonActionMenu(null);
                      openEditPerson(person);
                    }}
                  />
                  <Button
                    label="Delete contact"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    loading={isDeleting}
                    onPress={() => {
                      const person = personActionMenu;
                      setPersonActionMenu(null);
                      handleDeletePerson(person);
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => setPersonActionMenu(null)}
                  />
                </View>
              </Card>
            </View>
          </View>
        ) : null}

        {isCompactLayout ? (
          <FloatingActionBar
            actions={[
              { label: "+", onPress: () => openCreatePerson(""), variant: "ghost" },
              { label: selectedPerson ? "Log update" : "Pick contact", onPress: openCreateInteraction },
            ]}
          />
        ) : null}
      </View>
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
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: layout.stackGap,
    paddingBottom: 132,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  headerRowCompact: {
    alignItems: "stretch",
  },
  headerActionButtonCompact: {
    width: "100%",
  },
  controlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chipRow: {
    gap: 8,
    paddingTop: 10,
  },
  searchInput: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  subSectionLabel: {
    marginTop: 14,
  },
  featureCard: {
    gap: 10,
    backgroundColor: colors.surfaceMuted,
  },
  featureBody: {
    color: colors.textSecondary,
  },
  featureMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  metaDivider: {
    color: colors.textTertiary,
  },
  inlineMetaAction: {
    borderRadius: 999,
  },
  inlineMetaActionText: {
    color: colors.primaryAction,
    fontWeight: "600",
  },
  inlineMetaActionCaption: {
    color: colors.primaryAction,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  confirmCardWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 520,
    gap: 12,
  },
  confirmMeta: {
    color: colors.textSecondary,
  },
  confirmPreview: {
    color: colors.textPrimary,
  },
  draftEditorInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    fontSize: 15,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerList: {
    maxHeight: 260,
  },
  pickerListContent: {
    gap: 8,
  },
  compactPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compactPersonMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  compactCompany: {
    color: colors.textSecondary,
  },
  compactActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  expandButton: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryAction,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontWeight: "700",
  },
  expandedPersonContent: {
    marginTop: 14,
    gap: 10,
  },
  compactExpandedActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  secondaryActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  preferencePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  preferencePillCompact: {
    alignSelf: "flex-start",
  },
  preferencePillText: {
    color: colors.success,
    fontWeight: "600",
  },
  featureNote: {
    color: colors.textSecondary,
  },
  timelineHeader: {
    marginTop: 6,
    gap: 4,
  },
  timelineCount: {
    color: colors.textSecondary,
  },
  timelineStack: {
    gap: 14,
  },
  emptyStateCard: {
    gap: 10,
  },
  emptyStateActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  selectedCard: {
    borderColor: colors.primaryAction,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  personCopy: {
    flex: 1,
    gap: 6,
  },
  noteText: {
    marginTop: 10,
    marginBottom: 12,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
});
