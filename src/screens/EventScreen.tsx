import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { CurrentEventValue } from "../components/CurrentEventSheet";
import { FloatingActionBar } from "../components/FloatingActionBar";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  EVENT_CATEGORY_OPTIONS,
  buildInteractionRecord,
  createInteraction,
  createPerson,
  deleteEvent,
  ensureSessionUserId,
  formatCategoryLabel,
  formatEventDate,
  getOrCreateEvent,
  listAllInteractions,
  listEventInsights,
  listPeopleInsights,
  parseDateOnlyString,
  updateEventDetails,
} from "../lib/crm";
import { colors, layout } from "../theme/tokens";

type SortMode = "recent" | "name" | "people" | "notes";

type EventEditorDraft = {
  name: string;
  category: (typeof EVENT_CATEGORY_OPTIONS)[number]["value"] | "";
  eventDate: string;
};

type EventScreenProps = {
  currentEvent: CurrentEventValue | null;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeDateInputValue(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return toDateInputValue(date);
}

export function EventScreen({ currentEvent }: EventScreenProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 720;
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [isEventEditorOpen, setEventEditorOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isSavingEvent, setSavingEvent] = useState(false);
  const [isDeletingEvent, setDeletingEvent] = useState(false);
  const [deleteArmedEventId, setDeleteArmedEventId] = useState<string | null>(null);
  const [eventEditorMode, setEventEditorMode] = useState<"create" | "edit">("create");
  const [eventDraft, setEventDraft] = useState<EventEditorDraft>({ name: "", category: "", eventDate: getRelativeDateInputValue(0) });
  const [captureInitialDraft, setCaptureInitialDraft] = useState<Partial<ParsedPersonDraft> | null>(null);
  const quickDateChoices = useMemo(
    () => [
      { label: "Yesterday", value: getRelativeDateInputValue(-1) },
      { label: "Today", value: getRelativeDateInputValue(0) },
      { label: "Tomorrow", value: getRelativeDateInputValue(1) },
    ],
    []
  );
  const [captureLockedEvent, setCaptureLockedEvent] = useState<CurrentEventValue | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<(typeof EVENT_CATEGORY_OPTIONS)[number]["value"]>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [people, setPeople] = useState<Awaited<ReturnType<typeof listPeopleInsights>>>([]);
  const [interactions, setInteractions] = useState<Awaited<ReturnType<typeof listAllInteractions>>>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listEventInsights>>>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const categoryFiltered = events.filter(
      (event) => selectedCategory === "all" || event.category === selectedCategory
    );
    const query = searchQuery.trim().toLowerCase();
    const searchedEvents = !query
      ? categoryFiltered
      : categoryFiltered.filter((event) => event.name.toLowerCase().includes(query));

    return searchedEvents.sort((left, right) => {
      if (sortMode === "name") {
        return left.name.localeCompare(right.name);
      }

      if (sortMode === "people") {
        return right.peopleCount - left.peopleCount;
      }

      if (sortMode === "notes") {
        return right.interactionCount - left.interactionCount;
      }

      const leftValue = left.lastInteractionAt || left.createdAt;
      const rightValue = right.lastInteractionAt || right.createdAt;
      return rightValue.localeCompare(leftValue);
    });
  }, [events, searchQuery, selectedCategory, sortMode]);

  const selectedEvent = useMemo(() => {
    return filteredEvents.find((event) => event.id === selectedEventId) || filteredEvents[0] || null;
  }, [filteredEvents, selectedEventId]);

  const filteredPeople = useMemo(() => {
    const matching = people.filter((person) => {
      if (selectedEvent) {
        return interactions.some(
          (interaction) => interaction.event_id === selectedEvent.id && interaction.person_id === person.id
        );
      }

      return selectedCategory === "all" || person.lastEventCategory === selectedCategory;
    });

    return matching.sort((left, right) => {
      if (sortMode === "name") {
        return left.name.localeCompare(right.name);
      }

      const leftValue = left.lastInteractionAt || left.createdAt;
      const rightValue = right.lastInteractionAt || right.createdAt;
      return rightValue.localeCompare(leftValue);
    });
  }, [interactions, people, selectedCategory, selectedEvent, sortMode]);

  const selectedEventFollowUpSummary = useMemo(() => {
    return {
      dueToday: filteredPeople.filter((person) => person.followUpState === "dueToday").length,
      overdue: filteredPeople.filter((person) => person.followUpState === "overdue").length,
      upcoming: filteredPeople.filter((person) => person.followUpState === "upcoming").length,
    };
  }, [filteredPeople]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, typeof filteredEvents>();

    filteredEvents.forEach((event) => {
      const key = event.category;
      const current = groups.get(key) || [];
      current.push(event);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items,
    }));
  }, [filteredEvents]);

  async function loadEventData() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const userId = await ensureSessionUserId();
      const [peopleInsights, eventInsights, allInteractions] = await Promise.all([
        listPeopleInsights(userId),
        listEventInsights(userId),
        listAllInteractions(userId),
      ]);
      setPeople(peopleInsights);
      setEvents(eventInsights);
      setInteractions(allInteractions);
      setDeleteArmedEventId(null);
      setSelectedEventId((current) => {
        if (current && eventInsights.some((event) => event.id === current)) {
          return current;
        }

        return eventInsights[0]?.id || null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load event data.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEventData();
  }, []);

  function openCreateEvent() {
    setEventEditorMode("create");
    setEventDraft({
      name: currentEvent?.name || "",
      category: currentEvent?.category || "",
      eventDate: getRelativeDateInputValue(0),
    });
    setEventEditorOpen(true);
  }

  function openCreateEventWithName(name: string) {
    setEventEditorMode("create");
    setEventDraft({
      name,
      category: currentEvent?.category || "",
      eventDate: getRelativeDateInputValue(0),
    });
    setEventEditorOpen(true);
  }

  function openEditEvent() {
    if (!selectedEvent) {
      return;
    }

    setEventEditorMode("edit");
    setEventDraft({
      name: selectedEvent.name,
      category: selectedEvent.category,
      eventDate: selectedEvent.eventDate || "",
    });
    setEventEditorOpen(true);
  }

  function openGeneralCapture() {
    setCaptureInitialDraft(null);
    setCaptureLockedEvent(currentEvent);
    setCaptureOpen(true);
  }

  function openSelectedEventCapture() {
    if (!selectedEvent) {
      openGeneralCapture();
      return;
    }

    setCaptureInitialDraft({
      event: selectedEvent.name,
      eventCategory: selectedEvent.category,
    });
    setCaptureLockedEvent(currentEvent || { name: selectedEvent.name, category: selectedEvent.category });
    setCaptureOpen(true);
  }

  async function handleSaveEvent() {
    const name = eventDraft.name.trim();
    if (!name || isSavingEvent) {
      return;
    }

    if (eventDraft.eventDate && !parseDateOnlyString(eventDraft.eventDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD for the event date.");
      return;
    }

    try {
      setSavingEvent(true);
      const userId = await ensureSessionUserId();
      const category = eventDraft.category && eventDraft.category !== "all" ? eventDraft.category : null;
      const eventDate = eventDraft.eventDate.trim() || null;

      if (eventEditorMode === "edit" && selectedEvent) {
        await updateEventDetails({
          userId,
          eventId: selectedEvent.id,
          name,
          category,
          eventDate,
        });
      } else {
        const event = await getOrCreateEvent(userId, name, category, eventDate);
        setSelectedEventId(event.id);
      }

      setEventEditorOpen(false);
      await loadEventData();
      Alert.alert("Saved", eventEditorMode === "edit" ? "Event updated." : "Event logged.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save event.";
      Alert.alert("Save failed", message);
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent() {
    if (!selectedEvent) {
      return;
    }

    if (deleteArmedEventId !== selectedEvent.id) {
      setDeleteArmedEventId(selectedEvent.id);
      return;
    }

    try {
      setDeletingEvent(true);
      const userId = await ensureSessionUserId();
      await deleteEvent(userId, selectedEvent.id);
      await loadEventData();
      Alert.alert("Deleted", `${selectedEvent.name} removed. Existing interactions keep their notes.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete event.";
      Alert.alert("Delete failed", message);
    } finally {
      setDeletingEvent(false);
      setDeleteArmedEventId(null);
    }
  }

  async function handleQuickCreateEvent() {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery || isSavingEvent) {
      return;
    }

    try {
      setSavingEvent(true);
      const userId = await ensureSessionUserId();
      const event = await getOrCreateEvent(userId, trimmedQuery, null, null);
      setSelectedEventId(event.id);
      setSearchQuery("");
      await loadEventData();
      Alert.alert("Event created", `${event.name} is now in your event list.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create event.";
      Alert.alert("Save failed", message);
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleSaveDraft(draft: ParsedPersonDraft) {
    if (isSaving) {
      return;
    }

    try {
      setSaving(true);
      const userId = await ensureSessionUserId();
      const person = await createPerson(
        userId,
        draft.name,
        draft.company,
        draft.linkedinUrl,
        draft.email,
        draft.phoneNumber,
        draft.preferredChannel,
        draft.preferredChannelOther,
        draft.priority,
        draft.tags
      );
      let linkedEventId: string | null = null;
      const eventName = currentEvent?.name || draft.event;
      const eventCategory = currentEvent?.category || draft.eventCategory || null;
      let linkedEventName = eventName;

      if (eventName && eventName !== "No event") {
        const draftEvent = await getOrCreateEvent(userId, eventName, eventCategory, null);
        linkedEventId = draftEvent.id;
        linkedEventName = draftEvent.name;
      }

      await createInteraction({
        userId,
        personId: person.id,
        eventId: linkedEventId,
        rawNote: buildInteractionRecord(draft.whatMatters, draft.nextStep, draft.company, draft.nextFollowUpAt),
      });

      setCaptureOpen(false);
  setCaptureInitialDraft(null);
  setCaptureLockedEvent(null);
      await loadEventData();

      Alert.alert("Saved", `${draft.name} saved with event: ${linkedEventName || "No event"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save event interaction.";
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.headerRow, isCompactLayout ? styles.headerRowCompact : null]}>
            <View style={styles.headerCopy}>
              <Typography variant="h1">Events</Typography>
            </View>
            <Button
              label="Add event"
              onPress={openCreateEvent}
              fullWidth={false}
              variant="primary"
              style={styles.addEventButton}
            />
          </View>

          <Card>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {EVENT_CATEGORY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  label={option.label}
                  onPress={() => setSelectedCategory(option.value)}
                  variant={selectedCategory === option.value ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
              ))}
            </ScrollView>

            <View style={styles.sortRow}>
              <Button
                label="Recent"
                onPress={() => setSortMode("recent")}
                variant={sortMode === "recent" ? "primary" : "ghost"}
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
                label="Most people"
                onPress={() => setSortMode("people")}
                variant={sortMode === "people" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
              <Button
                label="Most notes"
                onPress={() => setSortMode("notes")}
                variant={sortMode === "notes" ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
            </View>

            <TextInput
              placeholder="Search event name"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Card>

          {errorMessage ? (
            <Card>
              <Typography variant="body">{errorMessage}</Typography>
            </Card>
          ) : null}

          {selectedEvent ? (
            <Card style={styles.featureCard}>
              <Typography variant="h2">{selectedEvent.name}</Typography>
              <Typography variant="caption" style={styles.secondaryText}>
                {formatCategoryLabel(selectedEvent.category)}
                {selectedEvent.eventDate ? ` · ${formatEventDate(selectedEvent.eventDate)}` : ""}
                {` · ${selectedEvent.interactionCount} notes · ${selectedEvent.peopleCount} people`}
              </Typography>
              <Typography variant="caption">
                Due today {selectedEventFollowUpSummary.dueToday} · Overdue {selectedEventFollowUpSummary.overdue} · Upcoming {selectedEventFollowUpSummary.upcoming}
              </Typography>
              <Typography variant="caption">{selectedEvent.lastConnectedLabel}</Typography>
              <View style={styles.featureActions}>
                <Button
                  label="Log contact"
                  onPress={openSelectedEventCapture}
                  fullWidth={false}
                  size="compact"
                />
                <Button label="Edit" onPress={openEditEvent} variant="ghost" fullWidth={false} size="compact" />
                <Button
                  label={deleteArmedEventId === selectedEvent.id ? "Delete now" : "Delete"}
                  onPress={handleDeleteEvent}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                  disabled={isDeletingEvent}
                />
              </View>
            </Card>
          ) : null}

          <View style={styles.sectionHeader}>
            <Typography variant="caption">All events</Typography>
          </View>

          <View style={styles.peopleStack}>
            {groupedEvents.map((group) => (
              <View key={group.category} style={styles.groupSection}>
                {group.items.map((event) => (
                  <Pressable key={event.id} onPress={() => setSelectedEventId(event.id)}>
                    <Card
                      style={[
                        styles.eventCard,
                        selectedEvent?.id === event.id ? styles.eventCardSelected : null,
                      ]}
                    >
                      <View style={styles.eventHeader}>
                        <Typography variant="body" style={styles.secondaryText}>
                          {formatCategoryLabel(event.category as never)}
                        </Typography>
                        <Typography variant="caption">
                          {event.eventDate ? `${formatEventDate(event.eventDate)} · ` : ""}{event.lastConnectedLabel}
                        </Typography>
                      </View>
                      <Typography variant="h2">{event.name}</Typography>
                      <Typography variant="caption">{event.interactionCount} notes · {event.peopleCount} people</Typography>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ))}
            {!isLoading && groupedEvents.length === 0 ? (
              searchQuery.trim() ? (
                <Card style={styles.emptyStateCard}>
                  <Typography variant="h2">No event found for "{searchQuery.trim()}"</Typography>
                  <Typography variant="body" style={styles.secondaryText}>
                    Add it now and keep the search term as the event name.
                  </Typography>
                  <View style={styles.emptyStateActions}>
                    <Button label={`Add ${searchQuery.trim()}`} onPress={handleQuickCreateEvent} fullWidth={false} size="compact" loading={isSavingEvent} />
                    <Button label="Edit before saving" onPress={() => openCreateEventWithName(searchQuery.trim())} variant="ghost" fullWidth={false} size="compact" />
                  </View>
                </Card>
              ) : (
                <Typography variant="body">No event categories match this filter yet.</Typography>
              )
            ) : null}
          </View>


          <View style={styles.sectionHeader}>
            <Typography variant="caption">People linked to this event</Typography>
            <Typography variant="body" style={styles.secondaryText}>
              {selectedEvent
                ? `These are the contacts most recently tied to ${selectedEvent.name}.`
                : "Choose an event to see the people most recently tied to it."}
            </Typography>
          </View>

          <View style={styles.peopleStack}>
            {filteredPeople.map((person) => (
              <Card key={person.id}>
                <View style={styles.personTopRow}>
                  <View style={styles.personCopy}>
                    <Typography variant="h2">{person.name}</Typography>
                    <Typography variant="caption">
                      {[person.company, person.lastEventName || "No event yet"].filter(Boolean).join(" · ")}
                    </Typography>
                    {person.tags.length ? <Typography variant="caption">Tags: {person.tags.join(", ")}</Typography> : null}
                  </View>
                  <Typography variant="caption">{person.bannerLabel}</Typography>
                </View>
                <Typography variant="body" style={styles.valueBlock} numberOfLines={2}>
                  {person.nextStep || person.whatMatters}
                </Typography>
                {person.nextFollowUpAt ? <Typography variant="caption">Follow up: {person.nextFollowUpLabel}</Typography> : null}
              </Card>
            ))}
            {!isLoading && filteredPeople.length === 0 ? (
              <Typography variant="body">No people match this event filter yet.</Typography>
            ) : null}
          </View>
        </ScrollView>

        <CaptureModal
          visible={isCaptureOpen}
          onClose={() => {
            setCaptureOpen(false);
            setCaptureInitialDraft(null);
            setCaptureLockedEvent(null);
          }}
          onSave={handleSaveDraft}
          isSaving={isSaving}
          initialDraft={captureInitialDraft}
          lockedEvent={captureLockedEvent}
          title="Log Event Contact"
          saveLabel="Save Event Contact"
        />

        {isCompactLayout ? (
          <FloatingActionBar
            actions={[
              { label: "Add event", onPress: openCreateEvent, variant: "ghost" },
              { label: "Log contact", onPress: openGeneralCapture },
            ]}
          />
        ) : null}

        <Modal visible={isEventEditorOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.modalContainer}>
              <View style={styles.headerRow}>
                <View style={styles.headerCopy}>
                  <Typography variant="caption">Event</Typography>
                  <Typography variant="h1">{eventEditorMode === "edit" ? "Edit event" : "Log event"}</Typography>
                </View>
                <Button
                  label="Close"
                  onPress={() => setEventEditorOpen(false)}
                  variant="ghost"
                  fullWidth={false}
                  size="compact"
                />
              </View>

              <Card style={styles.modalCard}>
                <Typography variant="caption">Event name</Typography>
                <TextInput
                  placeholder="London Founders Dinner"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.searchInput}
                  value={eventDraft.name}
                  onChangeText={(value) => setEventDraft((current) => ({ ...current, name: value }))}
                />

                <Typography variant="caption" style={styles.subSectionLabel}>
                  Event date
                </Typography>
                <Typography variant="body" style={styles.dateHelperText}>
                  Defaults to today. Use a quick pick or type a different date if needed.
                </Typography>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datePillRow}>
                  {quickDateChoices.map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      onPress={() => setEventDraft((current) => ({ ...current, eventDate: option.value }))}
                      variant={eventDraft.eventDate === option.value ? "primary" : "ghost"}
                      fullWidth={false}
                      size="compact"
                    />
                  ))}
                </ScrollView>
                <TextInput
                  placeholder="2026-04-28"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, styles.dateInput]}
                  value={eventDraft.eventDate}
                  onChangeText={(value) => setEventDraft((current) => ({ ...current, eventDate: value }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Typography variant="caption" style={styles.subSectionLabel}>
                  Event type
                </Typography>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {EVENT_CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      onPress={() => setEventDraft((current) => ({ ...current, category: option.value }))}
                      variant={eventDraft.category === option.value ? "primary" : "ghost"}
                      fullWidth={false}
                      size="compact"
                    />
                  ))}
                </ScrollView>
              </Card>

              <View style={styles.footerButtons}>
                <Button
                  label={eventEditorMode === "edit" ? "Save event" : "Log event"}
                  onPress={handleSaveEvent}
                  loading={isSavingEvent}
                  disabled={!eventDraft.name.trim()}
                />
                <Button label="Cancel" onPress={() => setEventEditorOpen(false)} variant="ghost" />
              </View>
            </View>
          </SafeAreaView>
        </Modal>
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  headerRowCompact: {
    alignItems: "stretch",
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: layout.stackGap,
    paddingBottom: 24,
    gap: 18,
  },
  modalCard: {
    gap: 12,
  },
  chipRow: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },
  secondaryText: {
    color: colors.textSecondary,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  subSectionLabel: {
    marginTop: 12,
  },
  searchInput: {
    minHeight: 48,
    marginTop: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 15,
  },
  sectionHeader: {
    gap: 4,
  },
  featureCard: {
    gap: 10,
  },
  featureActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  emptyStateCard: {
    gap: 10,
  },
  emptyStateActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  groupSection: {
    gap: 10,
  },
  eventCard: {
    gap: 8,
  },
  eventCardSelected: {
    borderColor: colors.primaryAction,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  eventCopy: {
    flex: 1,
    gap: 6,
  },
  peopleStack: {
    gap: 12,
  },
  personTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  personCopy: {
    flex: 1,
    gap: 6,
  },
  valueBlock: {
    marginTop: 12,
    marginBottom: 10,
    color: colors.textSecondary,
  },
  footerButtons: {
    gap: 10,
    marginTop: "auto",
  },
  addEventButton: {
    marginLeft: 8,
    minWidth: 110,
  },
  dateHelperText: {
    marginTop: 4,
    marginBottom: 8,
    color: colors.textSecondary,
  },
  datePillRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
  },
  dateInput: {
    marginTop: 0,
  },
});
