import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import { CurrentEventSheet, CurrentEventValue } from "./src/components/CurrentEventSheet";
import { formatCategoryLabel } from "./src/lib/crm";
import { Button } from "./src/components/ui/Button";
import { EventScreen } from "./src/screens/EventScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PersonProfileScreen } from "./src/screens/PersonProfileScreen";
import { colors } from "./src/theme/tokens";

type ScreenKey = "home" | "event" | "person";

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [isCurrentEventOpen, setCurrentEventOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CurrentEventValue | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View>
          <Button
            label="Home"
            onPress={() => setScreen("home")}
            variant={screen === "home" ? "primary" : "ghost"}
            fullWidth={false}
            size="compact"
            style={styles.switchButton}
          />
        </View>
        <View style={styles.switcher}>
          <Button
            label={currentEvent ? `Current: ${currentEvent.name}` : "Set Current Event"}
            onPress={() => setCurrentEventOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
            style={styles.currentEventButton}
          />
          <Button
            label="Events"
            onPress={() => setScreen("event")}
            variant={screen === "event" ? "primary" : "ghost"}
            fullWidth={false}
            size="compact"
            style={styles.switchButton}
          />
          <Button
            label="People"
            onPress={() => setScreen("person")}
            variant={screen === "person" ? "primary" : "ghost"}
            fullWidth={false}
            size="compact"
            style={styles.switchButton}
          />
        </View>
      </View>

      {currentEvent ? (
        <View style={styles.currentEventBar}>
          <Button
            label={`Live event: ${currentEvent.name} · ${formatCategoryLabel(currentEvent.category)}`}
            onPress={() => setCurrentEventOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
          />
          <Button
            label="Past Event Mode"
            onPress={() => setCurrentEvent(null)}
            variant="ghost"
            fullWidth={false}
            size="compact"
          />
        </View>
      ) : null}

      <View style={styles.content}>
        {screen === "home" ? <HomeScreen currentEvent={currentEvent} /> : null}
        {screen === "event" ? <EventScreen currentEvent={currentEvent} /> : null}
        {screen === "person" ? <PersonProfileScreen currentEvent={currentEvent} /> : null}
      </View>

      <CurrentEventSheet
        visible={isCurrentEventOpen}
        value={currentEvent}
        onClose={() => setCurrentEventOpen(false)}
        onSave={(value) => {
          setCurrentEvent(value);
          setCurrentEventOpen(false);
        }}
        onClear={() => {
          setCurrentEvent(null);
          setCurrentEventOpen(false);
        }}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  switcher: {
    flexDirection: "row",
    gap: 8,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  currentEventButton: {
    maxWidth: 170,
  },
  currentEventBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  switchButton: {
    minHeight: 40,
  },
  content: {
    flex: 1,
  },
});
