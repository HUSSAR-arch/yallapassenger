import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  I18nManager,
  StatusBar,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Car,
  Star,
  CreditCard,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase"; // Import Supabase

const { width, height } = Dimensions.get("window");

export default function RideDetailsScreen({ navigation, route }: any) {
  const { ride: initialRide } = route.params; // Rename params to initialRide
  const [ride, setRide] = useState(initialRide); // Use state for the ride data

  const { t, language } = useLanguage();

  const mapRef = useRef<MapView>(null);
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDirection = isRTL ? "row-reverse" : "row";

  // 1. Setup Realtime Subscription for THIS specific ride
  useEffect(() => {
    if (!ride?.id) return;

    // A. Subscribe to updates for this ride ID
    const channel = supabase
      .channel(`ride_detail_${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${ride.id}`, // Specific Filter
        },
        (payload) => {
          console.log("Ride details updated:", payload);
          setRide(payload.new); // Update state instantly
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.id]);

  // Fit map to markers on load
  useEffect(() => {
    if (mapRef.current && ride.pickup_lat && ride.dropoff_lat) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: ride.pickup_lat, longitude: ride.pickup_lng },
            { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
          ],
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }, 500);
    }
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString(
      language === "ar" ? "ar-DZ" : "en-US"
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. Header Map Area */}
      <View style={styles.mapContainer}>
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
        >
          {/* Pickup Marker */}
          <Marker
            coordinate={{
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            }}
          >
            <View style={[styles.markerBase, { backgroundColor: "green" }]}>
              <View style={styles.markerDot} />
            </View>
          </Marker>

          {/* Dropoff Marker */}
          <Marker
            coordinate={{
              latitude: ride.dropoff_lat,
              longitude: ride.dropoff_lng,
            }}
          >
            <View style={[styles.markerBase, { backgroundColor: "black" }]}>
              <View style={styles.markerDot} />
            </View>
          </Marker>

          {/* Line connecting them */}
          <Polyline
            coordinates={[
              { latitude: ride.pickup_lat, longitude: ride.pickup_lng },
              { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
            ]}
            strokeColor="#4f26afff"
            strokeWidth={3}
            lineDashPattern={[1]}
          />
        </MapView>

        {/* Back Button Overlay */}
        <SafeAreaView style={styles.headerOverlay}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <ArrowLeft
              size={24}
              color="#333"
              style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
            />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* 2. Scrollable Details */}
      <ScrollView
        style={styles.detailsContainer}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Status & Date */}
        <View>
          {/* 1. Add Short Ride ID Here */}
          <Text
            style={{
              fontSize: 16,
              color: "#4f26afff",
              fontFamily: "Tajawal_700Bold",
              textAlign: alignText,
              marginBottom: 2,
            }}
          >
            Ride #{ride.short_id || ride.id.slice(0, 6).toUpperCase()}
          </Text>

          <Text
            style={[
              styles.statusText,
              {
                color: ride.status === "COMPLETED" ? "purple" : "red",
                textAlign: alignText,
              },
            ]}
          >
            {ride.status}
          </Text>
          <Text style={[styles.dateText, { textAlign: alignText }]}>
            {formatDate(ride.created_at)}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Driver Info (If available) */}
        {ride.driver_id && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
              {t("driver") || "Driver Info"}
            </Text>
            <View style={[styles.driverRow, { flexDirection }]}>
              <View style={styles.driverAvatar}>
                <Car size={24} color="#555" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 15 }}>
                <Text style={[styles.driverName, { textAlign: alignText }]}>
                  Driver ID: {ride.driver_id.slice(0, 8)}...
                </Text>
                <View style={[styles.ratingRow, { flexDirection }]}>
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <Text style={styles.ratingText}>4.9</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        {/* Route Timeline */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
            {t("route") || "Route Details"}
          </Text>

          <View style={[styles.timelineItem, { flexDirection }]}>
            <MapPin size={20} color="green" />
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={[styles.timelineLabel, { textAlign: alignText }]}>
                {t("pickup")}
              </Text>
              <Text style={[styles.addressText, { textAlign: alignText }]}>
                {ride.pickup_address || "Pickup Location"}
              </Text>
            </View>
          </View>

          {/* Dotted Line */}
          <View
            style={[
              styles.timelineLine,
              isRTL ? { marginRight: 9 } : { marginLeft: 9 },
            ]}
          />

          <View style={[styles.timelineItem, { flexDirection }]}>
            <MapPin size={20} color="red" />
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={[styles.timelineLabel, { textAlign: alignText }]}>
                {t("dropoff")}
              </Text>
              <Text style={[styles.addressText, { textAlign: alignText }]}>
                {ride.dropoff_address || "Dropoff Location"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Payment Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
            {t("payment") || "Payment"}
          </Text>
          <View style={[styles.paymentRow, { flexDirection }]}>
            <CreditCard size={20} color="#666" />
            <Text style={[styles.paymentText, { textAlign: alignText }]}>
              {t("cashPayment") || "Cash"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  mapContainer: { height: height * 0.35, width: "100%" },
  headerOverlay: { position: "absolute", top: 10, left: 20, right: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  markerBase: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  markerDot: { width: 6, height: 6, backgroundColor: "white", borderRadius: 3 },
  detailsContainer: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "white",
    marginTop: -25,
    paddingTop: 25,
    paddingHorizontal: 20,
  },
  section: { marginVertical: 10 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#1f2937",
    marginBottom: 10,
  },
  statusText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },
  dateText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#6b7280",
    marginTop: 2,
  },
  priceText: { fontSize: 24, fontFamily: "Tajawal_700Bold", color: "#111827" },
  driverRow: { alignItems: "center" },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: { fontSize: 16, fontFamily: "Tajawal_700Bold", color: "#374151" },
  ratingRow: { alignItems: "center", gap: 5, marginTop: 2 },
  ratingText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#4b5563",
  },
  timelineItem: { alignItems: "flex-start", marginBottom: 0 },
  timelineLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "Tajawal_500Medium",
  },
  addressText: {
    fontSize: 15,
    color: "#374151",
    fontFamily: "Tajawal_500Medium",
    lineHeight: 20,
  },
  timelineLine: {
    height: 25,
    width: 2,
    backgroundColor: "#e5e7eb",
    marginVertical: 2,
  },
  paymentRow: {
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f3f4f6",
    padding: 15,
    borderRadius: 12,
  },
  paymentText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#374151",
  },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 10 },
});
