import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, TextInput, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import { sendMagicLink, signInAsGuest, signInWithGoogle } from "../lib/auth";
import { colors, layout, radius } from "../theme/tokens";

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
              Passwordless sign-in is fastest for testing and keeps your auth flow simple.
            </Typography>
          </View>

          <View style={styles.primaryActions}>
            <Button label="Continue with Google" onPress={handleGoogle} loading={isGoogleBusy} disabled={isBusy && !isGoogleBusy} />
            <Button
              label="Email me a magic link"
              onPress={handleMagicLink}
              disabled={!canSendMagicLink || (isBusy && !isMagicLinkBusy)}
              loading={isMagicLinkBusy}
              variant="ghost"
            />
          </View>

          <View style={styles.metaStrip}>
            <View style={styles.metaItem}>
              <Typography variant="caption">Fast setup</Typography>
              <Typography variant="body" style={styles.metaText}>Google or magic link only</Typography>
            </View>
            <View style={styles.metaItem}>
              <Typography variant="caption">Guest safe</Typography>
              <Typography variant="body" style={styles.metaText}>Guest data upgrades later</Typography>
            </View>
          </View>

          {guestUserId ? (
            <Card style={styles.guestCard}>
              <Typography variant="caption">Guest progress detected</Typography>
              <Typography variant="body" style={styles.helperText}>
                Your guest data will be imported automatically after you finish signing in.
              </Typography>
            </Card>
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
    paddingTop: layout.sectionGap,
    paddingBottom: layout.sectionGap,
    gap: layout.sectionGap,
    justifyContent: "center",
  },
  headerCard: {
    gap: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  livePill: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  livePillText: {
    color: colors.textSecondary,
  },
  subtitle: {
    color: colors.textSecondary,
    maxWidth: 540,
  },
  helperText: {
    color: colors.textSecondary,
  },
  modeCard: {
    gap: 16,
    borderRadius: radius.cardLg,
  },
  inputBlock: {
    gap: 10,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 16,
  },
  primaryActions: {
    gap: 10,
  },
  metaStrip: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  metaItem: {
    flex: 1,
    minWidth: 160,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  metaText: {
    color: colors.textSecondary,
  },
  guestCard: {
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  bannerError: {
    borderColor: colors.destructive,
    backgroundColor: "#FDECEC",
  },
  bannerText: {
    color: colors.textPrimary,
  },
});
