import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Calendar,
  ChevronRight,
  History,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  // Status Colors
  successBg: "#d1fae5",
  successText: "#047857",
  dangerBg: "#fee2e2",
  dangerText: "#b91c1c",
  infoBg: "#e0f2fe", // For Scheduled
  infoText: "#0284c7",
};

export default function HistoryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  // Dynamic Layout Helpers
  const isRTL = language === "ar";
  const flexDirection = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";

  const paramsSession = route.params?.session;
  const [session, setSession] = useState<any>(paramsSession);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // FILTER STATE: 'ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED'
  const [filter, setFilter] = useState<string>("ALL");

  // This is the correct definition that handles loading state properly
  const fetchHistory = async (showLoader = true) => {
    if (showLoader) setLoading(true);

    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .or(`passenger_id.eq.${session.user.id},driver_id.eq.${session.user.id}`)
      .in("status", ["COMPLETED", "CANCELLED", "SCHEDULED"])
      .order("created_at", { ascending: false });

    if (error) console.log("History fetch error:", error);
    if (data) setHistory(data);

    if (showLoader) setLoading(false);
  };

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

  // 2. Fetch Data
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchHistory();

    const channel = supabase
      .channel("history_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `passenger_id=eq.${session.user.id}`,
        },
        () => fetchHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Call fetchHistory with false so the full screen spinner doesn't appear
    await fetchHistory(false);
    setRefreshing(false);
  }, [session]);

  const getFilteredData = () => {
    if (filter === "ALL") return history;
    return history.filter((item) => item.status === filter);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? "ar-DZ" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString(isRTL ? "ar-DZ" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusStyle = (status: string) => {
    if (status === "COMPLETED")
      return {
        bg: COLORS.successBg,
        text: COLORS.successText,
        label: t("statusCompleted") || "Completed",
      };
    if (status === "CANCELLED")
      return {
        bg: COLORS.dangerBg,
        text: COLORS.dangerText,
        label: t("statusCancelled") || "Cancelled",
      };
    if (status === "SCHEDULED")
      return {
        bg: COLORS.infoBg,
        text: COLORS.infoText,
        label: t("statusScheduled") || "Scheduled",
      };
    return { bg: "#f3f4f6", text: "#374151", label: status };
  };

  const renderFilterButton = (key: string, label: string) => {
    const isActive = filter === key;
    return (
      <TouchableOpacity
        onPress={() => setFilter(key)}
        style={[styles.filterBtn, isActive && styles.filterBtnActive]}
      >
        <Text
          style={[styles.filterBtnText, isActive && styles.filterBtnTextActive]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const statusStyle = getStatusStyle(item.status);

    // For scheduled rides, usually show scheduled_time, else created_at
    const displayDate = item.scheduled_time || item.created_at;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate("RideDetails", { ride: item })}
        style={styles.card}
      >
        {/* --- Header: Date & Price --- */}
        <View style={[styles.cardHeader, { flexDirection }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={[
                styles.dateBadge,
                item.status === "SCHEDULED" && {
                  backgroundColor: COLORS.infoBg,
                },
              ]}
            >
              {item.status === "SCHEDULED" ? (
                <Clock size={14} color={COLORS.infoText} />
              ) : (
                <Calendar size={14} color={COLORS.textLight} />
              )}
              <Text
                style={[
                  styles.dateText,
                  item.status === "SCHEDULED" && { color: COLORS.infoText },
                ]}
              >
                {formatDate(displayDate)}
              </Text>
            </View>
            <Text style={styles.timeText}>• {formatTime(displayDate)}</Text>
          </View>

          <Text style={styles.priceText}>
            {item.fare_estimate || item.price || 0}{" "}
            <Text style={{ fontSize: 12, color: COLORS.textLight }}>DZD</Text>
          </Text>
        </View>

        <View style={styles.divider} />

        {/* --- Body: Timeline & Addresses --- */}
        <View style={styles.cardBody}>
          {/* 1. PICKUP ROW */}
          <View style={[styles.itemRow, { flexDirection }]}>
            <View style={styles.timelineColumn}>
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
              style={[
                styles.contentContainer,
                isRTL ? { marginRight: 12 } : { marginLeft: 12 },
              ]}
            >
              <Text style={[styles.label, { textAlign }]}>{t("pickup")}</Text>
              <Text
                numberOfLines={2}
                style={[styles.addressText, { textAlign }]}
              >
                {item.pickup_address || t("pickupLocation")}
              </Text>
            </View>
          </View>

          {/* 2. DROPOFF ROW */}
          <View style={[styles.itemRow, { flexDirection }]}>
            <View style={styles.timelineColumn}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: COLORS.accent,
                    borderColor: COLORS.accent,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineLine,
                  { backgroundColor: "transparent" },
                ]}
              />
            </View>
            <View
              style={[
                styles.contentContainer,
                isRTL ? { marginRight: 12 } : { marginLeft: 12 },
              ]}
            >
              <Text style={[styles.label, { textAlign }]}>{t("dropoff")}</Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.addressText,
                  { textAlign, marginBottom: 0, paddingBottom: 0 },
                ]}
              >
                {item.dropoff_address || t("dropoffLocation")}
              </Text>
            </View>
          </View>
        </View>

        {/* --- Footer: Status & Chevron --- */}
        <View style={[styles.cardFooter, { flexDirection }]}>
          <View
            style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
          >
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.detailsLink}>
              {t("viewDetails") || "Details"}
            </Text>
            <ChevronRight
              size={16}
              color={COLORS.mainPurple}
              style={isRTL && { transform: [{ scaleX: -1 }] }}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* --- Header --- */}
      <View style={[styles.header, { flexDirection }]}>
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
        <Text style={styles.headerTitle}>{t("historyTitle")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* --- Filter Bar --- */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filterScrollContent,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          {renderFilterButton("ALL", t("all") || "All")}
          {renderFilterButton("SCHEDULED", t("scheduled") || "Scheduled")}
          {renderFilterButton("COMPLETED", t("completed") || "Completed")}
          {renderFilterButton("CANCELLED", t("cancelled") || "Cancelled")}
        </ScrollView>
      </View>

      {/* --- Content --- */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      ) : (
        <FlatList
          data={getFilteredData()}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.mainPurple]} // Android color
              tintColor={COLORS.mainPurple} // iOS color
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <History size={40} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyTitle}>
                {t("emptyNoRides") || "No Rides Found"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {t("emptyNoRidesSub") || "Try changing the filter."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    height: 60,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },

  // Filters
  filterContainer: {
    height: 50,
    marginBottom: 5,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: {
    backgroundColor: COLORS.mainPurple,
    borderColor: COLORS.mainPurple,
  },
  filterBtnText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
  },
  filterBtnTextActive: {
    color: "white",
    fontFamily: "Tajawal_700Bold",
  },

  // List
  listContent: { padding: 20, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.text,
  },
  timeText: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    color: COLORS.textLight,
  },
  priceText: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.mainPurple,
  },
  divider: { height: 1, backgroundColor: COLORS.background, marginBottom: 12 },

  // Timeline
  cardBody: { marginBottom: 10 },
  itemRow: { alignItems: "flex-start" },
  timelineColumn: { width: 20, alignItems: "center", alignSelf: "stretch" },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 5,
    zIndex: 2,
    backgroundColor: "white",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E5E7EB",
    marginVertical: -2,
  },
  contentContainer: { flex: 1 },
  label: {
    fontSize: 11,
    color: COLORS.textLight,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: "Tajawal_500Medium",
    lineHeight: 20,
    marginBottom: 24,
  },

  // Footer
  cardFooter: {
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },
  detailsLink: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.mainPurple,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: COLORS.textLight,
    textAlign: "center",
  },
});
