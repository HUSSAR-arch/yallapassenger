import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { useLanguage } from "./context/LanguageContext";
import { supabase } from "./lib/supabase";
import { LogOut, User } from "lucide-react-native";
// 1. IMPORT THIS
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CustomDrawer(props: any) {
  // 2. GET INSETS
  const insets = useSafeAreaInsets();

  const { setLanguage, language } = useLanguage();

  const email = props.session?.user?.email || "User";

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        // 3. ADD PADDING TOP HERE
        contentContainerStyle={{
          backgroundColor: "#ffffffff",
          paddingTop: insets.top, // This pushes content down below the status bar
        }}
      >
        {/* HEADER: User Profile Info */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <User size={60} color="#333" />
          </View>
          <Text style={styles.name}>Welcome</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* THE MENU ITEMS */}
        <View style={styles.menuContainer}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      {/* FOOTER */}
      <View style={styles.footer}>
        {/* --- START NEW LANGUAGE SWITCHER SECTION --- */}
        <View style={styles.languageSwitchContainer}>
          {/* English Button */}
          <TouchableOpacity onPress={() => setLanguage("en")}>
            {/* Apply bold style if currently selected */}
            <Text
              style={[
                styles.langText,
                language === "en" && styles.langTextBold,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>

          {/* Separator */}
          <Text style={styles.langSeparator}>|</Text>

          {/* Arabic Button */}
          <TouchableOpacity onPress={() => setLanguage("ar")}>
            <Text
              style={[
                styles.langText,
                language === "ar" && styles.langTextBold,
              ]}
            >
              العربية
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => supabase.auth.signOut()}
          style={styles.logoutBtn}
        >
          <LogOut size={20} color="#333" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles remain the same...
const styles = StyleSheet.create({
  header: { padding: 20, alignItems: "center", marginBottom: 10 },
  avatar: {
    backgroundColor: "white",
    borderRadius: 40,
    marginBottom: 10,
    padding: 5,
  },
  name: { fontSize: 18, fontWeight: "bold", color: "#333" },
  email: { fontSize: 14, color: "#333", opacity: 0.8 },
  menuContainer: { flex: 1, backgroundColor: "white", paddingTop: 10 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: "#ccc" },
  languageSwitchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20, // Give space between switcher and logout button
    gap: 15,
  },
  langText: {
    fontSize: 16,
    color: "#555",
  },
  langTextBold: {
    fontWeight: "bold",
    color: "#333",
  },
  langSeparator: {
    color: "#ccc",
    fontSize: 16,
  },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoutText: { fontSize: 16, fontWeight: "bold", color: "#333" },
});
