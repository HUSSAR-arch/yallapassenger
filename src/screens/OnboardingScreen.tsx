// src/screens/OnboardingScreen.tsx
import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { UserRole } from "../types";
import { Car, User, ArrowRight, ArrowLeft } from "lucide-react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

export default function OnboardingScreen() {
  const { t, setLanguage, language } = useLanguage();
  const [step, setStep] = useState(1);
  const [isLoginMode, setIsLoginMode] = useState(false);

  // Form State
  const [role, setRole] = useState<UserRole>("PASSENGER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Verification State
  const [verificationStep, setVerificationStep] = useState(1);
  const [otpCode, setOtpCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Driver Fields
  // const [carModel, setCarModel] = useState("");
  // const [licensePlate, setLicensePlate] = useState("");

  const [loading, setLoading] = useState(false);

  // -----------------------------------------------------------
  // 1. CONFIGURE GOOGLE SIGN IN
  // -----------------------------------------------------------
  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        "934715851958-en3s6md1c1fkdd11h9p6udg0pbgeniub.apps.googleusercontent.com",
      scopes: ["email", "profile"],
    });
  }, []);

  // -----------------------------------------------------------
  // 2. RESEND TIMER LOGIC
  // -----------------------------------------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // -----------------------------------------------------------
  // 3. GOOGLE LOGIN FUNCTION
  // -----------------------------------------------------------
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();

      // 1. FORCE SIGN OUT FIRST
      // This ensures the "Choose Account" prompt appears every time
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore error if no user was signed in (e.g. first launch)
      }

      // 2. NOW SIGN IN (This will now show the account picker)
      const response = await GoogleSignin.signIn();

      if (response.data?.idToken) {
        const { idToken, user } = response.data;

        // 3. Auth with Supabase
        const { data: authData, error } = await supabase.auth.signInWithIdToken(
          {
            provider: "google",
            token: idToken,
          }
        );

        if (error) throw error;

        if (authData.user) {
          // 4. CHECK EXISTING PROFILE
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .single();

          // 5. PREPARE ROLES (The Silent Upgrade)
          // Start with 'PASSENGER'
          let finalRoles = ["PASSENGER"];

          if (existingProfile) {
            const currentRoles = existingProfile.roles || [];
            // Support legacy 'role' column
            if (existingProfile.role) currentRoles.push(existingProfile.role);

            // Combine existing roles with PASSENGER
            finalRoles = [...currentRoles, "PASSENGER"];
          }

          // Remove duplicates (e.g. if they are already a passenger)
          finalRoles = Array.from(new Set(finalRoles));

          // 6. UPSERT PROFILE
          // Note: The SQL trigger we fixed earlier handles the INSERT case, 
          // but this UPSERT handles the "Login again" case to ensure data is fresh.
          const updates = {
            id: authData.user.id,
            full_name: user.name,
            email: user.email,
            role: "PASSENGER", // Fallback for legacy
            roles: finalRoles, // Save the combined array
            updated_at: new Date(),
            // Preserve existing status if it exists, otherwise default to APPROVED for passengers
            agent_status: existingProfile?.agent_status || "APPROVED",
          };

          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(updates, { onConflict: "id" });

          if (profileError) throw profileError;

          // Success! App.tsx will detect the PASSENGER role and let them in.
        }
      }
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Google Sign-In Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------
  // 4. EMAIL LOGIN (Legacy Support)
  // -----------------------------------------------------------
  const handleSendVerification = async () => {
    if (!email || !password)
      return Alert.alert("Error", "Please fill in details.");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) Alert.alert("Login Failed", error.message);
  };

  // -----------------------------------------------------------
  // 5. PHONE AUTH HELPER: FORMAT FOR ALGERIA
  // -----------------------------------------------------------
  const formatPhoneForTwilio = (inputPhone: string) => {
    // Remove all non-numeric characters (spaces, dashes, parens)
    let cleaned = inputPhone.replace(/\D/g, "");

    // If it starts with '0', remove it (e.g. 0550 -> 550)
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }

    // If it doesn't have 213 yet, add it
    if (!cleaned.startsWith("213")) {
      cleaned = "213" + cleaned;
    }

    // Return with the plus sign
    return "+" + cleaned;
  };

  // -----------------------------------------------------------
  // 6. SEND OTP (WhatsApp or SMS)
  // -----------------------------------------------------------
  const sendOtp = async (channel: "whatsapp" | "sms") => {
    if (!phone) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    setLoading(true);
    const formattedPhone = formatPhoneForTwilio(phone);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: channel, // 'whatsapp' or 'sms'
        },
      });

      if (error) throw error;

      Alert.alert(
        "Code Sent",
        `We sent a code to ${formattedPhone} via ${
          channel === "whatsapp" ? "WhatsApp" : "SMS"
        }.`
      );
      setVerificationStep(2);
      setResendTimer(30); // Start 30s cooldown
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------
  // 7. VERIFY OTP & CREATE PROFILE
  // -----------------------------------------------------------
  const verifyOtp = async () => {
    if (otpCode.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    const formattedPhone = formatPhoneForTwilio(phone);

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: "sms",
      });

      if (error) throw error;

      if (user) {
        // 1. CHECK PROFILE
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        // 2. MERGE ROLES
        let finalRoles = ["PASSENGER"];
        if (existingProfile) {
          const currentRoles = existingProfile.roles || [];
          if (existingProfile.role) currentRoles.push(existingProfile.role);
          finalRoles = [...currentRoles, "PASSENGER"];
        }
        finalRoles = Array.from(new Set(finalRoles));

        // 3. UPDATE / INSERT
        // We use upsert to ensure we don't break an existing driver profile
        const updates = {
          id: user.id,
          full_name:
            existingProfile?.full_name ||
            (email ? email.split("@")[0] : "User"),
          phone: formattedPhone,
          roles: finalRoles,
          updated_at: new Date(),
        };

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(updates, { onConflict: "id" });

        if (profileError) throw profileError;

        // Done. Navigation will happen automatically via App.tsx session listener.
      }
    } catch (error: any) {
      Alert.alert("Verification Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------
  // UI RENDER
  // -----------------------------------------------------------
  if (step === 1) {
    return (
      <View style={styles.welcomeContainer}>
        <TouchableOpacity onPress={() => setStep(2)} style={styles.startButton}>
          <Text style={styles.startButtonText}>Get Started</Text>
          <ArrowRight color="white" size={24} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={{
              marginTop: 30,
              marginBottom: 10,
              width: 40,
              height: 40,
              justifyContent: "center",
              // No background color needed, just the icon
            }}
          >
            <ArrowLeft color="#1F2937" size={24} />
          </TouchableOpacity>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isLoginMode ? "Welcome Back" : "Create Account"}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Step 1: Phone Number Input */}
            {verificationStep === 1 && !isLoginMode && (
              <>
                <View>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0550 12 34 56"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                {/* Optional Email for Profile Data (Not used for auth currently) */}
                <View>
                  <Text style={styles.label}>Email (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </>
            )}

            {/* Step 2: Verification Code Input */}
            {verificationStep === 2 && !isLoginMode && (
              <View>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <Text style={styles.resendText}>
                  Code sent to {formatPhoneForTwilio(phone)}
                </Text>

                {/* Resend Options */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 15,
                  }}
                >
                  <Text style={{ color: "gray" }}>Didn't receive it?</Text>
                  {resendTimer > 0 ? (
                    <Text style={{ color: "gray" }}>Wait {resendTimer}s</Text>
                  ) : (
                    <TouchableOpacity onPress={() => sendOtp("sms")}>
                      <Text style={{ color: "#d97706", fontWeight: "bold" }}>
                        Resend via SMS
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Login Mode (Legacy Email/Password) */}
            {isLoginMode && (
              <>
                <View>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                <View>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="******"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>
              </>
            )}
          </View>

          {/* MAIN ACTION BUTTON */}
          <TouchableOpacity
            onPress={() => {
              if (isLoginMode) {
                handleSendVerification(); // Login logic
              } else {
                if (verificationStep === 1) {
                  // Try WhatsApp First
                  sendOtp("whatsapp");
                } else {
                  // Verify OTP
                  verifyOtp();
                }
              }
            }}
            disabled={loading}
            style={[styles.actionButton, loading && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.actionButtonText}>
                {isLoginMode
                  ? "Log In"
                  : verificationStep === 1
                  ? "Send Code via WhatsApp"
                  : "Verify & Register"}
              </Text>
            )}
          </TouchableOpacity>

          {/* GOOGLE LOGIN BUTTON */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsLoginMode(!isLoginMode)}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {isLoginMode ? "Create an account" : "Log In instead"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    backgroundColor: "#4f26afff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logoBox: {
    backgroundColor: "black",
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    transform: [{ rotate: "-3deg" }],
  },
  logoText: { fontSize: 40, fontWeight: "900", color: "#FFC107" },
  logoTextWhite: { color: "white" },
  textBox: { marginBottom: 50, alignItems: "center" },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#e6e6e6ff",
    maxWidth: 250,
  },
  startButton: {
    flexDirection: "row",
    backgroundColor: "#111",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: "center",
    gap: 10,
  },
  startButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  container: { flex: 1, backgroundColor: "white", padding: 20 },
  header: { marginTop: 10, marginBottom: 30 },
  headerTitle: { fontSize: 32, fontWeight: "bold" },
  roleRow: { flexDirection: "row", gap: 15, marginBottom: 30 },
  roleCard: {
    flex: 1,
    padding: 20,
    borderWidth: 2,
    borderColor: "#eee",
    borderRadius: 15,
    alignItems: "center",
    gap: 10,
  },
  roleCardActive: { borderColor: "#FFC107", backgroundColor: "#FFF9E5" },
  roleText: { fontWeight: "bold" },
  form: { gap: 15, marginBottom: 30 },
  label: { fontWeight: "bold", color: "#555", marginBottom: 10 },
  input: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
  },
  driverSection: {
    backgroundColor: "#fefce8",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde047",
    marginTop: 10,
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#ca8a04",
    marginBottom: 15,
    textTransform: "uppercase",
    fontSize: 12,
  },
  actionButton: {
    backgroundColor: "#1F2937",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  actionButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  switchButton: { alignItems: "center", padding: 10, marginBottom: 30 },
  switchText: { color: "#353535ff", fontWeight: "600" },
  resendText: {
    color: "gray",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { marginHorizontal: 10, color: "#9CA3AF", fontWeight: "600" },
  googleButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  googleButtonText: { color: "#1F2937", fontSize: 16, fontWeight: "600" },
});
