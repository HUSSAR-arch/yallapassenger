import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Keyboard,
  Dimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Wallet, CheckCircle2 } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

const { width } = Dimensions.get("window");

export default function TopUpScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // State for the generated voucher
  const [voucher, setVoucher] = useState<{ code: string; id: string } | null>(
    null
  );
  const [isScanned, setIsScanned] = useState(false);

  // RTL Helpers
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDir = isRTL ? "row-reverse" : "row";

  // --- 1. GENERATE CODE FUNCTION ---
  const handleGenerate = async () => {
    const value = parseInt(amount);
    if (!value || value < 100) {
      Alert.alert(t("error"), "Minimum amount is 100 DZD");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const { data, error } = await supabase.rpc("create_user_voucher", {
        amount_input: value,
      });

      if (error) throw error;

      if (data.success) {
        setVoucher({ code: data.code, id: data.id });
      } else {
        Alert.alert("Error", data.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. LISTEN FOR AGENT SCAN ---
  useEffect(() => {
    if (!voucher) return;

    // Subscribe to changes on THIS specific voucher row
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
          // If is_redeemed becomes true, the agent scanned it!
          if (updated.is_redeemed === true) {
            setIsScanned(true);
            // Play sound or vibration here if desired
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [voucher]);

  // --- 3. RESET ---
  const handleDone = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { flexDirection: flexDir }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft
            size={24}
            color="#1F2937"
            style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
          />
        </TouchableOpacity>
        <Text style={styles.title}>{t("topUp") || "Top Up Wallet"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* STATE 1: SUCCESS (Scanned) */}
        {isScanned ? (
          <View style={styles.centerBox}>
            <CheckCircle2 size={80} color="#22c55e" />
            <Text style={styles.successTitle}>
              {t("success") || "Success!"}
            </Text>
            <Text style={styles.successText}>
              {amount} DZD has been added to your wallet.
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : voucher ? (
          /* STATE 2: SHOW QR CODE */
          <View style={styles.centerBox}>
            <Text style={styles.instructionText}>
              Show this code to the Yassir Agent
            </Text>

            <View style={styles.qrContainer}>
              <QRCode value={voucher.code} size={200} />
            </View>

            <Text style={styles.codeText}>{voucher.code}</Text>
            <Text style={styles.amountDisplay}>{amount} DZD</Text>

            <View style={styles.loaderRow}>
              <ActivityIndicator color="#4f26afff" />
              <Text style={{ color: "gray" }}>Waiting for scan...</Text>
            </View>

            <TouchableOpacity
              style={styles.cancelLink}
              onPress={() => {
                setVoucher(null);
                setAmount("");
              }}
            >
              <Text style={{ color: "#ef4444" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* STATE 3: INPUT AMOUNT */
          <View style={styles.inputContainer}>
            <View style={styles.iconCircle}>
              <Wallet size={40} color="#4f26afff" />
            </View>

            <Text style={styles.label}>
              {t("enterAmount") || "Enter Amount (DZD)"}
            </Text>

            <TextInput
              style={[styles.input, { textAlign: "center" }]}
              placeholder="1000"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />

            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.generateBtnText}>Generate Code</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              Find a nearby agent and generate this code to pay with cash.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },

  // Input Styles
  inputContainer: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 10,
    fontFamily: "Tajawal_500Medium",
  },
  input: {
    fontSize: 40,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
    width: "100%",
    borderBottomWidth: 2,
    borderColor: "#e5e7eb",
    paddingBottom: 10,
    marginBottom: 30,
  },
  generateBtn: {
    backgroundColor: "#4f26afff",
    width: "100%",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  generateBtnText: {
    color: "white",
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
  },
  note: {
    marginTop: 20,
    textAlign: "center",
    color: "gray",
    fontSize: 12,
    lineHeight: 18,
  },

  // QR Styles
  centerBox: {
    alignItems: "center",
    backgroundColor: "white",
    padding: 30,
    borderRadius: 20,
    elevation: 4,
  },
  instructionText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Tajawal_500Medium",
  },
  qrContainer: {
    padding: 10,
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
  },
  codeText: {
    fontSize: 14,
    color: "gray",
    fontFamily: "monospace",
    marginBottom: 5,
  },
  amountDisplay: {
    fontSize: 32,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  loaderRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  cancelLink: {
    padding: 10,
  },

  // Success Styles
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#22c55e",
    marginTop: 20,
    marginBottom: 10,
  },
  successText: {
    textAlign: "center",
    color: "#4b5563",
    marginBottom: 30,
  },
  doneBtn: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  doneBtnText: {
    color: "white",
    fontWeight: "bold",
  },
});
