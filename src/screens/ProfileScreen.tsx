import React, { useEffect, useState, useRef } from "react";
// 1. ADD useFocusEffect to this import
import { useFocusEffect } from "@react-navigation/native";

// 2. ADD useCallback to this import
import { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Animated, // 1. IMPORT ANIMATED
  Dimensions, // 1. IMPORT DIMENSIONS
  Easing, // 1. IMPORT EASING
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  User,
  Phone,
  LogOut,
  Shield,
  CreditCard,
  Ticket,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

const { height } = Dimensions.get("window"); // 2. GET SCREEN HEIGHT

export default function ProfileScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- ANIMATION SETUP ---
  // Start the screen "pushed down" by the full height of the device
  const slideAnim = useRef(new Animated.Value(height)).current;

  useFocusEffect(
    useCallback(() => {
      // 1. Force reset the position to the bottom (off-screen) instantly
      slideAnim.setValue(height);

      // 2. Animate it UP to position 0 (visible)
      const animation = Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      });

      animation.start();

      // 3. Ensure we fetch fresh data every time we open the screen
      getProfile();

      // Cleanup: Stop animation if user leaves quickly
      return () => animation.stop();
    }, [])
  );

  // Custom Back Handler: Slide Down, then Go Back
  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: height, // Slide back down
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic), // Accelerate out
    }).start(() => {
      // Wait for animation to finish, then navigate
      navigation.goBack();
    });
  };

  const isRTL = language === "ar";
  const flexDir = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";
  const arrowTransform = isRTL ? { transform: [{ scaleX: -1 }] } : {};

  const getProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      }
    } catch (error) {
      console.log("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) {
      Alert.alert(t("error"), t("enterVoucherCode") || "Please enter a code");
      return;
    }

    setRedeeming(true);
    Keyboard.dismiss();

    try {
      const { data, error } = await supabase.rpc("redeem_voucher", {
        code_input: voucherCode.trim(),
        user_id_input: profile.id,
      });

      if (error) throw error;

      if (data.success) {
        Alert.alert(
          t("success"),
          `${t("voucherRedeemed") || "Voucher Redeemed"}: ${data.amount} DZD`
        );
        setVoucherCode("");
        getProfile();
      } else {
        Alert.alert(t("error"), data.message || "Invalid code");
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setRedeeming(false);
    }
  };

  const handleSignOut = async () => {
    try {
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // No need to navigate manually, App.tsx usually listens to auth state
    } catch (error: any) {
      Alert.alert(t("error"), error.message);
    }
  };

  return (
    // 3. REPLACE SafeAreaView WITH Animated.View (keep SafeAreaView styles inside if needed)
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }, // Apply the slide
      ]}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { flexDirection: flexDir }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            {/* If Arabic (RTL), show Right Arrow. If English, show Left Arrow. */}
            {isRTL ? (
              <ArrowRight size={24} color="#1F2937" />
            ) : (
              <ArrowLeft size={24} color="#1F2937" />
            )}
          </TouchableOpacity>

          <Text style={styles.title}>{t("profileTitle")}</Text>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* User Card */}
          <View style={[styles.card, { flexDirection: flexDir }]}>
            <View style={styles.avatarContainer}>
              <User size={32} color="white" />
            </View>
            <View
              style={{ flex: 1, alignItems: isRTL ? "flex-end" : "flex-start" }}
            >
              <Text style={[styles.name, { textAlign }]}>
                {profile?.full_name || t("loading")}
              </Text>
              <View
                style={[styles.row, { flexDirection: flexDir, marginTop: 4 }]}
              >
                <Phone size={14} color="gray" />
                <Text
                  style={[styles.subText, { textAlign, marginHorizontal: 5 }]}
                >
                  {profile?.phone || t("noPhone")}
                </Text>
              </View>
            </View>
          </View>

          {/* Wallet Section */}
          <View style={styles.walletCard}>
            <View style={[styles.walletHeader, { flexDirection: flexDir }]}>
              <View>
                <Text style={[styles.walletLabel, { textAlign }]}>
                  {t("currentBalance") || "Current Balance"}
                </Text>
                <Text style={[styles.balanceAmount, { textAlign }]}>
                  {profile?.balance ? profile.balance.toFixed(2) : "0.00"}
                  <Text style={styles.currency}> DZD</Text>
                </Text>
              </View>
              <View style={styles.walletIcon}>
                <CreditCard size={16} color="white" />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.topUpBtn, { flexDirection: flexDir }]}
              onPress={() => navigation.navigate("TopUpScreen")}
            >
              <Text style={styles.topUpText}>{t("topUp") || "Top Up"}</Text>
              <ArrowRight size={16} color="#1F2937" style={arrowTransform} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={[styles.voucherLabel, { textAlign }]}>
              {t("addVoucher") || "Add Voucher Code"}
            </Text>

            <View style={[styles.voucherRow, { flexDirection: flexDir }]}>
              <TextInput
                style={[styles.voucherInput, { textAlign }]}
                placeholder={t("voucherPlaceholder") || "Enter code here..."}
                placeholderTextColor="#9ca3af"
                value={voucherCode}
                onChangeText={setVoucherCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.redeemBtn}
                onPress={handleRedeemVoucher}
                disabled={redeeming}
              >
                {redeeming ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ticket size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment History Link */}
          <TouchableOpacity
            style={[styles.menuItem, { flexDirection: flexDir }]}
          >
            <View style={[styles.menuIconBox, { backgroundColor: "#f0f9ff" }]}>
              <CreditCard size={20} color="#0284c7" />
            </View>
            <Text style={[styles.menuText, { textAlign }]}>
              {t("paymentHistory") || "Payment History"}
            </Text>
            <ChevronRight size={20} color="#9ca3af" style={arrowTransform} />
          </TouchableOpacity>

          {/* Admin Console */}
          {profile?.role === "ADMIN" && (
            <TouchableOpacity
              onPress={() => navigation.navigate("AdminVoucherScreen")}
              style={[styles.adminBtn, { flexDirection: flexDir }]}
            >
              <Shield size={20} color="white" />
              <Text style={styles.adminText}>{t("openAdminConsole")}</Text>
            </TouchableOpacity>
          )}

          {/* Sign Out */}
          <TouchableOpacity
            onPress={handleSignOut}
            style={[styles.logoutBtn, { flexDirection: flexDir }]}
          >
            <LogOut color="#4f26afff" size={20} />
            <Text style={styles.logoutText}>{t("signOut")}</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    marginTop: 30,
  },
  title: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
    textAlign: "center",
    marginTop: 30,
  },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 16,
    marginBottom: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 15,
  },
  name: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#111",
  },
  subText: {
    color: "gray",
    fontFamily: "Tajawal_400Regular",
    fontSize: 14,
  },
  row: {
    alignItems: "center",
  },
  walletCard: {
    backgroundColor: "#1F2937",
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  walletHeader: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  walletLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    marginBottom: 5,
  },
  balanceAmount: {
    color: "white",
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
  },
  currency: {
    fontSize: 16,
    color: "#9ca3af",
    fontFamily: "Tajawal_500Medium",
  },
  walletIcon: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 10,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 10,
  },
  voucherLabel: {
    color: "#d1d5db",
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    marginBottom: 10,
  },
  voucherRow: {
    gap: 10,
  },
  voucherInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    color: "white",
    fontFamily: "Tajawal_700Bold",
    letterSpacing: 1,
  },
  redeemBtn: {
    backgroundColor: "#4f26afff",
    width: 100,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItem: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: "#374151",
    fontFamily: "Tajawal_500Medium",
  },
  adminBtn: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
  },
  adminText: {
    color: "white",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  logoutBtn: {
    backgroundColor: "#fafafaff",
    padding: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  logoutText: {
    color: "#4f26afff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  versionText: {
    textAlign: "center",
    marginBottom: 60,
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  topUpBtn: {
    backgroundColor: "#FFC107", // Yellow accent
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: "flex-start", // Use flex-start so it doesn't stretch
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  topUpText: {
    color: "#1F2937",
    fontFamily: "Tajawal_700Bold",
    fontSize: 14,
  },
});
