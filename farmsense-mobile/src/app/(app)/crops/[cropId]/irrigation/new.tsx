import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { TextField } from "@/components/ui/text-field";
import { Colors, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { enqueueOutboxItem, flushOutbox } from "@/lib/outbox";
import { KeyboardScreen } from "@/components/keyboard-screen";

export default function AddIrrigationScreen() {
  const queryClient = useQueryClient();
  const { cropId } = useLocalSearchParams<{ cropId: string }>();

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter the amount of water applied, in millimetres.");
      return;
    }

    setSubmitting(true);
    try {
      // Always queued, never called directly: this is what makes the entry
      // survive a dropped connection instead of just failing silently. flush
      // then sends it immediately when there is a connection, so it feels
      // instant online and queues invisibly offline.
      await enqueueOutboxItem("irrigation", cropId, {
        crop_instance_id: cropId,
        amount: parsed,
        action_date: date.toISOString().split("T")[0],
      });
      flushOutbox().then(() => {
        queryClient.invalidateQueries({ queryKey: ["irrigation", cropId] });
        queryClient.invalidateQueries({ queryKey: ["recommendations", cropId] });
      });
      router.back();
    } catch {
      setError("Could not save this entry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardScreen tabBar style={styles.flex}>
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Log irrigation" }} />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextField
        label="Water applied (mm)"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 50"
      />
      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

      <Button title="Save" icon="check" loading={submitting} onPress={handleSubmit} />
    </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: { backgroundColor: Colors.background },
  content: { padding: Spacing.three, gap: Spacing.three },
  errorBanner: { padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Palette.dangerTint },
  errorText: { color: Palette.danger, ...Type.bodyMd },
});
