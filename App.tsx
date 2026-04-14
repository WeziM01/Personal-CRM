import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, SafeAreaView, Share, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { BottomTabNavigator } from "./src/navigation/BottomTabNavigator";
import { Typography } from "./src/components/ui/Typography";
import { CurrentEventSheet, CurrentEventValue } from "./src/components/CurrentEventSheet";
import { getCurrentUsername, signInAsGuest, signOutCurrentUser } from "./src/lib/auth";
import { supabaseConfigMessage } from "./src/lib/supabase";
import { Button } from "./src/components/ui/Button";
import { AuthScreen } from "./src/screens/AuthScreen";
import { useAuth } from "./src/hooks/useAuth";
import { colors } from "./src/theme/tokens";

const EARLY_ACCESS_WAITLIST_URL = "https://tally.so/r/xXPNkd";

export default function App() {
  const { user, isLoading } = useAuth();
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isCurrentEventOpen, setCurrentEventOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CurrentEventValue | null>(null);
  const previousWasGuest = useRef(false);

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
      return (
        <NavigationContainer>
          <BottomTabNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      );
    }
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

      <Modal visible={isNavMenuOpen} transparent animationType="fade" onRequestClose={() => setNavMenuOpen(false)}>
        <View style={styles.accountMenuOverlay}>
          <View style={styles.accountMenuCard}>
            <Typography variant="caption">Navigate</Typography>
            <Button
              label="Home"
              onPress={() => {
                setScreen("home");
                setNavMenuOpen(false);
              }}
              variant={screen === "home" ? "primary" : "ghost"}
            />
            <Button
              label="Events"
              onPress={() => {
                setScreen("event");
                setNavMenuOpen(false);
              }}
              variant={screen === "event" ? "primary" : "ghost"}
            />
            <Button
              label="People"
              onPress={() => {
                setScreen("person");
                setNavMenuOpen(false);
              }}
              variant={screen === "person" ? "primary" : "ghost"}
            />
            <Button
              label={isGuest ? "Guest account" : `Account @${currentUsername || "member"}`}
              onPress={openAccountArea}
              variant="ghost"
            />
            <Button
              label="Settings"
              onPress={() => {
                setNavMenuOpen(false);
                setSettingsOpen(true);
              }}
              variant="ghost"
            />
            <Button label="Close" onPress={() => setNavMenuOpen(false)} variant="ghost" />
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
              <Button label="Report a bug" onPress={handleReportBug} />
              <Button label="Suggest a feature" onPress={handleSuggestFeature} variant="ghost" />
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
  compactTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  compactBrandWrap: {
    flex: 1,
    gap: 4,
  },
  compactTopActions: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 0,
  },
  compactHeaderButton: {
    minHeight: 38,
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
    gap: 0,
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
