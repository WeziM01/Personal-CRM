import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";

import { CurrentEventValue } from "../components/CurrentEventSheet";
import { FloatingActionBar } from "../components/FloatingActionBar";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  EVENT_CATEGORY_OPTIONS,
  PERSON_TAG_SUGGESTIONS,
  PersonPriority,
  buildReconnectDraft,
  JUST_CONNECTED_THRESHOLD,
  RECENT_CONTACT_THRESHOLD,
  buildInteractionRecord,
  createInteraction,
  createPerson,
  deletePerson,
  ensureSessionUserId,
  formatPriorityLabel,
  getOrCreateEvent,
  listPeopleInsights,
  markPersonContactedToday,
  updateInteraction,
  updatePersonDetails,
  isContactStale,
} from "../lib/crm";
import { colors, layout } from "../theme/tokens";

type SortMode = "recent" | "stale" | "name" | "frequency";
type CaptureMode = "createInteraction" | "createPerson" | "edit";
export type PersonStatusMode = "all" | "today" | "recent" | "stale";

type PersonProfileScreenProps = {
  currentEvent: CurrentEventValue | null;
  forcedStatusMode?: PersonStatusMode | null;
  forcedStatusNonce?: number;
};

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
  const [deleteArmedPersonId, setDeleteArmedPersonId] = useState<string | null>(null);
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

  const draftPreviewMessage = useMemo(() => {
    if (!draftPreviewPerson) {
      return "";
    }

    const message = buildMessageForPerson(draftPreviewPerson);
    return message.length > 220 ? `${message.slice(0, 217)}...` : message;
  }, [draftPreviewPerson]);

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

    return isCompactLayout ? null : filteredPeople[0] || null;
  }, [filteredPeople, isCompactLayout, selectedPersonId]);

  async function loadProfileData() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const userId = await ensureSessionUserId();
      const insights = await listPeopleInsights(userId);
      setPeople(insights);
      setDeleteArmedPersonId(null);
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

  function openCreateInteraction() {
    if (!selectedPerson) {
      Alert.alert(
        "Select a contact first",
        isCompactLayout
          ? "Tap a contact row to expand it, then tap Add interaction."
          : "No contact is selected yet."
      );
      return;
    }

    setEditorMode("createInteraction");
    setEditorDraft({
      name: selectedPerson.name,
      priority: selectedPerson.priority,
      tags: selectedPerson.tags,
      company: selectedPerson.company,
      linkedinUrl: selectedPerson.linkedinUrl,
      phoneNumber: selectedPerson.phoneNumber,
      event: selectedPerson.lastEventName || "",
      notes: "",
      followUp: selectedPerson.followUp === "None yet" ? "" : selectedPerson.followUp,
    });
    setCaptureOpen(true);
  }

  function openCreatePerson(initialName = searchQuery.trim()) {
    setEditorMode("createPerson");
    setEditorDraft({
      name: initialName,
      priority: "medium",
      tags: [],
      company: "",
      linkedinUrl: "",
      phoneNumber: "",
      event: currentEvent?.name || "",
      eventCategory: currentEvent?.category || "",
      notes: "",
      followUp: "",
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
      phoneNumber: person.phoneNumber,
      event: person.lastEventName || "",
      notes: person.lastInteractionNote,
      followUp: person.followUp === "None yet" ? "" : person.followUp,
    });
    setCaptureOpen(true);
  }

  async function handleSaveInteraction(draft: ParsedPersonDraft) {
    if (isSaving) {
      return;
    }

    if (editorMode === "createInteraction" && !draft.notes.trim()) {
      Alert.alert("Notes required", "Describe the interaction before saving.");
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
          phoneNumber: draft.phoneNumber,
        });

        let eventId: string | null = null;
        const editEventName = draft.event;
        if (editEventName && editEventName !== "No event") {
          eventId = (await getOrCreateEvent(userId, editEventName, draft.eventCategory || null)).id;
        }

        const rawNote = buildInteractionRecord(draft.notes, draft.followUp, draft.company);

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
            draft.phoneNumber,
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
          phoneNumber: draft.phoneNumber,
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
        rawNote: buildInteractionRecord(draft.notes, draft.followUp, draft.company),
      });

      setCaptureOpen(false);
      await loadProfileData();
      Alert.alert("Added", "Interaction added to timeline.");
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

  async function handleDeletePerson(person = selectedPerson) {
    if (!person) {
      return;
    }

    if (deleteArmedPersonId !== person.id) {
      setDeleteArmedPersonId(person.id);
      return;
    }

    try {
      setDeleting(true);
      const userId = await ensureSessionUserId();
      await deletePerson(userId, person.id);
      await loadProfileData();
      Alert.alert("Deleted", `${person.name} removed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete contact.";
      Alert.alert("Delete failed", message);
    } finally {
      setDeleting(false);
      setDeleteArmedPersonId(null);
    }
  }

  async function handleOpenExternal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Open failed", "Could not open that link on this device.");
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

  async function openDraftMessage(person = selectedPerson) {
    if (!person) {
      return;
    }

    const message = buildMessageForPerson(person);
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
        const browserUrl = whatsappApiUrl || whatsappWebUrl;
        if (!browserUrl) {
          Alert.alert("No WhatsApp number", `Add a phone number for ${person.name} before opening WhatsApp.`);
          return;
        }

        window.open(browserUrl, "_blank", "noopener,noreferrer");
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

      if (person.phoneNumber) {
        const smsUrl = `sms:${person.phoneNumber}?body=${encodedMessage}`;
        const canOpenSms = await Linking.canOpenURL(smsUrl);
        if (canOpenSms) {
          await Linking.openURL(smsUrl);
          return;
        }
      }

      Alert.alert("No supported message app", "Use Copy message and paste it into any app.");
    } catch {
      Alert.alert("Draft failed", "Use Copy message and paste it into any app.");
    }
  }

  function handleDraftMessage(person = selectedPerson) {
    if (!person) {
      return;
    }

    if (!person.phoneNumber) {
      Alert.alert("No WhatsApp number", `Add a phone number for ${person.name} before opening a WhatsApp draft.`);
      return;
    }

    setDraftPreviewPerson(person);
  }

  async function handleUpdatePriority(priority: PersonPriority, person = selectedPerson) {
    if (!person) {
      return;
    }

    try {
      const userId = await ensureSessionUserId();
      await updatePersonDetails({
        userId,
        personId: person.id,
        name: person.name,
        company: person.company,
        linkedinUrl: person.linkedinUrl,
        phoneNumber: person.phoneNumber,
        priority,
        tags: person.tags,
      });
      await loadProfileData();
      Alert.alert("Updated", `${person.name} is now ${formatPriorityLabel(priority).toLowerCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update priority.";
      Alert.alert("Update failed", message);
    }
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
                <Button label="Add interaction" onPress={openCreateInteraction} fullWidth={false} />
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
              placeholder="Search name, company, notes, follow-up, tags"
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
              <Typography variant="body" style={styles.featureBody}>
                {selectedPerson.bannerLabel} · {selectedPerson.interactionCount} logged moments · {selectedPerson.lastEventName || "No event yet"}
              </Typography>
              <Typography variant="caption">{formatPriorityLabel(selectedPerson.priority)}</Typography>
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
              {searchQuery ? <Typography variant="caption">Search: {searchQuery}</Typography> : null}

              <View style={styles.prioritySelector}>
                <Typography variant="caption">Priority</Typography>
                <View style={styles.prioritySelectorButtons}>
                  {(["high", "medium", "low"] as PersonPriority[]).map((priority) => (
                    <Button
                      key={priority}
                      label={priority.charAt(0).toUpperCase() + priority.slice(1)}
                      onPress={() => handleUpdatePriority(priority)}
                      variant={selectedPerson.priority === priority ? "primary" : "ghost"}
                      fullWidth={false}
                      size="compact"
                    />
                  ))}
                </View>
              </View>

              <View style={styles.actionRow}>
                <Button label="WhatsApp Draft" onPress={() => handleDraftMessage(selectedPerson)} fullWidth={false} size="compact" />
                <Button label="Edit contact" onPress={() => openEditPerson(selectedPerson)} variant="ghost" fullWidth={false} size="compact" />
                {selectedPerson.linkedinUrl ? (
                  <Button
                    label="Open LinkedIn"
                    onPress={() => handleOpenExternal(selectedPerson.linkedinUrl)}
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                  />
                ) : null}
                <Button
                  label="Edit contact"
                  onPress={() => openEditPerson(selectedPerson)}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Mark contacted today"
                  onPress={() => handleMarkContactedToday(selectedPerson)}
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Delete contact"
                  onPress={() => handleDeletePerson(selectedPerson)}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                  loading={isDeleting}
                  style={deleteArmedPersonId === selectedPerson.id ? styles.armedDeleteButton : null}
                />
              </View>

              {deleteArmedPersonId === selectedPerson.id ? (
                <Typography variant="caption">Tap delete again to confirm removal.</Typography>
              ) : null}

              <Typography variant="body" style={styles.featureNote}>
                {selectedPerson.lastInteractionNote}
              </Typography>
              <Typography variant="caption">Follow up: {selectedPerson.followUp}</Typography>
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
                        <Typography variant="caption">{formatPriorityLabel(person.priority)}</Typography>
                      </View>
                      <View style={styles.compactActions}>
                        {person.linkedinUrl ? (
                          <Pressable style={styles.iconButton} onPress={() => handleOpenExternal(person.linkedinUrl)}>
                            <Typography variant="body" style={styles.iconButtonText}>in</Typography>
                          </Pressable>
                        ) : null}
                        {person.phoneNumber ? (
                          <Pressable style={styles.iconButton} onPress={() => handleDraftMessage(person)}>
                            <Typography variant="body" style={styles.iconButtonText}>WA</Typography>
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
                          {isContactStale(person.daysSinceLastContact, person.priority) ? <Typography variant="caption">Need a nudge</Typography> : null}
                          <Typography variant="caption">{person.interactionCount} notes</Typography>
                        </View>
                        {person.tags.length ? <Typography variant="caption">Tags: {person.tags.join(", ")}</Typography> : null}
                        <Typography variant="caption">Follow up: {person.followUp}</Typography>
                        <View style={styles.prioritySelector}>
                          <Typography variant="caption">Priority</Typography>
                          <View style={styles.prioritySelectorButtons}>
                            {(["high", "medium", "low"] as PersonPriority[]).map((priority) => (
                              <Button
                                key={priority}
                                label={priority.charAt(0).toUpperCase() + priority.slice(1)}
                                onPress={() => handleUpdatePriority(priority, person)}
                                variant={person.priority === priority ? "primary" : "ghost"}
                                fullWidth={false}
                                size="compact"
                              />
                            ))}
                          </View>
                        </View>
                        <View style={styles.compactExpandedActions}>
                          <Button label="WhatsApp Draft" onPress={() => handleDraftMessage(person)} fullWidth={false} size="compact" />
                          <Button label="Edit contact" onPress={() => openEditPerson(person)} variant="ghost" fullWidth={false} size="compact" />
                          <Button label="Mark today" onPress={() => handleMarkContactedToday(person)} variant="ghost" fullWidth={false} size="compact" />
                          <Button
                            label={deleteArmedPersonId === person.id ? "Delete now" : "Delete"}
                            onPress={() => handleDeletePerson(person)}
                            variant="ghost"
                            fullWidth={false}
                            size="compact"
                            loading={isDeleting && deleteArmedPersonId === person.id}
                            style={deleteArmedPersonId === person.id ? styles.armedDeleteButton : null}
                          />
                        </View>
                        {deleteArmedPersonId === person.id ? (
                          <Typography variant="caption" style={styles.deleteConfirmText}>
                            Tap "Delete now" to confirm permanent removal.
                          </Typography>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={styles.rowTop}>
                      <View style={styles.personCopy}>
                        <Typography variant="h2">{person.name}</Typography>
                        <Typography variant="caption">{formatPriorityLabel(person.priority)}</Typography>
                        <Typography variant="caption">
                          {[person.company, person.lastEventName || "No event yet"].filter(Boolean).join(" · ")}
                        </Typography>
                        {person.tags.length ? <Typography variant="caption">Tags: {person.tags.join(", ")}</Typography> : null}
                      </View>
                      <Button
                        label={person.id === selectedPerson?.id ? "Editing" : "Edit"}
                        onPress={() => openEditPerson(person)}
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
          title={editorMode === "edit" ? "Edit Contact" : editorMode === "createPerson" ? "Add Person" : "Add Interaction"}
          saveLabel={editorMode === "edit" ? "Save Changes" : editorMode === "createPerson" ? "Save Person" : "Save Interaction"}
        />

        {draftPreviewPerson ? (
          <View style={styles.confirmOverlay}>
            <Pressable style={styles.confirmBackdrop} onPress={() => setDraftPreviewPerson(null)} />
            <View style={styles.confirmCardWrap}>
              <Card style={styles.confirmCard}>
                <Typography variant="h2">Open WhatsApp draft?</Typography>
                <Typography variant="body" style={styles.confirmMeta}>
                  {draftPreviewPerson.name} · {draftPreviewPerson.phoneNumber}
                </Typography>
                <Typography variant="body" style={styles.confirmPreview}>
                  {draftPreviewMessage}
                </Typography>
                <View style={styles.confirmActions}>
                  <Button
                    label="Edit contact"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = draftPreviewPerson;
                      setDraftPreviewPerson(null);
                      openEditPerson(person);
                    }}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    fullWidth={false}
                    size="compact"
                    onPress={() => setDraftPreviewPerson(null)}
                  />
                  <Button
                    label="Open WhatsApp"
                    fullWidth={false}
                    size="compact"
                    onPress={() => {
                      const person = draftPreviewPerson;
                      setDraftPreviewPerson(null);
                      void openDraftMessage(person);
                    }}
                  />
                </View>
              </Card>
            </View>
          </View>
        ) : null}

        {isCompactLayout ? (
          <FloatingActionBar
            actions={[
              { label: "Add person", onPress: () => openCreatePerson(""), variant: "ghost" },
              { label: "Add interaction", onPress: openCreateInteraction },
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
  confirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  prioritySelector: {
    gap: 10,
  },
  prioritySelectorButtons: {
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
  armedDeleteButton: {
    borderColor: colors.destructive,
  },
  deleteConfirmText: {
    color: colors.destructive,
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
