import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Colors, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { createCrop } from "@/features/crops/crop.service";
import { getRegion } from "@/features/region/region.service";
import { apiErrorMessage } from "@/lib/apiError";
import { KeyboardScreen } from "@/components/keyboard-screen";

export default function AddCropScreen() {
  const { id: fieldId } = useLocalSearchParams<{ id: string }>();
  const { data: region, isLoading: regionLoading } = useQuery({
    queryKey: ["region"],
    queryFn: getRegion,
  });

  const [cropType, setCropType] = useState<string | null>(null);
  const [sowingDate, setSowingDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!cropType) {
      setError("Choose which crop this is.");
      return;
    }

    setSubmitting(true);
    try {
      const crop = await createCrop({
        field_id: fieldId,
        crop_type: cropType,
        sowing_date: sowingDate.toISOString().split("T")[0],
      });
      router.replace(`/crops/${crop.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add crop. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardScreen tabBar style={styles.flex}>
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Add a crop" }} />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Crop</Text>
        {regionLoading ? (
          <ActivityIndicator color={Palette.primary} />
        ) : (
          <View style={styles.chipRow}>
            {(region?.crops ?? []).map((crop) => {
              const active = cropType === crop.key;
              return (
                <Pressable
                  key={crop.key}
                  onPress={() => setCropType(crop.key)}
                  style={[styles.chip, { backgroundColor: active ? Palette.primary : "#fff", borderColor: active ? Palette.primary : Colors.border }]}
                >
                  <Text style={[styles.chipText, { color: active ? "#fff" : Colors.text }]}>
                    {crop.variety} ({crop.season})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <DateField label="Sowing date" value={sowingDate} onChange={setSowingDate} maximumDate={new Date()} />

      <Button title="Add crop" icon="check" loading={submitting} onPress={handleSubmit} />
    </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: { backgroundColor: Colors.background },
  content: { padding: Spacing.three, gap: Spacing.three },
  section: { gap: Spacing.two },
  sectionLabel: { ...Type.titleSm, color: Colors.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, borderWidth: 1.5 },
  chipText: { ...Type.labelMd },
  errorBanner: { padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Palette.dangerTint },
  errorText: { color: Palette.danger, ...Type.bodyMd },
});
