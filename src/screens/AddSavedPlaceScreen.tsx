import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  I18nManager,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { supabase } from "../lib/supabase";
import { X, Save } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext"; // <--- Import Context

// YOUR API KEY
const GOOGLE_API_KEY = "AIzaSyBmq7ZMAkkbnzvEywiWDlX1sO6Pu27sJrU";

export default function AddSavedPlaceScreen({ navigation }: any) {
  const { t, language, isRTL } = useLanguage(); // <--- Use Hook

  // RTL Helpers
  const alignText = isRTL ? "right" : "left";
  const flexDir = isRTL ? "row-reverse" : "row";

  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Use translation keys for tags
  const quickTags = ["tagHome", "tagWork", "tagGym", "tagSchool", "tagPartner"];

  const handleSave = async () => {
    // 1. Validation
    if (!label || !address || !coords) {
      Alert.alert(t("error"), t("missingInfo"));
      return;
    }

    setLoading(true);

    // 2. Get User
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert(t("error"), t("emptyNoSession"));
      setLoading(false);
      return;
    }

    // 3. Save to Supabase
    const { error } = await supabase.from("saved_places").insert({
      user_id: user.id,
      label: label,
      address: address,
      latitude: coords.lat,
      longitude: coords.lng,
    });

    setLoading(false);

    // 4. Handle Success/Error & Navigation
    if (error) {
      Alert.alert(t("error"), error.message);
    } else {
      Alert.alert(t("success"), t("placeSaved"));
      navigation.goBack();
    }
  };

  return (
    <View style={styles.overlayContainer}>
      <TouchableOpacity
        style={styles.backdropClickArea}
        onPress={() => navigation.goBack()}
        activeOpacity={1}
      />

      <View style={styles.sheetContainer}>
        {/* Header - Dynamic Direction */}
        <View style={[styles.header, { flexDirection: flexDir }]}>
          <Text style={styles.title}>{t("addNewPlace")}</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
          >
            <X size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 }}
        >
          {/* Search Label */}
          <Text style={[styles.label, { textAlign: alignText }]}>
            {t("searchAddressLabel")}
          </Text>

          <View style={styles.autocompleteContainer}>
            <GooglePlacesAutocomplete
              placeholder={t("searchLocationPlaceholder")}
              debounce={400}
              fetchDetails={true}
              keyboardShouldPersistTaps="always"
              enablePoweredByContainer={false}
              onFail={(e) => console.error("Google Error:", e)}
              onPress={(data, details = null) => {
                if (details) {
                  setAddress(data.description);
                  setCoords({
                    lat: details.geometry.location.lat,
                    lng: details.geometry.location.lng,
                  });
                }
              }}
              textInputProps={{
                textAlign: alignText, // Forces input text to align correctly
              }}
              query={{
                key: GOOGLE_API_KEY,
                language: language, // Dynamic Language for Google Results
                components: "country:dz",
                types: "geocode",
              }}
              styles={{
                container: {
                  flex: 0,
                  zIndex: 100,
                  overflow: "visible",
                },
                textInput: [
                  styles.searchInput,
                  { textAlign: alignText }, // Apply alignment style
                ],
                listView: {
                  zIndex: 9999,
                  position: "absolute",
                  top: 60,
                  left: 0,
                  right: 0,
                  backgroundColor: "white",
                  borderRadius: 10,
                  elevation: 50,
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 5,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                },
                row: {
                  backgroundColor: "white",
                  padding: 5,
                  minHeight: 30,
                  flexDirection: flexDir, // Align result rows
                  alignItems: "center",
                },
                description: {
                  fontFamily: "Tajawal_400Regular",
                  textAlign: alignText, // Align result text
                },
              }}
              renderLeftButton={() => (
                <View
                  style={{
                    justifyContent: "center",
                    marginRight: 5,
                    height: "10%",
                  }}
                ></View>
              )}
            />
          </View>

          {/* Label Input */}
          <Text style={[styles.label, { textAlign: alignText }]}>
            {t("labelTitle")}
          </Text>
          <TextInput
            style={[styles.input, { textAlign: alignText }]}
            placeholder={t("labelPlaceholder")}
            value={label}
            onChangeText={setLabel}
            placeholderTextColor="#9ca3af"
          />

          {/* Quick Tags - Dynamic Direction */}
          <View style={[styles.tagRow, { flexDirection: flexDir }]}>
            {quickTags.map((tagKey) => {
              // @ts-ignore - Ignore TS error for dynamic keys if necessary
              const displayTag = t(tagKey);
              return (
                <TouchableOpacity
                  key={tagKey}
                  style={[
                    styles.tag,
                    label === displayTag && {
                      backgroundColor: "#1F2937",
                      borderColor: "#1F2937",
                    },
                  ]}
                  onPress={() => setLabel(displayTag)}
                >
                  <Text
                    style={[
                      styles.tagText,
                      label === displayTag && { color: "white" },
                    ]}
                  >
                    {displayTag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { flexDirection: "row" }]} // Keep row, just center content
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              // Order of Icon/Text doesn't strictly matter for centered button,
              // but you can swap them if you want strict RTL.
              // Currently kept uniform for simplicity.
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Save size={20} color="white" />
                <Text style={styles.saveBtnText}>{t("saveLocation")}</Text>
              </View>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Overlay Styles
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  backdropClickArea: {
    flex: 1,
  },
  sheetContainer: {
    height: "100%",
    backgroundColor: "#f5f5f5ff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
    paddingTop: 10,
  },

  // Content Styles
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  title: {
    marginTop: 30,
    fontSize: 20,
    color: "#1F2937",
    fontFamily: "Tajawal_700Bold",
  },
  closeBtn: {
    padding: 5,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    marginTop: 30,
  },
  label: {
    color: "#444444ff",
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    fontSize: 12,
    paddingHorizontal: 10,
    height: 50, // Added explicit height for better touch target
    color: "#1F2937",
    fontFamily: "Tajawal_400Regular",
  },
  tagRow: {
    gap: 8,
    marginTop: 15,
    flexWrap: "wrap",
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  tagText: {
    fontSize: 12,
    color: "#4b5563",
    fontFamily: "Tajawal_500Medium",
  },
  autocompleteContainer: {
    marginTop: 5,
    zIndex: 100,
    elevation: 10,
  },
  searchInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 10,
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Tajawal_400Regular",
  },
  saveBtn: {
    backgroundColor: "#5c40a1ff",
    padding: 10, // Increased padding
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 40,
  },
  saveBtnText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Tajawal_500Medium",
  },
});
