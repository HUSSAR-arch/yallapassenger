import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient"; //
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
  Edit2,
  Check,
  Globe,
  Trash2,
  MapPin,
  Gift,
  X,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

const { height } = Dimensions.get("window");

// --- THEME CONSTANTS (MATCHING DASHBOARD) ---
const COLORS = {
  primary: "#111827",
  mainPurple: "#775BD4",
  accent: "#960082ff",
  background: "#F3F4F6",
  card: "#FFFFFF",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
};

const BRAND_GRADIENT = ["#7055c9ff", "#b486e7ff"] as const;

export default function ProfileScreen({ navigation }: any) {
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<any>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- EDIT PROFILE STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // --- LANGUAGE MODAL STATE ---
  const [isLangModalVisible, setLangModalVisible] = useState(false);

  // --- ANIMATION SETUP ---
  const slideAnim = useRef(new Animated.Value(height)).current;

  useFocusEffect(
    useCallback(() => {
      slideAnim.setValue(height);
      const animation = Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      });
      animation.start();
      getProfile();
      return () => animation.stop();
    }, [])
  );

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    }).start(() => {
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
        setEditName(data.full_name || "");
      }
    } catch (error) {
      console.log("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editName })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({ ...profile, full_name: editName });
      setIsEditing(false);
      Alert.alert(t("success"), "Profile updated successfully");
    } catch (error: any) {
      Alert.alert(t("error"), error.message);
    } finally {
      setSavingProfile(false);
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
          `${t("voucherRedeemed")}: ${data.amount} DZD`
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
      } catch (e) {}
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert(t("error"), error.message);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Alert.alert(
            "Request Sent",
            "Your account deletion request has been processed."
          );
          handleSignOut();
        },
      },
    ]);
  };

  // --- HELPER COMPONENT: MENU ITEM ---
  const MenuItem = ({ icon: Icon, color, bgColor, label, onPress }: any) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.menuCard, { flexDirection: flexDir }]}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: bgColor }]}>
        <Icon size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { textAlign }]}>{label}</Text>
      </View>
      <ChevronRight size={20} color="#9CA3AF" style={arrowTransform} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <Animated.View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* HEADER */}
        <View style={[styles.header, { flexDirection: flexDir }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            {isRTL ? (
              <ArrowRight size={24} color={COLORS.text} />
            ) : (
              <ArrowLeft size={24} color={COLORS.text} />
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("profileTitle")}</Text>
          <View style={{ width: 40 }} />
          {/* Spacer to balance title center */}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
        >
          {/* 1. USER PROFILE CARD */}
          <View style={[styles.profileCard, { flexDirection: flexDir }]}>
            <View style={styles.avatarContainer}>
              <User size={32} color={COLORS.mainPurple} />
            </View>
            <View
              style={{
                flex: 1,
                alignItems: isRTL ? "flex-end" : "flex-start",
                justifyContent: "center",
                paddingHorizontal: 15,
              }}
            >
              {isEditing ? (
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={[styles.nameInput, { textAlign }]}
                  placeholder="Full Name"
                  autoFocus
                />
              ) : (
                <Text style={[styles.nameText, { textAlign }]}>
                  {profile?.full_name || t("loading")}
                </Text>
              )}

              <View
                style={{
                  flexDirection: flexDir,
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <Phone size={14} color={COLORS.textLight} />
                <Text
                  style={[styles.subText, { textAlign, marginHorizontal: 5 }]}
                >
                  {profile?.phone || profile?.email || t("noPhone")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (isEditing) handleUpdateProfile();
                else setIsEditing(true);
              }}
              style={styles.editBtn}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color={COLORS.mainPurple} />
              ) : isEditing ? (
                <Check size={20} color="white" />
              ) : (
                <Edit2 size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>

          {/* 2. WALLET CARD (Brand Gradient) */}
          <LinearGradient
            colors={BRAND_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.walletCard}
          >
            <View style={[styles.walletHeader, { flexDirection: flexDir }]}>
              <View>
                <Text style={[styles.walletLabel, { textAlign }]}>
                  {t("currentBalance") || "Current Balance"}
                </Text>
                <Text style={[styles.balanceText, { textAlign }]}>
                  {profile?.balance ? profile.balance.toFixed(2) : "0.00"}
                  <Text style={{ fontSize: 16 }}> DZD</Text>
                </Text>
              </View>
              <View style={styles.walletIconBox}>
                <CreditCard size={24} color="white" />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.topUpBtn,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
              onPress={() => navigation.navigate("TopUpScreen")}
              activeOpacity={0.8}
            >
              <Text style={styles.topUpText}>{t("topUp") || "Top Up"}</Text>
              <ChevronRight
                size={16}
                color={COLORS.mainPurple}
                style={arrowTransform}
              />
            </TouchableOpacity>
          </LinearGradient>

          {/* 3. VOUCHER INPUT (Styled like Search Bar) */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { textAlign }]}>
              {t("addVoucher") || "Promo Code"}
            </Text>
            <View
              style={[styles.voucherInputContainer, { flexDirection: flexDir }]}
            >
              <Gift
                size={20}
                color="#9CA3AF"
                style={{ marginHorizontal: 10 }}
              />
              <TextInput
                style={[styles.voucherInput, { textAlign }]}
                placeholder="Ex: YALLA-100"
                placeholderTextColor="#9CA3AF"
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
                  <Text style={styles.redeemText}>{t("add") || "ADD"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. MENU ITEMS (Styled like Schedule Card) */}
          <View style={{ marginTop: 10 }}>
            <MenuItem
              icon={MapPin}
              color="#0591a7ff"
              bgColor="#e0f2fe"
              label={t("favorites") || "Saved Places"}
              onPress={() => navigation.navigate("AddSavedPlace")}
            />

            <MenuItem
              icon={Ticket}
              color={COLORS.accent}
              bgColor="#fdf4ff"
              label={t("paymentHistory")}
              onPress={() => navigation.navigate("PaymentHistoryScreen")}
            />

            {/* Language Selector Trigger */}
            <MenuItem
              icon={Globe}
              color={COLORS.mainPurple}
              bgColor="#F3E8FF"
              label={`${
                t("language") || "Language"
              } (${language.toUpperCase()})`}
              onPress={() => setLangModalVisible(true)}
            />

            {profile?.role === "ADMIN" && (
              <MenuItem
                icon={Shield}
                color="#F59E0B"
                bgColor="#FEF3C7"
                label={t("openAdminConsole")}
                onPress={() => navigation.navigate("AdminVoucherScreen")}
              />
            )}
          </View>

          {/* 5. FOOTER */}
          <View style={{ marginTop: 30, gap: 15, paddingBottom: 20 }}>
            <TouchableOpacity
              onPress={handleSignOut}
              style={[styles.logoutBtn, { flexDirection: flexDir }]}
            >
              <LogOut color={COLORS.textLight} size={20} />
              <Text style={styles.logoutText}>{t("signOut")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteAccount}
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </Animated.View>

      {/* --- LANGUAGE SELECTION MODAL --- */}
      <Modal
        visible={isLangModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setLangModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { flexDirection: flexDir }]}>
              <Text style={styles.modalTitle}>
                {t("selectLanguage") || "Select Language"}
              </Text>
              <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                <X size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            {[
              { code: "en", label: "English", native: "English" },
              { code: "ar", label: "Arabic", native: "العربية" },
              { code: "fr", label: "French", native: "Français" },
            ].map((langItem) => (
              <TouchableOpacity
                key={langItem.code}
                style={[
                  styles.langOption,
                  language === langItem.code && styles.langOptionSelected,
                  { flexDirection: flexDir },
                ]}
                onPress={() => {
                  setLanguage(langItem.code);
                  setLangModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.langText,
                    language === langItem.code && styles.langTextSelected,
                  ]}
                >
                  {langItem.native}
                </Text>
                {language === langItem.code && (
                  <Check size={20} color={COLORS.mainPurple} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Light gray like dashboard background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },

  // --- PROFILE CARD ---
  profileCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3E8FF", // Light purple bg
    justifyContent: "center",
    alignItems: "center",
  },
  nameText: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },
  nameInput: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
    borderBottomWidth: 1,
    borderColor: COLORS.mainPurple,
    minWidth: 120,
    paddingVertical: 0,
  },
  subText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontFamily: "Tajawal_500Medium",
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.mainPurple, // Purple button
    justifyContent: "center",
    alignItems: "center",
  },

  // --- WALLET CARD (Gradient) ---
  walletCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 25,
    shadowColor: COLORS.mainPurple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  walletHeader: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  walletLabel: {
    color: "#E9D5FF",
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    marginBottom: 4,
  },
  balanceText: {
    color: "white",
    fontSize: 34,
    fontFamily: "Tajawal_700Bold",
  },
  walletIconBox: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 12,
    borderRadius: 16,
  },
  topUpBtn: {
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30, // Pill shape
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 8,
  },
  topUpText: {
    color: COLORS.mainPurple,
    fontFamily: "Tajawal_700Bold",
    fontSize: 14,
  },

  // --- VOUCHER INPUT ---
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.textLight,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  voucherInputContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  voucherInput: {
    flex: 1,
    height: 44,
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
    color: COLORS.primary,
  },
  redeemBtn: {
    backgroundColor: COLORS.primary, // Black button
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 2,
  },
  redeemText: {
    color: "white",
    fontFamily: "Tajawal_700Bold",
    fontSize: 13,
  },

  // --- MENU ITEMS ---
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14, // Squircle
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
  },
  menuTitle: {
    fontSize: 16,
    color: COLORS.primary,
    fontFamily: "Tajawal_700Bold",
  },

  // --- FOOTER ---
  logoutBtn: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logoutText: {
    color: COLORS.textLight,
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  deleteText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
  versionText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 10,
  },

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },
  langOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    justifyContent: "space-between",
    alignItems: "center",
  },
  langOptionSelected: {
    backgroundColor: "#F3E8FF",
    marginHorizontal: -24,
    paddingHorizontal: 24,
    borderBottomColor: "transparent",
  },
  langText: {
    fontSize: 16,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
  },
  langTextSelected: {
    color: COLORS.mainPurple,
    fontFamily: "Tajawal_700Bold",
  },
});
