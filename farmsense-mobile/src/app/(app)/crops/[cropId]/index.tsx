import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { CheckinPrompt } from "@/features/checkin/CheckinPrompt";
import { getCropById } from "@/features/crops/crop.service";
import { getRecommendations } from "@/features/recommendations/recommendations.service";

const STATUS: Record<string, { label: string; tone: BadgeTone; color: string }> = {
  healthy: { label: "Healthy", tone: "positive", color: Palette.positive },
  stressed: { label: "Stressed", tone: "warning", color: Palette.warning },
  critical: { label: "Critical", tone: "danger", color: Palette.danger },
};

function ActionTile({ href, label, icon }: { href: Href; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [styles.actionTile, pressed && { backgroundColor: Colors.backgroundSelected }]}>
        <View style={styles.actionIconWrap}>
          <MaterialCommunityIcons name={icon} size={22} color={Palette.primary} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export default function CropDetailScreen() {
  const { cropId } = useLocalSearchParams<{ cropId: string }>();
  const [analysisRequested, setAnalysisRequested] = useState(false);

  const { data: crop } = useQuery({
    queryKey: ["crop", cropId],
    queryFn: () => getCropById(cropId),
    enabled: !!cropId,
  });

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["recommendations", cropId],
    queryFn: () => getRecommendations(cropId),
    enabled: !!cropId && analysisRequested,
  });

  const runAnalysis = () => {
    if (analysisRequested) refetch();
    else setAnalysisRequested(true);
  };

  const refreshAnalysis = async () => {
    if (analysisRequested) await refetch();
  };

  const state = analysisRequested ? data?.state : undefined;
  const status = state ? STATUS[state.status] : null;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching && analysisRequested} onRefresh={refreshAnalysis} tintColor={Palette.primary} />}
    >
      <Stack.Screen options={{ title: crop?.crop_type ?? state?.crop_type ?? "Crop" }} />

      {!state && crop && (
        <View style={styles.healthCard}>
          <View style={styles.healthTextBlock}>
            <Text style={styles.cropTitle}>{crop.crop_type}</Text>
            <Text style={styles.healthMeta}>
              Sown {new Date(crop.sowing_date).toLocaleDateString()} · {crop.status}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Field Management Actions</Text>
      <View style={styles.actionsGrid}>
        <ActionTile href={`/crops/${cropId}/irrigation`} label="Irrigation Log" icon="water-outline" />
        <ActionTile href={`/crops/${cropId}/fertilizer`} label="Fertilizer Log" icon="flask-outline" />
        <ActionTile href={`/crops/${cropId}/diagnose`} label="Diagnose Photo" icon="camera-outline" />
        <ActionTile href={`/crops/${cropId}/chat`} label="Ask Assistant" icon="chat-outline" />
      </View>

      {!state && (
        <View style={styles.analyseCard}>
          <View style={styles.analyseIconWrap}>
            <MaterialCommunityIcons name="chart-line" size={24} color={Palette.primary} />
          </View>
          <Text style={styles.analyseTitle}>Crop analysis</Text>
          <Text style={styles.analyseBody}>
            Get the crop health score, irrigation and fertilizer advice for this crop. This takes a few seconds.
          </Text>
          <Pressable
            onPress={runAnalysis}
            disabled={isFetching}
            style={({ pressed }) => [styles.analyseButton, pressed && { backgroundColor: Palette.primaryPressed }, isFetching && { opacity: 0.6 }]}
          >
            {isFetching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyseButtonText}>{analysisRequested ? "Try again" : "Analyse crop"}</Text>
            )}
          </Pressable>
          {error && analysisRequested ? (
            <Text style={styles.analyseError}>
              Couldn&apos;t complete the analysis. Check your connection and try again.
            </Text>
          ) : null}
        </View>
      )}

      {state && (
        <>
          <View style={styles.healthCard}>
            <View style={styles.healthRingOuter}>
              <View style={[styles.healthRing, { borderColor: status?.color ?? Colors.border }]}>
                <Text style={[styles.healthScore, { color: status?.color ?? Colors.text }]}>{state.health_score}</Text>
                <Text style={styles.healthScoreMax}>/ 100</Text>
              </View>
            </View>
            <View style={styles.healthTextBlock}>
              <Text style={styles.cropTitle}>{state.crop_type}</Text>
              {status && <Badge label={status.label} tone={status.tone} />}
              <Text style={styles.healthMeta}>
                Day {state.day_number} · {state.phase.replace(/_/g, " ")} · {state.progress_pct}% to maturity
              </Text>
            </View>
          </View>

          <CheckinPrompt cropId={cropId} />

          {state.stress_factors.length > 0 && (
            <View style={[styles.card, styles.warnCard]}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="alert-outline" size={16} color={Palette.warning} />
                <Text style={[styles.cardTitle, { color: Palette.warning }]}>Things to know</Text>
              </View>
              {state.stress_factors.map((factor, i) => (
                <Text key={i} style={styles.stressLine}>
                  • {factor}
                </Text>
              ))}
            </View>
          )}

          {data?.irrigation && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="water-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.cardTitle}>Irrigation</Text>
              </View>
              <Text style={styles.cardHeadline}>{data.irrigation.action.replace(/_/g, " ")}</Text>
              <Text style={styles.cardBody}>{data.irrigation.reason}</Text>
              {data.irrigation.dosage && (
                <Text style={styles.cardValue}>
                  {data.irrigation.dosage.depth_mm} mm · {data.irrigation.dosage.volume_m3} m³
                </Text>
              )}
            </View>
          )}

          {data?.fertilizer?.current_action && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="flask-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.cardTitle}>Fertilizer due</Text>
              </View>
              <Text style={styles.cardHeadline}>{data.fertilizer.current_action.name}</Text>
              {data.fertilizer.current_action.products.map((product) => (
                <Text key={product.product} style={styles.cardBody}>
                  {product.label}: {product.local_units}
                </Text>
              ))}
            </View>
          )}

          {data?.blocked && (
            <View style={[styles.card, styles.dangerCard]}>
              <Text style={{ color: Palette.danger, ...Type.bodyMd }}>{data.blocked}</Text>
            </View>
          )}

        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  offlineNotice: { ...Type.bodyMd, color: Colors.textSecondary, padding: Spacing.three },

  healthCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  healthRingOuter: { alignItems: "center", justifyContent: "center" },
  healthRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  healthScore: { ...Type.headlineMd, fontFamily: FontFamily.bold },
  healthScoreMax: { ...Type.labelSm, color: Colors.textSecondary },
  healthTextBlock: { flex: 1, gap: Spacing.half },
  cropTitle: { ...Type.titleSm, color: Colors.text, textTransform: "capitalize" },
  healthMeta: { ...Type.labelMd, color: Colors.textSecondary, fontFamily: FontFamily.regular, marginTop: 2 },

  card: {
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  warnCard: { backgroundColor: Palette.warningTint, borderColor: "#FDE4B0" },
  dangerCard: { backgroundColor: Palette.dangerTint, borderColor: "#F8C9C9" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one, marginBottom: Spacing.one },
  cardTitle: { ...Type.labelSm, color: Colors.textSecondary, textTransform: "uppercase" },
  cardHeadline: { ...Type.titleSm, color: Colors.text, textTransform: "capitalize" },
  cardBody: { ...Type.bodyMd, color: Colors.textSecondary, marginTop: Spacing.half },
  cardValue: { ...Type.bodyMdBold, color: Colors.text, marginTop: Spacing.two },
  stressLine: { ...Type.bodyMd, color: "#92620A", marginTop: Spacing.one },

  sectionTitle: { ...Type.titleSm, color: Colors.text, marginTop: Spacing.one },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  actionTile: {
    flexGrow: 1,
    minWidth: "47%",
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    alignItems: "center",
    gap: Spacing.one,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { ...Type.bodyMdBold, fontSize: 13, color: Colors.text, textAlign: "center" },
  analyseCard: {
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
  analyseIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: Palette.primaryTint, alignItems: "center", justifyContent: "center" },
  analyseTitle: { ...Type.titleSm, color: Colors.text },
  analyseBody: { ...Type.bodyMd, color: Colors.textSecondary, textAlign: "center" },
  analyseButton: {
    alignSelf: "stretch",
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  analyseButtonText: { ...Type.bodyMdBold, color: "#fff" },
  analyseError: { ...Type.labelMd, color: Palette.danger, textAlign: "center" },
});
