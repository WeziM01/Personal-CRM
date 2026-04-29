
import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, TextInput, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import { sendMagicLink, signInWithGoogle } from "../lib/auth";
import { colors, layout, radius } from "../theme/tokens";

type AuthScreenProps = {
  authError?: string | null;
  onAuthenticated?: (message: string) => void;
  onCancel?: () => void;
};

type BannerState = {
  text: string;
  tone: "success" | "error";
} | null;

export function AuthScreen({
  authError = null,
  onAuthenticated,
  onCancel,
}: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [banner, setBanner] = useState<BannerState>(authError ? { text: authError, tone: "error" } : null);
  const [isGoogleBusy, setGoogleBusy] = useState(false);
  const [isMagicLinkBusy, setMagicLinkBusy] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSendMagicLink = normalizedEmail.includes("@");
  const isBusy = isGoogleBusy || isMagicLinkBusy;

  async function handleGoogle() {
    try {
      setGoogleBusy(true);
      setBanner(null);
      await signInWithGoogle();
    } catch (error) {
      setBanner({ text: error instanceof Error ? error.message : "Google sign-in failed.", tone: "error" });
      setGoogleBusy(false);
    }
  }

  async function handleMagicLink() {
    try {
      setMagicLinkBusy(true);
      setBanner(null);
      await sendMagicLink(normalizedEmail);
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
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Typography variant="caption">Relationship follow-up</Typography>
            <View style={styles.livePill}>
              <Typography variant="caption" style={styles.livePillText}>Mobile-first</Typography>
            </View>
          </View>
          <Typography variant="h1">Blackbook Pulse</Typography>
          <Typography variant="body" style={styles.subtitle}>
            Capture the person, keep the context, and come back to the exact next step when it is time to follow up.
          </Typography>
        </View>

        <Card style={styles.modeCard}>
          <View style={styles.inputBlock}>
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
              Passwordless sign-in keeps people coming back without losing their progress.
            </Typography>
          </View>

          {banner ? (
            <View
              style={[
                styles.banner,
                banner.tone === "success" ? styles.bannerSuccess : styles.bannerError,
              ]}
            >
              <Typography variant="body" style={styles.bannerText}>
                {banner.text}
              </Typography>
            </View>
          ) : null}

          <View style={styles.actionStack}>
            <Button
              label="Email me a magic link"
              onPress={() => void handleMagicLink()}
              disabled={!canSendMagicLink || isBusy}
              loading={isMagicLinkBusy}
            />
            <Button
              label="Continue with Google"
              onPress={() => void handleGoogle()}
              variant="ghost"
              disabled={isBusy}
              loading={isGoogleBusy}
            />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Typography variant="caption">Magic link</Typography>
              <Typography variant="body" style={styles.metaText}>Fast return on the same device</Typography>
            </View>
            <View style={styles.metaItem}>
              <Typography variant="caption">Google</Typography>
              <Typography variant="body" style={styles.metaText}>One tap and done</Typography>
            </View>
            <View style={styles.metaItem}>
              <Typography variant="caption">Recoverable</Typography>
              <Typography variant="body" style={styles.metaText}>No guest data to lose later</Typography>
            </View>
          </View>

          {onCancel ? <Button label="Cancel" onPress={onCancel} variant="ghost" disabled={isBusy} /> : null}
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
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: layout.stackGap,
    gap: 18,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  headerCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  livePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  livePillText: {
    color: colors.textSecondary,
  },
  subtitle: {
    color: colors.textSecondary,
  },
  modeCard: {
    gap: 16,
  },
  inputBlock: {
    gap: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  helperText: {
    color: colors.textSecondary,
  },
  banner: {
    borderRadius: radius.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerSuccess: {
    backgroundColor: colors.successSoft,
  },
  bannerError: {
    backgroundColor: colors.accentSoft,
  },
  bannerText: {
    color: colors.textPrimary,
  },
  actionStack: {
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    flex: 1,
    minWidth: 120,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  metaText: {
    color: colors.textSecondary,
  },
});
