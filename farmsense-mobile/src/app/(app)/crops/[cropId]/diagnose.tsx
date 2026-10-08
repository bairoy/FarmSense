import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { analyseCropImage } from "@/features/disease/disease.service";
import type { AnalysisResult, Treatment } from "@/features/disease/disease.types";
import { enqueueOutboxItem, isServerAnswered } from "@/lib/outbox";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  low: "positive",
  mild: "positive",
  moderate: "warning",
  high: "danger",
  severe: "danger",
};

export default function DiagnoseScreen() {
  const queryClient = useQueryClient();
  const { cropId } = useLocalSearchParams<{ cropId: string }>();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [takenOn, setTakenOn] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const capture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo) setPhotoUri(photo.uri);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Photo library permission denied.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!picked.canceled && picked.assets[0]) {
      setPhotoUri(picked.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!photoUri) return;
    setError(null);
    setSubmitting(true);

    const clientRequestId = Crypto.randomUUID();
    const takenOnStr = takenOn.toISOString().split("T")[0];

    try {
      const analysis = await analyseCropImage(cropId, photoUri, takenOnStr, clientRequestId);
      setResult(analysis);
      queryClient.invalidateQueries({ queryKey: ["recommendations", cropId] });
    } catch (err) {
      if (isServerAnswered(err)) {
        setError((err as any).response?.data?.error ?? "Could not analyse this photo. Please try again.");
      } else {
        // No connectivity: queue it. There is no diagnosis to show yet - the
        // photo will be classified once the app can reach the server.
        await enqueueOutboxItem("disease", cropId, { taken_on: takenOnStr }, photoUri, clientRequestId);
        setQueuedMessage("No connection right now. This photo is saved and will be diagnosed once you're back online.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPhotoUri(null);
    setResult(null);
    setQueuedMessage(null);
    setError(null);
  };

  if (result || queuedMessage) {
    const treatment = result?.actionable && "treatment" in result ? result.treatment : null;
    const fullTreatment: Treatment | null = treatment && "cultural_practice" in treatment ? (treatment as Treatment) : null;
    const steps: string[] = [];
    if (fullTreatment?.chemical_treatment) {
      const c = fullTreatment.chemical_treatment;
      steps.push(`Spray ${c.active_ingredient}: ${c.dose_per_hectare}, ${c.application} (${c.timing}).`);
    }
    if (fullTreatment?.cultural_practice.length) {
      steps.push(...fullTreatment.cultural_practice);
    }

    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: "Diagnosis" }} />

        {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}

        {queuedMessage ? (
          <View style={[styles.card, styles.warnCard]}>
            <MaterialCommunityIcons name="cloud-upload-outline" size={20} color={Palette.warning} />
            <Text style={styles.warnCardText}>{queuedMessage}</Text>
          </View>
        ) : (
          result && (
            <>
              <View style={styles.card}>
                <View style={styles.resultTopRow}>
                  <Text style={styles.cardLabel}>PRIMARY PATHOLOGY IDENTIFIED</Text>
                  <Badge label={`${Math.round(result.diagnosis.confidence * 100)}% Match`} tone="positive" icon="check-decagram-outline" />
                </View>
                <Text style={styles.diseaseTitle}>{result.diagnosis.disease.replace(/_/g, " ")}</Text>

                {fullTreatment?.severity && (
                  <View style={styles.severityRow}>
                    <Text style={styles.cardLabel}>SEVERITY</Text>
                    <Badge
                      label={fullTreatment.severity}
                      tone={SEVERITY_TONE[fullTreatment.severity.toLowerCase()] ?? "warning"}
                      icon="alert-outline"
                    />
                  </View>
                )}
              </View>

              {result.diagnosis.heatmap ? (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>WHERE THE AI LOOKED</Text>
                  <Image source={{ uri: result.diagnosis.heatmap }} style={styles.preview} />
                  <Text style={styles.heatmapNote}>
                    Warmer colours mark the parts of the photo that most influenced the result. If they sit on soil or
                    background instead of the leaf, do not rely on it.
                  </Text>
                </View>
              ) : null}

              {steps.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={18} color={Colors.text} />
                    <Text style={styles.sectionLabel}>Prescribed Treatment Plan</Text>
                  </View>
                  {steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!fullTreatment && treatment && "label" in treatment && (
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>Recommended action</Text>
                  <Text style={styles.stepText}>{treatment.label}</Text>
                </View>
              )}

              {!result.actionable && "guidance" in result && result.guidance && (
                <View style={styles.card}>
                  <Text style={styles.stepText}>{result.guidance.message}</Text>
                </View>
              )}
            </>
          )
        )}

        <Button title="Diagnose another photo" icon="camera-outline" onPress={reset} />
      </ScrollView>
    );
  }

  if (photoUri) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: "Confirm photo" }} />
        <Image source={{ uri: photoUri }} style={styles.preview} />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <DateField label="Date the photo was taken" value={takenOn} onChange={setTakenOn} maximumDate={new Date()} />

        <Button title="Analyse this photo" icon="line-scan" loading={submitting} onPress={submit} />
        <Button title="Retake" variant="ghost" icon="camera-retake-outline" onPress={() => setPhotoUri(null)} />
      </ScrollView>
    );
  }

  if (!permission) {
    return <View style={styles.flex} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Diagnose" }} />
        <View style={styles.permissionIconWrap}>
          <MaterialCommunityIcons name="camera-outline" size={28} color={Palette.primary} />
        </View>
        <Text style={styles.permissionText}>Camera access is needed to photograph a leaf for diagnosis.</Text>
        <Button title="Grant camera access" icon="camera" onPress={requestPermission} />
        <Button title="Choose from gallery instead" variant="ghost" icon="image-multiple-outline" onPress={pickFromGallery} />
      </View>
    );
  }

  return (
    <View style={styles.cameraFlex}>
      <Stack.Screen options={{ title: "Diagnose", headerTransparent: true, headerTintColor: "#fff" }} />
      <CameraView ref={cameraRef} style={styles.cameraFlex} facing="back" />
      <View style={styles.frameHint}>
        <Text style={styles.frameHintText}>Centre the affected leaf in frame</Text>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={pickFromGallery} style={styles.galleryButton} hitSlop={12}>
          <MaterialCommunityIcons name="image-multiple-outline" size={22} color="#fff" />
          <Text style={styles.controlText}>Gallery</Text>
        </Pressable>
        <Pressable onPress={capture} style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.8 }]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={{ width: 60 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  cameraFlex: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four, gap: Spacing.two, backgroundColor: Colors.background },
  permissionIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Palette.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: Spacing.one },
  permissionText: { ...Type.bodyMd, color: Colors.text, textAlign: "center", marginBottom: Spacing.three },
  content: { padding: Spacing.three, gap: Spacing.three },
  preview: { width: "100%", aspectRatio: 1, borderRadius: Radius.lg },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.one,
  },
  warnCard: { backgroundColor: "#FFF7E6", borderColor: "#FDE4B0", flexDirection: "row", gap: Spacing.two, alignItems: "flex-start" },
  warnCardText: { ...Type.bodyMd, color: "#7A5B00", flex: 1 },
  resultTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { ...Type.labelSm, color: Colors.textSecondary },
  heatmapNote: { ...Type.labelSm, color: Colors.textSecondary, marginTop: Spacing.one },
  diseaseTitle: { ...Type.headlineMd, color: Colors.text, textTransform: "capitalize", marginTop: 2 },
  severityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: Colors.border },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  sectionLabel: { ...Type.titleSm, color: Colors.text },
  stepRow: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two, alignItems: "flex-start" },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.primary, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumberText: { color: "#fff", fontFamily: FontFamily.bold, fontSize: 12 },
  stepText: { ...Type.bodyMd, color: Colors.text, flex: 1 },
  errorBanner: { padding: Spacing.three, borderRadius: Radius.md, backgroundColor: Palette.dangerTint },
  errorText: { color: Palette.danger, ...Type.bodyMd },
  frameHint: { position: "absolute", top: 100, left: 0, right: 0, alignItems: "center" },
  frameHintText: {
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    fontFamily: FontFamily.semibold,
    fontSize: 13,
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: Spacing.four,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  galleryButton: { alignItems: "center", gap: 4, width: 60 },
  controlText: { color: "#fff", fontFamily: FontFamily.semibold, fontSize: 12, textAlign: "center" },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
