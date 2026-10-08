import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { answerCheckin, getDueCheckin } from "./checkin.service";

/**
 * The farmer-as-sensor prompt, ported from the web app's CheckinPrompt.
 *
 * Renders nothing when nothing is due — asking for the sake of asking trains
 * people to dismiss the prompt without reading it.
 */
export function CheckinPrompt({ cropId }: { cropId: string }) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["checkin", "due", cropId],
    queryFn: () => getDueCheckin(cropId),
  });

  const submit = async (value: string) => {
    if (!data?.checkin) return;

    setSubmitting(true);
    try {
      const result = await answerCheckin(data.checkin.id, value);
      setThanks(result.correction?.note ?? "Thank you. This helps keep the estimates accurate.");
      queryClient.invalidateQueries({ queryKey: ["recommendations", cropId] });
      queryClient.invalidateQueries({ queryKey: ["checkin", "due", cropId] });
    } catch {
      setThanks("Could not save your answer. It will be asked again later.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;

  if (thanks) {
    return (
      <View style={styles.thanksBox}>
        <Text style={styles.thanksText}>{thanks}</Text>
      </View>
    );
  }

  if (!data?.due || !data.checkin) return null;

  const question = data.checkin.question;
  if (!question) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>QUICK CHECK</Text>
      <Text style={styles.question}>{question.question}</Text>
      {question.question_hi ? <Text style={styles.questionHi}>{question.question_hi}</Text> : null}

      <View style={styles.options}>
        {submitting ? (
          <ActivityIndicator color={Palette.info} />
        ) : (
          question.options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => submit(option.value)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: Palette.infoTint }]}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionLabelHi}>{option.label_hi}</Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "#BAE0FA",
    backgroundColor: Palette.infoTint,
    padding: Spacing.three,
  },
  kicker: { ...Type.labelSm, color: Palette.info, letterSpacing: 1 },
  question: { ...Type.titleSm, color: Colors.text, marginTop: Spacing.one },
  questionHi: { ...Type.bodyMd, color: Colors.textSecondary, marginTop: 2 },
  options: { marginTop: Spacing.three, gap: Spacing.two },
  option: {
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Palette.info,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.two,
  },
  optionLabel: { ...Type.bodyMdBold, color: Colors.text, textAlign: "center" },
  optionLabelHi: { ...Type.labelSm, color: Colors.textSecondary, marginTop: 2 },
  thanksBox: { borderRadius: Radius.lg, padding: Spacing.three, backgroundColor: Palette.positiveTint },
  thanksText: { ...Type.bodyMd, color: "#15803D", fontFamily: FontFamily.semibold },
});
