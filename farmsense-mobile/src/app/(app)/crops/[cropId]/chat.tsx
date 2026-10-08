import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { getCropById } from "@/features/crops/crop.service";
import { sendChatMessage, toApiHistory } from "@/features/chat/chat.service";
import type { ChatMessage } from "@/features/chat/chat.types";
import { useChatHistory } from "@/features/chat/useChatHistory";
import { apiErrorMessage } from "@/lib/apiError";
import { KeyboardScreen } from "@/components/keyboard-screen";

const QUICK_QUESTIONS = ["How is my crop doing?", "Should I irrigate?", "What fertilizer do I need?"];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { cropId } = useLocalSearchParams<{ cropId: string }>();
  const { messages, addMessage } = useChatHistory(cropId);
  const { data: crop } = useQuery({ queryKey: ["crop", cropId], queryFn: () => getCropById(cropId), enabled: !!cropId });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setError(null);
      setInput("");

      const userMessage: ChatMessage = { role: "user", content: text.trim(), timestamp: Date.now() };
      addMessage(userMessage);
      setLoading(true);

      try {
        const response = await sendChatMessage(text.trim(), cropId, toApiHistory(messages));
        addMessage({ role: "assistant", content: response.reply, timestamp: Date.now() });
      } catch (err) {
        setError(apiErrorMessage(err, "Could not reach the assistant. Please try again."));
      } finally {
        setLoading(false);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
    },
    [loading, addMessage, cropId, messages]
  );

  return (
    <KeyboardScreen tabBar style={styles.flex} iosOffset={90}>
      <Stack.Screen options={{ title: crop ? `Ask about ${crop.crop_type}` : "Ask the assistant" }} />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => String(item.timestamp)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="shimmer" size={26} color={Palette.primary} />
            </View>
            <Text style={styles.emptyText}>{crop ? `Ask anything about your ${crop.crop_type}` : "Ask anything about this crop"}</Text>
            <View style={styles.quickRow}>
              {QUICK_QUESTIONS.map((q) => (
                <Pressable key={q} onPress={() => send(q)} style={({ pressed }) => [styles.quickChip, pressed && { backgroundColor: Colors.backgroundSelected }]}>
                  <Text style={styles.quickChipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, item.role === "user" ? styles.rowEnd : styles.rowStart]}>
            {item.role === "assistant" && (
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="shimmer" size={16} color={Palette.primary} />
              </View>
            )}
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={item.role === "user" ? styles.userBubbleText : styles.assistantBubbleText}>{item.content}</Text>
            </View>
          </View>
        )}
      />

      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={Palette.primary} />
          <Text style={styles.typingText}>Thinking…</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about this crop…"
          placeholderTextColor={Colors.textTertiary}
          style={styles.input}
          onSubmitEditing={() => send(input)}
          editable={!loading}
          multiline
        />
        <Pressable
          onPress={() => send(input)}
          disabled={loading || !input.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: input.trim() ? Palette.primary : Colors.backgroundSelected },
            pressed && input.trim() && { backgroundColor: Palette.primaryPressed },
          ]}
        >
          <MaterialCommunityIcons name="arrow-up" size={20} color={input.trim() ? "#fff" : Colors.textTertiary} />
        </Pressable>
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.two, marginBottom: Spacing.one },
  rowStart: { justifyContent: "flex-start" },
  rowEnd: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Palette.primaryTint, alignItems: "center", justifyContent: "center" },
  bubble: { borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, maxWidth: "78%" },
  userBubble: { backgroundColor: Palette.primary, borderBottomRightRadius: Spacing.one },
  userBubbleText: { color: "#fff", lineHeight: 20, fontFamily: FontFamily.regular, fontSize: 16 },
  assistantBubble: { backgroundColor: Colors.backgroundElement, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: Spacing.one },
  assistantBubbleText: { color: Colors.text, lineHeight: 20, fontFamily: FontFamily.regular, fontSize: 16 },
  emptyWrap: { alignItems: "center", paddingTop: Spacing.six, gap: Spacing.one },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Palette.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: Spacing.two },
  emptyText: { ...Type.bodyMd, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.two },
  quickRow: { gap: Spacing.two, width: "100%" },
  quickChip: { padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundElement },
  quickChipText: { ...Type.bodyMd, color: Colors.text },
  typingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingHorizontal: Spacing.three, marginBottom: Spacing.one },
  typingText: { ...Type.labelMd, color: Colors.textSecondary, fontFamily: FontFamily.regular },
  error: { paddingHorizontal: Spacing.three, marginBottom: Spacing.two, color: Palette.danger, ...Type.bodyMd },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
