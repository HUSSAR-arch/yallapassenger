import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, History } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaymentHistoryScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isRTL = language === "ar";
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // 1. Fetch Completed Rides (Spending)
      const { data: rides, error: ridesError } = await supabase
        .from("rides")
        .select("id, created_at, fare, dropoff_address, payment_method")
        .eq("passenger_id", user.id)
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false });

      if (ridesError) throw ridesError;

      // 2. Fetch Redeemed Vouchers (Income)
      const { data: vouchers, error: vouchersError } = await supabase
        .from("vouchers")
        .select("id, redeemed_at, amount, code")
        .eq("redeemed_by", user.id)
        .eq("is_redeemed", true)
        .order("redeemed_at", { ascending: false });

      if (vouchersError) throw vouchersError;

      // 3. Normalize & Merge Data
      const formattedRides = (rides || []).map((r) => ({
        id: r.id,
        type: "RIDE",
        date: new Date(r.created_at),
        amount: -Math.abs(r.fare || 0), // Negative for spending
        title: t("tabRide") || "Ride",
        subtitle: r.dropoff_address,
        method: r.payment_method // CASH or WALLET
      }));

      const formattedVouchers = (vouchers || []).map((v) => ({
        id: v.id,
        type: "TOPUP",
        date: new Date(v.redeemed_at),
        amount: Math.abs(v.amount), // Positive for income
        title: t("topUp") || "Top Up",
        subtitle: `Code: ${v.code}`,
        method: "VOUCHER"
      }));

      // Combine and Sort by Date (Newest first)
      const allHistory = [...formattedRides, ...formattedVouchers].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      setTransactions(allHistory);
    } catch (err) {
      console.log("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.amount > 0;
    const formattedDate = item.date.toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return (
      <View style={[styles.card, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {/* Icon Box */}
        <View style={[
          styles.iconBox, 
          { backgroundColor: isCredit ? "#dcfce7" : "#fee2e2" }
        ]}>
          {isCredit ? (
            <ArrowDownLeft size={24} color="#45986cff" />
          ) : (
            <ArrowUpRight size={24} color="#dc2626" />
          )}
        </View>

        {/* Details */}
        <View style={{ flex: 1, paddingHorizontal: 12, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        {/* Amount */}
        <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
          <Text style={[
            styles.amount, 
            { color: isCredit ? "#45986cff" : "#1f2937" }
          ]}>
            {item.amount > 0 ? "+" : ""}{item.amount} <Text style={{fontSize: 12}}>DZD</Text>
          </Text>
          {item.type === 'RIDE' && (
             <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.method}</Text>
             </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color="#1F2937" style={isRTL ? { transform: [{ scaleX: -1 }] } : {}} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("paymentHistory")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#45986cff" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchHistory} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <History size={60} color="#e5e7eb" />
              <Text style={{ marginTop: 20, color: "gray", fontFamily: "Tajawal_500Medium" }}>
                {t("emptyNoRides") || "No transaction history"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 40, 
    height: 40, 
    justifyContent: "center", 
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#f1f5f9"
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50
  },
  card: {
    backgroundColor: "white",
    padding: 15,
    marginBottom: 12,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "Tajawal_400Regular",
    marginVertical: 2,
  },
  date: {
    fontSize: 11,
    color: "#9ca3af",
    fontFamily: "Tajawal_400Regular",
  },
  amount: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  badge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4
  },
  badgeText: {
    fontSize: 10,
    color: "#4b5563",
    fontWeight: "bold"
  }
});