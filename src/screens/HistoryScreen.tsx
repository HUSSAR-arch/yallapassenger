import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  I18nManager,
  StatusBar,
} from "react-native";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Clock, MapPin } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

export default function HistoryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();

  // Dynamic Layout Helpers
  const isRTL = language === "ar";
  const flexDirection = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";

  const paramsSession = route.params?.session;
  const [session, setSession] = useState<any>(paramsSession);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  // 1. Initialize Session
  useEffect(() => {
    if (!session) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession(data.session);
        } else {
          setLoading(false);
        }
      });
    }
  }, []);

  // 2. Fetch Data & Setup Realtime Listener
  useEffect(() => {
    if (!session?.user?.id) return;

    // A. Initial Fetch
    fetchHistory();

    // B. Realtime Subscription (Listen for NEW rides or STATUS updates)
    const channel = supabase
      .channel("history_updates")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT and UPDATE
          schema: "public",
          table: "rides",
          filter: `passenger_id=eq.${session.user.id}`,
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      // Check both passenger OR driver columns (useful if you share logic)
      .or(`passenger_id.eq.${session.user.id},driver_id.eq.${session.user.id}`)
      .in("status", ["COMPLETED", "CANCELLED"])
      .order("created_at", { ascending: false });

    if (error) console.log("History fetch error:", error);
    if (data) setHistory(data);
    setLoading(false);
  };

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord } = payload;
    const isCompletedOrCancelled = ["COMPLETED", "CANCELLED"].includes(
      newRecord.status
    );

    if (eventType === "INSERT" && isCompletedOrCancelled) {
      // New historical ride? Add to top.
      setHistory((prev) => [newRecord, ...prev]);
    } else if (eventType === "UPDATE") {
      setHistory((prev) => {
        // If status changed to something we don't show (e.g. back to PENDING?), remove it
        if (!isCompletedOrCancelled) {
          return prev.filter((item) => item.id !== newRecord.id);
        }

        // Check if item exists in our list
        const exists = prev.find((item) => item.id === newRecord.id);

        if (exists) {
          // Update existing item
          return prev.map((item) =>
            item.id === newRecord.id ? newRecord : item
          );
        } else {
          // If it wasn't there (e.g. just became COMPLETED), add it to top
          return [newRecord, ...prev];
        }
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return (
      date.toLocaleDateString(isRTL ? "ar-DZ" : "en-US") +
      " " +
      date.toLocaleTimeString(isRTL ? "ar-DZ" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const getStatusText = (status: string) => {
    if (status === "COMPLETED") return t("statusCompleted") || "Completed";
    if (status === "CANCELLED") return t("statusCancelled") || "Cancelled";
    return status;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { flexDirection }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft
            size={24}
            color="black"
            style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { textAlign }]}>{t("historyTitle")}</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#4f26afff"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { textAlign: "center" }]}>
              {!session ? t("emptyNoSession") : t("emptyNoRides")}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate("RideDetails", { ride: item })}
            >
              <View style={styles.card}>
                {/* Price and Status Row */}
                <View style={[styles.rowBetween, { flexDirection }]}>
                  <Text
                    style={[
                      styles.status,
                      { textAlign },
                      item.status === "COMPLETED"
                        ? { color: "green" }
                        : { color: "red" },
                    ]}
                  >
                    {getStatusText(item.status)}
                  </Text>
                  <Text style={styles.price}>{item.fare_estimate} DZD</Text>
                </View>

                {/* Date/Time Row */}
                <View style={[styles.dateRow, { flexDirection }]}>
                  <Clock size={14} color="gray" />
                  <Text style={styles.dateText}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>

                {/* Addresses */}
                <View style={styles.timeline}>
                  {/* Pickup */}
                  <View style={[styles.locRow, { flexDirection }]}>
                    <MapPin size={16} color="green" />
                    <Text
                      style={[styles.address, { textAlign }]}
                      numberOfLines={1}
                    >
                      {item.pickup_address ||
                        t("pickupLocation") ||
                        "Pickup location"}
                    </Text>
                  </View>

                  {/* Dotted Line */}
                  <View
                    style={[
                      styles.line,
                      isRTL ? { marginRight: 7 } : { marginLeft: 7 },
                    ]}
                  />

                  {/* Dropoff */}
                  <View style={[styles.locRow, { flexDirection }]}>
                    <MapPin size={16} color="red" />
                    <Text
                      style={[styles.address, { textAlign }]}
                      numberOfLines={1}
                    >
                      {item.dropoff_address ||
                        t("dropoffLocation") ||
                        "Dropoff location"}
                    </Text>
                  </View>
                </View>

                {/* "View Details" Link */}
                <View style={styles.detailsLinkContainer}>
                  <Text style={[styles.detailsLink, { textAlign }]}>
                    {t("viewDetails") || "viewDetails"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginTop: 30,
  },
  backBtn: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    marginHorizontal: 15, // Use marginHorizontal so it works for both LTR/RTL
  },
  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    elevation: 2,
  },
  rowBetween: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  status: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  price: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  dateRow: {
    alignItems: "center",
    gap: 5,
    marginBottom: 15,
  },
  dateText: {
    color: "gray",
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  timeline: {
    gap: 5,
  },
  locRow: {
    gap: 10,
    alignItems: "center",
  },
  address: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    fontFamily: "Tajawal_500Medium",
  },
  line: {
    height: 10,
    width: 1,
    backgroundColor: "#ccc",
  },
  detailsLinkContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
    paddingTop: 10,
  },
  detailsLink: {
    color: "#4f26afff",
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  emptyText: {
    marginTop: 50,
    color: "gray",
    fontFamily: "Tajawal_500Medium",
  },
});
