import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { TileMap } from "@/components/tile-map";
import { Colors, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { getCropsByField } from "@/features/crops/crop.service";
import type { CropInstance } from "@/features/crops/crop.types";
import { getFieldById } from "@/features/fields/field.service";

const CROP_STATUS: Record<CropInstance["status"], { label: string; tone: BadgeTone; accent: string }> = {
  active: { label: "Active", tone: "positive", accent: Palette.primary },
  harvested: { label: "Harvested", tone: "neutral", accent: Colors.textTertiary },
  failed: { label: "Failed", tone: "danger", accent: Palette.danger },
};

function dayNumber(sowingDate: string) {
  const days = Math.floor((Date.now() - new Date(sowingDate).getTime()) / 86_400_000);
  return Math.max(days, 0);
}

export default function FieldDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: field, isLoading: fieldLoading } = useQuery({
    queryKey: ["fields", id],
    queryFn: () => getFieldById(id),
    enabled: !!id,
  });

  const { data: crops, isLoading: cropsLoading } = useQuery({
    queryKey: ["crops", "field", id],
    queryFn: () => getCropsByField(id),
    enabled: !!id,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: field?.location_name ?? "Field" }} />

      {fieldLoading ? (
        <ActivityIndicator style={styles.center} color={Palette.primary} />
      ) : (
        <FlatList
          data={crops ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              {field && (
                <View>
                  <TileMap latitude={field.latitude} longitude={field.longitude} height={170} />
                  {field.area?.area_label && (
                    <View style={styles.mapBadge}>
                      <MaterialCommunityIcons name="crop-square" size={14} color={Palette.primary} />
                      <Text style={styles.mapBadgeText}>{field.area.area_label}</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.title}>{field?.location_name}</Text>

              <View style={styles.infoTilesRow}>
                <View style={styles.infoTile}>
                  <MaterialCommunityIcons name="layers-outline" size={18} color={Colors.textSecondary} />
                  <View>
                    <Text style={styles.infoTileLabel}>Soil Type</Text>
                    <Text style={styles.infoTileValue}>{field?.soil_type}</Text>
                  </View>
                </View>
                <View style={styles.infoTile}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={18} color={Colors.textSecondary} />
                  <View>
                    <Text style={styles.infoTileLabel}>Registered</Text>
                    <Text style={styles.infoTileValue}>
                      {field ? new Date(field.created_at).toLocaleDateString() : ""}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cropsHeaderRow}>
                <Text style={styles.sectionTitle}>Crops in this Field{crops ? ` (${crops.length})` : ""}</Text>
                <Link href={{ pathname: "/fields/[id]/add-crop", params: { id: id! } }} asChild>
                  <Pressable style={({ pressed }) => [styles.addCropButton, pressed && { backgroundColor: Palette.primaryTint }]}>
                    <MaterialCommunityIcons name="plus" size={16} color={Palette.primary} />
                    <Text style={styles.addCropButtonText}>Add Crop</Text>
                  </Pressable>
                </Link>
              </View>

              {!cropsLoading && crops?.length === 0 && (
                <View style={styles.emptyCrops}>
                  <MaterialCommunityIcons name="flower-outline" size={22} color={Colors.textSecondary} />
                  <Text style={styles.emptyCropsText}>No crops in this field yet.</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const status = CROP_STATUS[item.status];
            return (
              <Link href={`/crops/${item.id}`} asChild>
                <Pressable style={({ pressed }) => [styles.cropCard, { borderLeftColor: status.accent }, pressed && { backgroundColor: Colors.backgroundSelected }]}>
                  <View style={styles.cropCardTopRow}>
                    <Text style={styles.cropCardTitle}>{item.crop_type}</Text>
                    <Badge label={status.label} tone={status.tone} />
                  </View>
                  <View style={styles.cropCardMetaRow}>
                    <MaterialCommunityIcons name="calendar-outline" size={15} color={Colors.textSecondary} />
                    <Text style={styles.cropCardMeta}>
                      Sown {new Date(item.sowing_date).toLocaleDateString()} · Day {dayNumber(item.sowing_date)}
                    </Text>
                  </View>
                  <View style={styles.cropCardCta}>
                    <Text style={styles.cropCardCtaText}>Open Crop Health &amp; Advisory</Text>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  header: { gap: Spacing.three, marginBottom: Spacing.two },
  mapBadge: {
    position: "absolute",
    top: Spacing.two,
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
  title: { ...Type.headlineLg, color: Colors.text },
  infoTilesRow: { flexDirection: "row", gap: Spacing.two },
  infoTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  infoTileLabel: { ...Type.labelSm, color: Colors.textSecondary },
  infoTileValue: { ...Type.bodyMdBold, color: Colors.text, textTransform: "capitalize" },
  cropsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.two },
  sectionTitle: { ...Type.titleSm, color: Colors.text },
  addCropButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
  },
  addCropButtonText: { ...Type.labelMd, color: Palette.primary },
  emptyCrops: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
  },
  emptyCropsText: { ...Type.bodyMd, color: Colors.textSecondary },
  cropCard: {
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cropCardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cropCardTitle: { ...Type.titleSm, color: Colors.text, textTransform: "capitalize" },
  cropCardMetaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  cropCardMeta: { ...Type.bodyMd, color: Colors.textSecondary },
  cropCardCta: {
    marginTop: Spacing.one,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  cropCardCtaText: { ...Type.bodyMdBold, color: "#fff", fontSize: 14 },
});
