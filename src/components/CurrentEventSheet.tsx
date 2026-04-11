import { useEffect, useState } from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";

import { EVENT_CATEGORY_OPTIONS, EventCategory, formatCategoryLabel } from "../lib/crm";
import { colors, layout, radius } from "../theme/tokens";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Typography } from "./ui/Typography";

export type CurrentEventValue = {
  name: string;
  category: EventCategory;
};

type CurrentEventSheetProps = {
  visible: boolean;
  value: CurrentEventValue | null;
  onClose: () => void;
  onSave: (value: CurrentEventValue) => void;
  onClear: () => void;
};

export function CurrentEventSheet({ visible, value, onClose, onSave, onClear }: CurrentEventSheetProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 720;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EventCategory>("networking");

  useEffect(() => {
    if (visible) {
      setName(value?.name || "");
      setCategory(value?.category || "networking");
    }
  }, [value, visible]);

  function handleSave() {
    if (!name.trim()) {
      return;
    }

    onSave({ name: name.trim(), category });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Typography variant="h1">Set Event Mode</Typography>
            <Button label="Close" onPress={onClose} variant="ghost" fullWidth={false} size="compact" />
          </View>

          <Card style={styles.heroCard}>
            <Typography variant="caption">Current mode</Typography>
            <Typography variant="body" style={styles.heroText}>
              Set this once and every new person or interaction will automatically inherit the same event and type until you switch back to past-event mode.
            </Typography>
          </Card>

          <Card>
            <Typography variant="caption">Event name</Typography>
            <TextInput
              placeholder="React Native EU"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoFocus
            />

            <Typography variant="caption" style={styles.labelSpacing}>Event type</Typography>
            <View style={styles.chipRow}>
              {EVENT_CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                <Button
                  key={option.value}
                  label={option.label}
                  onPress={() => setCategory(option.value as EventCategory)}
                  variant={category === option.value ? "primary" : "ghost"}
                  fullWidth={false}
                  size="compact"
                />
              ))}
            </View>
          </Card>

          <Card>
            <Typography variant="caption">Preview</Typography>
            <Typography variant="body" style={styles.heroText}>
              New saves will tag to {name.trim() || "your event"} · {formatCategoryLabel(category)}.
            </Typography>
          </Card>

          <View style={styles.footerButtons}>
            <Button label={isCompactLayout ? "Save event" : "Save Current Event"} onPress={handleSave} disabled={!name.trim()} />
            <Button label={isCompactLayout ? "Clear event" : "Past Event Mode"} onPress={onClear} variant="ghost" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    paddingBottom: layout.stackGap * 2,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  heroCard: {
    backgroundColor: colors.surfaceMuted,
  },
  heroText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  input: {
    marginTop: 10,
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  labelSpacing: {
    marginTop: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  footerButtons: {
    gap: 12,
  },
});
