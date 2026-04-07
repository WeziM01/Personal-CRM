import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Linking, Modal, SafeAreaView, StyleSheet, View } from "react-native";

import { Typography } from "./src/components/ui/Typography";
import { CurrentEventSheet, CurrentEventValue } from "./src/components/CurrentEventSheet";
import { formatCategoryLabel } from "./src/lib/crm";
import { getCurrentUsername, signOutCurrentUser } from "./src/lib/auth";
import { supabaseConfigMessage } from "./src/lib/supabase";
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
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [isCurrentEventOpen, setCurrentEventOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CurrentEventValue | null>(null);

  const isGuest = Boolean(user?.is_anonymous);

  if (supabaseConfigMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <View style={styles.configCard}>
            <Typography variant="h2">Supabase configuration error</Typography>
            <Typography variant="body" style={styles.configText}>
              {supabaseConfigMessage}
            </Typography>
            <Typography variant="body" style={styles.configText}>
              Add the same EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY values from your local .env to Vercel Project Settings, then redeploy.
            </Typography>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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

  async function handleSupportEmail(type: "bug" | "feature") {
    const subject = type === "bug" ? "Bug Report - Personal CRM MVP" : "Feature Request - Personal CRM MVP";
    const body = type === "bug"
      ? [
          "What happened?",
          "",
          "What did you expect to happen?",
          "",
          "Steps to reproduce:",
          "1. ",
          "2. ",
          "3. ",
          "",
          `Signed in as: ${isGuest ? "Guest" : `@${currentUsername || "member"}`}`,
        ].join("\n")
      : [
          "What would you like the app to do?",
          "",
          "Why would it help?",
          "",
          "When would you use it?",
          "",
          `Signed in as: ${isGuest ? "Guest" : `@${currentUsername || "member"}`}`,
        ].join("\n");

    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("No mail app found", "Set up a mail app on this device to send feedback.");
        return;
      }

      await Linking.openURL(url);
      setSettingsOpen(false);
    } catch {
      Alert.alert("Could not open mail", "Please try again after setting a default mail app.");
    }
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
          <Button
            label="⚙️"
            onPress={() => setSettingsOpen(true)}
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

      <Modal visible={isSettingsOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.settingsContainer}>
            <View style={styles.settingsHeader}>
              <View style={styles.settingsCopy}>
                <Button label="Settings" onPress={() => undefined} disabled fullWidth={false} size="compact" />
              </View>
              <Button label="Close" onPress={() => setSettingsOpen(false)} variant="ghost" fullWidth={false} size="compact" />
            </View>

            <View style={styles.settingsActions}>
              <Button label="🐛 Report a Bug" onPress={() => handleSupportEmail("bug")} />
              <Button label="💡 Suggest a Feature" onPress={() => handleSupportEmail("feature")} variant="ghost" />
            </View>
          </View>
        </SafeAreaView>
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
  configCard: {
    width: "100%",
    maxWidth: 560,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  configText: {
    color: colors.textSecondary,
  },
  settingsContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsCopy: {
    flex: 1,
  },
  settingsActions: {
    gap: 12,
    marginTop: 12,
  },
});
