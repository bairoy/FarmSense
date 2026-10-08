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

export default function AddFertilizerScreen() {
  const queryClient = useQueryClient();
  const { cropId } = useLocalSearchParams<{ cropId: string }>();

  const [fertilizerType, setFertilizerType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const parsed = Number(quantity);
    if (fertilizerType.trim().length < 2) {
      setError("Enter the fertilizer used, e.g. urea, DAP.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter the quantity applied, in kilograms.");
      return;
    }

    setSubmitting(true);
    try {
      await enqueueOutboxItem("fertilizer", cropId, {
        crop_instance_id: cropId,
        fertilizer_type: fertilizerType.trim(),
        quantity: parsed,
        action_date: date.toISOString().split("T")[0],
      });
      flushOutbox().then(() => {
        queryClient.invalidateQueries({ queryKey: ["fertilizer", cropId] });
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
      <Stack.Screen options={{ title: "Log fertilizer" }} />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextField
        label="Fertilizer"
        value={fertilizerType}
        onChangeText={setFertilizerType}
        placeholder="e.g. Urea, DAP, MOP"
      />
      <TextField
        label="Quantity (kg)"
        keyboardType="decimal-pad"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="e.g. 25"
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
