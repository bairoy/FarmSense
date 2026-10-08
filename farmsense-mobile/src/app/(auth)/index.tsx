import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiErrorMessage } from "@/lib/apiError";
import { login as loginRequest } from "@/lib/auth.service";
import { Colors, FontFamily, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";
import { KeyboardScreen } from "@/components/keyboard-screen";

export default function LoginScreen() {
  const router = useRouter();
  const { justRegistered } = useLocalSearchParams<{ justRegistered?: string }>();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const data = await loginRequest(email.trim(), password);
      login(data.user, data.accessToken, data.refreshToken);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not sign in. Check your email and password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardScreen style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="leaf" size={32} color={Palette.primary} />
          </View>
          <Text style={styles.brand}>FarmSense</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to see your fields and this week&apos;s guidance.</Text>

          {justRegistered === "1" && (
            <View style={styles.banner}>
              <MaterialCommunityIcons name="check-circle" size={18} color={Palette.primary} />
              <Text style={styles.bannerText}>Account created. Sign in to continue.</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={Palette.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />

          <Button title="Sign in" loading={submitting} onPress={handleSubmit} />

          <Button title="Create an account" variant="ghost" onPress={() => router.push("/(auth)/register")} />
        </ScrollView>
      </KeyboardScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.one,
  },
  brand: { ...Type.labelMd, color: Palette.primary, textAlign: "center", letterSpacing: 1, textTransform: "uppercase" },
  title: { ...Type.headlineXl, color: Colors.text, textAlign: "center", marginTop: Spacing.two },
  subtitle: { ...Type.bodyLg, color: Colors.textSecondary, marginBottom: Spacing.two, textAlign: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryTint,
  },
  bannerText: { ...Type.bodyMd, color: "#15803D", fontFamily: FontFamily.semibold },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.dangerTint,
  },
  errorText: { color: Palette.danger, flex: 1, ...Type.bodyMd },
});
