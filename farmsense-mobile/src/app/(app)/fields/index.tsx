import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { AppHeader } from "@/components/ui/app-header";
import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { getFields } from "@/features/fields/field.service";
import { getCropsByField } from "@/features/crops/crop.service";
import type { CropInstance } from "@/features/crops/crop.types";

const CROP_STATUS: Record<CropInstance["status"], { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "positive" },
  harvested: { label: "Harvested", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

function dayNumber(sowingDate: string) {
  const days = Math.floor((Date.now() - new Date(sowingDate).getTime()) / 86_400_000);
  return Math.max(days, 0);
}

export default function FieldsScreen() {
  const [soilFilter, setSoilFilter] = useState<string | null>(null);
  const { data: fields, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["fields"],
    queryFn: getFields,
  });

  const cropQueries = useQueries({
    queries: (fields ?? []).map((field) => ({
      queryKey: ["crops", "field", field.id],
      queryFn: () => getCropsByField(field.id),
      enabled: !!fields,
    })),
  });

  const soilTypes = useMemo(() => {
    const set = new Set((fields ?? []).map((f) => f.soil_type));
    return Array.from(set);
  }, [fields]);

  const visibleFields = (fields ?? []).filter((f) => !soilFilter || f.soil_type === soilFilter);

  return (
    <View style={styles.flex}>
      <AppHeader />
      <SafeAreaView style={styles.flex} edges={["bottom"]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Fields</Text>
            <Text style={styles.subtitle}>
              {fields?.length ?? 0} {fields?.length === 1 ? "field" : "fields"}
            </Text>
          </View>
          <Link href="/fields/new" asChild>
            <Pressable style={({ pressed }) => [styles.addButton, pressed && { backgroundColor: Palette.primaryPressed }]}>
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Field</Text>
            </Pressable>
          </Link>
        </View>

        {soilTypes.length > 1 && (
          <FlatList
            horizontal
            data={[null, ...soilTypes]}
            keyExtractor={(item) => item ?? "all"}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => {
              const active = soilFilter === item;
              const count = item ? (fields ?? []).filter((f) => f.soil_type === item).length : fields?.length ?? 0;
              return (
                <Pressable
                  onPress={() => setSoilFilter(item)}
                  style={[styles.filterChip, { backgroundColor: active ? Palette.primary : "#fff", borderColor: active ? Palette.primary : Colors.border }]}
                >
                  <Text style={[styles.filterChipText, { color: active ? "#fff" : Colors.text }]}>
                    {item ? `${item} (${count})` : `All Fields (${count})`}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}

        {error && !fields ? (
          <View style={styles.center}>
            <Text style={styles.subtleText}>Couldn&apos;t load your fields. Showing cached data when available.</Text>
          </View>
        ) : null}

        {!isLoading && fields?.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="leaf" size={32} color={Palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>No fields yet</Text>
            <Text style={styles.subtleText}>
              Add your first field to start tracking irrigation, fertilizer and crop health.
            </Text>
            <Link href="/fields/new" asChild>
              <Pressable style={styles.emptyButton}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={styles.addButtonText}>Add a field</Text>
              </Pressable>
            </Link>
          </View>
        ) : null}

        <FlatList
          data={visibleFields}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Palette.primary} />}
          renderItem={({ item, index }) => {
            const fieldIndex = (fields ?? []).findIndex((f) => f.id === item.id);
            const crops = cropQueries[fieldIndex]?.data;
            const activeCrop = crops?.find((c) => c.status === "active") ?? crops?.[0];
            const status = activeCrop ? CROP_STATUS[activeCrop.status] : null;

            return (
              <Link href={`/fields/${item.id}`} asChild>
                <Pressable style={({ pressed }) => [styles.card, pressed && { backgroundColor: Colors.backgroundSelected }]}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardIconWrap}>
                      <MaterialCommunityIcons name="sprout-outline" size={20} color={Palette.primary} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{item.location_name}</Text>
                      <Text style={styles.cardMeta}>
                        {item.area?.area_label ?? "Area not set"} · {item.soil_type}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
                  </View>

                  {activeCrop && (
                    <View style={styles.cropRow}>
                      <View style={styles.cropLabelRow}>
                        <MaterialCommunityIcons name="grass" size={16} color={Colors.textSecondary} />
                        <Text style={styles.cropLabel}>
                          {activeCrop.crop_type} · Day {dayNumber(activeCrop.sowing_date)}
                        </Text>
                      </View>
                      {status && <Badge label={status.label} tone={status.tone} />}
                    </View>
                  )}
                </Pressable>
              </Link>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: { ...Type.headlineLg, color: Colors.text },
  subtitle: { ...Type.labelMd, color: Colors.textSecondary, fontFamily: FontFamily.regular, marginTop: 2 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    backgroundColor: Palette.primary,
    borderRadius: Radius.md,
    height: 44,
    paddingHorizontal: Spacing.three,
  },
  addButtonText: { ...Type.bodyMdBold, color: "#fff", fontSize: 14 },
  filterRow: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two },
  filterChip: { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  filterChipText: { ...Type.labelMd },
  center: { padding: Spacing.four, alignItems: "center" },
  subtleText: { ...Type.bodyMd, color: Colors.textSecondary, textAlign: "center" },
  list: { padding: Spacing.three, gap: Spacing.three, flexGrow: 1 },
  card: {
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    shadowColor: "#17221A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  cardIconWrap: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Palette.primaryTint, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { ...Type.bodyMdBold, color: Colors.text },
  cardMeta: { ...Type.labelMd, color: Colors.textSecondary, fontFamily: FontFamily.regular },
  cropRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cropLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  cropLabel: { ...Type.bodyMd, color: Colors.text, textTransform: "capitalize" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.six, gap: Spacing.two },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { ...Type.titleSm, color: Colors.text, marginTop: Spacing.one },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    marginTop: Spacing.two,
  },
});
