import { useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

import { FloatingFab } from "../components/FloatingFab";
import { CaptureModal, ParsedPersonDraft } from "./CaptureModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import {
  buildInteractionNote,
  createInteraction,
  createPerson,
  ensureSessionUserId,
  getOrCreateEvent,
} from "../lib/crm";
import { colors, layout } from "../theme/tokens";

type ReconnectItem = {
  id: string;
  name: string;
  note: string;
  lastSeen: string;
};

type RecentPerson = {
  id: string;
  name: string;
  context: string;
};

const initialReconnectData: ReconnectItem[] = [
  {
    id: "r1",
    name: "Sarah (Stripe)",
    note: "Send intro to analytics engineer",
    lastSeen: "2 days ago",
  },
  {
    id: "r2",
    name: "David (Notion)",
    note: "Follow up on mobile onboarding experiments",
    lastSeen: "4 days ago",
  },
];

const initialRecentPeopleData: RecentPerson[] = [
  { id: "p1", name: "Ava", context: "Design Lead" },
  { id: "p2", name: "Noah", context: "Founder" },
  { id: "p3", name: "Mia", context: "Product" },
  { id: "p4", name: "Leo", context: "Engineer" },
];

const initialLastEvent = {
  name: "React Native EU",
  time: "Yesterday",
  count: 7,
};

export function HomeScreen() {
  const [isCaptureOpen, setCaptureOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [reconnectData, setReconnectData] = useState(initialReconnectData);
  const [recentPeopleData, setRecentPeopleData] = useState(initialRecentPeopleData);
  const [lastEvent, setLastEvent] = useState(initialLastEvent);

  const recentPeople = useMemo(() => recentPeopleData.slice(0, 6), [recentPeopleData]);

  async function handleSaveDraft(draft: ParsedPersonDraft) {
    if (isSaving) {
      return;
    }

    setSaving(true);

    try {
      const userId = await ensureSessionUserId();

      const person = await createPerson(userId, draft.name);
      const event =
        draft.event === "No event" ? null : await getOrCreateEvent(userId, draft.event);

      await createInteraction({
        userId,
        personId: person.id,
        eventId: event?.id ?? null,
        rawNote: buildInteractionNote(draft.notes, draft.followUp),
      });

      const shortContext = event?.name || "New contact";

      setRecentPeopleData((current) => [
        {
          id: person.id,
          name: person.name || draft.name,
          context: shortContext,
        },
        ...current,
      ]);

      setReconnectData((current) => [
        {
          id: String(Date.now() + 1),
          name: person.name || draft.name,
          note: draft.followUp === "None yet" ? draft.notes : draft.followUp,
          lastSeen: "Just now",
        },
        ...current,
      ]);

      setLastEvent((current) => ({
        name: event?.name || current.name,
        time: "Just now",
        count: event?.name === current.name ? current.count + 1 : 1,
      }));

      setCaptureOpen(false);
      Alert.alert("Saved", `${draft.name} saved to Supabase.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save person.";

      const helpMessage =
        message === "Anonymous sign-ins are disabled"
          ? "Anonymous auth is disabled in Supabase. In Dashboard, go to Authentication > Providers > Anonymous and enable it."
          : message;

      Alert.alert("Save failed", helpMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Typography variant="h1">Home</Typography>
          <Button label="Add person" onPress={() => setCaptureOpen(true)} />

          <View style={styles.section}>
            <Typography variant="caption">Reconnect</Typography>
            {reconnectData.map((item) => (
              <Card key={item.id}>
                <Typography variant="h2">{item.name}</Typography>
                <Typography variant="body" style={styles.cardBody}>
                  {item.note}
                </Typography>
                <Typography variant="caption">{item.lastSeen}</Typography>
              </Card>
            ))}
          </View>

          <View style={styles.section}>
            <Typography variant="caption">Recent People</Typography>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rowContent}
            >
              {recentPeople.map((person) => (
                <Card key={person.id} style={styles.personCard}>
                  <Typography variant="h2">{person.name}</Typography>
                  <Typography variant="caption">{person.context}</Typography>
                </Card>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Typography variant="caption">Last Event</Typography>
            <Card>
              <Typography variant="h2">{lastEvent.name}</Typography>
              <Typography variant="body" style={styles.cardBody}>
                {lastEvent.count} interactions captured
              </Typography>
              <Typography variant="caption">{lastEvent.time}</Typography>
            </Card>
          </View>
        </ScrollView>

        <FloatingFab
          extended
          label="Met someone"
          onPress={() => setCaptureOpen(true)}
        />

        <CaptureModal
          visible={isCaptureOpen}
          onClose={() => setCaptureOpen(false)}
          onSave={handleSaveDraft}
          isSaving={isSaving}
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
    gap: layout.stackGap,
  },
  section: {
    gap: 12,
  },
  cardBody: {
    marginTop: 8,
    marginBottom: 10,
  },
  rowContent: {
    gap: 12,
    paddingRight: layout.screenPaddingHorizontal,
  },
  personCard: {
    width: 170,
  },
});
