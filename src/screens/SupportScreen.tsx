import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  ArrowLeft,
  Plus,
  MessageCircle,
  ChevronRight,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // <--- 1. IMPORT THIS
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

export default function SupportScreen() {
  const navigation = useNavigation<any>();
  const { t, language } = useLanguage();

  // <--- 2. GET INSETS
  const insets = useSafeAreaInsets();

  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDir = isRTL ? "row-reverse" : "row";

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [initialMessage, setInitialMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setTickets(data);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [])
  );

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !initialMessage.trim()) {
      Alert.alert(t("error"), t("fillAllFields") || "Please fill all fields");
      return;
    }

    setCreating(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;

    // 1. Create Ticket
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject: newSubject,
        category: newCategory,
        status: "open",
      })
      .select()
      .single();

    if (error || !ticket) {
      Alert.alert("Error", "Could not create ticket");
      setCreating(false);
      return;
    }

    // 2. Insert Initial Message
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      message_text: initialMessage,
      is_admin: false,
    });

    setCreating(false);
    setModalVisible(false);
    setNewSubject("");
    setInitialMessage("");
    fetchTickets();

    navigation.navigate("TicketChatScreen", {
      ticketId: ticket.id,
      subject: ticket.subject,
    });
  };

  const renderTicket = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.ticketCard, { flexDirection: flexDir }]}
      onPress={() =>
        navigation.navigate("TicketChatScreen", {
          ticketId: item.id,
          subject: item.subject,
        })
      }
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: item.status === "resolved" ? "#e0f2f1" : "#f3e5f5",
          },
        ]}
      >
        <MessageCircle
          size={24}
          color={item.status === "resolved" ? "green" : "#45986cff"}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 15 }}>
        <Text style={[styles.ticketSubject, { textAlign: alignText }]}>
          {item.subject}
        </Text>
        <Text style={[styles.ticketDate, { textAlign: alignText }]}>
          {new Date(item.created_at).toLocaleDateString()} •{" "}
          {item.status.toUpperCase()}
        </Text>
      </View>

      <ChevronRight
        size={20}
        color="#ccc"
        style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
      />
    </TouchableOpacity>
  );

  return (
    // 3. Changed SafeAreaView to standard View
    <View style={styles.container}>
      {/* HEADER FIX: Added dynamic paddingTop */}
      <View
        style={[
          styles.header,
          {
            flexDirection: flexDir,
            paddingTop: Math.max(insets.top, 20),
          },
        ]}
      >
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
        <Text style={styles.headerTitle}>
          {t("support") || "Help & Support"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* CONTENT */}
      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 50 }}
          size="large"
          color="#45986cff"
        />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 100, // Extra padding so FAB doesn't cover last item
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 50 }}>
              <Text style={{ color: "#888", fontFamily: "Tajawal_400Regular" }}>
                {t("noTickets") || "No support tickets yet."}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB FIX: Added dynamic bottom margin */}
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: 30 + (Platform.OS === "ios" ? insets.bottom : 0) },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Plus size={30} color="white" />
      </TouchableOpacity>

      {/* CREATE TICKET MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View
              style={{
                flexDirection: flexDir,
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text style={styles.modalTitle}>
                {t("newTicket") || "New Ticket"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { textAlign: alignText }]}>
              {t("subject") || "Subject"}
            </Text>
            <TextInput
              style={[styles.input, { textAlign: alignText }]}
              placeholder="e.g. Lost Item"
              value={newSubject}
              onChangeText={setNewSubject}
            />

            <Text style={[styles.label, { textAlign: alignText }]}>
              {t("message") || "Description"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { height: 100, textAlignVertical: "top", textAlign: alignText },
              ]}
              placeholder="Describe your issue..."
              value={initialMessage}
              onChangeText={setInitialMessage}
              multiline
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateTicket}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitText}>
                  {t("submit") || "Submit Ticket"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15, // Changed from paddingVertical to paddingBottom since Top is dynamic
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontFamily: "Tajawal_700Bold", color: "#333" },

  ticketCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  ticketSubject: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#333",
    marginBottom: 4,
  },
  ticketDate: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    color: "#888",
  },
  fab: {
    position: "absolute",
    // bottom is now dynamic inline
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#45986cff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginBottom: 30,
  },
  // Modal

  modalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 60,
    paddingHorizontal: 30,

    height: "100%",
  },
  modalTitle: { fontSize: 18, fontFamily: "Tajawal_700Bold", marginBottom: 5 },
  label: {
    fontFamily: "Tajawal_500Medium",
    marginBottom: 5,
    marginTop: 10,
    color: "#555",
  },
  input: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Tajawal_400Regular",
  },
  submitBtn: {
    backgroundColor: "#45986cff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  submitText: { color: "white", fontFamily: "Tajawal_700Bold" },
});
