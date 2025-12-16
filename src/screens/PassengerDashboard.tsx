import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedRoute from "../components/AnimatedRoute";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapViewDirections from "react-native-maps-directions";
import { GooglePlacesAutocompleteRef } from "react-native-google-places-autocomplete";
import {
  useFonts,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from "@expo-google-fonts/tajawal";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Keyboard,
  I18nManager,
  Platform,
  LayoutAnimation,
  Image,
  FlatList,
  Modal,
  Animated,
  Easing,
  BackHandler,
  Vibration,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { RideStatus, RideRequest, SavedPlace } from "../types";
import {
  ArrowLeft,
  Search,
  Star,
  Phone,
  Car,
  X,
  Navigation as NavIcon,
  Home,
  Briefcase,
  MapPin,
  Menu,
  Clock,
  Wallet, // <--- ADD THIS
  Banknote, // <--- ADD THIS
  Check,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// =================================================================
// 1. CONFIGURATION
// =================================================================
const GOOGLE_API_KEY = "AIzaSyBmq7ZMAkkbnzvEywiWDlX1sO6Pu27sJrU";
const { width, height } = Dimensions.get("window");

const CUSTOM_MAP_STYLE = [
  // --- 1. FORCE LIGHT MODE COLORS ---
  {
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }],
  },
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

  // --- 2. YOUR SPECIFIC OVERRIDES (Keep these at the bottom) ---
  {
    featureType: "poi.business",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "on" }],
  },
];
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("ride-updates", {
      name: "Ride Updates",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      sound: "push.wav", // Ensure this file exists in android/app/src/main/res/raw if using custom sound
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return;
    }

    // Get the token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("PASSENGER PUSH TOKEN:", token);

    // Save to Supabase
    await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId);
  } else {
    console.log("Must use physical device for Push Notifications");
  }
}

export default function PassengerDashboard({ session, navigation }: any) {
  const { t, language } = useLanguage();
  const mapRef = useRef<MapView>(null);
  const pinTranslateY = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  const confirmSheetAnim = useRef(new Animated.Value(height + 100)).current;
  // --- SMART RTL HELPERS ---
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDir = isRTL ? "row-reverse" : "row";

  // For absolute positioned items (Menu/Back buttons)
  // If RTL, we want them on the Right edge? usually Back is Top-Left in English, Top-Right in Arabic
  const menuBtnPos = isRTL ? { right: 20 } : { left: 20 };
  const backBtnPos = isRTL ? { right: 20 } : { left: 20 };

  // State
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );

  const handlePickupSelected = (data: any, details: any) => {
    if (!details) return;

    // 1. Commit the Text immediately
    if (pickupRef.current) {
      pickupRef.current.setAddressText(data.description);
      pickupRef.current.blur(); // Close the keyboard
    }

    // 2. Update the State
    const newPickup = {
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      address: data.description,
    };

    setPickupCoords(newPickup);

    // 3. Animate Map
    mapRef.current?.animateToRegion({
      latitude: newPickup.latitude,
      longitude: newPickup.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    });

    // 4. Clean up UI
    setPickupListVisible(false);
    setIsTyping(false);
    Keyboard.dismiss();
  };

  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  const [routeDetails, setRouteDetails] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);

  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
  } | null>(null);

  const [tempDropoff, setTempDropoff] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);

  const [balance, setBalance] = useState(0);
  const previousBalance = useRef<number>(0);
  const previousViewMode = useRef(viewMode);
  const pickupRef = useRef<GooglePlacesAutocompleteRef>(null);
  const googlePlacesRef = useRef<GooglePlacesAutocompleteRef>(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [fare, setFare] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [driverDetails, setDriverDetails] = useState<any>(null);

  const [viewMode, setViewMode] = useState<
    "IDLE" | "SEARCHING" | "CONFIRM" | "RIDE" | "CHOOSE_ON_MAP"
  >("IDLE");
  const [selectedType, setSelectedType] = useState<"STANDARD" | "TAXI">(
    "STANDARD"
  );

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "WALLET">("CASH");
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);

  const [hoverLocation, setHoverLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);

  const [isMapMoving, setIsMapMoving] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState<any[]>([]);
  const [isPickupListVisible, setPickupListVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(height + 100)).current;

  const prevStatusRef = useRef<string | null>(null);
  const isSelectionRef = useRef(false);

  const handlePlaceSelected = (data: any, details: any) => {
    if (!details) return;

    // 1. Close dropdown
    if (googlePlacesRef.current) {
      googlePlacesRef.current.setAddressText(data.description);
      googlePlacesRef.current.blur();
    }

    // 2. Prepare Data
    const selectedLocation = {
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      address: data.description,
    };

    setTempDropoff(selectedLocation);

    // 3. SAVE TO STATE & ASYNC STORAGE
    setRecentPlaces((prev) => {
      // Remove duplicates
      const filtered = prev.filter(
        (p) => p.address !== selectedLocation.address
      );
      // Add new to top, keep max 3
      const updated = [selectedLocation, ...filtered].slice(0, 3);

      // Save to device storage
      AsyncStorage.setItem("@recent_places", JSON.stringify(updated)).catch(
        (err) => console.error("Failed to save recent place", err)
      );

      return updated;
    });

    // 4. Cleanup
    Keyboard.dismiss();
    setIsTyping(false);
  };
  const onRecentPlacePress = (place: any) => {
    // Populate Search Bar
    if (googlePlacesRef.current) {
      googlePlacesRef.current.setAddressText(place.address);
      googlePlacesRef.current.blur();
    }
    // Set Temp Dropoff (Shows Next Button)
    setTempDropoff({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
    });
    // Hide Keyboard
    Keyboard.dismiss();
    setIsTyping(false);
  };
  const handleNextPress = async () => {
    if (!tempDropoff || !pickupCoords) return;

    setLoading(true);

    // 1. Commit the temp location to the real state
    setDropoffCoords(tempDropoff);
    setFare(null);

    // 2. Perform Calculation
    const result = await calculateRouteAndFare(pickupCoords, tempDropoff);

    if (result) {
      setFare(result.price);
      setRouteDetails(result.details);

      // 3. Switch View
      setViewMode("CONFIRM");

      // 4. Animate Map
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([pickupCoords, tempDropoff], {
          edgePadding: { top: 140, right: 60, left: 60, bottom: height * 0.5 },
          animated: true,
        });
      }, 500);
    } else {
      Alert.alert("Error", "Could not calculate route.");
    }

    setLoading(false);

    // Clear temp so it resets for next time
    setTempDropoff(null);
  };

  useEffect(() => {
    if (viewMode === "SEARCHING") {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }).start();

      if (googlePlacesRef.current) {
        googlePlacesRef.current.setAddressText("");
        // ADD THIS: Manually focus Dropoff once when search opens
        setTimeout(() => {
          googlePlacesRef.current?.focus();
        }, 100);
      }
      setTempDropoff(null);
      setIsTyping(false);
    } else {
      // ... (keep existing close logic) ...
      Animated.timing(slideAnim, {
        toValue: height + 100,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start();

      Keyboard.dismiss();
    }
  }, [viewMode]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // 1. Set the State
      const address = t("currentLocation");
      setPickupCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: address,
      });

      // 2. Set the Text Input MANUALLY (Fire and Forget)
      if (pickupRef.current) {
        pickupRef.current.setAddressText(address);
      }
    })();

    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id);
    }

    // 3. NEW: Handle Notification Taps (Background/Killed state)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // When user taps the notification, check for the ride immediately
        console.log("Passenger tapped notification");
        checkActiveRide();
      }
    );
    checkActiveRide();
  }, []);

  const fetchSavedPlaces = async () => {
    const { data } = await supabase
      .from("saved_places")
      .select("*")
      .eq("user_id", session.user.id);

    if (data) setSavedPlaces(data);
  };

  useFocusEffect(
    useCallback(() => {
      fetchSavedPlaces();
    }, [])
  );

  const onSavedPlacePress = (place: SavedPlace) => {
    setDropoffCoords({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
    });
  };

  useEffect(() => {
    const USER_FOCUS_MODES = ["IDLE", "CHOOSE_ON_MAP"];
    if (USER_FOCUS_MODES.includes(viewMode) && location && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          pitch: 0,
          heading: 0,
          zoom: 15,
        },
        { duration: 1000 }
      );
    }
  }, [viewMode, location]);

  const checkActiveRide = async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", session.user.id)
      // 👇 CHANGE THIS LINE: Add "ARRIVED" to the list
      .in("status", ["PENDING", "ACCEPTED", "ARRIVED", "IN_PROGRESS"])
      .single();

    if (data) {
      setCurrentRide(data);

      // If we have saved stats (from the previous step), restore them now
      if (data.distance_text || data.duration_text) {
        setRouteDetails({
          distance: data.distance_text,
          duration: data.duration_text,
        });
      }

      if (data.driver_id) fetchDriverDetails(data.driver_id);

      // This switches the screen immediately to the Ride view
      setViewMode("RIDE");
    }
  };

  useEffect(() => {
    if (!currentRide?.id) return;
    const channel = supabase
      .channel(`ride:${currentRide.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${currentRide.id}`,
        },
        (payload) => {
          const updated = payload.new as RideRequest;
          setCurrentRide(updated);
          if (
            updated.status === "ACCEPTED" &&
            updated.driver_id &&
            !driverDetails
          ) {
            fetchDriverDetails(updated.driver_id);
          }
          if (
            updated.status === "COMPLETED" ||
            updated.status === "CANCELLED"
          ) {
            resetState();
            Alert.alert(t("update"), t("rideEnded"));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRide?.id]);

  const fetchDriverDetails = async (driverId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", driverId)
      .single();
    if (data) setDriverDetails(data);
  };

  const resetState = () => {
    setCurrentRide(null);
    setDriverDetails(null);
    setDropoffCoords(null);
    setFare(null);
    setViewMode("IDLE");
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (currentRide?.status === "PENDING") {
      timeout = setTimeout(async () => {
        Alert.alert(
          t("noDrivers") || "No Drivers Found",
          t("tryAgainLater") || "Please try again later.",
          [
            {
              text: "OK",
              onPress: async () => {
                await supabase
                  .from("rides")
                  .update({ status: "NO_DRIVERS_AVAILABLE" })
                  .eq("id", currentRide.id);
                resetState();
              },
            },
          ]
        );
      }, 60000);
    }
    return () => clearTimeout(timeout);
  }, [currentRide?.status]);
  /*
  useEffect(() => {
    if (pickupCoords && dropoffCoords && !fare) {
      (async () => {
        try {
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${pickupCoords.latitude},${pickupCoords.longitude}&destination=${dropoffCoords.latitude},${dropoffCoords.longitude}&key=${GOOGLE_API_KEY}`
          );
          const data = await resp.json();
          if (data.routes.length) {
            const leg = data.routes[0].legs[0];
            setRouteDetails({
              distance: leg.distance.text,
              duration: leg.duration.text,
            });
          }
        } catch (err) {
          console.error("Route Error", err);
        }

        const { data: price, error } = await supabase.rpc(
          "calculate_fare_estimate",
          {
            pickup_lat: pickupCoords.latitude,
            pickup_lng: pickupCoords.longitude,
            dropoff_lat: dropoffCoords.latitude,
            dropoff_lng: dropoffCoords.longitude,
          }
        );

        if (error) {
          console.error("Pricing Error:", error);
          Alert.alert("Error", "Could not calculate fare.");
          return;
        }

        if (price) setFare(price);
        Keyboard.dismiss();

        setViewMode("CONFIRM");

        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates([pickupCoords, dropoffCoords], {
              edgePadding: {
                top: 140,
                right: 60,
                left: 60,
                bottom: height * 0.5,
              },
              animated: true,
            });
          }
        }, 500);
      })();
    }
  }, [dropoffCoords]);

  */

  // Inside PassengerDashboard.tsx

useEffect(() => {
  if (!currentRide?.driver_id) return;

  // 1. Fetch Initial Position (so car appears immediately)
  const fetchInitialLocation = async () => {
    const { data } = await supabase
      .from("driver_locations")
      .select("lat, lng, heading") // <--- include heading if you added it
      .eq("driver_id", currentRide.driver_id)
      .single();

    if (data) {
      setDriverLocation({
        latitude: data.lat,
        longitude: data.lng,
        heading: data.heading || 0,
      });
    }
  };
  fetchInitialLocation();

  // 2. Realtime Listener (Handles MOVEMENT + OFFLINE)
  const channel = supabase
    .channel(`driver_loc:${currentRide.driver_id}`)
    .on(
      "postgres_changes",
      {
        event: "*", // <--- CHANGE THIS: Listen to ALL events (INSERT, UPDATE, DELETE)
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${currentRide.driver_id}`,
      },
      (payload) => {
        // CASE A: Driver went offline (Row Deleted)
        if (payload.eventType === "DELETE") {
          console.log("Driver went offline - Removing icon");
          setDriverLocation(null); // <--- This makes the car disappear instantly!
        } 
        
        // CASE B: Driver moved (Row Updated or Inserted)
        else if (payload.new) {
          const newLoc = payload.new;
          if (newLoc.lat && newLoc.lng) {
            setDriverLocation({
              latitude: newLoc.lat,
              longitude: newLoc.lng,
              heading: newLoc.heading || 0,
            });
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentRide?.driver_id]);

  useEffect(() => {
    // 1. Initial Balance Fetch
    const fetchBalance = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", session.user.id)
        .single();
      if (data) {
        setBalance(data.balance);
        previousBalance.current = data.balance;
      }
    };
    fetchBalance();

    // 2. Setup Realtime Subscriptions
    const channel = supabase
      .channel("passenger_updates")

      // A) Listen for BALANCE UPDATES (Just update the number)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const newBal = payload.new.balance;
          setBalance(newBal); // Just update the UI text
          previousBalance.current = newBal;
        }
      )

      // B) Listen for NEW DEBTS (Trigger the Alert Modal IMMEDIATELY)
      .on(
        "postgres_changes",
        {
          event: "INSERT", // Triggers the moment driver clicks 'Confirm'
          schema: "public",
          table: "payment_disputes",
          filter: `passenger_id=eq.${session.user.id}`,
        },
        (payload) => {
          // Immediately show the modal with the exact amount from the driver
          console.log("New dispute received:", payload.new);
          setReportData({ amount: payload.new.missing_amount });
          setIsReportModalVisible(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const checkForMissedDisputes = async () => {
      const { data: recentDisputes } = await supabase
        .from("payment_disputes")
        .select("*")
        .eq("passenger_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentDisputes && recentDisputes.length > 0) {
        const lastDispute = recentDisputes[0];
        const disputeTime = new Date(lastDispute.created_at).getTime();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        if (disputeTime > oneDayAgo) {
          const { data: existingReport } = await supabase
            .from("user_reports")
            .select("id")
            .eq("ride_id", lastDispute.ride_id)
            .single();

          if (!existingReport) {
            setReportData({ amount: lastDispute.missing_amount });
            setIsReportModalVisible(true);
          }
        }
      }
    };

    checkForMissedDisputes();
  }, []);

  useEffect(() => {
    if (viewMode === "CONFIRM") {
      Animated.timing(confirmSheetAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }).start();
    } else {
      Animated.timing(confirmSheetAnim, {
        toValue: height + 100, // Slide it down off-screen
        duration: 300,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start();
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [viewMode, currentRide?.status]);

  useEffect(() => {
    const loadRecentPlaces = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem("@recent_places");
        if (jsonValue != null) {
          setRecentPlaces(JSON.parse(jsonValue));
        }
      } catch (e) {
        console.error("Failed to load recent places", e);
      }
    };
    loadRecentPlaces();
  }, []);

  useEffect(() => {
    if (!currentRide) return;

    // MODIFIED: Logic now runs whenever the status changes (and is not the first load)
    if (prevStatusRef.current && currentRide.status !== prevStatusRef.current) {
      // 1. Vibrate (Optional: remove this line if you only want sound)
      Vibration.vibrate([0, 400, 100, 400]);

      // 2. Play Sound
      const playStatusSound = async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/push.wav")
          );
          await sound.playAsync();
        } catch (error) {
          console.log("Could not play status sound:", error);
        }
      };

      playStatusSound();
    }

    // Update the ref so we know what the status was for the next comparison
    prevStatusRef.current = currentRide.status;
  }, [currentRide?.status]);

  useEffect(() => {
    const onBackPress = () => {
      // If we are in a ride, DISABLE the back button
      if (viewMode === "RIDE") {
        return true; // true = prevent default behavior (don't go back)
      }

      // If we are in search/confirm mode, go back to IDLE instead of exiting app
      if (
        viewMode === "SEARCHING" ||
        viewMode === "CONFIRM" ||
        viewMode === "CHOOSE_ON_MAP"
      ) {
        setViewMode("IDLE");
        setDropoffCoords(null);
        return true;
      }

      return false; // Let default behavior happen (exit app or go back)
    };

    // ✅ FIX: Capture the subscription object
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    // ✅ FIX: Use .remove() on the subscription
    return () => backHandler.remove();
  }, [viewMode]);

  const handleReportFraud = async () => {
    setIsReportModalVisible(false);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: session.user.id,
      ride_id: currentRide?.id || null,
      driver_id: currentRide?.driver_id || null,
      type: "FRAUD_DEBT",
      description: `User flagged a debt of ${reportData?.amount} DA as false.`,
    });

    if (!error) {
      Alert.alert("Report Received", "...");
    } else {
      console.log("Reporting Error:", error.message);
      Alert.alert("Error", "Could not submit report: " + error.message);
    }
  };
  // ---------------------------------------------------------
  // HELPER: Calculate Route & Price (Manually)
  // ---------------------------------------------------------
  const calculateRouteAndFare = async (pickupObj: any, dropoffObj: any) => {
    try {
      console.log("Starting manual calculation...");

      // 1. Get Distance/Duration from Google
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${pickupObj.latitude},${pickupObj.longitude}&destination=${dropoffObj.latitude},${dropoffObj.longitude}&key=${GOOGLE_API_KEY}`
      );
      const data = await resp.json();

      let details = { distance: "0 km", duration: "0 min" };

      if (data.routes.length) {
        const leg = data.routes[0].legs[0];
        details = {
          distance: leg.distance.text,
          duration: leg.duration.text,
        };
      }

      // 2. Get Price from Supabase
      const { data: price, error } = await supabase.rpc(
        "calculate_fare_estimate",
        {
          pickup_lat: pickupObj.latitude,
          pickup_lng: pickupObj.longitude,
          dropoff_lat: dropoffObj.latitude,
          dropoff_lng: dropoffObj.longitude,
        }
      );
      console.log("Price Calculated");

      if (error) throw error;

      return { price, details };
    } catch (err) {
      console.error("Calculation Error", err);
      return null;
    }
  };
  const handleRequestRide = async () => {
    if (!pickupCoords || !dropoffCoords) return;
    setLoading(true);

    try {
      // ⚠️ IMPORTANT: Replace 192.168.1.5 with YOUR IP from ipconfig
      // Keep the :3000/rides/request part
      const API_URL = "https://my-ride-service.onrender.com/rides/request";
      // const API_URL = "http://192.168.1.11:3000/rides/request";

      console.log("SENDING RIDE REQUEST:", {
        pickupAddr: pickupCoords.address,
        dropoffAddr: dropoffCoords.address,
      });

      console.log("Sending request to:", API_URL);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passengerId: session.user.id,
          pickup: { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
          dropoff: {
            lat: dropoffCoords.latitude,
            lng: dropoffCoords.longitude,
          },

          // ✅ FORCE A STRING IF EMPTY
          pickupAddress: pickupCoords.address || "Unknown Pickup",
          dropoffAddress: dropoffCoords.address || "Unknown Dropoff",

          fare: fare,
          paymentMethod: paymentMethod,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Server Error");
      }

      console.log("Ride Created:", responseData.id);

      // Success! Update UI
      setCurrentRide(responseData);
      setViewMode("RIDE");
    } catch (error: any) {
      console.error("Ride Request Error:", error);
      Alert.alert(
        "Connection Error",
        "Make sure your backend server is running and the IP is correct.\n\n" +
          error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;
    await supabase
      .from("rides")
      .update({ status: "CANCELLED" })
      .eq("id", currentRide.id);
    resetState();
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const address = await getAddressFromCoords(latitude, longitude);
    setDropoffCoords({
      latitude,
      longitude,
      address: address || "Tapped Location",
    });
    setViewMode("CONFIRM");
  };

  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      return null;
    } catch (error) {
      console.error("Reverse Geocoding Error:", error);
      return null;
    }
  };

  const onRegionChangeComplete = async (region: any) => {
    if (viewMode !== "CHOOSE_ON_MAP") return;

    Animated.spring(pinTranslateY, {
      toValue: 0,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    setIsMapMoving(false);

    const newLocation = {
      latitude: region.latitude,
      longitude: region.longitude,
      address: t("loading") || "Loading...",
    };
    setHoverLocation(newLocation);

    try {
      const address = await getAddressFromCoords(
        region.latitude,
        region.longitude
      );
      setHoverLocation({
        ...newLocation,
        address: address || "Unknown Location (Check API Key)",
      });
    } catch (err) {
      console.error("Geocoding Error:", err);
      setHoverLocation({
        ...newLocation,
        address: "Error retrieving address",
      });
    }
  };

  const onRegionChange = () => {
    if (viewMode === "CHOOSE_ON_MAP") {
      setIsMapMoving(true);
      Animated.timing(pinTranslateY, {
        toValue: -25,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {viewMode === "IDLE" && (
        <SafeAreaView style={[styles.menuBtnContainer, menuBtnPos]}>
          <TouchableOpacity
            onPress={() => navigation.navigate("MenuScreen")}
            style={styles.menuBtnShadow}
          >
            <Menu size={28} color="#1F2937" />
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* --- MAP LAYER --- */}
      {/* --- MAP LAYER --- */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={CUSTOM_MAP_STYLE}
        userInterfaceStyle="light" // <--- ADD THIS LINE
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapPadding={{
          top: 0,
          right: 0,
          bottom: viewMode === "CONFIRM" ? height * 0.45 : 20,
          left: 0,
        }}
        initialRegion={{
          latitude: location?.coords.latitude || 36.75,
          longitude: location?.coords.longitude || 3.05,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={(e) => {
          // Prevent map taps from disrupting the UI if in RIDE mode
          if (viewMode === "CHOOSE_ON_MAP" || viewMode === "RIDE") return;
          handleMapPress(e);
        }}
      >
        {pickupCoords &&
          viewMode !== "IDLE" &&
          viewMode !== "SEARCHING" &&
          viewMode !== "CHOOSE_ON_MAP" && (
            <Marker coordinate={pickupCoords} title={t("pickup")}>
              <View style={styles.markerCircle}>
                <View
                  style={[styles.markerDot, { backgroundColor: "green" }]}
                />
              </View>
            </Marker>
          )}
        {dropoffCoords && (
          <Marker coordinate={dropoffCoords} title={t("dropoff")}>
            <View style={styles.markerCircle}>
              <View style={[styles.markerDot, { backgroundColor: "black" }]} />
            </View>
          </Marker>
        )}

        {driverLocation && viewMode === "RIDE" && (
          <Marker coordinate={driverLocation} title={t("driver") || "Driver"}>
  {/* No View container needed if you just want the car image directly */}
  <Image 
    source={require('../assets/car-top-view.png')} // <--- Make sure you have this file
    style={{
      width: 40,  // Adjust size to match your map zoom
      height: 40, // Top-down cars are usually rectangular
      resizeMode: 'contain',
      transform: [{ rotate: `${driverLocation.heading || 0}deg` }] // <--- Rotates car with direction!
    }}
  />
</Marker>
        )}
        {pickupCoords && dropoffCoords && (
          <AnimatedRoute
            pickup={{
              latitude: pickupCoords.latitude,
              longitude: pickupCoords.longitude,
            }}
            dropoff={{
              latitude: dropoffCoords.latitude,
              longitude: dropoffCoords.longitude,
            }}
          />
        )}
      </MapView>

      {(viewMode === "SEARCHING" || viewMode === "CONFIRM") && (
        <SafeAreaView style={[styles.topContainer, backBtnPos]}>
          <TouchableOpacity
            onPress={() => {
              if (viewMode === "SEARCHING") setViewMode("IDLE");
              if (viewMode === "CONFIRM") {
                setDropoffCoords(null);
                setViewMode("SEARCHING");
              }
            }}
            style={styles.backBtn}
          >
            <ArrowLeft
              color="#333"
              size={24}
              style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
            />
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {viewMode === "IDLE" && (
        <View style={styles.bottomSheet}>
          <TouchableOpacity
            style={[styles.searchTrigger, { flexDirection: flexDir }]}
            onPress={() => setViewMode("SEARCHING")}
          >
            <Text style={[styles.searchTriggerText, { marginHorizontal: 10 }]}>
              {t("searchPlaceholder")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        style={[
          styles.searchOverlay,
          {
            transform: [{ translateY: slideAnim }],
            zIndex: 100,
            elevation: 50,
          },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <View style={[styles.searchHeader, { flexDirection: flexDir }]}>
              {/* 1. Title with dynamic text alignment */}
              <Text style={[styles.headerTitle, { textAlign: alignText }]}>
                {t("searchForPlace")}
              </Text>

              {/* 2. Close Button */}
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setTempDropoff(null);
                  setTimeout(() => {
                    setViewMode("IDLE");
                  }, 100);
                }}
                style={styles.closeSearchBtn}
              >
                <X size={24} color="#7c7c7cff" />
              </TouchableOpacity>
            </View>

            {/* --- BLOCK 1: Search Inputs (Inside the Container) --- */}
            <View
              style={[styles.searchInputContainer, { flexDirection: flexDir }]}
            >
              <View style={styles.timelineDecor}>
                <View style={[styles.dot, { backgroundColor: "#ffffffff" }]} />
                <View style={styles.line} />
                <View style={[styles.dot1, { backgroundColor: "white" }]} />
              </View>

              <View style={{ flex: 1, gap: 15 }}>
                {/* Pickup Input */}
                <GooglePlacesAutocomplete
                  ref={pickupRef}
                  placeholder={t("pickup") || "Pickup Location"}
                  debounce={400}
                  keyboardShouldPersistTaps="always"
                  fetchDetails={true}
                  enablePoweredByContainer={false}
                  // 1. Control List Visibility
                  // listViewDisplayed={isPickupListVisible}
                  // 2. MIRROR DROPOFF: Clean Input Props
                  textInputProps={{
                    placeholderTextColor: "#9ca3af",
                    returnKeyType: "search",
                    // Simple logic: If text exists, show list. If empty, hide list.
                    onChangeText: (text) => {
                      setPickupListVisible(text.length > 0);
                      setIsTyping(text.length > 0);
                    },
                    onFocus: () => setPickupListVisible(true),
                  }}
                  // 3. MIRROR DROPOFF: Exact OnPress Logic
                  onPress={(data, details = null) => {
                    handlePickupSelected(data, details);
                  }}
                  query={{
                    key: GOOGLE_API_KEY,
                    language: language,
                    components: "country:dz",
                    radius: 10000,
                    location: location
                      ? `${location.coords.latitude},${location.coords.longitude}`
                      : "",
                  }}
                  renderRightButton={() => (
                    <TouchableOpacity
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 11,
                        zIndex: 100,
                      }}
                      onPress={() => {
                        pickupRef.current?.setAddressText("");
                        setPickupCoords(null);
                        setPickupListVisible(false);
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: "#c5c5c5",
                          borderRadius: 15,
                          padding: 2,
                        }}
                      >
                        <X size={18} color="white" />
                      </View>
                    </TouchableOpacity>
                  )}
                  styles={{
                    container: {
                      flex: 0,
                      zIndex: 60,
                      elevation: 60,
                    },
                    textInputContainer: {
                      padding: 0,
                      margin: 0,
                      borderTopWidth: 0,
                      borderBottomWidth: 0,
                    },
                    textInput: {
                      backgroundColor: "#ffffffff",
                      height: 45,
                      paddingHorizontal: 10,
                      paddingRight: 40,
                      borderColor: "#a5a5a5ff",
                      borderBottom: 1,
                      fontSize: 15,
                      textAlign: alignText,
                      color: "#000",
                      fontFamily: "Tajawal_500Medium",
                    },
                    listView: {
                      position: "absolute",
                      top: 50,
                      zIndex: 2000,
                      elevation: 2000,
                      backgroundColor: "white",
                      width: "120%",
                      marginTop: 5,
                      maxHeight: 350,
                      borderRadius: 5,
                      borderColor: "#ddd",
                      borderWidth: 0,
                      // 👇 ADD THIS LINE TO MATCH DROPOFF LOGIC 👇
                      display: isPickupListVisible ? "flex" : "none",
                    },
                    description: {
                      fontFamily: "Tajawal_500Medium",
                      textAlign: alignText,
                    },
                    row: {
                      padding: 13,
                      height: 50,
                      flexDirection: flexDir,
                    },
                  }}
                />

                {/* Dropoff Input */}
                <GooglePlacesAutocomplete
                  ref={googlePlacesRef}
                  placeholder={t("searchPlaceholder")}
                  debounce={400}
                  keyboardShouldPersistTaps="always"
                  textInputProps={{
                    onChangeText: (text) => {
                      setTempDropoff(null);
                      setIsTyping(text.length > 0);
                    },
                  }}
                  renderRightButton={() => (
                    <TouchableOpacity
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 11,
                        zIndex: 100,
                      }}
                      onPress={() => {
                        googlePlacesRef.current?.setAddressText("");
                        setIsTyping(false);
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: "#c5c5c5",
                          borderRadius: 15,
                          padding: 2,
                        }}
                      >
                        <X size={18} color="white" />
                      </View>
                    </TouchableOpacity>
                  )}
                  fetchDetails={true}
                  enablePoweredByContainer={false}
                  onPress={(data, details = null) => {
                    handlePlaceSelected(data, details);
                    setIsTyping(false);
                  }}
                  query={{
                    key: GOOGLE_API_KEY,
                    language: language,
                    components: "country:dz",
                    radius: 10000,
                    location: location
                      ? `${location.coords.latitude},${location.coords.longitude}`
                      : "",
                    types: "",
                    strictbounds: false,
                  }}
                  styles={{
                    container: {
                      flex: 0,
                      zIndex: 50,
                      elevation: 10,
                    },
                    textInputContainer: { padding: 0, margin: 0 },
                    textInput: {
                      backgroundColor: "#ffffffff",
                      height: 45,
                      paddingHorizontal: 10,
                      paddingRight: 40,
                      borderColor: "#a5a5a5ff",
                      borderWidth: 0,
                      fontSize: 15,
                      textAlign: alignText,
                      color: "#000",
                      zIndex: 100,
                      fontFamily: "Tajawal_500Medium",
                    },
                    listView: {
                      position: "absolute",
                      top: 50,
                      zIndex: 1000,
                      elevation: 1000,
                      backgroundColor: "white",
                      width: "120%",
                      paddingHorizontal: 10,
                      marginTop: 5,
                      maxHeight: 250,
                      display: tempDropoff || !isTyping ? "none" : "flex",
                    },
                    description: {
                      fontFamily: "Tajawal_500Medium",
                      textAlign: alignText,
                    },
                    row: {
                      padding: 13,
                      height: 50,
                      flexDirection: flexDir,
                    },
                  }}
                />
              </View>
            </View>
            {/* --- END OF SEARCH INPUT CONTAINER --- */}

            {/* --- BLOCK 2: Moved Elements (Outside the Container) --- */}
            {/* Added a margin top to separate it from the search box above */}
            <View style={{ marginTop: 15, paddingHorizontal: 10 }}>
              {/* Set Location On Map Button */}
              <TouchableOpacity
                style={{
                  flexDirection: flexDir,
                  alignItems: "center",
                  backgroundColor: "white",
                  marginBottom: 10,
                  paddingVertical: 10, // Increased padding since it's now standalone
                  borderRadius: 10, // Added border radius to make it look like a button
                  paddingHorizontal: 0, // Added horizontal padding
                }}
                onPress={() => {
                  if (location) {
                    setHoverLocation({
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                      address: t("loading") || "Loading...",
                    });
                  }
                  setViewMode("CHOOSE_ON_MAP");
                }}
              >
                <View style={{ marginRight: 0, marginLeft: 10 }}>
                  <MapPin size={25} color="#be14beff" />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#1F2937",
                    fontFamily: "Tajawal_700Bold",
                    textAlign: alignText,
                  }}
                >
                  {t("setLocationOnMap") || "Set location on map"}
                </Text>
              </TouchableOpacity>

              {/* Recent Places List */}
              {recentPlaces.length > 0 && (
                <View
                  style={{
                    marginBottom: 15,
                    backgroundColor: "white",
                    padding: 0,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: "#474747ff",
                      fontFamily: "Tajawal_700Bold",
                      marginBottom: 8,
                      textAlign: alignText,
                    }}
                  >
                    {t("recent")}
                  </Text>
                  {recentPlaces.map((place, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => onRecentPlacePress(place)}
                      style={{
                        flexDirection: flexDir,
                        alignItems: "center",
                        paddingVertical: 8, // Increased slightly for better touch
                        borderBottomWidth:
                          index === recentPlaces.length - 1 ? 0 : 1, // Remove border from last item
                        borderBottomColor: "#f3f4f6",
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: isRTL ? 0 : 0,
                          marginLeft: isRTL ? 0 : 0,
                        }}
                      >
                        <Clock size={20} color="#be14beff" />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: 15,
                          color: "#374151",
                          fontFamily: "Tajawal_500Medium",
                          textAlign: alignText,
                        }}
                      >
                        {place.address}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Favorites / Saved Places */}
              <View style={[styles.recentContainer, { marginTop: 5 }]}>
                <View
                  style={{
                    flexDirection: flexDir,
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    paddingHorizontal: 0,
                  }}
                >
                  <Text
                    style={{
                      color: "#444444ff",
                      fontFamily: "Tajawal_700Bold",
                      paddingHorizontal: 0,
                    }}
                    writingDirection={isRTL ? "rtl" : "ltr"}
                  >
                    {t("favorites")}
                  </Text>

                  <TouchableOpacity
                    onPress={() => navigation.navigate("AddSavedPlace")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={{
                        color: "#4f26afff",
                        fontSize: 15,
                        fontFamily: "Tajawal_700Bold",
                        paddingHorizontal: 8,
                      }}
                      writingDirection={isRTL ? "rtl" : "ltr"}
                    >
                      {t("add")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  horizontal
                  inverted={isRTL}
                  data={savedPlaces}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  ListEmptyComponent={
                    <Text
                      style={{
                        marginBottom: 20,
                        color: "#444444ff",
                        fontSize: 12,
                      }}
                    >
                      No saved places yet
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.recentItem}
                      onPress={() => onSavedPlacePress(item)}
                    >
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: "#444444ff" },
                        ]}
                      >
                        {item.label === "Home" ? (
                          <Home size={20} color="white" />
                        ) : item.label === "Work" ? (
                          <Briefcase size={20} color="white" />
                        ) : (
                          <Star size={20} color="white" />
                        )}
                      </View>
                      <Text style={styles.recentText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </View>
        </SafeAreaView>
        {tempDropoff && (
          <View
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              zIndex: 200, // Ensure it's above the list
            }}
          >
            <TouchableOpacity
              onPress={handleNextPress}
              style={{
                backgroundColor: "#4f26afff",
                height: 55,
                borderRadius: 30,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 40,

                elevation: 5,
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 2 },
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{
                    color: "white",
                    fontSize: 18,
                    fontFamily: "Tajawal_700Bold",
                    textAlign: "center", // <--- Good practice to keep centered
                    includeFontPadding: false, // <--- Fix vertical alignment on Android
                  }}
                >
                  {t("next")} {/* <--- CHANGED */}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.confirmSheet,
          {
            transform: [{ translateY: confirmSheetAnim }],
            zIndex: viewMode === "CONFIRM" ? 50 : -1, // Hide behind map when inactive
          },
        ]}
      >
        {/* Only render inner content if fare exists to prevent empty box glitches */}
        {fare ? (
          <>
            <View
              style={{
                justifyContent: "center", // 1. Center content horizontally
                alignItems: "center", // 2. Align items in center
                marginBottom: 10,
                paddingHorizontal: 4,
                width: "100%", // 3. Ensure it takes full width
              }}
            >
              <View
                style={{
                  flexDirection: "column",
                  alignItems: "center", // 4. Force items inside to center
                }}
              >
                {/* Price */}
                <Text style={styles.carPrice}>{fare} DA</Text>

                {/* Time & Distance */}
                {routeDetails && (
                  <View
                    style={[
                      styles.statsBadge,
                      {
                        marginTop: 4,
                        paddingHorizontal: 0,
                        backgroundColor: "transparent",
                        alignSelf: "center", // 5. Center the badge itself
                      },
                    ]}
                  >
                    <Text style={styles.statsText}>
                      {routeDetails.duration} •{" "}
                      <Text style={{ color: "#9ca3af", fontSize: 16 }}>
                        {routeDetails.distance}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* --- ROUTE CONTAINER --- */}
            <View
              style={[styles.routeInfoContainer, { flexDirection: flexDir }]}
            >
              {/* Visual Timeline */}
              <View
                style={{
                  alignItems: "center",
                  marginHorizontal: 10,
                  width: 20,
                }}
              >
                <View style={[styles.dot, { backgroundColor: "#ffffffff" }]} />
                <View
                  style={{
                    width: 1,
                    height: 35,
                    backgroundColor: "#d1d5db",
                    marginVertical: 4,
                  }}
                />
                <MapPin size={16} color="#6caf00ff" fill="#f3f3f3ff" />
              </View>

              {/* Addresses */}
              <View style={{ flex: 1, justifyContent: "space-between" }}>
                <View style={{ marginBottom: 12 }}>
                  <Text
                    numberOfLines={1}
                    style={[styles.routeText, { textAlign: alignText }]}
                  >
                    {pickupCoords?.address || "Pickup Location"}
                  </Text>
                </View>
                <View>
                  <Text
                    numberOfLines={1}
                    style={[styles.routeText, { textAlign: alignText }]}
                  >
                    {dropoffCoords?.address || "Dropoff Location"}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.paymentRow,
                { flexDirection: flexDir, alignItems: "center" },
              ]}
            >
              {/* Left Side: Icon & Text */}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                {paymentMethod === "CASH" ? (
                  <Banknote size={20} color="#426e00ff" />
                ) : (
                  <Wallet size={20} color="#4f26afff" />
                )}

                <Text
                  style={{
                    color: "#f2f2f2ff",
                    fontFamily: "Tajawal_700Bold",
                    fontSize: 16,
                  }}
                >
                  {paymentMethod === "CASH"
                    ? t("cashPayment")
                    : t("payWithBalance") || "Pay with Balance"}
                </Text>
              </View>

              {/* Right Side: Change Button */}
              <TouchableOpacity onPress={() => setIsPaymentModalVisible(true)}>
                <Text
                  style={{
                    color: "#e6e6e6ff", // Purple accent color
                    fontFamily: "Tajawal_700Bold",
                    fontSize: 14,
                    textDecorationLine: "underline",
                  }}
                >
                  {t("change") || "Change"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleRequestRide}
              disabled={loading}
              style={styles.confirmBtn}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.confirmBtnText}>{t("chooseStandard")}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </Animated.View>

      {viewMode === "RIDE" && currentRide && (
        <View style={styles.rideSheet}>
          <View style={styles.rideHeader}>
            {/* 1. The Status Text (Make sure there is NO ActivityIndicator above or next to this) */}
            <Text style={styles.rideStatusText}>
              {currentRide.status === "PENDING"
                ? t("findingDrivers")
                : currentRide.status === "ACCEPTED"
                ? t("driverOnTheWay")
                : currentRide.status === "ARRIVED"
                ? t("driverArrived") || "Driver is here!"
                : currentRide.status === "IN_PROGRESS"
                ? t("enjoyRide")
                : "Arrived"}
            </Text>

            {/* 2. The Time Badge */}
            <View style={styles.timeBadge}>
              <Text
                style={{
                  fontWeight: "bold",
                  fontSize: 12,
                  color: "#ecececff",
                  fontFamily: "Tajawal_500Medium",
                }}
              >
                ~5 min
              </Text>
            </View>
          </View>

          {(currentRide.status === "ACCEPTED" ||
            currentRide.status === "ARRIVED") && (
            <View
              style={{
                alignSelf: "center",
                backgroundColor: "#333333ff",
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                marginTop: 10,

                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 2,
                  fontFamily: "Tajawal_400Regular",
                }}
              >
                {t("giveCodeToDriver") || "PIN Code"}
              </Text>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "900",
                  letterSpacing: 5,
                  color: "#f2f2f2ff",
                  fontFamily: "Tajawal_700Bold",
                }}
              >
                {currentRide.start_code}
              </Text>
            </View>
          )}

          {(currentRide.status === "ACCEPTED" ||
            currentRide.status === "IN_PROGRESS") && (
            <View style={[styles.driverCard, { flexDirection: flexDir }]}>
              <View style={styles.driverAvatar}>
                <Car size={24} color="#4b5563" />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <Text
                  style={[styles.driverName, { textAlign: alignText }]} // FIX
                >
                  {driverDetails?.full_name || "Sammer"}
                </Text>
                <Text
                  style={[styles.driverCar, { textAlign: alignText }]} // FIX
                >
                  {driverDetails?.car_model || "MERCEDES"} •{" "}
                  {driverDetails?.license_plate}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  <Star size={12} color="#fdea39ff" fill="#fdea39ff" />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: "#f2f2f2ff",
                      fontFamily: "Tajawal_500Medium",
                    }}
                  >
                    4.9
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callBtn}>
                <Phone size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {currentRide.status === "PENDING" && (
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <ActivityIndicator size="large" color="#4f26afff" />
            </View>
          )}

          <View style={[styles.tripRow, { flexDirection: flexDir }]}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginHorizontal: 10,
                color: "#eeeeeeff",
                fontFamily: "Tajawal_400Regular",
                textAlign: alignText,
              }}
            >
              {currentRide.dropoff_address}
            </Text>
          </View>

          {currentRide.status !== "IN_PROGRESS" && (
            <TouchableOpacity
              onPress={handleCancelRide}
              style={styles.cancelTextBtn}
            >
              <Text
                style={{
                  color: "#ffffffff",
                  fontWeight: "bold",
                }}
              >
                {t("cancelRequest")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {viewMode === "CHOOSE_ON_MAP" && (
        <View style={styles.centeredPinContainer} pointerEvents="box-none">
          <View style={styles.fixedPin}>
            <Animated.View
              style={{
                transform: [{ translateY: pinTranslateY }],
              }}
            >
              <MapPin size={40} color="#4f26afff" fill="white" />
            </Animated.View>

            <View style={styles.pinShadow} />
          </View>

          <View style={styles.confirmLocationSheet}>
            <Text style={styles.confirmLabel}>
              {t("confirmDestination") || "Confirm Destination"}
            </Text>
            <View style={styles.divider} />
            <View style={styles.addressBox}>
              <View style={[styles.dot, { backgroundColor: "black" }]} />
              <Text
                style={[
                  styles.addressText,
                  { marginStart: 10, textAlign: alignText }, // FIX
                ]}
                numberOfLines={2}
              >
                {hoverLocation?.address || "Locating..."}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn]}
              disabled={loading || !hoverLocation}
              onPress={async () => {
                // 1. Validation
                if (!hoverLocation || hoverLocation.latitude === 0) {
                  Alert.alert("Error", "Please select a valid location");
                  return;
                }

                // 2. Start Loading (Spinner appears on button)
                setLoading(true);

                // 3. Calculate Logic (Wait for it...)
                // We use 'pickupCoords' (your state) and 'hoverLocation' (where the pin is)
                if (pickupCoords) {
                  const routeData = await calculateRouteAndFare(
                    pickupCoords,
                    hoverLocation
                  );

                  if (routeData) {
                    // 4. Data is ready! Update everything at once.
                    setFare(routeData.price);
                    setRouteDetails(routeData.details);

                    // Update the dropoff state
                    setDropoffCoords({
                      latitude: hoverLocation.latitude,
                      longitude: hoverLocation.longitude,
                      address: hoverLocation.address,
                    });

                    // 5. NOW Switch the View (No empty screen glitch)
                    setViewMode("CONFIRM");

                    // 6. Animate the Map
                    if (mapRef.current) {
                      mapRef.current.fitToCoordinates(
                        [pickupCoords, hoverLocation],
                        {
                          edgePadding: {
                            top: 140,
                            right: 60,
                            left: 60,
                            bottom: height * 0.5,
                          },
                          animated: true,
                        }
                      );
                    }
                  } else {
                    Alert.alert(
                      "Error",
                      "Could not calculate route price. Check internet."
                    );
                  }
                }

                // 7. Stop Loading
                setLoading(false);
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {hoverLocation?.address === "Loading..."
                    ? "Locating..."
                    : t("confirmLocation") || "Confirm Location"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* FIX: Top Container for "Choose On Map" also needs RTL fix */}
          <SafeAreaView
            style={[
              styles.topContainer,
              isRTL ? { right: 20 } : { left: 20 },
              { alignItems: isRTL ? "flex-end" : "flex-start" },
            ]}
          >
            <TouchableOpacity
              onPress={() => setViewMode("SEARCHING")}
              style={styles.backBtn}
            >
              {/* Mirror icon */}
              <ArrowLeft
                color="#1F2937"
                size={24}
                style={isRTL ? { transform: [{ scaleX: -1 }] } : {}}
              />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={isPaymentModalVisible}
        onRequestClose={() => setIsPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("selectPaymentMethod") || "Select Payment Method"}
            </Text>

            {/* Option 1: Cash */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === "CASH" && styles.selectedPaymentOption,
              ]}
              onPress={() => {
                setPaymentMethod("CASH");
                setIsPaymentModalVisible(false);
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 15 }}
              >
                <View style={[styles.iconBox, { backgroundColor: "#e6f4ea" }]}>
                  <Banknote size={24} color="#1e8e3e" />
                </View>
                <Text style={styles.paymentOptionText}>{t("cashPayment")}</Text>
              </View>
              {paymentMethod === "CASH" && (
                <Check size={20} color="#4f26afff" />
              )}
            </TouchableOpacity>

            {/* Option 2: Wallet */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === "WALLET" && styles.selectedPaymentOption,
              ]}
              onPress={() => {
                setPaymentMethod("WALLET");
                setIsPaymentModalVisible(false);
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 15 }}
              >
                <View style={[styles.iconBox, { backgroundColor: "#f3e8ff" }]}>
                  <Wallet size={24} color="#6b21a8" />
                </View>
                <View>
                  <Text style={styles.paymentOptionText}>
                    {t("payWithBalance") || "Wallet Balance"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "gray",
                      fontFamily: "Tajawal_400Regular",
                    }}
                  >
                    {balance.toFixed(2)} DZD Available
                  </Text>
                </View>
              </View>
              {paymentMethod === "WALLET" && (
                <Check size={20} color="#4f26afff" />
              )}
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsPaymentModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>
                {t("cancel") || "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isReportModalVisible && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 99999,
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              width: "85%",
              padding: 25,
              borderRadius: 20,
              alignItems: "center",
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "#fee2e2",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 15,
              }}
            >
              <Text style={{ fontSize: 30 }}>⚠️</Text>
            </View>

            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: "#111827",
                marginBottom: 10,
                textAlign: "center",
                fontFamily: "Tajawal_700Bold",
              }}
            >
              New Debt Added
            </Text>

            <Text
              style={{
                fontSize: 15,
                color: "#4b5563",
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 22,
                fontFamily: "Tajawal_400Regular",
              }}
            >
              A debt of{" "}
              <Text style={{ fontWeight: "bold", color: "#af0075ff" }}>
                {reportData?.amount} DA
              </Text>{" "}
              was just added to your account by the driver.
              {"\n\n"}
              <Text style={{ fontWeight: "bold" }}>
                Did you pay the full price?
              </Text>
            </Text>

            <View style={{ width: "100%", gap: 10 }}>
              <TouchableOpacity
                onPress={handleReportFraud}
                style={{
                  backgroundColor: "#af0075ff",
                  padding: 15,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontWeight: "bold",
                    fontSize: 15,
                    fontFamily: "Tajawal_700Bold",
                  }}
                >
                  Yes, I Paid Full (Report)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsReportModalVisible(false)}
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: 15,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#4b5563",
                    fontWeight: "bold",
                    fontSize: 15,
                    fontFamily: "Tajawal_700Bold",
                  }}
                >
                  No, the debt is correct
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topContainer: { position: "absolute", top: 50, zIndex: 50 }, // Removed fixed left/right here

  // --- BUTTONS & ICONS ---
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  menuBtnContainer: {
    position: "absolute",
    top: 50,
    zIndex: 50,
    // Removed fixed left/right here, handled in component
  },
  menuBtnShadow: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  closeSearchBtn: {
    padding: 5,
    marginTop: 30,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },

  // --- MAP MARKERS ---
  markerCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    elevation: 3,
  },
  markerDot: { width: 10, height: 10, borderRadius: 5 },

  // --- BOTTOM SHEET (IDLE) ---
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    paddingBottom: 35,
    elevation: 20,
    shadowColor: "#161616ff",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 20,
    color: "#1F2937",
  },
  searchTrigger: {
    flexDirection: "row",
    alignItems: "center", // CHANGE THIS: Was "flex-end"
    justifyContent: "center", // KEEPS THIS: Centers text Left-to-Right
    backgroundColor: "#4f26afff",
    // paddingBottom: 12,      // REMOVE THIS: This pushes text up and ruins vertical center
    borderRadius: 50,
    height: 50,
    marginBottom: 25,
    borderBottomColor: "#bbbbbbff",
    borderStyle: "solid",
  },
  searchTriggerText: {
    alignItems: "center", // CHANGE THIS: Was "flex-end"
    justifyContent: "center",
    // marginLeft: 10, // Removed, use marginStart in component
    // direction: "rtl", // Removed hardcoded RTL
    fontSize: 16,
    color: "#ebebebff",
    fontFamily: "Tajawal_700Bold",
  },

  recentContainer: {
    gap: 15,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "lightgray",
  },
  recentItem: { alignItems: "center", gap: 8, marginRight: 20 },
  iconCircle: {
    width: 35,
    height: 35,
    borderRadius: 25,
    backgroundColor: "#4e2c9cff",
    justifyContent: "center",
    alignItems: "center",
  },
  recentText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    marginBottom: 30,
    color: "#444444ff",
  },

  // --- FULL SCREEN SEARCH ---
  searchOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    zIndex: 50,
    elevation: 50,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  searchHeader: {
    // Remove "flexDirection: 'row'" from here if you want strictly dynamic control
    // or keep it as a default.
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 16, // Increased slightly for better visibility
    // Remove fontWeight: "bold" -> using custom font handles the weight
    fontFamily: "Tajawal_700Bold",
    marginTop: 30,
    color: "#000",
  },
  searchInputContainer: {
    flexDirection: "row",
    borderColor: "lightgray",
    borderWidth: 1,
    borderRadius: 30,
    margin: 10,
    padding: 10,
    gap: 15,
  },
  timelineDecor: { alignItems: "center", paddingTop: 5 },
  dot: {
    marginTop: 10,
    width: 15,
    height: 15,
    borderWidth: 3,
    borderRadius: 16,
    borderColor: "#af26a4ff",
  },
  dot1: {
    width: 15,
    height: 15,
    borderWidth: 3,
    borderRadius: 16,
    borderColor: "#af26a4ff",
  },
  line: {
    width: 1.5,
    height: 40,
    marginVertical: 5,
    backgroundColor: "#c9c9c9ff",
  },
  fakeInput: {
    height: 45,
    backgroundColor: "#ffffffff",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 0,
    borderColor: "#a5a5a5ff",
    marginTop: 10,
  },

  // --- CONFIRM RIDE SHEET ---
  confirmSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: 10,
    backgroundColor: "#2c2c2cff",
    padding: 20,
    paddingBottom: 30,
    borderRadius: 30,
    borderWidth: 0,
    borderColor: "#4f26afff",
    marginBottom: 60,

    // --- Android Shadow ---
    elevation: 22,

    // --- iOS Shadow ---
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3, // Negative height makes the shadow appear slightly above the sheet
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sheetTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#f2f2f2ff",
  },
  divider: {
    height: 1,
    backgroundColor: "#c0c0c0ff",
    marginVertical: 10,
    borderStyle: "dashed",
  },
  carOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: "#f5f6f3ff",
    marginBottom: 10,
  },
  selectedOption: { borderColor: "#444444ff", backgroundColor: "#4f26afff" },
  carImage: {
    width: 60,
    height: 35,
    resizeMode: "contain",
    color: "white",
    minWidth: 50,
  },
  carTitle: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
    color: "#444444ff",
  },
  carSub: {
    color: "white",
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  carPrice: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 32,
    color: "#f2f2f2ff",
    textAlign: "center",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  confirmBtn: {
    backgroundColor: "#426e00ff",
    padding: 15,
    borderRadius: 50,
    alignItems: "center", // Centers text horizontally (left/right)
    justifyContent: "center", // <--- ADD THIS (Centers text vertically top/bottom)
    borderColor: "white",
    marginBottom: 0,
  },
  confirmBtnText: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
    color: "white",
    textAlign: "center", // <--- 1. Forces text to center within its own box
    includeFontPadding: false, // <--- 2. Fixes vertical alignment issues on Android
    textAlignVertical: "center", // <--- 3. Ensures vertical center on Android
  },

  // --- ACTIVE RIDE SHEET ---
  rideSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2c2c2cff",
    padding: 20,
    borderRadius: 30,
    elevation: 20,
    marginBottom: 60,
    marginHorizontal: 10,
  },
  rideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rideStatusText: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    color: "#ecececff",
  },
  timeBadge: {
    backgroundColor: "#2c2c2cff",
    color: "#ecececff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c2c2cff",
    padding: 15,
    borderRadius: 12,

    marginTop: 15,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
    color: "#f2f2f2ff",
  },
  driverCar: {
    color: "#f2f2f2ff",
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#af0075ff",
    justifyContent: "center",
    alignItems: "center",
  },
  tripRow: {
    color: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  cancelTextBtn: {
    marginTop: 5,
    alignItems: "center",
    backgroundColor: "#426e00ff",

    borderRadius: 40,
    padding: 10,
    fontFamily: "Tajawal_500Medimu",
  },

  // --- UBER-STYLE PIN & LOCATION CONFIRMATION ---
  centeredPinContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  fixedPin: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinShadow: {
    width: 6,
    height: 6,
    backgroundColor: "#4f26afff",
    borderRadius: 5,
    marginBottom: 2,
  },
  confirmLocationSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 290,
    backgroundColor: "#f3f3f3ff",
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.9,
    borderRadius: 30,
    shadowRadius: 10,
  },
  confirmLabel: {
    fontSize: 11,
    color: "#9c9c9cff",
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 80,
    backgroundColor: "#f3f3f3ff",
    borderRadius: 10,
  },
  addressText: {
    flex: 1,
    // marginLeft: 10, // Removed, use marginStart
    fontFamily: "Tajawal_700Bold",
    color: "#444444ff",
    fontSize: 15,
  },
  dimBackground: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  routeInfoContainer: {
    backgroundColor: "#3b3b3bff",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
    borderColor: "#3b3b3bff",
    borderWidth: 1,
  },
  routeText: {
    color: "#f2f2f2ff",
    fontFamily: "Tajawal_500Medium",
    fontSize: 15,
    lineHeight: 32,
    // textAlign: "left", // Removed
  },
  statsBadge: {
    backgroundColor: "#fff",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 8,
    alignItems: "center",
    // marginLeft: 8, // Removed, use marginStart
    alignSelf: "center",
  },
  statsText: {
    color: "#f2f2f2ff",
    fontWeight: "bold",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end", // Slides up from bottom
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    minHeight: 300,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#374151",
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 10,
  },
  selectedPaymentOption: {
    borderColor: "#4f26afff",
    backgroundColor: "#faf5ff",
  },
  paymentOptionText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#1f2937",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtn: {
    marginTop: 10,
    padding: 15,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#6b7280",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
});
