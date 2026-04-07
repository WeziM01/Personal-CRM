import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, TextInput, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import { isUsernameAvailable, signInAsGuest, signInWithUsername, signUpWithUsername } from "../lib/auth";
import { colors, layout } from "../theme/tokens";

type AuthMode = "login" | "signup";

type AuthScreenProps = {
  canUseGuest?: boolean;
  guestUserId?: string | null;
  onAuthenticated?: (message: string) => void;
  onCancel?: () => void;
};

type BannerState = {
  text: string;
  tone: "success" | "error";
} | null;

export function AuthScreen({ canUseGuest = true, guestUserId = null, onAuthenticated, onCancel }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(guestUserId ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [importGuestData, setImportGuestData] = useState(Boolean(guestUserId));
  const [banner, setBanner] = useState<BannerState>(null);
  const [isBusy, setBusy] = useState(false);

  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username]);
  const canSubmit = normalizedUsername.length >= 3 && password.length >= 6;

  async function handleGuest() {
    try {
      setBusy(true);
      setBanner(null);
      await signInAsGuest();
      const message = "Guest mode active.";
      setBanner({ text: message, tone: "success" });
      onAuthenticated?.(message);
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Failed to start guest mode.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    try {
      setBusy(true);
      setBanner(null);
      await signInWithUsername(normalizedUsername, password);
      const message = "Logged in successfully.";
      setBanner({ text: message, tone: "success" });
      onAuthenticated?.(message);
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Login failed.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup() {
    try {
      setBusy(true);
      setBanner(null);

      const usernameAvailable = await isUsernameAvailable(normalizedUsername);
      if (!usernameAvailable) {
        setBanner({ text: "Can't use that username because it's already used.", tone: "error" });
        return;
      }

      await signUpWithUsername({
        username: normalizedUsername,
        password,
        guestUserId,
        importGuestData,
      });

      const message = "Signed up successfully.";
      setBanner({ text: message, tone: "success" });
      onAuthenticated?.(message);
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Sign up failed.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Typography variant="caption">Welcome</Typography>
          <Typography variant="h1">Blackbook Pulse</Typography>
          <Typography variant="body" style={styles.subtitle}>
            Use guest mode for quick capture, then create a real account when you want persistent login.
          </Typography>
        </View>

        <Card style={styles.modeCard}>
          <View style={styles.modeRow}>
            <Button
              label="Login"
              onPress={() => setMode("login")}
              variant={mode === "login" ? "primary" : "ghost"}
              fullWidth={false}
              size="compact"
            />
            <Button
              label="Sign up"
              onPress={() => setMode("signup")}
              variant={mode === "signup" ? "primary" : "ghost"}
              fullWidth={false}
              size="compact"
            />
          </View>

          <View style={styles.formBlock}>
            <Typography variant="caption">Username</Typography>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              placeholder="wezzi"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />

            <Typography variant="caption">Password</Typography>
            <TextInput
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </View>

          {mode === "signup" && guestUserId ? (
            <View style={styles.importRow}>
              <Typography variant="body" style={styles.subtitle}>
                Import guest data into this account
              </Typography>
              <Button
                label={importGuestData ? "Yes" : "No"}
                onPress={() => setImportGuestData((current) => !current)}
                variant={importGuestData ? "primary" : "ghost"}
                fullWidth={false}
                size="compact"
              />
            </View>
          ) : null}

          <Button
            label={mode === "signup" ? "Create account" : "Login"}
            onPress={mode === "signup" ? handleSignup : handleLogin}
            disabled={!canSubmit || isBusy}
            loading={isBusy}
          />

          {canUseGuest ? (
            <Button label="Use as guest" onPress={handleGuest} variant="ghost" disabled={isBusy} />
          ) : null}

          {onCancel ? <Button label="Cancel" onPress={onCancel} variant="ghost" disabled={isBusy} /> : null}

          {banner ? (
            <View style={[styles.banner, banner.tone === "success" ? styles.bannerSuccess : styles.bannerError]}>
              <Typography variant="body" style={styles.bannerText}>
                {banner.text}
              </Typography>
            </View>
          ) : null}
        </Card>
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
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: layout.stackGap,
    paddingBottom: layout.stackGap,
    gap: 16,
    justifyContent: "center",
  },
  header: {
    gap: 8,
  },
  subtitle: {
    color: colors.textSecondary,
  },
  modeCard: {
    gap: 14,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  formBlock: {
    gap: 10,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 16,
  },
  importRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerSuccess: {
    borderColor: colors.success,
    backgroundColor: "#EDF7ED",
  },
  bannerError: {
    borderColor: colors.destructive,
    backgroundColor: "#FDECEC",
  },
  bannerText: {
    color: colors.textPrimary,
  },
});