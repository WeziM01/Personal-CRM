import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { CurrentEventValue } from "../components/CurrentEventSheet";
import { FloatingFab } from "../components/FloatingFab";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  JUST_CONNECTED_THRESHOLD,
  buildInteractionRecord,
  createInteraction,
  createPerson,
  ensureSessionUserId,
  formatCategoryLabel,
  getOrCreateEvent,
  isContactStale,
  listEventInsights,
  listPeopleInsights,
} from "../lib/crm";
import { colors, layout, radius } from "../theme/tokens";
import { PersonStatusMode } from "./PersonProfileScreen";

type HomeScreenProps = {
  currentEvent: CurrentEventValue | null;
  onOpenPeopleFilter?: (status: PersonStatusMode) => void;
  onRequestOpenEvents?: () => void;
};

type SignalFilter = "all" | "tracked" | "contactedToday" | "needNudge";

const EVENT_ONBOARDING_KEY = "blackbook:onboarding:event-anchor-seen";
const CAPTURE_ONBOARDING_KEY = "blackbook:onboarding:capture-anchor-seen";

export function HomeScreen({
  currentEvent,
  onOpenPeopleFilter,
  onRequestOpenEvents,
}: HomeScreenProps) {
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [people, setPeople] = useState<Awaited<ReturnType<typeof listPeopleInsights>>>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listEventInsights>>>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSignal, setActiveSignal] = useState<SignalFilter>("all");
  const [showEventOnboarding, setShowEventOnboarding] = useState(false);
  const [showCaptureOnboarding, setShowCaptureOnboarding] = useState(false);

  const recentPeople = useMemo(() => people.slice(0, 4), [people]);
  const dueTodayPeople = useMemo(
    () => people.filter((person) => person.followUpState === "dueToday").slice(0, 4),
    [people]
  );
  const overduePeople = useMemo(
    () => people.filter((person) => person.followUpState === "overdue").slice(0, 4),
    [people]
  );
  const followUpPeople = useMemo(
    () => people.filter((person) => isContactStale(person.daysSinceLastContact, person.priority)).slice(0, 4),
    [people]
  );
  const waitingOnYouCount = dueTodayPeople.length + overduePeople.length;
  const contactedTodayPeople = useMemo(
    () => people.filter((person) => (person.daysSinceLastContact || 0) <= JUST_CONNECTED_THRESHOLD),
    [people]
  );
  const nudgeCount = useMemo(
    () => people.filter((person) => isContactStale(person.daysSinceLastContact, person.priority)).length,
    [people]
  );
  const signalPeople = useMemo(() => {
    if (activeSignal === "tracked") {
      return people;
    }

    if (activeSignal === "contactedToday") {
      return contactedTodayPeople;
    }

    if (activeSignal === "needNudge") {
      return people.filter((person) => isContactStale(person.daysSinceLastContact, person.priority));
    }

    return recentPeople;
  }, [activeSignal, contactedTodayPeople, people, recentPeople]);
  const signalHeading =
    activeSignal === "tracked"
      ? "People tracked"
      : activeSignal === "contactedToday"
        ? "Reached out today"
        : activeSignal === "needNudge"
          ? "People who need a nudge"
          : "Recently connected";
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

  const eventPulse = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      counts.set(event.category, (counts.get(event.category) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3);
  }, [events]);

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

  useEffect(() => {
    let isMounted = true;

    async function syncOnboardingState() {
      const [eventSeen, captureSeen] = await AsyncStorage.multiGet([
        EVENT_ONBOARDING_KEY,
        CAPTURE_ONBOARDING_KEY,
      ]);

      if (!isMounted) {
        return;
      }

      const hasCurrentEvent = Boolean(currentEvent);
      setShowEventOnboarding(!hasCurrentEvent && eventSeen?.[1] !== "true");
      setShowCaptureOnboarding(hasCurrentEvent && people.length === 0 && captureSeen?.[1] !== "true");
    }

    void syncOnboardingState();

    return () => {
      isMounted = false;
    };
  }, [currentEvent, people.length]);

  useEffect(() => {
    if (!currentEvent) {
      return;
    }

    void AsyncStorage.setItem(EVENT_ONBOARDING_KEY, "true");
    setShowEventOnboarding(false);
  }, [currentEvent]);

  async function dismissEventOnboarding() {
    setShowEventOnboarding(false);
    await AsyncStorage.setItem(EVENT_ONBOARDING_KEY, "true");
  }

  async function dismissCaptureOnboarding() {
    setShowCaptureOnboarding(false);
    await AsyncStorage.setItem(CAPTURE_ONBOARDING_KEY, "true");
  }

  async function handleEventOnboardingPress() {
    await dismissEventOnboarding();

    if (onRequestOpenEvents) {
      onRequestOpenEvents();
      return;
    }

    Alert.alert("Set current event", "Open the Events tab and create or select the event you are at right now.");
  }

  async function handleCaptureOnboardingPress() {
    await dismissCaptureOnboarding();
    openCapture();
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

  function openCapture() {
    setCaptureOpen(true);
  }

  function renderPersonCard(person: (typeof people)[number], variant: "default" | "muted" = "default") {
    return (
      <Card key={person.id} style={[styles.connectionCard, variant === "muted" ? styles.mutedCard : null]}>
        <View style={styles.connectionHeader}>
          <View style={styles.connectionMain}>
            <Typography variant="h2">{person.name}</Typography>
            <Typography variant="caption">
              {[person.company, person.lastEventName || "No event logged"].filter(Boolean).join(" · ")}
            </Typography>
          </View>
          <View style={styles.statusPill}>
            <Typography variant="caption" style={styles.statusPillText}>{person.statusLabel}</Typography>
          </View>
        </View>
        <Typography variant="body" style={styles.cardBody} numberOfLines={2}>
          {person.nextStep || person.whatMatters || person.lastInteractionNote}
        </Typography>
        <Typography variant="caption">{person.bannerLabel}</Typography>
      </Card>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Typography variant="caption">Today</Typography>
              <Typography variant="h1">Blackbook</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Track warm contacts, spot follow-ups that are slipping, and keep event momentum alive.
              </Typography>
            </View>
          </View>



          {currentEvent ? (
            <Card style={styles.currentEventCard}>
              <View style={styles.currentEventTopRow}>
                <View style={styles.liveBadge}>
                  <Typography variant="caption" style={styles.liveBadgeText}>Live event</Typography>
                </View>
                <Typography variant="caption">{formatCategoryLabel(currentEvent.category)}</Typography>
              </View>
              <Typography variant="h2">{currentEvent.name}</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                {currentEventSummary
                  ? `${currentEventSummary.total} people added · ${currentEventSummary.outstanding} still need follow-up.`
                  : "Any person saved now will be attached to this event."}
              </Typography>
            </Card>
          ) : null}

          {showEventOnboarding ? (
            <Card style={styles.onboardingCard}>
              <Typography variant="caption">Start here</Typography>
              <Typography variant="h2">You are probably at an event right now.</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Set your current event first so every connection you capture has context from the start.
              </Typography>
              <View style={styles.onboardingActions}>
                <Button label="Set current event" onPress={() => void handleEventOnboardingPress()} fullWidth={false} />
                <Button label="Dismiss" onPress={() => void dismissEventOnboarding()} variant="ghost" fullWidth={false} />
              </View>
            </Card>
          ) : null}

          {showCaptureOnboarding ? (
            <Card style={styles.onboardingCard}>
              <Typography variant="caption">Next step</Typography>
              <Typography variant="h2">Great. Who did you just meet?</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Capture your first connection from {currentEvent?.name || "this event"} and let Blackbook draft the follow-up for you.
              </Typography>
              <View style={styles.onboardingActions}>
                <Button label="Add connection" onPress={() => void handleCaptureOnboardingPress()} fullWidth={false} />
                <Button label="Dismiss" onPress={() => void dismissCaptureOnboarding()} variant="ghost" fullWidth={false} />
              </View>
            </Card>
          ) : null}

          {errorMessage ? (
            <Card>
              <Typography variant="body">{errorMessage}</Typography>
            </Card>
          ) : null}

          <Card style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroCopy}>
                <Typography variant="caption" style={styles.heroCaption}>Pulse</Typography>
                <Typography variant="h2" style={styles.heroHeading}>What needs your attention now</Typography>
              </View>
              {waitingOnYouCount ? (
                <View style={styles.heroBadge}>
                  <Typography variant="caption" style={styles.heroBadgeText}>{waitingOnYouCount} waiting</Typography>
                </View>
              ) : null}
            </View>

            <View style={styles.signalGrid}>
              <Pressable
                style={[styles.signalCell, activeSignal === "tracked" ? styles.signalCellActive : null]}
                onPress={() => {
                  setActiveSignal("tracked");
                  onOpenPeopleFilter?.("all");
                }}
              >
                <Typography variant="h2" style={styles.heroMetric}>{people.length}</Typography>
                <Typography variant="caption" style={styles.heroCaption}>People tracked</Typography>
              </Pressable>
              <Pressable
                style={[styles.signalCell, activeSignal === "contactedToday" ? styles.signalCellActive : null]}
                onPress={() => {
                  setActiveSignal("contactedToday");
                  onOpenPeopleFilter?.("today");
                }}
              >
                <Typography variant="h2" style={styles.heroMetric}>{contactedTodayPeople.length}</Typography>
                <Typography variant="caption" style={styles.heroCaption}>Reached out</Typography>
              </Pressable>
              <Pressable
                style={[styles.signalCell, activeSignal === "needNudge" ? styles.signalCellActive : null]}
                onPress={() => {
                  setActiveSignal("needNudge");
                  onOpenPeopleFilter?.("stale");
                }}
              >
                <Typography variant="h2" style={styles.heroMetric}>{nudgeCount}</Typography>
                <Typography variant="caption" style={styles.heroCaption}>Need a nudge</Typography>
              </Pressable>
            </View>
          </Card>

          {waitingOnYouCount ? (
            <Card style={styles.bannerCard}>
              <Typography variant="h2">{waitingOnYouCount} people are waiting on you</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Due today and overdue follow-ups are surfaced first so you can move quickly.
              </Typography>
            </Card>
          ) : null}

          {dueTodayPeople.length ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Typography variant="caption">Due today</Typography>
                <Typography variant="body" style={styles.sectionMeta}>
                  Follow-ups that should happen before the day gets away from you.
                </Typography>
              </View>
              {dueTodayPeople.map((person) => renderPersonCard(person, "muted"))}
            </View>
          ) : null}

          {overduePeople.length ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Typography variant="caption">Overdue</Typography>
                <Typography variant="body" style={styles.sectionMeta}>
                  These follow-ups slipped past the original plan.
                </Typography>
              </View>
              {overduePeople.map((person) => renderPersonCard(person, "muted"))}
            </View>
          ) : null}

          {activeSignal !== "all" ? (
            <View style={styles.sectionHeaderRow}>
              <Typography variant="caption">{signalHeading}</Typography>
              <Button
                label="Clear"
                onPress={() => setActiveSignal("all")}
                variant="ghost"
                fullWidth={false}
                size="compact"
              />
            </View>
          ) : null}

          {activeSignal !== "all" ? (
            <View style={styles.section}>
              {signalPeople.map((person) => renderPersonCard(person))}
              {!isLoading && signalPeople.length === 0 ? (
                <Typography variant="body">No contacts in this segment yet.</Typography>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Typography variant="caption">Recently connected</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Last touch, follow-up, and event memory in one glance.
              </Typography>
            </View>

            {recentPeople.map((person) => renderPersonCard(person))}
            {!isLoading && recentPeople.length === 0 ? (
              <Typography variant="body">No people tracked yet.</Typography>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Typography variant="caption">Needs follow-up</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Contacts drifting beyond two weeks.
              </Typography>
            </View>
            {followUpPeople.map((person) => renderPersonCard(person, "muted"))}
            {!isLoading && followUpPeople.length === 0 ? (
              <Typography variant="body">Everyone is still warm.</Typography>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Typography variant="caption">Event pulse</Typography>
              <Typography variant="body" style={styles.sectionMeta}>
                Dominant room types across your recent activity.
              </Typography>
            </View>
            <View style={styles.pulseRow}>
              {eventPulse.map((item) => (
                <Card key={item.category} style={styles.pulseCard}>
                  <Typography variant="h2">{item.count}</Typography>
                  <Typography variant="caption">{formatCategoryLabel(item.category as never)}</Typography>
                </Card>
              ))}
              {!isLoading && eventPulse.length === 0 ? (
                <Card style={styles.pulseCard}>
                  <Typography variant="body">No event categories yet.</Typography>
                </Card>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <FloatingFab label="+" onPress={openCapture} />

        <CaptureModal
          visible={isCaptureOpen}
          onClose={() => setCaptureOpen(false)}
          onSave={handleSaveDraft}
          isSaving={isSaving}
          lockedEvent={currentEvent}
          initialMethod="manual"
          showQuickCapture
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
    paddingTop: layout.sectionGap,
    paddingBottom: 120,
    gap: layout.sectionGap,
  },
  headerRow: {
    gap: 10,
  },
  headerCopy: {
    gap: 8,
  },
  quickCaptureCard: {
    gap: 14,
  },
  quickCaptureHeader: {
    gap: 8,
  },
  quickCaptureCopy: {
    gap: 6,
  },
  quickCaptureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  currentEventCard: {
    backgroundColor: colors.surface,
    gap: 10,
  },
  onboardingCard: {
    gap: 12,
    borderColor: colors.primaryAction,
  },
  onboardingActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  currentEventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  liveBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveBadgeText: {
    color: "#17843A",
  },
  heroCard: {
    backgroundColor: colors.primaryAction,
    borderColor: colors.primaryAction,
    gap: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroHeading: {
    color: colors.background,
  },
  heroBadge: {
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: colors.background,
  },
  bannerCard: {
    gap: 10,
  },
  signalGrid: {
    flexDirection: "row",
    gap: 10,
  },
  signalCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  signalCellActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  heroMetric: {
    color: colors.background,
  },
  heroCaption: {
    color: "rgba(246,243,238,0.76)",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionMeta: {
    color: colors.textSecondary,
  },
  connectionCard: {
    gap: 10,
  },
  mutedCard: {
    backgroundColor: colors.surfaceMuted,
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  connectionMain: {
    flex: 1,
    gap: 6,
  },
  statusPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillText: {
    color: colors.textSecondary,
  },
  cardBody: {
    color: colors.textSecondary,
  },
  pulseRow: {
    flexDirection: "row",
    gap: 10,
  },
  pulseCard: {
    flex: 1,
    gap: 8,
  },
});
