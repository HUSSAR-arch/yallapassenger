import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
  Dimensions,
  ScrollView,
  Animated,
  Easing,
  StatusBar
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient"; //
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, 
  Wallet, 
  CheckCircle2, 
  MapPin, 
  Copy, 
  X,
  ScanLine
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from 'expo-clipboard';

// --- THEME CONSTANTS ---
const COLORS = {
  primary: "#111827",
  mainPurple: "#775BD4",
  accent: "#960082ff",
  background: "#F3F4F6",
  card: "#FFFFFF",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981"
};

const BRAND_GRADIENT = ["#7055c9ff", "#b486e7ff"] as const;
const { width } = Dimensions.get("window");

export default function TopUpScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Voucher State
  const [voucher, setVoucher] = useState<{ code: string; id: string } | null>(null);
  const [isScanned, setIsScanned] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // RTL Helpers
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDir = isRTL ? "row-reverse" : "row";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true })
    ]).start();
  }, [voucher, isScanned]);

  // --- 1. GENERATE VOUCHER ---
  const handleGenerate = async () => {
    const value = parseInt(amount);
    if (!value || value < 100) {
      Alert.alert(t("error"), t("minAmountError") || "Minimum amount is 100 DZD");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      // Call Supabase RPC to create voucher
      const { data, error } = await supabase.rpc("create_user_voucher", {
        amount_input: value,
      });

      if (error) throw error;

      if (data.success) {
        setVoucher({ code: data.code, id: data.id });
      } else {
        Alert.alert(t("error"), data.message);
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. REAL-TIME LISTENER ---
  useEffect(() => {
    if (!voucher) return;

    console.log(`Listening for voucher: ${voucher.id}`);
    
    const channel = supabase
      .channel(`voucher_watch:${voucher.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vouchers",
          filter: `id=eq.${voucher.id}`,
        },
        (payload) => {
          const updated = payload.new;
          if (updated.is_redeemed === true) {
            setIsScanned(true); // Trigger Success View
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [voucher]);

  // --- 3. HELPER FUNCTIONS ---
  const copyToClipboard = async () => {
    if (voucher?.code) {
      await Clipboard.setStringAsync(voucher.code);
      Alert.alert(t("success"), "Code copied to clipboard");
    }
  };

  const handleQuickAdd = (val: number) => {
    const current = parseInt(amount) || 0;
    setAmount((current + val).toString());
  };

  // --- RENDER CONTENT STATES ---

  // A. SUCCESS STATE
  if (isScanned) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={64} color="white" />
            </View>
            <Text style={styles.successTitle}>{t("success") || "Payment Successful!"}</Text>
            <Text style={styles.successSub}>
              {amount} DZD {t("addedToWallet") || "has been added to your wallet."}
            </Text>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneBtnText}>{t("done") || "Done"}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  // B. QR CODE STATE
  if (voucher) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View style={[styles.header, { flexDirection: flexDir }]}>
            <TouchableOpacity onPress={() => setVoucher(null)} style={styles.closeBtn}>
                <X size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("scanCode") || "Scan Code"}</Text>
            <View style={{width: 40}} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollCenter}>
            <Animated.View style={[styles.qrCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <Text style={styles.qrTitle}>{t("showToAgent") || "Show to Agent"}</Text>
                <Text style={styles.qrAmount}>{amount} <Text style={{fontSize: 18, color: COLORS.textLight}}>DZD</Text></Text>
                
                <View style={styles.qrBorder}>
                    <QRCode value={voucher.code} size={220} />
                </View>

                <TouchableOpacity style={styles.codeRow} onPress={copyToClipboard}>
                    <Text style={styles.codeText}>{voucher.code}</Text>
                    <Copy size={16} color={COLORS.textLight} />
                </TouchableOpacity>

                <View style={styles.loaderRow}>
                    <ActivityIndicator color={COLORS.mainPurple} />
                    <Text style={styles.loaderText}>{t("waitingForScan") || "Waiting for agent to scan..."}</Text>
                </View>
            </Animated.View>

            <Text style={styles.qrNote}>
                {t("qrNote") || "Keep this screen open until the agent confirms the transaction."}
            </Text>
        </ScrollView>
      </View>
    );
  }

  // C. INPUT STATE (Default)
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={[styles.header, { flexDirection: flexDir }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                 <ArrowLeft size={24} color={COLORS.text} style={isRTL && { transform: [{ scaleX: -1 }] }} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("topUp")}</Text>
            <View style={{width: 40}} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* 1. Main Input Card */}
            <View style={styles.inputCard}>
                <View style={[styles.iconBox, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Wallet size={24} color={COLORS.mainPurple} />
                </View>
                
                <Text style={[styles.label, { textAlign: alignText }]}>{t("enterAmount")}</Text>
                
                <View style={[styles.inputWrapper, { flexDirection: flexDir }]}>
                    <TextInput 
                        style={[styles.mainInput, { textAlign: alignText }]}
                        placeholder="0"
                        placeholderTextColor="#E5E7EB"
                        keyboardType="number-pad"
                        value={amount}
                        onChangeText={setAmount}
                        autoFocus={false}
                    />
                    <Text style={styles.currencySuffix}>DZD</Text>
                </View>

                {/* Quick Amounts */}
                <View style={[styles.chipRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {[500, 1000, 2000].map((val) => (
                        <TouchableOpacity 
                            key={val} 
                            style={styles.chip} 
                            onPress={() => handleQuickAdd(val)}
                        >
                            <Text style={styles.chipText}>+{val}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* 2. Find Agent Card */}
            <TouchableOpacity 
                style={[styles.agentCard, { flexDirection: flexDir }]}
                // onPress={() => navigation.navigate("AgentMap")} // Use this if you have the route
                activeOpacity={0.8}
            >
                <View style={styles.mapIconCircle}>
                    <MapPin size={24} color="white" />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 15 }}>
                    <Text style={[styles.agentTitle, { textAlign: alignText }]}>
                        {t("findAgent") || "Find Nearby Agent"}
                    </Text>
                    <Text style={[styles.agentSub, { textAlign: alignText }]}>
                        {t("findAgentSub") || "Locate the nearest cash point on the map."}
                    </Text>
                </View>
                {/* Arrow icon would go here if needed */}
            </TouchableOpacity>

            {/* 3. Instructions */}
            <View style={styles.infoSection}>
                <Text style={[styles.infoTitle, { textAlign: alignText }]}>{t("howItWorks") || "How it works"}</Text>
                <View style={[styles.stepRow, { flexDirection: flexDir }]}>
                    <View style={styles.stepNumber}><Text style={styles.stepText}>1</Text></View>
                    <Text style={[styles.stepDesc, { textAlign: alignText }]}>{t("step1") || "Enter the amount you want to add."}</Text>
                </View>
                <View style={[styles.stepRow, { flexDirection: flexDir }]}>
                    <View style={styles.stepNumber}><Text style={styles.stepText}>2</Text></View>
                    <Text style={[styles.stepDesc, { textAlign: alignText }]}>{t("step2") || "Generate a QR code."}</Text>
                </View>
                <View style={[styles.stepRow, { flexDirection: flexDir }]}>
                    <View style={styles.stepNumber}><Text style={styles.stepText}>3</Text></View>
                    <Text style={[styles.stepDesc, { textAlign: alignText }]}>{t("step3") || "Let the agent scan it and pay cash."}</Text>
                </View>
            </View>

        </ScrollView>

        {/* Floating Bottom Button */}
        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={handleGenerate}
                disabled={loading}
                style={styles.shadowWrapper}
            >
                <LinearGradient
                    colors={BRAND_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                            <ScanLine size={20} color="white" />
                            <Text style={styles.btnText}>{t("generateCode") || "Generate Code"}</Text>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // Header
  header: {
    height: 60,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "white",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  closeBtn: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },

  // Scroll Views
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Space for button
  },
  scrollCenter: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80%'
  },

  // Input Card
  inputCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.textLight,
    marginBottom: 10,
  },
  inputWrapper: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 5,
    marginBottom: 20,
  },
  mainInput: {
    flex: 1,
    fontSize: 36,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
    padding: 0,
  },
  currencySuffix: {
    fontSize: 18,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
    marginBottom: 5,
  },
  chipRow: {
    gap: 10,
    justifyContent: "flex-start",
  },
  chip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.mainPurple,
  },

  // Agent Card
  agentCard: {
    backgroundColor: "#111827", // Dark card
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  mapIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  agentTitle: {
    color: "white",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 4,
  },
  agentSub: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },

  // Instructions
  infoSection: {
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
    marginBottom: 15,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  stepText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },
  stepDesc: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
    lineHeight: 20,
  },

  // Floating Button
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: "transparent", // or gradient fade
  },
  shadowWrapper: {
    shadowColor: COLORS.mainPurple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradientBtn: {
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "white",
  },

  // --- QR SCREEN STYLES ---
  qrCard: {
    backgroundColor: "white",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 30,
  },
  qrTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.textLight,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qrAmount: {
    fontSize: 40,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
    marginBottom: 30,
  },
  qrBorder: {
    padding: 15,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#F3F4F6",
    marginBottom: 20,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  codeText: {
    fontSize: 18,
    fontFamily: "monospace",
    fontWeight: "bold",
    color: COLORS.text,
    letterSpacing: 2,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loaderText: {
    color: COLORS.textLight,
    fontFamily: "Tajawal_500Medium",
    fontSize: 14,
  },
  qrNote: {
    textAlign: "center",
    color: COLORS.textLight,
    paddingHorizontal: 40,
    fontSize: 13,
    lineHeight: 20,
  },

  // --- SUCCESS SCREEN ---
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    shadowColor: COLORS.success,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
    marginBottom: 10,
  },
  successSub: {
    fontSize: 16,
    textAlign: "center",
    color: COLORS.textLight,
    marginBottom: 40,
    lineHeight: 24,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 50,
    paddingVertical: 15,
    borderRadius: 30,
  },
  doneBtnText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
});