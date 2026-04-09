import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, SafeAreaView, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";

import { CurrentEventValue } from "../components/CurrentEventSheet";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  EVENT_CATEGORY_OPTIONS,
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
  toWhatsAppUrl,
  updateInteraction,
  updatePersonDetails,
  isContactStale,
} from "../lib/crm";
import { colors, layout } from "../theme/tokens";

type SortMode = "recent" | "stale" | "name" | "frequency";
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
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [deleteArmedPersonId, setDeleteArmedPersonId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorDraft, setEditorDraft] = useState<Partial<ParsedPersonDraft> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [statusMode, setStatusMode] = useState<PersonStatusMode>("all");
  const [categoryMode, setCategoryMode] = useState<(typeof EVENT_CATEGORY_OPTIONS)[number]["value"]>("all");
  const [people, setPeople] = useState<Awaited<ReturnType<typeof listPeopleInsights>>>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredPeople = useMemo(() => {
    const statusFiltered = people.filter((person) => {
      if (statusMode === "today") {
        return person.daysSinceLastContact !== null && person.daysSinceLastContact <= JUST_CONNECTED_THRESHOLD;
      }

      if (statusMode === "recent") {
        return person.daysSinceLastContact !== null && person.daysSinceLastContact <= RECENT_CONTACT_THRESHOLD;
      }

      if (statusMode === "stale") {
        return isContactStale(person.daysSinceLastContact, person.isVip);
      }

      return true;
    });

    const categoryFiltered = statusFiltered.filter(
      (person) => categoryMode === "all" || person.lastEventCategory === categoryMode
    );

    const query = searchQuery.trim().toLowerCase();
    const searchedPeople = !query
      ? categoryFiltered
      : categoryFiltered.filter((person) =>
          [person.name, person.company, person.lastInteractionNote, person.followUp, person.lastEventName || ""]
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
  }, [categoryMode, people, searchQuery, sortMode, statusMode]);

  const selectedPerson = useMemo(() => {
    return (
      filteredPeople.find((person) => person.id === selectedPersonId) || filteredPeople[0] || null
    );
  }, [filteredPeople, selectedPersonId]);

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

        return insights[0]?.id || null;
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
    setEditorMode("create");
    setEditorDraft(
      selectedPerson
        ? {
            name: selectedPerson.name,
            isVip: selectedPerson.isVip,
            company: selectedPerson.company,
          linkedinUrl: selectedPerson.linkedinUrl,
          phoneNumber: selectedPerson.phoneNumber,
            event: selectedPerson.lastEventName || "",
            notes: "",
            followUp: selectedPerson.followUp === "None yet" ? "" : selectedPerson.followUp,
          }
        : null
    );
    setCaptureOpen(true);
  }

  function openCreatePersonFromSearch() {
    const nameFromSearch = searchQuery.trim();
    if (!nameFromSearch) {
      return;
    }

    setSelectedPersonId(null);
    setEditorMode("create");
    setEditorDraft({
      name: nameFromSearch,
      isVip: false,
      company: "",
      event: currentEvent?.name || "",
      eventCategory: currentEvent?.category || "",
      notes: "",
      followUp: "",
    });
    setCaptureOpen(true);
  }

  function openEditPerson(person = selectedPerson) {
    if (!person) {
      return;
    }

    setSelectedPersonId(person.id);
    setEditorMode("edit");
    setEditorDraft({
      name: person.name,
      isVip: person.isVip,
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

    try {
      setSaving(true);
      const userId = await ensureSessionUserId();

      if (editorMode === "edit" && selectedPerson) {
        await updatePersonDetails({
          userId,
          personId: selectedPerson.id,
          name: draft.name,
          isVip: draft.isVip,
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

      const activePersonId =
        selectedPerson?.id ||
        (await createPerson(
          userId,
          draft.name === "Unknown contact" ? "New Person" : draft.name,
          draft.company,
          draft.linkedinUrl,
          draft.phoneNumber,
          draft.isVip
        )).id;

      let eventId: string | null = null;
      const eventName = currentEvent?.name || draft.event;
      const eventCategory = currentEvent?.category || draft.eventCategory || null;
      if (eventName && eventName !== "No event") {
        eventId = (await getOrCreateEvent(userId, eventName, eventCategory)).id;
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

  async function handleMarkContactedToday() {
    if (!selectedPerson) {
      return;
    }

    try {
      const userId = await ensureSessionUserId();
      await markPersonContactedToday(userId, selectedPerson.id);
      await loadProfileData();
      Alert.alert("Updated", `${selectedPerson.name} marked as contacted today.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark contact.";
      Alert.alert("Update failed", message);
    }
  }

  async function handleDeletePerson() {
    if (!selectedPerson) {
      return;
    }

    if (deleteArmedPersonId !== selectedPerson.id) {
      setDeleteArmedPersonId(selectedPerson.id);
      return;
    }

    try {
      setDeleting(true);
      const userId = await ensureSessionUserId();
      await deletePerson(userId, selectedPerson.id);
      await loadProfileData();
      Alert.alert("Deleted", `${selectedPerson.name} removed.`);
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

  function buildMessageForSelectedPerson() {
    if (!selectedPerson) {
      return "";
    }

    return buildReconnectDraft({
      name: selectedPerson.name,
      eventName: selectedPerson.lastEventName,
      lastInteractionNote: selectedPerson.lastInteractionNote,
      followUp: selectedPerson.followUp,
    });
  }

  async function handleDraftMessage() {
    if (!selectedPerson) {
      return;
    }

    const message = buildMessageForSelectedPerson();
    const whatsappBase = selectedPerson.phoneNumber ? toWhatsAppUrl(selectedPerson.phoneNumber) : null;
    const whatsappUrl = whatsappBase ? `${whatsappBase}?text=${encodeURIComponent(message)}` : null;

    try {
      if (whatsappUrl) {
        const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
        if (canOpenWhatsApp) {
          await Linking.openURL(whatsappUrl);
          return;
        }
      }

      if (selectedPerson.phoneNumber) {
        const smsUrl = `sms:${selectedPerson.phoneNumber}?body=${encodeURIComponent(message)}`;
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

  async function handleCopyMessage() {
    if (!selectedPerson) {
      return;
    }

    const message = buildMessageForSelectedPerson();

    try {
      await Share.share({
        message,
        title: `Follow up with ${selectedPerson.name}`,
      });
    } catch {
      Alert.alert("Copy fallback", message);
    }
  }

  async function handleToggleVip() {
    if (!selectedPerson) {
      return;
    }

    try {
      const userId = await ensureSessionUserId();
      await updatePersonDetails({
        userId,
        personId: selectedPerson.id,
        name: selectedPerson.name,
        company: selectedPerson.company,
        linkedinUrl: selectedPerson.linkedinUrl,
        phoneNumber: selectedPerson.phoneNumber,
        isVip: !selectedPerson.isVip,
      });
      await loadProfileData();
      Alert.alert("Updated", !selectedPerson.isVip ? `${selectedPerson.name} marked as a lead.` : `${selectedPerson.name} is now a normal contact.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update priority.";
      Alert.alert("Update failed", message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Typography variant="caption">People</Typography>
              <Typography variant="h1">Your live contact ledger, sorted by warmth and context.</Typography>
            </View>
            <Button label="Add interaction" onPress={openCreateInteraction} fullWidth={false} />
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
                label="Name"
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
              placeholder="Search name, company, notes, follow-up"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Card>

          {selectedPerson ? (
            <Card style={styles.featureCard}>
              <Typography variant="caption">Selected contact</Typography>
              <Typography variant="h1">{selectedPerson.isVip ? "⭐ " : ""}{selectedPerson.name}</Typography>
              <Typography variant="body" style={styles.featureBody}>
                {selectedPerson.bannerLabel} · {selectedPerson.interactionCount} logged moments · {selectedPerson.lastEventName || "No event yet"}
              </Typography>
              {selectedPerson.company ? (
                <Typography variant="caption">{selectedPerson.company}</Typography>
              ) : null}
              {searchQuery ? <Typography variant="caption">Search: {searchQuery}</Typography> : null}

              <View style={styles.actionRow}>
                <Button label="Draft Message" onPress={handleDraftMessage} fullWidth={false} size="compact" />
                <Button label="Copy / Share" onPress={handleCopyMessage} variant="ghost" fullWidth={false} size="compact" />
                <Button
                  label={selectedPerson.isVip ? "⭐ Unstar lead" : "⭐ Star lead"}
                  onPress={handleToggleVip}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                />
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
                  label="Edit details"
                  onPress={() => openEditPerson(selectedPerson)}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Mark contacted today"
                  onPress={handleMarkContactedToday}
                  fullWidth={false}
                  size="compact"
                />
                <Button
                  label="Delete user"
                  onPress={handleDeletePerson}
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
              {filteredPeople.length} people in view
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
                <View style={styles.rowTop}>
                  <View style={styles.personCopy}>
                    <Typography variant="h2">{person.name}</Typography>
                    {person.isVip ? <Typography variant="caption">⭐ Starred lead</Typography> : null}
                    <Typography variant="caption">
                      {[person.company, person.lastEventName || "No event yet"].filter(Boolean).join(" · ")}
                    </Typography>
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
                  {isContactStale(person.daysSinceLastContact, person.isVip) ? <Typography variant="caption">Need a nudge</Typography> : null}
                  <Typography variant="caption">{person.interactionCount} notes</Typography>
                </View>
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
          lockedEvent={editorMode === "create" ? currentEvent : null}
          title={editorMode === "edit" ? "Edit Contact" : "Add Interaction"}
          saveLabel={editorMode === "edit" ? "Save Changes" : "Save Interaction"}
        />
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
    paddingBottom: 56,
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  armedDeleteButton: {
    borderColor: colors.destructive,
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
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
});
