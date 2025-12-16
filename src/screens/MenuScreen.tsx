import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  I18nManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LogOut, User, X, Home, Clock, Headphones } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

interface MenuScreenParams {
  session: any;
}

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();

  // Get language state
  const { t, language, setLanguage } = useLanguage();

  const params = route.params as MenuScreenParams;
  const session = params?.session;
  const email = session?.user?.email || "User";

  // --- FIXED RTL LOGIC ---
  // We strictly check the selected language.
  const isAr = language === "ar";

  // 1. Flex Direction:
  // 'row-reverse' moves items to the Right (Visual RTL).
  // 'row' moves items to the Left (Visual LTR).
  const flexDir = isAr ? "row-reverse" : "row";

  // 2. Text Alignment:
  const textAlign = isAr ? "right" : "left";

  // 3. Cross Alignment (For Close Button container):
  // If Arabic, we align the close button to the left (flex-start) or right (flex-end) depending on preference.
  // Standard UI often keeps close buttons on the 'Start' (Left for English, Right for Arabic)
  // But based on your request, let's just make sure the LIST items are correct.
  // For the close button specifically:
  const closeBtnAlign = isAr ? "flex-end" : "flex-start"; // Align Close button to the starting edge

  const handleNavigation = (screenName: string) => {
    navigation.goBack();
    navigation.navigate("Dashboard", { screen: screenName });
  };

  // --- REUSABLE COMPONENT: MENU ITEM ---
  const MenuItem = ({
    icon: IconComponent,
    label,
    onPress,
  }: {
    icon: any;
    label: string;
    onPress: () => void;
  }) => {
    return (
      <TouchableOpacity
        // Apply the smart flexDir here
        style={[styles.menuItem, { flexDirection: flexDir }]}
        onPress={onPress}
      >
        <IconComponent size={24} color="#333" />
        <Text style={[styles.menuItemText, { textAlign }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Pressable style={styles.overlay} onPress={() => navigation.goBack()}>
      <Pressable
        style={styles.sheetContainer}
        onPress={(e) => e.stopPropagation()}
      >
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          {/* HEADER: Close Button */}
          {/* We align this using closeBtnAlign */}
          <View style={[styles.headerBtnRow, { alignItems: closeBtnAlign }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.closeBtn}
            >
              <X size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* LANGUAGE SWITCHER */}
          <View style={styles.langSwitchContainer}>
            {/* ENGLISH BUTTON - Explicitly sets 'en' */}
            <TouchableOpacity
              onPress={() => setLanguage("en")}
              style={[
                styles.langBtn,
                language === "en" && styles.langBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.langText,
                  language === "en" && styles.langTextActive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>

            <View style={styles.langDivider} />

            {/* ARABIC BUTTON - Explicitly sets 'ar' */}
            <TouchableOpacity
              onPress={() => setLanguage("ar")}
              style={[
                styles.langBtn,
                language === "ar" && styles.langBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.langText,
                  language === "ar" && styles.langTextActive,
                ]}
              >
                العربية
              </Text>
            </TouchableOpacity>
          </View>

          {/* PROFILE INFO */}
          <View
            style={[styles.profileInfoContainer, { flexDirection: flexDir }]}
          >
            <View style={styles.avatar}>
              <User size={40} color="#ffffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.welcomeText, { textAlign }]}>
                {t("menuWelcome")}
              </Text>
              <Text style={[styles.emailText, { textAlign }]}>{email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* MENU ITEMS LIST */}
          <ScrollView contentContainerStyle={styles.menuItemsContainer}>
            <MenuItem
              icon={Home}
              label={t("tabRide")}
              onPress={() => handleNavigation("Home")}
            />
            <MenuItem
              icon={Clock}
              label={t("tabActivity")}
              onPress={() => handleNavigation("Activity")}
            />
            <MenuItem
              icon={User}
              label={t("tabProfile")}
              onPress={() => handleNavigation("Profile")}
            />
            <MenuItem
              icon={Headphones}
              label={t("support") || "Support"}
              onPress={() => {
                navigation.goBack();
                // We will create this screen next
                navigation.navigate("SupportScreen");
              }}
            />
          </ScrollView>

          {/* FOOTER: Logout Button */}
          {/* Always Centered - Unaffected by RTL Logic */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                navigation.goBack();
                supabase.auth.signOut();
              }}
            >
              <LogOut size={24} color="#D9534F" />
              <Text style={styles.logoutText}>{t("signOut") || "Log Out"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheetContainer: {
    height: "100%",
    backgroundColor: "white",
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  headerBtnRow: {
    marginBottom: 10,
    // alignItems is now handled dynamically inline
  },
  closeBtn: {
    padding: 8,
    marginTop: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
  },
  // Profile
  profileInfoContainer: {
    alignItems: "center", // Vertical align
    gap: 15,
    marginBottom: 25,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  avatar: {
    backgroundColor: "#4f26afff",
    borderRadius: 25,
    padding: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Tajawal_400Regular",
    marginBottom: 2,
    includeFontPadding: false,
  },
  emailText: {
    fontSize: 13,
    color: "#333",
    fontFamily: "Tajawal_700Bold",
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginBottom: 15,
  },
  // Menu Items
  menuItemsContainer: {
    paddingBottom: 10,
  },
  menuItem: {
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    gap: 15,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    includeFontPadding: false,
    color: "#333",
    flex: 1,
  },
  // Footer / Logout
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderColor: "#D9534F",
    borderWidth: 1,
    borderRadius: 50,
    gap: 10,
  },
  logoutText: {
    color: "#D9534F",
    fontFamily: "Tajawal_500Medium",
    fontSize: 15,
    includeFontPadding: false,
  },
  // Language Switcher
  langSwitchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    alignSelf: "center",
  },
  langDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "#e7e7e7ff",
    marginHorizontal: 5,
  },
  langBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  langBtnActive: {
    backgroundColor: "white",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  langText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Tajawal_400Regular",
  },
  langTextActive: {
    color: "#333",
    fontFamily: "Tajawal_700Bold",
  },
});
