import React, { useRef, useEffect, useState } from "react";
import MapViewDirections from "react-native-maps-directions";
import * as Clipboard from "expo-clipboard";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  Image,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Car,
  Star,
  CreditCard,
  Calendar,
  Clock,
  ShieldCheck,
  Wallet,
  Banknote,
  Copy,
  CheckCircle2,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

// --- THEME CONSTANTS (MATCHING PASSENGER DASHBOARD) ---
const COLORS = {
  primary: "#111827", // Dark Charcoal
  mainPurple: "#775BD4", // Brand Purple
  accent: "#960082ff", // Magenta Accent
  background: "#F3F4F6", // Light Gray
  card: "#FFFFFF",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10b981", // Green for Completed
  danger: "#ef4444", // Red for Cancelled
};

const { width, height } = Dimensions.get("window");
const GOOGLE_API_KEY = "AIzaSyBmq7ZMAkkbnzvEywiWDlX1sO6Pu27sJrU";

// --- MAP STYLE (MATCHING DASHBOARD) ---
const CUSTOM_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9c9c9" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "on" }],
  },
];

export default function RideDetailsScreen({ navigation, route }: any) {
  const { ride: initialRide } = route.params;
  const [ride, setRide] = useState(initialRide);
  const [driver, setDriver] = useState<any>(null);

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(ride.short_id || ride.id);
    setCopied(true);
    // Reset the "Copied" icon back to "Copy" after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };
  const { t, language } = useLanguage();

  const mapRef = useRef<MapView>(null);
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDirection = isRTL ? "row-reverse" : "row";

  // 1. Realtime Subscription
  useEffect(() => {
    if (!ride?.id) return;
    const channel = supabase
      .channel(`ride_detail_${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${ride.id}`,
        },
        (payload) => {
          setRide(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.id]);

  useEffect(() => {
    const fetchDriver = async () => {
      if (!ride.driver_id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ride.driver_id)
        .single();

      if (data) {
        setDriver(data);
      } else if (error) {
        console.error("Error fetching driver:", error);
      }
    };

    fetchDriver();
  }, [ride.driver_id]);

  // 2. Fit Map Logic
  useEffect(() => {
    if (mapRef.current && ride.pickup_lat && ride.dropoff_lat) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: ride.pickup_lat, longitude: ride.pickup_lng },
            { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
          ],
          {
            edgePadding: { top: 80, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }, 500);
    }
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString(
      language === "ar" ? "ar-DZ" : "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    );
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString(
      language === "ar" ? "ar-DZ" : "en-US",
      { hour: "2-digit", minute: "2-digit" }
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { bg: "#d1fae5", text: "#047857" }; // Green
      case "CANCELLED":
        return { bg: "#fee2e2", text: "#b91c1c" }; // Red
      case "ON_TRIP":
      case "ACCEPTED":
      case "ARRIVED":
        return { bg: "#F3E8FF", text: COLORS.mainPurple }; // Brand Purple
      default:
        return { bg: "#f3f4f6", text: "#374151" }; // Gray
    }
  };

  const statusStyle = getStatusStyle(ride.status);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* --- MAP SECTION --- */}
      <View style={styles.mapHeader}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: ride.pickup_lat || 36.75,
            longitude: ride.pickup_lng || 3.05,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
          customMapStyle={CUSTOM_MAP_STYLE}
        >
          {/* PICKUP MARKER (Purple) */}
          <Marker
            coordinate={{
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            }}
          >
            <View
              style={[styles.markerBase, { borderColor: COLORS.mainPurple }]}
            >
              <View
                style={[
                  styles.markerDot,
                  { backgroundColor: COLORS.mainPurple },
                ]}
              />
            </View>
          </Marker>

          {/* DROPOFF MARKER (Magenta Accent) */}
          <Marker
            coordinate={{
              latitude: ride.dropoff_lat,
              longitude: ride.dropoff_lng,
            }}
          >
            <View style={[styles.markerBase, { borderColor: COLORS.accent }]}>
              <View
                style={[styles.markerDot, { backgroundColor: COLORS.accent }]}
              />
            </View>
          </Marker>

          {/* ROUTE LINE (Purple) */}
          <MapViewDirections
            origin={{
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            }}
            destination={{
              latitude: ride.dropoff_lat,
              longitude: ride.dropoff_lng,
            }}
            apikey={GOOGLE_API_KEY}
            strokeWidth={4}
            strokeColor={COLORS.mainPurple} // Matches your theme
            optimizeWaypoints={true}
            mode="DRIVING"
            // This ensures the route loads immediately
            onReady={(result) => {
              // Optional: Fit map to route perfectly when it loads
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 80, right: 50, bottom: 50, left: 50 },
              });
            }}
          />
        </MapView>

        {/* Floating Back Button */}
        <SafeAreaView style={styles.headerOverlay}>
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
        </SafeAreaView>
      </View>

      {/* --- DETAILS BOTTOM SHEET --- */}
      <View style={styles.sheetContainer}>
        <View style={styles.dragHandle} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. ID Card */}
          <View style={[styles.idCard, { flexDirection }]}>
            <View
              style={{ flex: 1, alignItems: isRTL ? "flex-end" : "flex-start" }}
            >
              <Text style={styles.idLabel}>{t("rideId") || "Ride ID"}</Text>
              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={styles.idValue}>
                  #{ride.short_id || ride.id.slice(0, 8).toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={copyToClipboard}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {copied ? (
                    <CheckCircle2 size={18} color={COLORS.success} />
                  ) : (
                    <Copy size={18} color={COLORS.mainPurple} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
            >
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {ride.status}
              </Text>
            </View>
          </View>

          {/* DIVIDER */}
          <View style={styles.sectionDivider} />

          {/* 2. Date & Time Card */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
              {t("dateAndTime") || "Date & Time"}
            </Text>
            <View
              style={[
                styles.dateTimeRow,
                { flexDirection, justifyContent: "flex-start" },
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Calendar size={18} color={COLORS.mainPurple} />
                <Text
                  style={[
                    styles.dateTimeText,
                    { fontSize: 15, color: COLORS.text },
                  ]}
                >
                  {formatDate(ride.created_at)}
                </Text>
              </View>
              <View style={[styles.dotSeparator, { marginHorizontal: 15 }]} />
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Clock size={18} color={COLORS.mainPurple} />
                <Text
                  style={[
                    styles.dateTimeText,
                    { fontSize: 15, color: COLORS.text },
                  ]}
                >
                  {formatTime(ride.created_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* DIVIDER */}
          <View style={styles.sectionDivider} />

          {/* 3. Price Card */}
          <View style={[styles.priceCard, { flexDirection }]}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View style={[styles.iconBox, { backgroundColor: "#F3E8FF" }]}>
                <Wallet size={20} color={COLORS.mainPurple} />
              </View>
              <Text style={styles.priceLabel}>
                {t("totalFare") || "Total Fare"}
              </Text>
            </View>
            <Text style={styles.priceValue}>
              {ride.fare_estimate || ride.price || "0"}
              <Text style={{ fontSize: 14, color: COLORS.textLight }}>
                {" "}
                DZD
              </Text>
            </Text>
          </View>

          {/* DIVIDER */}
          <View style={styles.sectionDivider} />

          {/* 4. Driver Card (Conditional) */}
          {ride.driver_id && driver && (
            <>
              <View style={styles.card}>
                {/* --- HEADER ROW: TITLE & RATING ALIGNED --- */}
                <View
                  style={{
                    flexDirection, // Respects RTL/LTR
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  {/* Title */}
                  <Text
                    style={[
                      styles.sectionTitle,
                      { marginBottom: 0, textAlign: alignText },
                    ]}
                  >
                    {t("driver") || "Driver Details"}
                  </Text>

                  {/* Rating Badge (Moved here) */}
                  <View style={styles.ratingBadge}>
                    <Star size={12} color="#FBBF24" fill="#FBBF24" />
                    <Text style={styles.ratingValue}>
                      {driver.average_rating
                        ? Number(driver.average_rating).toFixed(1)
                        : "5.0"}
                    </Text>
                  </View>
                </View>

                {/* --- DRIVER INFO ROW --- */}
                <View style={[styles.driverRow, { flexDirection }]}>
                  {/* Avatar Section */}
                  <View style={styles.avatarContainer}>
                    {driver.avatar_url ? (
                      <Image
                        source={{ uri: driver.avatar_url }}
                        style={styles.driverAvatarImage}
                      />
                    ) : (
                      <View style={styles.driverAvatar}>
                        <Car size={26} color={COLORS.mainPurple} />
                      </View>
                    )}
                  </View>

                  {/* Name & Car Info */}
                  <View
                    style={{
                      flex: 1,
                      marginHorizontal: 12,
                      alignItems: isRTL ? "flex-end" : "flex-start",
                    }}
                  >
                    <Text style={styles.driverName}>
                      {driver.full_name || t("driver")}
                    </Text>
                    <Text style={styles.driverSubText}>
                      {driver.car_model || "Unknown Car"} •{" "}
                      {driver.license_plate || "No Plate"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* DIVIDER */}
              <View style={styles.sectionDivider} />
            </>
          )}

          {/* 5. Route Card */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
              {t("tripRoute") || "Trip Route"}
            </Text>
            {/* Pickup */}
            <View style={[styles.timelineItem, { flexDirection }]}>
              <View style={styles.timelineIconColumn}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: COLORS.mainPurple,
                      borderColor: COLORS.mainPurple,
                    },
                  ]}
                />
                <View style={styles.timelineLine} />
              </View>
              <View
                style={{
                  flex: 1,
                  marginHorizontal: 12,
                  alignItems: isRTL ? "flex-end" : "flex-start",
                }}
              >
                <Text style={styles.timelineLabel}>{t("pickup")}</Text>
                <Text style={[styles.addressText, { textAlign: alignText }]}>
                  {ride.pickup_address || "Selected on map"}
                </Text>
              </View>
            </View>
            {/* Dropoff */}
            <View style={[styles.timelineItem, { flexDirection }]}>
              <View style={styles.timelineIconColumn}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: COLORS.accent,
                      borderColor: COLORS.accent,
                    },
                  ]}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  marginHorizontal: 12,
                  alignItems: isRTL ? "flex-end" : "flex-start",
                }}
              >
                <Text style={styles.timelineLabel}>{t("dropoff")}</Text>
                <Text style={[styles.addressText, { textAlign: alignText }]}>
                  {ride.dropoff_address || "Selected on map"}
                </Text>
              </View>
            </View>
          </View>

          {/* DIVIDER */}
          <View style={styles.sectionDivider} />

          {/* 6. Payment Card */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
              {t("payment") || "Payment Method"}
            </Text>
            <View style={[styles.paymentRow, { flexDirection }]}>
              <View
                style={[
                  styles.paymentIconBox,
                  {
                    backgroundColor:
                      ride.payment_method === "WALLET" ? "#F3E8FF" : "#e6f4ea",
                  },
                ]}
              >
                {ride.payment_method === "WALLET" ? (
                  <Wallet size={20} color={COLORS.mainPurple} />
                ) : (
                  <Banknote size={20} color={COLORS.success} />
                )}
              </View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text
                  style={[styles.paymentMethodText, { textAlign: alignText }]}
                >
                  {ride.payment_method === "WALLET"
                    ? t("payWithBalance")
                    : t("cashPayment")}
                </Text>
                <Text
                  style={[
                    styles.paymentStatus,
                    {
                      textAlign: alignText,
                      color:
                        ride.status === "COMPLETED"
                          ? COLORS.success
                          : COLORS.textLight,
                    },
                  ]}
                >
                  {ride.status === "COMPLETED"
                    ? t("paid") || "Paid"
                    : t("pending") || "Pending"}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <TouchableOpacity style={[styles.helpBtn, { flexDirection }]}>
            <ShieldCheck size={18} color={COLORS.textLight} />
            <Text style={styles.helpText}>
              {t("reportIssue") || "Report an issue with this ride"}
            </Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Map Header
  mapHeader: {
    height: height * 0.4,
    width: "100%",
  },
  headerOverlay: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 10,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  // Custom Markers
  markerBase: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Bottom Sheet Container
  sheetContainer: {
    flex: 1,
    marginTop: -30,
    backgroundColor: "#ffffffff",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    overflow: "hidden",
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },

  // Header Details
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  rideIdLabel: {
    fontSize: 22, // Slightly larger for emphasis
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
    // Removed marginBottom, handled by the row now
  },
  dateTimeRow: {
    alignItems: "center",
    gap: 6,
    // Removed nested flex alignment issues
  },
  dateTimeText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },

  // Price Card
  priceCard: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 16,
    borderColor: COLORS.border,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },
  priceValue: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.mainPurple,
  },

  // Cards
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderColor: COLORS.border,
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.textLight,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Driver Styles
  driverRow: {
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3E8FF", // Light Purple background
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },
  driverSubText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderColor: "#fef3c7",
  },
  ratingValue: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: "#141414ff",
  },

  // Route Styles
  timelineItem: {
    alignItems: "flex-start",
    minHeight: 60,
  },
  timelineIconColumn: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    // Background and border set dynamically in component
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  timelineLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.text,
    lineHeight: 20,
  },

  // Payment Styles
  paymentRow: {
    alignItems: "center",
  },
  paymentIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentMethodText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },
  paymentStatus: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    // Color set dynamically
  },

  // Help Footer
  helpBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    gap: 8,
    opacity: 0.7,
  },
  helpText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
    textDecorationLine: "underline",
  },
  headerContainer: {
    marginBottom: 20,
  },

  idRow: {
    justifyContent: "space-between",
    alignItems: "center", // This ensures the text and badge center vertically
    marginBottom: 6, // Spacing between ID and Date
  },
  // ... existing styles ...

  // NEW STYLES FOR ID CARD
  idCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  idLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: "Tajawal_500Medium",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  idValue: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 10,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },
  copyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3E8FF", // Light Purple
    justifyContent: "center",
    alignItems: "center",
  },
  copyBtnSuccess: {
    backgroundColor: "#10B981", // Green when copied
  },

  sectionDivider: {
    height: 1,
    backgroundColor: "#e8e8e8ff", // Light gray border color
    marginVertical: 0, // Spacing above and below the line
    width: "100%", // Full width
  },
});
