import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Colors, Palette, Radius, Spacing, Type } from "@/constants/theme";
import { apiErrorMessage } from "@/lib/apiError";
import { signup } from "@/lib/auth.service";
import { KeyboardScreen } from "@/components/keyboard-screen";

const MIN_PASSWORD = 8;

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      router.replace({ pathname: "/(auth)", params: { justRegistered: "1" } });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create your account. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardScreen style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="account-plus-outline" size={28} color={Palette.primary} />
          </View>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Add your fields once, then get water and fertilizer guidance every week.</Text>

          {error && (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={Palette.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextField label="Your name" autoComplete="name" value={name} onChangeText={setName} />
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
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters.`}
            value={password}
            onChangeText={setPassword}
          />

          <Button title="Create account" loading={submitting} onPress={handleSubmit} />
          <Button title="Already have an account? Sign in" variant="ghost" onPress={() => router.back()} />
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.one,
  },
  title: { ...Type.headlineLg, color: Colors.text, textAlign: "center" },
  subtitle: { ...Type.bodyLg, color: Colors.textSecondary, marginBottom: Spacing.two, textAlign: "center" },
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
