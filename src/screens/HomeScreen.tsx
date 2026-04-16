import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

import { CurrentEventValue } from "../components/CurrentEventSheet";
import { FloatingFab } from "../components/FloatingFab";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  JUST_CONNECTED_THRESHOLD,
  buildInteractionRecord,
  createInteraction,
  createPerson,
  ensureSessionUserId,
  getOrCreateEvent,
  listEventInsights,
  listPeopleInsights,
} from "../lib/crm";
import { colors, layout } from "../theme/tokens";
import { PersonStatusMode } from "./PersonProfileScreen";

type HomeScreenProps = {
  currentEvent: CurrentEventValue | null;
  onOpenPeopleFilter?: (status: PersonStatusMode) => void;
};

export function HomeScreen({ currentEvent, onOpenPeopleFilter }: HomeScreenProps) {
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [people, setPeople] = useState<Awaited<ReturnType<typeof listPeopleInsights>>>([]);
  const [, setEvents] = useState<Awaited<ReturnType<typeof listEventInsights>>>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recentPeople = useMemo(() => people.slice(0, 4), [people]);
  const dueTodayPeople = useMemo(
    () => people.filter((person) => person.followUpState === "dueToday").slice(0, 4),
    [people]
  );
  const overduePeople = useMemo(
    () => people.filter((person) => person.followUpState === "overdue").slice(0, 4),
    [people]
  );
  const recentlyContactedPeople = useMemo(
    () => people.filter((person) => (person.daysSinceLastContact || 0) <= JUST_CONNECTED_THRESHOLD).slice(0, 4),
    [people]
  );
  const waitingOnYouCount = dueTodayPeople.length + overduePeople.length;

  const currentEventSummary = useMemo(() => {
    if (!currentEvent) {
      return null;
    }

    const linkedPeople = people.filter((person) => person.lastEventName === currentEvent.name);
    return {
      total: linkedPeople.length,
      outstanding: linkedPeople.filter((person) => person.followUpState === "dueToday" || person.followUpState === "overdue").length,
    };
  }, [currentEvent, people]);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage(null);

      const userId = await ensureSessionUserId();
      const [peopleInsights, eventInsights] = await Promise.all([
        listPeopleInsights(userId),
        listEventInsights(userId),
      ]);

      setPeople(
        peopleInsights.sort((left, right) => {
          if (!left.lastInteractionAt && !right.lastInteractionAt) {
            return right.createdAt.localeCompare(left.createdAt);
          }

          if (!left.lastInteractionAt) {
            return 1;
          }

          if (!right.lastInteractionAt) {
            return -1;
          }

          return right.lastInteractionAt.localeCompare(left.lastInteractionAt);
        })
      );
      setEvents(eventInsights);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load data.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
        draft.phoneNumber,
        draft.priority,
        draft.tags
      );

      let eventId: string | null = null;
      const eventName = currentEvent?.name || draft.event;
      const eventCategory = currentEvent?.category || draft.eventCategory || null;
      if (eventName && eventName !== "No event") {
        const event = await getOrCreateEvent(userId, eventName, eventCategory);
        eventId = event.id;
      }

      await createInteraction({
        userId,
        personId: person.id,
        eventId,
        rawNote: buildInteractionRecord(draft.whatMatters, draft.nextStep, draft.company, draft.nextFollowUpAt),
      });

      setCaptureOpen(false);
      await loadData();
      Alert.alert("Saved", `${draft.name} saved to Supabase.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save interaction.";
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  const recentSectionTitle = recentlyContactedPeople.length ? "Recently contacted" : "Recently added";
  const recentSectionCopy = recentlyContactedPeople.length
    ? "Your latest follow-ups and warm contacts."
    : "Newest contacts added to your Blackbook.";
  const recentSectionPeople = recentlyContactedPeople.length ? recentlyContactedPeople : recentPeople;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Typography variant="h1">Blackbook</Typography>
        </View>

        {currentEvent ? (
          <View style={styles.liveEventRow}>
            <Pressable style={styles.liveEventPill}>
              <Typography variant="body" style={styles.liveEventText}>🟢 Live: {currentEvent.name}</Typography>
            </Pressable>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {errorMessage ? (
            <Card>
              <Typography variant="body">{errorMessage}</Typography>
            </Card>
          ) : null}

          {waitingOnYouCount ? (
            <Card style={styles.bannerCard}>
              <Typography variant="h2">{waitingOnYouCount} people are waiting on you</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Due today and overdue follow-ups show up here first.
              </Typography>
            </Card>
          ) : null}

          {currentEventSummary && currentEvent ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Typography variant="caption">From current event</Typography>
                <Typography variant="body" style={styles.sectionMeta}>
                  {currentEvent.name} · {currentEventSummary.total} people added · {currentEventSummary.outstanding} still need follow-up
                </Typography>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Typography variant="caption">Due today</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Follow-ups scheduled for today.
              </Typography>
            </View>
            {dueTodayPeople.length ? (
              dueTodayPeople.map((person) => (
                <Card key={`due-${person.id}`} style={styles.followCard}>
                  <View style={styles.connectionHeader}>
                    <View style={styles.connectionMain}>
                      <Typography variant="h2">{person.name}</Typography>
                      <Typography variant="caption">
                        {[person.company, person.lastEventName || "No event logged"].filter(Boolean).join(" · ")}
                      </Typography>
                    </View>
                    <Typography variant="caption">{person.nextFollowUpLabel}</Typography>
                  </View>
                  <Typography variant="body" style={styles.cardBody}>
                    {person.nextStep || person.whatMatters}
                  </Typography>
                </Card>
              ))
            ) : (
              <Card>
                <Typography variant="body">Nothing due today.</Typography>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Typography variant="caption">Overdue</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Follow-ups that slipped past their planned date.
              </Typography>
            </View>
            {overduePeople.length ? (
              overduePeople.map((person) => (
                <Card key={`overdue-${person.id}`} style={styles.followCard}>
                  <View style={styles.connectionHeader}>
                    <View style={styles.connectionMain}>
                      <Typography variant="h2">{person.name}</Typography>
                      <Typography variant="caption">
                        {[person.company, person.lastEventName || "No event logged"].filter(Boolean).join(" · ")}
                      </Typography>
                    </View>
                    <Typography variant="caption">{person.nextFollowUpLabel}</Typography>
                  </View>
                  <Typography variant="body" style={styles.cardBody}>
                    {person.nextStep || person.whatMatters}
                  </Typography>
                </Card>
              ))
            ) : (
              <Card>
                <Typography variant="body">No overdue follow-ups.</Typography>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderCopy}>
                <Typography variant="caption">{recentSectionTitle}</Typography>
                <Typography variant="body" style={styles.sectionMeta}>
                  {recentSectionCopy}
                </Typography>
              </View>
              {onOpenPeopleFilter ? (
                <Pressable onPress={() => onOpenPeopleFilter(recentlyContactedPeople.length ? "today" : "all")}>
                  <Typography variant="caption" style={styles.linkLabel}>Open people</Typography>
                </Pressable>
              ) : null}
            </View>

            {recentSectionPeople.length ? (
              recentSectionPeople.map((person) => (
                <Card key={`recent-${person.id}`} style={styles.connectionCard}>
                  <View style={styles.connectionHeader}>
                    <View style={styles.connectionMain}>
                      <Typography variant="h2">{person.name}</Typography>
                      <Typography variant="caption">
                        {[person.company, person.lastEventName || "No event logged"].filter(Boolean).join(" · ")}
                      </Typography>
                    </View>
                    <Typography variant="caption">{person.statusLabel}</Typography>
                  </View>
                  <Typography variant="body" style={styles.cardBody} numberOfLines={2}>
                    {person.lastInteractionNote}
                  </Typography>
                  <Typography variant="caption">{person.bannerLabel}</Typography>
                </Card>
              ))
            ) : !isLoading ? (
              <Card>
                <Typography variant="body">No contacts tracked yet.</Typography>
              </Card>
            ) : null}
          </View>
        </ScrollView>

        <FloatingFab label="+" onPress={() => setCaptureOpen(true)} />

        <CaptureModal
          visible={isCaptureOpen}
          onClose={() => setCaptureOpen(false)}
          onSave={handleSaveDraft}
          isSaving={isSaving}
          lockedEvent={currentEvent}
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
    paddingBottom: 120,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  liveEventRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  liveEventPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  liveEventText: {
    color: "#1ecb4f",
  },
  bannerCard: {
    backgroundColor: colors.surfaceMuted,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionMeta: {
    color: colors.textSecondary,
  },
  linkLabel: {
    color: colors.primaryAction,
  },
  followCard: {
    gap: 10,
  },
  connectionCard: {
    gap: 10,
  },
  connectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  connectionMain: {
    flex: 1,
    gap: 4,
  },
  cardBody: {
    color: colors.textPrimary,
  },
});
