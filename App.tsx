import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Modal, SafeAreaView, StyleSheet, View } from "react-native";

import { CurrentEventSheet, CurrentEventValue } from "./src/components/CurrentEventSheet";
import { formatCategoryLabel } from "./src/lib/crm";
import { getCurrentUsername, signOutCurrentUser } from "./src/lib/auth";
import { Button } from "./src/components/ui/Button";
import { AuthScreen } from "./src/screens/AuthScreen";
import { EventScreen } from "./src/screens/EventScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PersonProfileScreen } from "./src/screens/PersonProfileScreen";
import { useAuth } from "./src/hooks/useAuth";
import { colors } from "./src/theme/tokens";

type ScreenKey = "home" | "event" | "person";

export default function App() {
  const { user, isLoading } = useAuth();
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [authBanner, setAuthBanner] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [isCurrentEventOpen, setCurrentEventOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CurrentEventValue | null>(null);

  const isGuest = Boolean(user?.is_anonymous);

  useEffect(() => {
    let isMounted = true;

    async function syncUsername() {
      if (!user || user.is_anonymous) {
        if (isMounted) {
          setCurrentUsername(null);
        }
        return;
      }

      try {
        const username = await getCurrentUsername(user.id);
        if (isMounted) {
          setCurrentUsername(username);
        }
      } catch {
        if (isMounted) {
          setCurrentUsername(null);
        }
      }
    }

    syncUsername();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Button label="Loading..." onPress={() => undefined} disabled />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={(message) => setAuthBanner(message)} />;
  }

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
            label={isGuest ? "Guest" : `@${currentUsername || "member"}`}
            onPress={() => setAuthModalOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
            style={styles.switchButton}
          />
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
          <Button
            label={isGuest ? "Login / Sign up" : "Log out"}
            onPress={() => {
              if (isGuest) {
                setAuthModalOpen(true);
                return;
              }

              signOutCurrentUser();
            }}
            variant="ghost"
            fullWidth={false}
            size="compact"
            style={styles.switchButton}
          />
        </View>
      </View>

      {authBanner ? (
        <View style={styles.authBannerRow}>
          <Button
            label={authBanner}
            onPress={() => setAuthBanner(null)}
            variant="ghost"
            fullWidth={false}
            size="compact"
          />
        </View>
      ) : null}

      {isGuest ? (
        <View style={styles.currentEventBar}>
          <Button
            label="Guest mode: data is temporary unless you create an account"
            onPress={() => setAuthModalOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
          />
        </View>
      ) : null}

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

      <Modal visible={isAuthModalOpen} animationType="slide" presentationStyle="pageSheet">
        <AuthScreen
          canUseGuest={false}
          guestUserId={isGuest ? user.id : null}
          onAuthenticated={(message) => {
            setAuthBanner(message);
            setAuthModalOpen(false);
          }}
          onCancel={() => setAuthModalOpen(false)}
        />
      </Modal>

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
  authBannerRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  switchButton: {
    minHeight: 40,
  },
  content: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
});
