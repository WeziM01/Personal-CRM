import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, TextInput, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import { sendMagicLink, signInAsGuest, signInWithGoogle } from "../lib/auth";
import { colors, layout } from "../theme/tokens";

type AuthScreenProps = {
  canUseGuest?: boolean;
  guestUserId?: string | null;
  authError?: string | null;
  onAuthenticated?: (message: string) => void;
  onCancel?: () => void;
};

type BannerState = {
  text: string;
  tone: "success" | "error";
} | null;

export function AuthScreen({
  canUseGuest = true,
  guestUserId = null,
  authError = null,
  onAuthenticated,
  onCancel,
}: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [banner, setBanner] = useState<BannerState>(authError ? { text: authError, tone: "error" } : null);
  const [isGoogleBusy, setGoogleBusy] = useState(false);
  const [isMagicLinkBusy, setMagicLinkBusy] = useState(false);
  const [isGuestBusy, setGuestBusy] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSendMagicLink = normalizedEmail.includes("@");
  const isBusy = isGoogleBusy || isMagicLinkBusy || isGuestBusy;

  async function handleGuest() {
    try {
      setGuestBusy(true);
      setBanner(null);
      await signInAsGuest();
      const message = "Guest mode active.";
      setBanner({ text: message, tone: "success" });
      onAuthenticated?.(message);
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Failed to start guest mode.", tone: "error" });
    } finally {
      setGuestBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      setGoogleBusy(true);
      setBanner(null);
      await signInWithGoogle(guestUserId);
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Google sign-in failed.", tone: "error" });
      setGoogleBusy(false);
    }
  }

  async function handleMagicLink() {
    try {
      setMagicLinkBusy(true);
      setBanner(null);
      await sendMagicLink(normalizedEmail, guestUserId);
      const message = `Magic link sent to ${normalizedEmail}. Check your inbox to continue.`;
      setBanner({ text: message, tone: "success" });
      onAuthenticated?.(message);
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Could not send magic link.", tone: "error" });
    } finally {
      setMagicLinkBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Typography variant="caption">Welcome</Typography>
          <Typography variant="h1">Blackbook Pulse</Typography>
          <Typography variant="body" style={styles.subtitle}>
            Use guest mode for quick capture, then upgrade with Google or a passwordless email link when you want a permanent account.
          </Typography>
        </View>

        <Card style={styles.modeCard}>
          <View style={styles.formBlock}>
            <Typography variant="caption">Email for magic link</Typography>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="wez@example.com"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <Typography variant="body" style={styles.helperText}>
              We will email you a secure sign-in link. No password needed.
            </Typography>
          </View>

          <Button label="Continue with Google" onPress={handleGoogle} loading={isGoogleBusy} disabled={isBusy && !isGoogleBusy} />
          <Button
            label="Email me a magic link"
            onPress={handleMagicLink}
            disabled={!canSendMagicLink || (isBusy && !isMagicLinkBusy)}
            loading={isMagicLinkBusy}
            variant="ghost"
          />

          {guestUserId ? (
            <Typography variant="body" style={styles.helperText}>
              Your guest data will be imported automatically after you finish signing in.
            </Typography>
          ) : null}

          {canUseGuest ? <Button label="Use as guest" onPress={handleGuest} variant="ghost" disabled={isBusy && !isGuestBusy} loading={isGuestBusy} /> : null}

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
  helperText: {
    color: colors.textSecondary,
  },
  modeCard: {
    gap: 14,
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
