import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, SafeAreaView, Share, StyleSheet, View, useWindowDimensions } from "react-native";

import { Typography } from "./src/components/ui/Typography";
import { CurrentEventSheet, CurrentEventValue } from "./src/components/CurrentEventSheet";
import { formatCategoryLabel } from "./src/lib/crm";
import { getCurrentUsername, signInAsGuest, signOutCurrentUser } from "./src/lib/auth";
import { supabaseConfigMessage } from "./src/lib/supabase";
import { Button } from "./src/components/ui/Button";
import { AuthScreen } from "./src/screens/AuthScreen";
import { EventScreen } from "./src/screens/EventScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PersonProfileScreen, PersonStatusMode } from "./src/screens/PersonProfileScreen";
import { useAuth } from "./src/hooks/useAuth";
import { colors } from "./src/theme/tokens";

type ScreenKey = "home" | "event" | "person";

const EARLY_ACCESS_WAITLIST_URL = "https://tally.so/r/xXPNkd";

export default function App() {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 880;
  const isVeryCompactLayout = width < 520;
  const { user, isLoading } = useAuth();
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [personStatusMode, setPersonStatusMode] = useState<PersonStatusMode>("all");
  const [personStatusNonce, setPersonStatusNonce] = useState(0);
  const [isCurrentEventOpen, setCurrentEventOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CurrentEventValue | null>(null);
  const previousWasGuest = useRef(false);

  const isGuest = Boolean(user?.is_anonymous);
  const guestBannerLabel = isCompactLayout ? "Guest mode active" : "Guest mode active · data is temporary";
  const updatesBannerLabel = isCompactLayout ? "Future updates" : "Sign up for future updates";

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

  useEffect(() => {
    const isGuest = Boolean(user?.is_anonymous);

    if (previousWasGuest.current && user && !isGuest) {
      setAuthModalOpen(false);
      setAccountMenuOpen(false);
    }

    previousWasGuest.current = isGuest;
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
    return <AuthScreen />;
  }

  async function handleReportBug() {
    const subject = "Bug Report - Personal CRM MVP";
    const body = [
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
    ].join("\n");
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(url);
      setSettingsOpen(false);
    } catch {
      try {
        await Share.share({
          title: subject,
          message: `${subject}\n\n${body}`,
        });
        setSettingsOpen(false);
      } catch {
        Alert.alert("Could not open bug report", "Please try again in a moment.");
      }
    }
  }

  async function handleOpenWaitlist() {
    try {
      await Linking.openURL(EARLY_ACCESS_WAITLIST_URL);
      setSettingsOpen(false);
    } catch {
      Alert.alert("Unable to open link", "Please try again in a moment.");
    }
  }

  function handleOpenPeopleFilter(status: PersonStatusMode) {
    setPersonStatusMode(status);
    setPersonStatusNonce((value) => value + 1);
    setScreen("person");
  }

  async function handleLogout() {
    try {
      await signOutCurrentUser();
      await signInAsGuest();
    } finally {
      setAccountMenuOpen(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isCompactLayout ? styles.topBarCompact : null]}>
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
        <View style={[styles.switcher, isCompactLayout ? styles.switcherCompact : null]}>
          <Button
            label={isGuest ? "Guest" : `@${currentUsername || "member"}`}
            onPress={() => {
              if (isGuest) {
                setAuthModalOpen(true);
                return;
              }

              setAccountMenuOpen(true);
            }}
            variant="ghost"
            fullWidth={false}
            size="compact"
            style={[styles.switchButton, isCompactLayout ? styles.switchButtonCompact : null]}
          />
          <Button
            label={
              currentEvent
                ? isVeryCompactLayout
                  ? "Current Event"
                  : `Current: ${currentEvent.name}`
                : "Set Current Event"
            }
            onPress={() => setCurrentEventOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
            style={[styles.currentEventButton, isCompactLayout ? styles.switchButtonCompact : null]}
          />
          <Button
            label="Events"
            onPress={() => setScreen("event")}
            variant={screen === "event" ? "primary" : "ghost"}
            fullWidth={false}
            size="compact"
            style={[styles.switchButton, isCompactLayout ? styles.switchButtonCompact : null]}
          />
          <Button
            label="People"
            onPress={() => setScreen("person")}
            variant={screen === "person" ? "primary" : "ghost"}
            fullWidth={false}
            size="compact"
            style={[styles.switchButton, isCompactLayout ? styles.switchButtonCompact : null]}
          />
          <Button
            label="⚙️"
            onPress={() => setSettingsOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
            style={[styles.switchButton, isCompactLayout ? styles.switchButtonCompact : null]}
          />
        </View>
      </View>

      {isGuest ? (
        <View style={styles.currentEventBar}>
          <Button
            label={guestBannerLabel}
            onPress={() => setAuthModalOpen(true)}
            variant="ghost"
            fullWidth={false}
            size="compact"
          />
        </View>
      ) : (
        <View style={styles.currentEventBar}>
          <Button
            label={updatesBannerLabel}
            onPress={handleOpenWaitlist}
            variant="ghost"
            fullWidth={false}
            size="compact"
          />
        </View>
      )}

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
        {screen === "home" ? <HomeScreen currentEvent={currentEvent} onOpenPeopleFilter={handleOpenPeopleFilter} /> : null}
        {screen === "event" ? <EventScreen currentEvent={currentEvent} /> : null}
        {screen === "person" ? (
          <PersonProfileScreen
            currentEvent={currentEvent}
            forcedStatusMode={personStatusMode}
            forcedStatusNonce={personStatusNonce}
          />
        ) : null}
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
          onAuthenticated={() => {
            setAuthModalOpen(false);
          }}
          onCancel={() => setAuthModalOpen(false)}
        />
      </Modal>

      <Modal visible={isAccountMenuOpen} transparent animationType="fade" onRequestClose={() => setAccountMenuOpen(false)}>
        <View style={styles.accountMenuOverlay}>
          <View style={styles.accountMenuCard}>
            <Typography variant="caption">Signed in</Typography>
            <Typography variant="h2">@{currentUsername || "member"}</Typography>
            <Button label="Log out" onPress={handleLogout} />
            <Button
              label="Close"
              onPress={() => setAccountMenuOpen(false)}
              variant="ghost"
            />
          </View>
        </View>
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
              <Button label="🐛 Report a Bug" onPress={handleReportBug} />
              <Button label="💡 Suggest a Feature" onPress={handleOpenWaitlist} variant="ghost" />
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
  switcherCompact: {
    flexWrap: "wrap",
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
  topBarCompact: {
    alignItems: "stretch",
    flexDirection: "column",
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
  switchButtonCompact: {
    maxWidth: "100%",
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
  accountMenuOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingTop: 64,
    paddingHorizontal: 16,
  },
  accountMenuCard: {
    width: 260,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
});
