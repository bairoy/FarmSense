import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { TileMap } from "@/components/tile-map";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { createField } from "@/features/fields/field.service";
import { getRegion } from "@/features/region/region.service";
import { apiErrorMessage } from "@/lib/apiError";
import { KeyboardScreen } from "@/components/keyboard-screen";

const SOIL_TYPES = [
  { label: "Alluvial Loam", icon: "triangle-outline" as const },
  { label: "Clay Loam", icon: "rhombus-outline" as const },
  { label: "Sandy Loam", icon: "dots-grid" as const },
  { label: "Black Soil", icon: "triangle" as const },
];

export default function AddFieldScreen() {
  const { data: region, isLoading: regionLoading } = useQuery({
    queryKey: ["region"],
    queryFn: getRegion,
  });

  const [locationName, setLocationName] = useState("");
  // null until the farmer drags the pin or uses their current location; until
  // then the map is centred on the region's default point without needing an
  // effect to copy it into state.
  const [manualCoords, setManualCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [area, setArea] = useState<Record<string, number>>({});
  const [soilType, setSoilType] = useState(SOIL_TYPES[0].label);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const coords = manualCoords ?? region?.coordinates ?? null;

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Location permission denied. Drag the pin instead.");
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    setManualCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  };

  const areaSqm = (region?.land_units.levels ?? []).reduce(
    (total, level) => total + (area[level.key] || 0) * level.sqm,
    0
  );

  const handleSubmit = async () => {
    setError(null);

    if (!locationName.trim()) {
      setError("Give this field a name.");
      return;
    }
    if (!coords) {
      setError("Set the field's location on the map.");
      return;
    }
    if (areaSqm <= 0) {
      setError("Enter the field area. Without it, fertilizer and water amounts cannot be calculated.");
      return;
    }

    setSubmitting(true);
    try {
      await createField({
        location_name: locationName.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        soil_type: soilType,
        ...area,
      });
      router.replace("/fields");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create field. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (regionLoading || !coords) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Add a field" }} />
        <ActivityIndicator color={Palette.primary} />
      </View>
    );
  }

  return (
    <KeyboardScreen tabBar style={styles.flex}>
      <Stack.Screen options={{ title: "Add a field" }} />
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Field Location &amp; Pin</Text>
          </View>
          <View>
            <TileMap
              latitude={coords.latitude}
              longitude={coords.longitude}
              height={240}
              onChange={setManualCoords}
            />

          </View>
          <Text style={styles.hint}>Drag the map so the red pin sits on your field. Use + and − to zoom, and Satellite/Map to see names of villages and roads.</Text>
          <Button title="Use Current GPS Location" icon="crosshairs-gps" onPress={useMyLocation} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Field Identifier</Text>
          <TextField
            label="Field name *"
            placeholder="e.g. Ganga side plot, North bigha"
            hint="Whatever you call it when you talk about it."
            value={locationName}
            onChangeText={setLocationName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Field Area *</Text>
          <Text style={styles.cardSubtitle}>As written on your khatauni. Leave a box empty if it does not apply.</Text>
          <View style={styles.areaGrid}>
            {(region?.land_units.levels ?? []).map((level) => (
              <View key={level.key} style={styles.areaBox}>
                <TextInput
                  keyboardType="decimal-pad"
                  value={area[level.key] ? String(area[level.key]) : ""}
                  onChangeText={(text) => {
                    const parsed = Number(text);
                    setArea((prev) => ({ ...prev, [level.key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }));
                  }}
                  placeholder="0"
                  style={styles.areaInput}
                  placeholderTextColor={Colors.textTertiary}
                />
                <Text style={styles.areaLabel}>{level.label}</Text>
                <Text style={styles.areaLabelLocal}>{level.label_local}</Text>
              </View>
            ))}
          </View>
          {areaSqm > 0 && (
            <Text style={styles.areaConverted}>
              That is {Math.round(areaSqm).toLocaleString()} m² ({(areaSqm / 10000).toFixed(3)} hectares)
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Soil Classification</Text>
          <View style={styles.soilGrid}>
            {SOIL_TYPES.map((soil) => {
              const active = soilType === soil.label;
              return (
                <Pressable
                  key={soil.label}
                  onPress={() => setSoilType(soil.label)}
                  style={[styles.soilOption, { backgroundColor: active ? Palette.primaryTint : "#fff", borderColor: active ? Palette.primary : Colors.border }]}
                >
                  <MaterialCommunityIcons name={soil.icon} size={20} color={active ? Palette.primary : Colors.textSecondary} />
                  <Text style={[styles.soilLabel, { color: active ? Palette.primary : Colors.text }]}>{soil.label}</Text>
                  {active && <MaterialCommunityIcons name="check-circle" size={16} color={Palette.primary} style={styles.soilCheck} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button title="Save &amp; Register Field" icon="check" loading={submitting} onPress={handleSubmit} />

        <View style={styles.offlineNote}>
          <MaterialCommunityIcons name="cloud-off-outline" size={16} color={Palette.warning} />
          <Text style={styles.offlineNoteText}>Will save locally and sync automatically when online.</Text>
        </View>
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: {
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { ...Type.titleSm, color: Colors.text },
  cardSubtitle: { ...Type.bodyMd, color: Colors.textSecondary, fontSize: 13 },
  hint: { ...Type.labelSm, color: Colors.textSecondary },
  mapBadge: {
    position: "absolute",
    bottom: Spacing.two,
    left: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  mapBadgeText: { ...Type.labelSm, color: Colors.text },
  areaGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  areaBox: { width: "30%", alignItems: "center", gap: Spacing.half },
  areaInput: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    textAlign: "center",
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.text,
    backgroundColor: Colors.backgroundElement,
  },
  areaLabel: { ...Type.labelMd, color: Colors.text, textTransform: "capitalize" },
  areaLabelLocal: { ...Type.labelSm, color: Colors.textSecondary, textAlign: "center" },
  areaConverted: { ...Type.bodyMd, color: Colors.textSecondary },
  soilGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  soilOption: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.two + 2,
  },
  soilLabel: { ...Type.labelMd, flex: 1 },
  soilCheck: { marginLeft: -Spacing.one },
  errorBanner: { padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Palette.dangerTint },
  errorText: { color: Palette.danger, ...Type.bodyMd },
  offlineNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  offlineNoteText: { ...Type.labelSm, color: Palette.warning },
});
