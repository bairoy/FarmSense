import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Colors, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { getIrrigationByCrop } from "@/features/irrigation/irrigation.service";
import { listOutboxForCrop, type OutboxItem } from "@/lib/outbox";

type Row =
  | { kind: "synced"; id: string; amount: number; action_date: string }
  | { kind: "queued"; id: string; amount: number; action_date: string; failed: boolean };

export default function IrrigationHistoryScreen() {
  const { cropId } = useLocalSearchParams<{ cropId: string }>();
  const [queued, setQueued] = useState<OutboxItem[]>([]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["irrigation", cropId],
    queryFn: () => getIrrigationByCrop(cropId),
    enabled: !!cropId,
  });

  const loadQueued = useCallback(async () => {
    const items = await listOutboxForCrop(cropId);
    setQueued(items.filter((item) => item.kind === "irrigation"));
  }, [cropId]);

  useFocusEffect(
    useCallback(() => {
      loadQueued();
    }, [loadQueued])
  );

  const rows: Row[] = [
    ...queued.map((item) => {
      const payload = JSON.parse(item.payload);
      return {
        kind: "queued" as const,
        id: item.id,
        amount: payload.amount,
        action_date: payload.action_date,
        failed: item.status === "failed",
      };
    }),
    ...(data ?? []).map((entry) => ({
      kind: "synced" as const,
      id: entry.id,
      amount: entry.amount,
      action_date: entry.action_date,
    })),
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Irrigation",
          headerRight: () => (
            <Link href={`/crops/${cropId}/irrigation/new`} asChild>
              <Pressable hitSlop={12} style={styles.headerAdd}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              </Pressable>
            </Link>
          ),
        }}
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => { refetch(); loadQueued(); }} tintColor={Palette.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="water-outline" size={28} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No irrigation logged yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <MaterialCommunityIcons name="water" size={18} color={Palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.amount}>{item.amount} mm</Text>
              <Text style={styles.date}>{item.action_date}</Text>
            </View>
            {item.kind === "queued" && (
              <Badge label={item.failed ? "Retry needed" : "Pending sync"} tone={item.failed ? "danger" : "warning"} />
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.three, gap: Spacing.two },
  headerAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: Palette.primary, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: Spacing.two, padding: Spacing.six },
  emptyText: { ...Type.bodyMd, color: Colors.textSecondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
    gap: Spacing.three,
  },
  rowIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.primaryTint, alignItems: "center", justifyContent: "center" },
  amount: { ...Type.bodyMdBold, color: Colors.text },
  date: { ...Type.bodyMd, color: Colors.textSecondary, fontSize: 13 },
});
