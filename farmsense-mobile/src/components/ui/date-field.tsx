import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, FontFamily, Palette, Radius, Spacing } from "@/constants/theme";

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
}

const format = (date: Date) => date.toISOString().split("T")[0];

export function DateField({ label, value, onChange, maximumDate, minimumDate }: DateFieldProps) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        maximumDate,
        minimumDate,
        onChange: (_event, selected) => {
          if (selected) onChange(selected);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={open} style={styles.input}>
        <MaterialCommunityIcons name="calendar-outline" size={18} color={Palette.primary} />
        <Text style={styles.value}>{format(value)}</Text>
      </Pressable>

      {showIosPicker && Platform.OS === "ios" && (
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(_event, selected) => {
            setShowIosPicker(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  label: { fontFamily: FontFamily.semibold, fontSize: 14, color: Colors.textSecondary },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.backgroundElement,
  },
  value: { fontFamily: FontFamily.regular, fontSize: 16, color: Colors.text },
});
