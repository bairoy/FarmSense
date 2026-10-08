import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/ui/app-header";
import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { getFields } from "@/features/fields/field.service";
import { useAuthStore } from "@/store/authStore";
import { useOutboxStore } from "@/store/outboxStore";

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: getFields });
  const pending = useOutboxStore((state) => state.pending);
  const failed = useOutboxStore((state) => state.failed);

  const fieldCount = fields?.length ?? 0;
  const totalHectares = (fields ?? []).reduce((sum, f) => sum + (f.area_sqm ?? 0), 0) / 10000;
  const avgHectares = fieldCount > 0 ? totalHectares / fieldCount : 0;

  const syncBadge =
    failed > 0
      ? { label: `${failed} need retry`, tone: "danger" as const, icon: "alert-circle-outline" as const }
      : pending > 0
        ? { label: `${pending} syncing`, tone: "warning" as const, icon: "sync" as const }
        : { label: "All synced", tone: "positive" as const, icon: "check-circle-outline" as const };

  return (
    <View style={styles.flex}>
      <AppHeader />
      <SafeAreaView style={styles.flex} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.greeting}>
            Namaste{user?.name ? `, ${user.name}` : ""}
          </Text>

          <View style={styles.heroCard}>
            <View style={styles.heroAccent} />
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>FIELD OVERVIEW</Text>
                <View style={styles.heroMetricRow}>
                  <Text style={styles.heroMetric}>{fieldCount}</Text>
                  <Text style={styles.heroMetricUnit}>{fieldCount === 1 ? "Active Field" : "Active Fields"}</Text>
                </View>
              </View>
              <Badge label={syncBadge.label} tone={syncBadge.tone} icon={syncBadge.icon} />
            </View>

            {fieldCount > 0 && (
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatCell}>
                  <Text style={styles.heroStatLabel}>Total Area</Text>
                  <Text style={styles.heroStatValue}>{totalHectares.toFixed(2)} ha</Text>
                </View>
                <View style={styles.heroStatCell}>
                  <Text style={styles.heroStatLabel}>Avg. Field Size</Text>
                  <Text style={styles.heroStatValue}>{avgHectares.toFixed(2)} ha</Text>
                </View>
              </View>
            )}

            <Link href="/fields" asChild>
              <Pressable style={({ pressed }) => [styles.heroCta, pressed && { backgroundColor: Palette.primaryPressed }]}>
                <Text style={styles.heroCtaText}>View All Fields</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </Pressable>
            </Link>
          </View>

          <Text style={styles.sectionTitle}>Field Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionTile href="/fields" icon="view-grid-outline" title="My Fields" subtitle={`${fieldCount} registered`} />
            <ActionTile href="/fields/new" icon="plus-circle-outline" title="Add New Field" subtitle="GPS or map pin" />
            <ActionTile href="/fields" icon="camera-outline" title="Diagnose Crop" subtitle="Choose a crop" />
            <ActionTile href="/fields" icon="chat-outline" title="Ask Assistant" subtitle="Choose a crop" />
          </View>

          {fieldCount === 0 && (
            <View style={styles.tip}>
              <MaterialCommunityIcons name="information-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.tipText}>
                Add your first field to start tracking irrigation, fertilizer and crop health.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ActionTile({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={({ pressed }) => [styles.tile, pressed && { backgroundColor: Colors.backgroundSelected }]}>
        <View style={styles.tileIconWrap}>
          <MaterialCommunityIcons name={icon} size={24} color={Palette.primary} />
        </View>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
  greetingBlock: { gap: Spacing.half },
  greeting: { ...Type.headlineMd, color: Colors.text },
  locationRow: { flexDirection: "row", alignItems: "center", gap: Spacing.half },
  locationText: { ...Type.labelMd, color: Colors.textSecondary, fontFamily: FontFamily.regular },

  heroCard: {
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    overflow: "hidden",
    shadowColor: "#17221A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  heroAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: Palette.primary },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: Spacing.one },
  heroLabel: { ...Type.labelSm, color: Colors.textSecondary, textTransform: "uppercase" },
  heroMetricRow: { flexDirection: "row", alignItems: "baseline", gap: Spacing.two, marginTop: Spacing.half },
  heroMetric: { ...Type.metricDisplay, color: Palette.primary },
  heroMetricUnit: { ...Type.titleSm, color: Colors.text },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
    marginVertical: Spacing.one,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  heroStatCell: { gap: 2 },
  heroStatLabel: { ...Type.labelSm, color: Colors.textSecondary },
  heroStatValue: { ...Type.bodyMdBold, color: Colors.text },
  heroCta: {
    marginTop: Spacing.three,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  heroCtaText: { ...Type.bodyMdBold, color: "#fff" },

  sectionTitle: { ...Type.titleSm, color: Colors.text },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
  tile: {
    width: "47%",
    minHeight: 100,
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    justifyContent: "space-between",
    shadowColor: "#17221A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.two,
  },
  tileTitle: { ...Type.bodyMdBold, color: Colors.text },
  tileSubtitle: { ...Type.labelSm, color: Colors.textSecondary, marginTop: 2 },

  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
  },
  tipText: { flex: 1, ...Type.bodyMd, color: Colors.textSecondary },
});
