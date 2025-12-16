import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { ArrowLeft, Send } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

export default function TicketChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { ticketId, subject } = route.params;

  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const flexDir = isRTL ? "row-reverse" : "row";
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Initial Load
  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session.session?.user.id || null;
      setUserId(currentUserId);

      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
    };
    init();
  }, [ticketId]);

  // 2. Realtime Listener (The "Instant" Receiver)
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT", // Listen specifically for INSERTs
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`, // Crucial filter
        },
        (payload) => {
          console.log("Realtime event received!", payload); // Debug log
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

  // 3. Optimistic Send (The "Instant" Sender)
  const handleSend = async () => {
    if (!inputText.trim() || !userId) return;

    const textToSend = inputText.trim();
    setInputText(""); // Clear input immediately

    // A. Create a temporary "Optimistic" message
    const tempId = Math.random().toString();
    const optimisticMsg = {
      id: tempId,
      ticket_id: ticketId,
      sender_id: userId,
      message_text: textToSend,
      is_admin: false,
      created_at: new Date().toISOString(),
      pending: true, // Optional: You could use this to show a "sending..." icon
    };

    // B. Show it immediately in the UI
    setMessages((prev) => [...prev, optimisticMsg]);

    // C. Send to Supabase
    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: userId,
        message_text: textToSend,
        is_admin: false,
      })
      .select()
      .single();

    // D. Update the message with real data from server (or remove on error)
    if (error) {
      console.error("Send error:", error);
      // Remove the optimistic message if failed
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert("Failed to send message.");
    } else if (data) {
      // Swap the temporary ID with the real ID from database
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === userId;
    return (
      <View
        style={[
          styles.msgRow,
          { justifyContent: isMe ? "flex-end" : "flex-start" },
        ]}
      >
        <View
          style={[
            styles.msgBubble,
            isMe ? styles.bubbleMe : styles.bubbleSupport,
            // Visual cue for pending messages (optional)
            item.pending && { opacity: 0.7 },
          ]}
        >
          <Text
            style={[styles.msgText, isMe ? styles.textMe : styles.textSupport]}
          >
            {item.message_text}
          </Text>
          <Text
            style={[
              styles.msgTime,
              isMe ? { color: "#e0e0e0" } : { color: "#888" },
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { flexDirection: flexDir, paddingTop: Math.max(insets.top, 20) },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 5 }}
        >
          <ArrowLeft
            size={24}
            color="#333"
            style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {subject}
          </Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View
          style={[
            styles.inputContainer,
            {
              flexDirection: flexDir,
              paddingBottom:
                Platform.OS === "ios" ? Math.max(insets.bottom, 10) : 10,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { textAlign: isRTL ? "right" : "left" }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("typeMessage") || "Type a message..."}
            multiline
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
            <Send
              size={20}
              color="white"
              style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  header: {
    backgroundColor: "white",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
  },
  headerTitle: { fontSize: 16, fontFamily: "Tajawal_700Bold", color: "#333" },
  msgRow: { flexDirection: "row", marginBottom: 10 },
  msgBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 15,
  },
  bubbleMe: {
    backgroundColor: "#4f26afff",
    borderBottomRightRadius: 2,
  },
  bubbleSupport: {
    backgroundColor: "white",
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  msgText: { fontSize: 15, fontFamily: "Tajawal_500Medium" },
  textMe: { color: "white" },
  textSupport: { color: "#333" },
  msgTime: {
    fontSize: 10,
    marginTop: 5,
    alignSelf: "flex-end",
    fontFamily: "Tajawal_400Regular",
  },
  inputContainer: {
    backgroundColor: "white",
    paddingTop: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    backgroundColor: "#e6e6e6ff",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 45,
    marginBottom: 10, // Reduced from 50 to look better
    fontFamily: "Tajawal_400Regular",
  },
  sendBtn: {
    marginBottom: 10, // Reduced from 50
    width: 45,
    height: 45,
    backgroundColor: "#4f26afff",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
});
