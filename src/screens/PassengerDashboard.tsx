import React, { useState, useEffect, useRef, useCallback } from "react";

import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedRoute from "../components/AnimatedRoute";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapViewDirections from "react-native-maps-directions";
import { GooglePlacesAutocompleteRef } from "react-native-google-places-autocomplete";
import { useFonts } from "expo-font";
import RatingModal from "../components/RatingModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
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
  ScrollView,
  TextInput,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { RideStatus, RideRequest, SavedPlace } from "../types";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Star,
  Phone,
  Car,
  X,
  Home,
  Briefcase,
  MapPin,
  Menu,
  Clock,
  Wallet, // <--- ADD THIS
  Banknote, // <--- ADD THIS
  Check,
  MessageSquare,
  Navigation as NavIcon,
  Calendar,
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
    shouldShowAlert: false, // Don't show alert while app is open
    shouldPlaySound: false, // Don't play system sound (we play our own custom sound)
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
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
    // ✅ New Fixed Code
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "09a6c5f4-9e83-4eea-8b6f-97384074d7a0", // Matches ID in app.json
      })
    ).data;
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
// --- THEME CONSTANTS (MATCHING DRIVER APP) ---
const COLORS = {
  primary: "#111827", // Dark Charcoal (Text)
  mainPurple: "#775BD4", // The main brand purple
  accent: "#960082ff", // Darker magenta accent
  background: "#F3F4F6", // Light Gray background
  card: "#FFFFFF", // White cards
  text: "#1F2937", // Dark text
  textLight: "#6B7280", // Light gray text
  border: "#E5E7EB", // Border color
};

// The signature gradient used on buttons
const BRAND_GRADIENT = ["#7055c9ff", "#b486e7ff"] as const;

export default function PassengerDashboard({ session, navigation }: any) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const pinTranslateY = useRef(new Animated.Value(0)).current;

  // Add this right after useFonts

  const confirmSheetAnim = useRef(new Animated.Value(height + 100)).current;
  // --- SMART RTL HELPERS ---
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDir = isRTL ? "row-reverse" : "row";

  const handleUseCurrentLocation = async () => {
    if (!location) {
      Alert.alert(
        t("locationError") || "Error",
        t("waitingForLocation") || "Waiting for location..."
      );
      return;
    }

    const address = t("currentLocation") || "Current Location";

    // 1. Update State
    setPickupCoords({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address: address,
    });

    // 2. Update Text Input
    if (pickupRef.current) {
      pickupRef.current.setAddressText(address);
      setPickupText(address); // Make sure to update the controlled text state
    }

    // 3. Animate Map
    mapRef.current?.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    });

    // 4. Cleanup UI
    setActiveInput(null);
    setIsTyping(false);
    Keyboard.dismiss();
  };

  // --- DATE PICKER HANDLER ---
  const handleSchedulePress = () => {
    if (Platform.OS === "android") {
      // 🤖 ANDROID: Native flow (Keep existing logic)
      DateTimePickerAndroid.open({
        value: scheduledTime || new Date(),
        mode: "date",
        minimumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === "dismissed") return;
          if (date) {
            DateTimePickerAndroid.open({
              value: date,
              mode: "time",
              is24Hour: true,
              onChange: (e, time) => {
                if (e.type === "dismissed") return;
                if (time) {
                  const finalDate = new Date(date);
                  finalDate.setHours(time.getHours());
                  finalDate.setMinutes(time.getMinutes());
                  setScheduledTime(finalDate);
                }
              },
            });
          }
        },
      });
    } else {
      // 🍎 iOS: Open our new custom Modal
      setTempDate(scheduledTime || new Date());
      setIOSPickerVisible(true);
    }
  };

  // For absolute positioned items (Menu/Back buttons)
  // If RTL, we want them on the Right edge? usually Back is Top-Left in English, Top-Right in Arabic
  const menuBtnPos = isRTL ? { right: 20 } : { left: 20 };
  const backBtnPos = isRTL ? { right: 20 } : { left: 20 };

  // State
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );

  const [activeInput, setActiveInput] = useState<"pickup" | "dropoff" | null>(
    null
  );

  // Helper function to calculate distance (Haversine formula)
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat1)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

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
    // setPickupListVisible(false); // <--- DELETE THIS (Old state variable)
    setActiveInput(null); // <--- ADD THIS (Forces list to hide)
    setIsTyping(false);
    Keyboard.dismiss();
  };

  // Helper: Calculate distance (km) and time (min) assuming 30km/h average city speed
  const updateEta = (
    driverLat: number,
    driverLng: number,
    pickupLat: number,
    pickupLng: number
  ) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (pickupLat - driverLat) * (Math.PI / 180);
    const dLon = (pickupLng - driverLng) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(driverLat * (Math.PI / 180)) *
        Math.cos(pickupLat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c; // Distance in km

    // Assume average city speed is 25 km/h
    const speedKmH = 25;
    const timeHours = distanceKm / speedKmH;
    const timeMinutes = Math.ceil(timeHours * 60);

    if (timeMinutes < 1) return "Arrived";
    return `~${timeMinutes} min`;
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
  const isDriverComing =
    currentRide?.status === "ACCEPTED" || currentRide?.status === "ARRIVED";
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
  const [isRatingVisible, setIsRatingVisible] = useState(false);
  const [completedRideData, setCompletedRideData] = useState<any>(null);
  const [userFare, setUserFare] = useState<string>("");

  const slideAnim = useRef(new Animated.Value(height + 100)).current;

  const prevStatusRef = useRef<string | null>(null);
  const [note, setNote] = useState("");
  const [liveEta, setLiveEta] = useState("~ min");
  const [pickupText, setPickupText] = useState(""); // <--- ADD THIS
  const [dropoffText, setDropoffText] = useState(""); // <--- ADD THIS

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);

  const [tripType, setTripType] = useState<"CITY" | "OUTSTATION">("CITY");
  const [isIOSPickerVisible, setIOSPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState(new Date()); // Temporary state for iOS scroller
  const isSelectionRef = useRef(false);

  // Payment Modal Animations
  const paymentSlideAnim = useRef(new Animated.Value(height)).current;
  const paymentFadeAnim = useRef(new Animated.Value(0)).current;

  // --- CUT THIS OUT FROM INSIDE handlePlaceSelected ---
  useEffect(() => {
    // FIX: Use 'pickupCoords' instead of 'pickupLocation'
    if (driverLocation && pickupCoords) {
      // 1. Calculate distance in km
      const distanceKm = getDistanceFromLatLonInKm(
        driverLocation.latitude,
        driverLocation.longitude,
        pickupCoords.latitude,
        pickupCoords.longitude
      );

      // 2. Estimate time based on average speed
      const speedKmH = 30;
      const timeHours = distanceKm / speedKmH;
      const timeMinutes = Math.ceil(timeHours * 60);

      // 3. Update the state
      setLiveEta(`${timeMinutes} mins`);
    }
  }, [driverLocation, pickupCoords]);
  // -----------------------------------------------------

  const handlePlaceSelected = (data: any, details: any) => {
    if (!details) return;

    // 1. Close dropdown text input visuals
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

    // 3. Update Recent Places
    setRecentPlaces((prev) => {
      const filtered = prev.filter(
        (p) => p.address !== selectedLocation.address
      );
      const updated = [selectedLocation, ...filtered].slice(0, 10);

      AsyncStorage.setItem("@recent_places", JSON.stringify(updated)).catch(
        (err) => console.error("Failed to save recent place", err)
      );

      return updated;
    });

    // 4. Cleanup - THIS WILL NOW RUN CORRECTLY
    Keyboard.dismiss();
    setIsTyping(false);
    setActiveInput(null); // <--- This closes the list
  };
  const onRecentPlacePress = (place: any) => {
    const locationData = {
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
    };

    // CHECK WHICH INPUT IS ACTIVE
    if (activeInput === "pickup") {
      // --- 1. HANDLE PICKUP ---

      // Update Text Input Visuals
      if (pickupRef.current) {
        pickupRef.current.setAddressText(place.address);
        pickupRef.current.blur();
      }
      setPickupText(place.address); // Sync React State

      // Update Logic State
      setPickupCoords(locationData);

      // Animate Map to new Pickup
      mapRef.current?.animateToRegion({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    } else {
      // --- 2. HANDLE DROPOFF (Default) ---

      // Update Text Input Visuals
      if (googlePlacesRef.current) {
        googlePlacesRef.current.setAddressText(place.address);
        googlePlacesRef.current.blur();
      }
      setDropoffText(place.address); // Sync React State

      // Update Logic State (Temp Dropoff shows the "Next" button)
      setTempDropoff(locationData);
    }

    // --- CLEANUP ---
    setActiveInput(null); // Reset active input
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
      }
      setTempDropoff(null);
      setIsTyping(false);

      // ✅ ADD THIS: Force the state to null so bottom sections appear
      setActiveInput(null);
      Keyboard.dismiss();
    } else {
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
        // Inside useEffect for ride updates...
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

          if (updated.status === "COMPLETED") {
            // 1. Prepare data for the modal
            setCompletedRideData({
              id: updated.id,
              driverId: updated.driver_id,
              name: driverDetails?.full_name || "Driver",
            });
            // 2. Show the modal
            setIsRatingVisible(true);
          } else if (updated.status === "CANCELLED") {
            // For cancellations, we reset immediately
            Alert.alert(t("update"), t("rideEnded"));
            resetState();
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
      .select("*, average_rating, rating_count")
      .eq("id", driverId)
      .single();
    if (data) setDriverDetails(data);
  };

  const resetState = () => {
    setCurrentRide(null);
    setDriverDetails(null);
    setDropoffCoords(null);
    setFare(null);
    setNote("");
    setScheduledTime(null);
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
              if (pickupCoords) {
                const timeStr = updateEta(
                  newLoc.lat,
                  newLoc.lng,
                  pickupCoords.latitude,
                  pickupCoords.longitude
                );
                setLiveEta(timeStr);
              }
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
    if (isPaymentModalVisible) {
      // OPEN: Fade in overlay, Slide up content
      Animated.parallel([
        Animated.timing(paymentFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(paymentSlideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
      ]).start();
    } else {
      // CLOSE: Fade out overlay, Slide down content
      Animated.parallel([
        Animated.timing(paymentFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(paymentSlideAnim, {
          toValue: height, // Slide off screen
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
      ]).start();
    }
  }, [isPaymentModalVisible]);

  useEffect(() => {
    if (fare) {
      setUserFare(fare.toString());
    }
  }, [fare]);

  // ----------------------------------------------------------------
  // ✅ NEW: Global Listener for Ride Activation / Updates
  // This wakes up the app when a Scheduled ride becomes PENDING or ACCEPTED
  // ----------------------------------------------------------------
  useEffect(() => {
    // Only subscribe if we are NOT already in a ride flow
    if (viewMode === "RIDE" && currentRide) return;

    const channel = supabase
      .channel(`passenger_global:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `passenger_id=eq.${session.user.id}`,
        },
        (payload) => {
          const updatedRide = payload.new;

          // Check if this update makes a ride "Active"
          const activeStatuses = [
            "PENDING",
            "ACCEPTED",
            "ARRIVED",
            "IN_PROGRESS",
          ];

          if (activeStatuses.includes(updatedRide.status)) {
            console.log(
              "🔔 Global Listener: Ride activated or updated!",
              updatedRide.status
            );

            // 1. Update State
            setCurrentRide(updatedRide);

            // 2. Fetch Driver Info if needed
            if (updatedRide.driver_id) {
              fetchDriverDetails(updatedRide.driver_id);
            }

            // 3. Switch View Mode to show the sheet
            setViewMode("RIDE");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, session.user.id]); // Re-run if viewMode changes

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

    // ✅ 1. Validate the custom fare before sending
    const finalOffer = parseFloat(userFare);
    if (!fare || isNaN(finalOffer) || finalOffer < fare) {
      Alert.alert("Invalid Fare", "Please enter a valid amount.");
      return;
    }

    setLoading(true);

    try {
      const API_URL = "https://my-ride-service.onrender.com/rides/request";

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
          pickupAddress: pickupCoords.address || "Unknown Pickup",
          dropoffAddress: dropoffCoords.address || "Unknown Dropoff",

          // ✅ 2. Send the User's Offer (userFare) instead of the calculated 'fare'
          // The backend will double-check this against the floor price anyway.
          fare: finalOffer,

          paymentMethod: paymentMethod,
          note: note.trim(),
          scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Server Error");
      }

      if (responseData.status === "SCHEDULED") {
        Alert.alert(
          "Ride Scheduled 📅",
          `Your ride has been scheduled for ${new Date(
            responseData.scheduled_time
          ).toLocaleString()}. We will start looking for drivers 20 minutes before pickup.`
        );
        resetState();
        setScheduledTime(null); // Clear time
      } else {
        // Standard flow
        setCurrentRide(responseData);
        setViewMode("RIDE");
      }
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

    try {
      // 1. Call API so the server sends the Push Notification
      const response = await fetch(
        "https://my-ride-service.onrender.com/rides/cancel/passenger",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rideId: currentRide.id,
            passengerId: session.user.id,
            reason: "PASSENGER_CANCELLED",
          }),
        }
      );

      if (!response.ok) throw new Error("Server cancellation failed");
    } catch (error) {
      console.log(
        "API Cancel failed, falling back to Supabase direct update",
        error
      );
      // Fallback: If server is down, force update DB so user isn't stuck
      await supabase
        .from("rides")
        .update({ status: "CANCELLED" })
        .eq("id", currentRide.id);
    }

    // 2. Reset UI immediately
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

  const parseAddress = (fullAddress: string) => {
    if (!fullAddress) return { name: "", detail: "" };

    // 1. Split by either English comma (,) OR Arabic comma (،)
    const parts = fullAddress.split(/[,،]/);

    // 2. The first part is the Place Name
    const name = parts[0].trim();

    // 3. The rest is the Detail (City, Country).
    // We join them back together.
    const detail = parts
      .slice(1)
      .map((p) => p.trim())
      .join(", ");

    return { name, detail };
  };

  // Helper to render a pretty row with an icon
  const renderAutocompleteRow = (data: any) => {
    const mainText = data.structured_formatting?.main_text || data.description;
    const secondaryText = data.structured_formatting?.secondary_text || "";

    return (
      <View
        style={[
          styles.resultRow,
          {
            // 👇 ADD THIS LINE
            width: "100%",
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        {/* ICON CONTAINER */}
        <View style={isRTL ? { marginLeft: 15 } : { marginRight: 15 }}>
          <View style={styles.resultIconBg}>
            <MapPin size={18} color="#960082" />
          </View>
        </View>

        {/* TEXT CONTAINER */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text
            style={[
              styles.resultMainText,
              // 2. EXPLICIT TEXT ALIGNMENT
              { textAlign: isRTL ? "right" : "left" },
            ]}
            numberOfLines={1}
          >
            {mainText}
          </Text>
          {secondaryText ? (
            <Text
              style={[
                styles.resultSubText,
                { textAlign: isRTL ? "right" : "left" },
              ]}
              numberOfLines={1}
            >
              {secondaryText}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const shouldShowBottomContent =
    !activeInput ||
    (activeInput === "pickup" && pickupText.length === 0) ||
    (activeInput === "dropoff" && dropoffText.length === 0);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {viewMode === "IDLE" && (
        <View
          style={[
            styles.menuBtnContainer,
            menuBtnPos,
            { top: insets.top + 10 },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("MenuScreen")}
            style={styles.menuBtnShadow}
          >
            <Menu size={28} color="#1F2937" />
          </TouchableOpacity>
        </View>
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
              {/* Outer White Ring with Purple Border */}
              <View
                style={[
                  styles.markerCircle,
                  { borderColor: COLORS.mainPurple },
                ]}
              >
                {/* Inner Glowing Gradient Dot */}
                <LinearGradient
                  colors={[COLORS.mainPurple, "#9d4edd"]} // Purple Gradient
                  style={styles.markerDot}
                />
              </View>
            </Marker>
          )}
        {dropoffCoords && (
          <Marker coordinate={dropoffCoords} title={t("dropoff")}>
            <View style={[styles.markerCircle, { borderColor: COLORS.accent }]}>
              <LinearGradient
                colors={[COLORS.accent, "#d946ef"]} // Magenta Gradient
                style={styles.markerDot}
              />
            </View>
          </Marker>
        )}

        {driverLocation && viewMode === "RIDE" && (
          <Marker coordinate={driverLocation} title={t("driver") || "Driver"}>
            {/* No View container needed if you just want the car image directly */}
            <Image
              source={require("../assets/car-top-view.png")} // <--- Make sure you have this file
              style={{
                width: 40, // Adjust size to match your map zoom
                height: 40, // Top-down cars are usually rectangular
                resizeMode: "contain",
                transform: [{ rotate: `${driverLocation.heading || 0}deg` }], // <--- Rotates car with direction!
              }}
            />
          </Marker>
        )}
        {pickupCoords && dropoffCoords && (
          <MapViewDirections
            // 1. DYNAMIC ORIGIN
            // If driver is coming, start from Driver's Car.
            // If ride started, start from Pickup (or keep updating to driver's location if you want live tail).
            origin={
              isDriverComing && driverLocation
                ? {
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                  }
                : {
                    latitude: pickupCoords.latitude,
                    longitude: pickupCoords.longitude,
                  }
            }
            // 2. DYNAMIC DESTINATION
            // If driver is coming -> He is going to Pickup
            // If ride started -> He is going to Dropoff
            destination={
              isDriverComing
                ? {
                    latitude: pickupCoords.latitude,
                    longitude: pickupCoords.longitude,
                  }
                : {
                    latitude: dropoffCoords.latitude,
                    longitude: dropoffCoords.longitude,
                  }
            }
            // 3. REQUIRED PROPS
            apikey={GOOGLE_API_KEY}
            strokeWidth={4}
            strokeColor={COLORS.mainPurple} // Matches your app theme
            // 4. OPTIMIZATION (Optional)
            // precision="high" makes curves smoother but uses more data
            precision="high"
            // Prevents the map from re-zooming automatically while you are tracking
            resetOnChange={false}
          />
        )}
      </MapView>

      {(viewMode === "SEARCHING" || viewMode === "CONFIRM") && (
        <View
          style={[styles.topContainer, backBtnPos, { top: insets.top + 10 }]}
        >
          {" "}
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
        </View>
      )}

      {/* IDLE VIEW */}
      {viewMode === "IDLE" && (
        <View style={styles.bottomSheet}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setViewMode("SEARCHING")}
            // REMOVE style={styles.searchTrigger} from here
            style={{
              shadowColor: "#775BD4",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={BRAND_GRADIENT} // <--- THE PURPLE GRADIENT
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: flexDir,
                alignItems: "center",
                justifyContent: "center",
                height: 55,
                borderRadius: 28,
              }}
            >
              <Search size={20} color="white" style={{ marginRight: 10 }} />
              <Text style={[styles.searchTriggerText, { color: "white" }]}>
                {t("searchPlaceholder")}
              </Text>
            </LinearGradient>
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
            paddingTop: insets.top, // <-- ADD THIS
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <View style={[styles.searchHeader, { flexDirection: flexDir }]}>
              <Text style={[styles.headerTitle, { textAlign: alignText }]}>
                {t("searchForPlace")}
              </Text>
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
            {/* --- TRIP TYPE SELECTOR --- */}
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 10,
                flexDirection: flexDir,
                justifyContent: "center",
                gap: 15,
              }}
            >
              {/* Option 1: Inside City */}
              <TouchableOpacity
                onPress={() => setTripType("CITY")}
                style={[
                  styles.typeBtn,
                  tripType === "CITY"
                    ? styles.typeBtnActive
                    : styles.typeBtnInactive,
                ]}
              >
                <Car
                  size={18}
                  color={tripType === "CITY" ? "white" : "#374151"}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    tripType === "CITY"
                      ? { color: "white" }
                      : { color: "#374151" },
                  ]}
                >
                  {t("insideCity") || "Inside City"}
                </Text>
              </TouchableOpacity>

              {/* Option 2: Outside City */}
              <TouchableOpacity
                onPress={() => setTripType("OUTSTATION")}
                style={[
                  styles.typeBtn,
                  tripType === "OUTSTATION"
                    ? styles.typeBtnActive
                    : styles.typeBtnInactive,
                ]}
              >
                <MapPin
                  size={18}
                  color={tripType === "OUTSTATION" ? "white" : "#374151"}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    tripType === "OUTSTATION"
                      ? { color: "white" }
                      : { color: "#374151" },
                  ]}
                >
                  {t("outsideCity") || "Outside City"}
                </Text>
              </TouchableOpacity>
            </View>
            {/* --- PROFESSIONAL SEARCH CARD --- */}
            <View
              style={[styles.professionalInputCard, { flexDirection: flexDir }]}
            >
              {/* TIMELINE VISUAL */}
              <View
                style={[
                  styles.timelineColumn,
                  // Since we removed 'left' from the stylesheet, this now works perfectly:
                  isRTL ? { right: 15 } : { left: 15 },
                ]}
              >
                <View style={styles.timelineDot} />
                <View style={styles.timelineLine} />
                <View style={styles.timelineSquare} />
              </View>

              {/* INPUTS COLUMN (Right Side) - Flexible */}
              <View style={{ flex: 1, position: "relative" }}>
                {/* 1. PICKUP INPUT */}
                <View style={styles.pickupContainer}>
                  <GooglePlacesAutocomplete
                    ref={pickupRef}
                    key={`pickup-${language}`} // 👈 ADD THIS LINE
                    placeholder={t("pickup") || "Current Location"}
                    debounce={300}
                    fetchDetails={true}
                    enablePoweredByContainer={false}
                    renderRow={renderAutocompleteRow}
                    renderRightButton={() =>
                      pickupText.length > 0 ? (
                        <TouchableOpacity
                          style={{
                            position: "absolute",
                            right: isRTL ? "auto" : 10,
                            left: isRTL ? 10 : "auto",
                            top: 8,
                            zIndex: 100,
                            padding: 5,
                          }}
                          onPress={() => {
                            pickupRef.current?.setAddressText("");
                            setPickupText("");
                            setPickupCoords(null);
                          }}
                        >
                          <X size={22} color="#9CA3AF" />
                        </TouchableOpacity>
                      ) : (
                        <></>
                      )
                    }
                    textInputProps={{
                      placeholderTextColor: "#9CA3AF",
                      value: pickupText,
                      onChangeText: (text) => {
                        setPickupText(text);
                        setActiveInput("pickup"); // Open list when typing
                        setIsTyping(true);
                      },
                      onFocus: () => {
                        setActiveInput("pickup"); // Open list when focused
                        setIsTyping(true);
                      },
                      style: {
                        fontFamily: "Tajawal_500Medium",
                        fontSize: 16,
                        color: "#1F2937",
                        height: 45,
                        backgroundColor: "transparent",
                        width: "100%",
                        textAlign: isRTL ? "right" : "left",
                        writingDirection: isRTL ? "rtl" : "ltr",
                        paddingRight: isRTL ? 50 : 35,
                        paddingLeft: isRTL ? 35 : 50,
                      },
                    }}
                    onPress={(data, details = null) => {
                      // 1. Update text state manually to prevent flicker
                      setPickupText(data.description);
                      // 2. Run the handler (which now includes setActiveInput(null))
                      handlePickupSelected(data, details);
                    }}
                    query={{
                      key: GOOGLE_API_KEY,
                      language: language,
                      components: "country:dz",
                    }}
                    styles={{
                      container: { flex: 0 },
                      textInputContainer: {
                        backgroundColor: "transparent",
                        borderTopWidth: 0,
                        borderBottomWidth: 0,
                      },
                      textInput: {},
                      row: { padding: 0, height: 50 },
                      separator: {
                        marginBottom: 10,
                        height: 1,
                        backgroundColor: "#f3f4f6",
                      },

                      listView: {
                        // ✅ VISIBILITY LOGIC
                        display:
                          activeInput === "pickup" && pickupText.length > 0
                            ? "flex"
                            : "none",

                        position: "absolute",
                        paddingTop: 15,
                        top: 128,
                        left: 0,
                        width: "100%",
                        backgroundColor: "white",
                        borderRadius: 15,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.2,
                        shadowRadius: 10,
                        elevation: 0,
                        zIndex: 1000,
                      },
                    }}
                  />
                </View>

                {/* SEPARATOR */}
                <View style={styles.inputSeparator} />

                {/* 2. DROPOFF INPUT */}
                {/* 2. DROPOFF INPUT */}
                <View style={styles.dropoffContainer}>
                  <GooglePlacesAutocomplete
                    ref={googlePlacesRef}
                    key={`${tripType}-${language}`}
                    placeholder={
                      tripType === "CITY"
                        ? t("whereToCity") || "Where in the city?"
                        : t("whereToOutside") || "Which city?"
                    }
                    debounce={300}
                    fetchDetails={true}
                    enablePoweredByContainer={false}
                    renderRow={renderAutocompleteRow}
                    renderRightButton={() =>
                      dropoffText.length > 0 ? (
                        <TouchableOpacity
                          style={{
                            position: "absolute",
                            right: isRTL ? "auto" : 10,
                            left: isRTL ? 10 : "auto",
                            top: 12,
                            zIndex: 100,
                            padding: 5,
                          }}
                          onPress={() => {
                            googlePlacesRef.current?.setAddressText("");
                            setDropoffText("");
                            setTempDropoff(null);
                          }}
                        >
                          <X size={22} color="#9CA3AF" />
                        </TouchableOpacity>
                      ) : (
                        <></>
                      )
                    }
                    textInputProps={{
                      placeholderTextColor: "#9CA3AF",
                      value: dropoffText,
                      onChangeText: (text) => {
                        setDropoffText(text);
                        setActiveInput("dropoff");
                        setIsTyping(true);
                      },
                      onFocus: () => {
                        setActiveInput("dropoff");
                        setIsTyping(true);
                      },
                      style: {
                        fontFamily: "Tajawal_500Medium",
                        fontSize: 16,
                        color: "#1F2937",
                        height: 45,
                        backgroundColor: "transparent",
                        width: "100%",
                        textAlign: isRTL ? "right" : "left",
                        writingDirection: isRTL ? "rtl" : "ltr",
                        paddingRight: isRTL ? 50 : 35,
                        paddingLeft: isRTL ? 35 : 50,
                      },
                    }}
                    onPress={(data, details = null) => {
                      setDropoffText(data.description);
                      handlePlaceSelected(data, details);
                    }}
                    query={{
                      key: GOOGLE_API_KEY,
                      language: language,
                      components: "country:dz",

                      // ✅ FIX: Only add these keys if we are in CITY mode.
                      // If we are in OUTSTATION mode, these keys will simply not exist.
                      ...(tripType === "CITY" && location
                        ? {
                            location: `${location.coords.latitude},${location.coords.longitude}`,
                            radius: 20000,
                            strictbounds: true,
                          }
                        : {}),
                    }}
                    styles={{
                      container: { flex: 0 },
                      textInputContainer: {
                        backgroundColor: "transparent",
                        borderTopWidth: 0,
                        borderBottomWidth: 0,
                      },
                      textInput: {},
                      row: { padding: 0, height: 50 },
                      separator: {
                        marginBottom: 10,
                        height: 1,
                        backgroundColor: "#f3f4f6",
                      },

                      listView: {
                        // 👇 CHANGE THIS LINE
                        // Only show if active AND text is not empty
                        display:
                          activeInput === "dropoff" && dropoffText.length > 0
                            ? "flex"
                            : "none",

                        position: "absolute",
                        paddingTop: 15,
                        top: 65, // Your adjusted top value
                        left: 0,
                        width: "100%",
                        backgroundColor: "white",
                        borderRadius: 15,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.2,
                        shadowRadius: 10,
                        elevation: 20,
                        zIndex: 1000,
                      },
                    }}
                  />
                </View>
              </View>
            </View>

            {/* --- BLOCK 2: SECTIONS THAT HIDE WHEN TYPING --- */}
            {/* --- BLOCK 2: SECTIONS THAT HIDE WHEN A LIST IS OPEN --- */}
            {shouldShowBottomContent && (
              <View style={{ marginTop: 15, paddingHorizontal: 10 }}>
                {/* 1. MAP ACTION BUTTON */}
                <TouchableOpacity
                  style={[styles.mapActionCard, { flexDirection: flexDir }]}
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
                  <View
                    style={[
                      styles.mapActionIconBox,
                      isRTL ? { marginLeft: 12 } : { marginRight: 12 },
                    ]}
                  >
                    <MapPin size={22} color="#0591a7ff" />
                  </View>
                  <Text
                    style={[styles.mapActionText, { textAlign: alignText }]}
                  >
                    {t("setLocationOnMap") || "Set location on map"}
                  </Text>
                  <ArrowLeft
                    size={18}
                    color="#9CA3AF"
                    style={{
                      transform: [{ rotate: isRTL ? "0deg" : "180deg" }],
                    }}
                  />
                </TouchableOpacity>

                {/* --- NEW BUTTON: CURRENT LOCATION (Only for Pickup) --- */}
                {activeInput === "pickup" && (
                  <TouchableOpacity
                    style={[
                      styles.mapActionCard,
                      { flexDirection: flexDir, marginTop: 10 },
                    ]} // Added marginTop
                    onPress={handleUseCurrentLocation}
                  >
                    <View
                      style={[
                        styles.mapActionIconBox,
                        isRTL ? { marginLeft: 12 } : { marginRight: 12 },
                        { backgroundColor: "#e0f2fe" }, // Different color (Light Blue) to distinguish
                      ]}
                    >
                      {/* Ensure you import NavIcon or Crosshair from lucide-react-native */}
                      <NavIcon size={22} color="#0284c7" />
                    </View>
                    <Text
                      style={[styles.mapActionText, { textAlign: alignText }]}
                    >
                      {t("useCurrentLocation") || "Use current location"}
                    </Text>

                    {/* Optional: Add an arrow like the map button, or leave clean */}
                  </TouchableOpacity>
                )}

                {/* 2. RECENT PLACES SECTION */}
                {recentPlaces.length > 0 && (
                  <View>
                    <View style={styles.recentListCard}>
                      <ScrollView
                        style={{ maxHeight: 340 }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                      >
                        {recentPlaces.map((place, index) => {
                          const { name, detail } = parseAddress(place.address);
                          const isLast = index === recentPlaces.length - 1;
                          return (
                            <TouchableOpacity
                              key={index}
                              onPress={() => onRecentPlacePress(place)}
                              style={[
                                styles.recentItemRow,
                                { flexDirection: flexDir },
                                !isLast && {
                                  borderBottomWidth: 1,
                                  borderBottomColor: "#F3F4F6",
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.recentIconBox,
                                  isRTL
                                    ? { marginLeft: 12 }
                                    : { marginRight: 12 },
                                ]}
                              >
                                <Clock size={26} color="#0591a7ff" />
                              </View>
                              <View
                                style={{ flex: 1, justifyContent: "center" }}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.recentPlaceTitle,
                                    { textAlign: alignText },
                                  ]}
                                >
                                  {name}
                                </Text>
                                {detail ? (
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      styles.recentPlaceSub,
                                      { textAlign: alignText },
                                    ]}
                                  >
                                    {detail}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
        {tempDropoff && (
          <View style={styles.floatingNextContainer}>
            <TouchableOpacity
              onPress={handleNextPress}
              activeOpacity={0.9} // Slight press effect
              disabled={loading}
            >
              <LinearGradient
                colors={BRAND_GRADIENT} // Uses your ["#7055c9ff", "#b486e7ff"]
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.gradientButton,
                  // Optional: Reverse layout for RTL if you want the icon on the left
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.gradientButtonText}>{t("next")}</Text>
                    {/* Add a directional icon for clarity */}
                    <ArrowLeft
                      size={20}
                      color="white"
                      // Rotate arrow to point Right for LTR, Left for RTL
                      style={{
                        transform: [{ rotate: isRTL ? "0deg" : "180deg" }],
                      }}
                    />
                  </>
                )}
              </LinearGradient>
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
            paddingBottom: Platform.OS === "android" ? 60 : insets.bottom + 20,
          },
        ]}
      >
        {/* Only render inner content if fare exists to prevent empty box glitches */}
        {fare ? (
          <>
            {/* --- PRICE & TIME ROW (Fixed Layout) --- */}
            <View
              style={{
                flexDirection: flexDir, // Row (or Row-Reverse for Arabic)
                alignItems: "center",
                justifyContent: "space-between", // Pushes Price to one side, Time to the other
                marginBottom: 20,
                width: "100%",
                paddingHorizontal: 5,
              }}
            >
              {/* 1. PRICE INPUT */}
              <View
                style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}
              >
                <TextInput
                  style={[
                    styles.carPrice,
                    {
                      borderBottomWidth: 1,
                      borderBottomColor: "#D1D5DB",
                      minWidth: 80,
                      paddingVertical: 0,
                      fontSize: 28, // Slightly smaller to fit in the row
                      color: "#920097ff",
                    },
                  ]}
                  value={userFare}
                  onChangeText={(text) => setUserFare(text)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onEndEditing={() => {
                    const enteredAmount = parseFloat(userFare);
                    const minimumFare = fare || 0;
                    if (isNaN(enteredAmount) || enteredAmount < minimumFare) {
                      Alert.alert(
                        t("priceTooLow") || "Price Too Low",
                        `${
                          t("minimumFareIs") || "Minimum is"
                        } ${minimumFare} DA`
                      );
                      setUserFare(minimumFare.toString());
                    }
                  }}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Tajawal_700Bold",
                    color: "#b6b6b6ff",
                    paddingHorizontal: 5,
                  }}
                >
                  DA
                </Text>
              </View>

              {/* 2. TIME & DISTANCE BADGE */}
              {routeDetails && (
                <View
                  style={{
                    backgroundColor: "#f3e8ff", // Light Purple Background
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.mainPurple, // Purple Text
                      fontFamily: "Tajawal_700Bold",
                      fontSize: 13,
                    }}
                  >
                    {routeDetails.duration}
                    <Text style={{ color: COLORS.mainPurple, opacity: 0.7 }}>
                      {" "}
                      • {routeDetails.distance}
                    </Text>
                  </Text>
                </View>
              )}
            </View>

            {/* --- ROUTE CONTAINER --- */}
            {/* --- ROUTE CONTAINER --- */}
            {/* --- ROUTE CONTAINER (Updated Display) --- */}
            <View
              style={[styles.routeInfoContainer, { flexDirection: flexDir }]}
            >
              {/* Visual Timeline Column */}
              <View
                style={{
                  alignItems: "center",
                  marginHorizontal: 10,
                  width: 24,
                  paddingTop: 6,
                }}
              >
                {/* 1. Pickup Dot */}
                <View
                  style={[
                    styles.dot,
                    {
                      borderColor: COLORS.mainPurple,
                      backgroundColor: "white",
                      width: 16,
                      height: 16, // Slightly larger
                    },
                  ]}
                />

                {/* Connecting Line (Increased height for double-line text) */}
                <View
                  style={{
                    width: 1,
                    height: 45, // <--- INCREASED from 28 to 45
                    backgroundColor: "#d1d5db",
                    marginVertical: 4,
                  }}
                />

                {/* 2. Dropoff Pin */}
                <MapPin size={24} color={COLORS.accent} fill="white" />
              </View>

              {/* Addresses Column */}
              <View
                style={{
                  flex: 1,
                  justifyContent: "space-between",
                  paddingVertical: 2,
                }}
              >
                {/* PICKUP SECTION */}
                <View style={{ marginBottom: 15 }}>
                  {(() => {
                    // Parse the address
                    const { name, detail } = parseAddress(
                      pickupCoords?.address || t("pickupLocation")
                    );
                    return (
                      <>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tripAddressMain,
                            { textAlign: alignText, fontSize: 15 },
                          ]}
                        >
                          {name}
                        </Text>
                        {detail ? (
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.tripAddressSub,
                              { textAlign: alignText },
                            ]}
                          >
                            {detail}
                          </Text>
                        ) : null}
                      </>
                    );
                  })()}
                </View>

                {/* DROPOFF SECTION */}
                <View>
                  {(() => {
                    // Parse the address
                    const { name, detail } = parseAddress(
                      dropoffCoords?.address || t("dropoffLocation")
                    );
                    return (
                      <>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tripAddressMain,
                            { textAlign: alignText, fontSize: 15 },
                          ]}
                        >
                          {name}
                        </Text>
                        {detail ? (
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.tripAddressSub,
                              { textAlign: alignText },
                            ]}
                          >
                            {detail}
                          </Text>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              </View>
            </View>
            <View style={[styles.noteContainer, { flexDirection: flexDir }]}>
              <MessageSquare
                size={20}
                color="#9ca3af"
                style={{ marginHorizontal: 10 }}
              />
              <TextInput
                placeholder={t("addNote") || "Note for driver (optional)..."}
                placeholderTextColor="#9ca3af"
                value={note}
                onChangeText={setNote}
                style={[
                  styles.noteInput,
                  { textAlign: alignText }, // Align text for RTL support
                ]}
                maxLength={100} // Limit length to prevent issues
              />
            </View>

            <View style={[styles.paymentRow, { flexDirection: flexDir }]}>
              {/* Left Side: Icon & Text */}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                {paymentMethod === "CASH" ? (
                  // 🟣 Update Icon Color to Purple
                  <Banknote size={24} color="green" />
                ) : (
                  <Wallet size={24} color={COLORS.mainPurple} />
                )}

                <Text
                  style={{
                    color: "#1F2937", // ✅ DARK TEXT (Was white #f2f2f2ff)
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
                    color: COLORS.mainPurple, // 🟣 PURPLE LINK (Was light gray #e6e6e6ff)
                    fontFamily: "Tajawal_700Bold",
                    fontSize: 14,
                    textDecorationLine: "underline",
                  }}
                >
                  {t("change") || "Change"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* DATE PICKER COMPONENT (Invisible logic) */}
            {/* DATE PICKER COMPONENT (iOS Only) */}
            {Platform.OS === "ios" && datePickerVisible && (
              <DateTimePicker
                value={scheduledTime || new Date()}
                mode="datetime"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setDatePickerVisible(false); // Close modal
                  if (selectedDate) {
                    setScheduledTime(selectedDate);
                  }
                }}
              />
            )}

            {/* --- MODERN SCHEDULE CARD --- */}
            <TouchableOpacity
              onPress={handleSchedulePress}
              activeOpacity={0.9}
              style={[
                styles.scheduleCard,
                { flexDirection: isRTL ? "row-reverse" : "row" }, // <--- 1. FLIP DIRECTION
              ]}
            >
              {/* Icon with Light Purple Background */}
              <View
                style={[
                  styles.scheduleIconContainer,
                  // 2. FLIP MARGINS: If RTL, margin is on Left. If LTR, on Right.
                  isRTL
                    ? { marginLeft: 15, marginRight: 0 }
                    : { marginRight: 15, marginLeft: 0 },
                ]}
              >
                <Calendar size={24} color="#775BD4" />
              </View>

              {/* Text Area */}
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.scheduleTitle,
                    { textAlign: isRTL ? "right" : "left" }, // <--- 3. ALIGN TEXT
                  ]}
                >
                  {scheduledTime
                    ? t("rideScheduled")
                    : t("scheduleForLater") || "Schedule a Ride"}
                </Text>
              </View>

              {/* Active State: Show Clear Button / Inactive: Show Arrow */}
              {scheduledTime ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setScheduledTime(null);
                  }}
                  style={styles.clearScheduleBtn}
                >
                  <X size={18} color="#EF4444" />
                </TouchableOpacity>
              ) : (
                <ArrowLeft
                  size={20}
                  color="#9CA3AF"
                  // 4. ROTATE ARROW: Points Left for RTL (<), Right for LTR (>)
                  style={{ transform: [{ rotate: isRTL ? "0deg" : "180deg" }] }}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRequestRide}
              disabled={loading}
              style={{
                marginTop: 10,
                shadowColor: "#775BD4",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <LinearGradient
                colors={BRAND_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 60,
                  borderRadius: 30,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {t("chooseStandard")}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : null}
      </Animated.View>

      {viewMode === "RIDE" && currentRide && (
        // Use a floating panel style instead of a full bottom sheet for a cleaner look
        <View
          style={[
            styles.rideFloatingPanel,
            { paddingBottom: insets.bottom + 10 },
          ]}
        >
          {/* --- A. WAITING STATE (Searching) --- */}
          {currentRide.status === "PENDING" ? (
            <View style={styles.pendingContainer}>
              <View style={styles.pulseContainer}>
                <ActivityIndicator size="large" color={COLORS.mainPurple} />
              </View>
              <Text style={styles.searchingTextMain}>
                {t("findingDrivers") || "Finding a driver..."}
              </Text>
              <Text style={styles.searchingTextSub}>
                Standard • {userFare} DA
              </Text>

              {/* Simple Linear Progress */}
              <View style={styles.loadingBarContainer}>
                <Animated.View style={styles.loadingBarFill} />
              </View>

              <TouchableOpacity
                onPress={handleCancelRide}
                style={styles.softCancelBtn}
              >
                <Text style={styles.softCancelText}>{t("cancelRequest")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // --- B. ACTIVE RIDE STATE (Accepted / Arrived / In Progress) ---
            <>
              {/* 1. HEADER: Status & ETA */}
              <View style={[styles.headerRow, { flexDirection: flexDir }]}>
                <View>
                  <Text style={[styles.statusTitle, { textAlign: alignText }]}>
                    {currentRide.status === "ACCEPTED"
                      ? t("driverOnTheWay") || "Driver is on the way"
                      : currentRide.status === "ARRIVED"
                      ? t("driverArrived") || "Driver has arrived"
                      : t("enjoyRide") || "Enjoy your ride"}
                  </Text>
                  <Text style={[styles.statusSub, { textAlign: alignText }]}>
                    {currentRide.status === "ACCEPTED"
                      ? "Arriving soon"
                      : "Please meet at pickup"}
                  </Text>
                </View>

                {/* ETA Pill */}
                <View style={styles.etaPill}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Clock size={12} color="white" />
                    <Text style={styles.etaText}>
                      {liveEta && liveEta !== "~ min" ? liveEta : "-- min"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 2. PIN CODE (Only show before ride starts) */}
              {(currentRide.status === "ACCEPTED" ||
                currentRide.status === "ARRIVED") && (
                <View style={[styles.pinRow, { flexDirection: flexDir }]}>
                  <View style={styles.pinLabelContainer}>
                    <Text
                      style={[styles.pinLabelTitle, { textAlign: alignText }]}
                    >
                      {t("startCode") || "START CODE"}
                    </Text>
                    <Text
                      style={[styles.pinLabelSub, { textAlign: alignText }]}
                    >
                      {t("giveToDriver") || "Give this to driver"}
                    </Text>
                  </View>
                  <Text style={styles.pinValue}>{currentRide.start_code}</Text>
                </View>
              )}

              {/* 3. DRIVER CARD */}
              <View style={[styles.driverRow, { flexDirection: flexDir }]}>
                {/* Avatar & Rating */}
                <View
                  style={[
                    styles.avatarContainer,
                    isRTL ? { marginLeft: 15, marginRight: 0 } : {},
                  ]}
                >
                  <View style={styles.avatarCircle}>
                    <Car size={26} color={COLORS.mainPurple} />
                  </View>
                  <View style={styles.ratingBadge}>
                    <Star
                      size={10}
                      color="#FBBF24"
                      fill="#FBBF24"
                      style={{ marginRight: 2 }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "bold",
                        color: "#374151",
                      }}
                    >
                      {driverDetails?.average_rating
                        ? Number(driverDetails.average_rating).toFixed(1)
                        : "5.0"}
                    </Text>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.driverInfo}>
                  {/* 👇 REPLACE THE OLD DRIVER NAME TEXT HERE 👇 */}
                  <Text style={[styles.driverName, { textAlign: alignText }]}>
                    {driverDetails?.full_name ||
                      t("loadingDriver") ||
                      "Loading..."}
                  </Text>

                  {/* Keep the car model text below it as is */}
                  <Text style={[styles.carText, { textAlign: alignText }]}>
                    {driverDetails?.car_model || "Car Model"}
                  </Text>

                  {/* License Plate Badge */}
                  {driverDetails?.license_plate && (
                    <View style={styles.plateBox}>
                      <Text style={styles.plateText}>
                        {driverDetails.license_plate}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Call Button */}
                <TouchableOpacity style={styles.callBtnBig} activeOpacity={0.8}>
                  <Phone size={22} color="white" />
                </TouchableOpacity>
              </View>

              {/* ✅ PASTE THE CODE HERE (Inside the fragment) */}
              {(currentRide.status === "ACCEPTED" ||
                currentRide.status === "ARRIVED") && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      t("cancelRide") || "Cancel Ride?",
                      t("cancelConfirm") ||
                        "Are you sure you want to cancel? A fee may apply.",
                      [
                        { text: t("no") || "No", style: "cancel" },
                        {
                          text: t("yes") || "Yes, Cancel",
                          style: "destructive",
                          onPress: handleCancelRide,
                        },
                      ]
                    );
                  }}
                  style={{
                    marginTop: 10,
                    alignItems: "center",
                    padding: 15,
                    backgroundColor: "#fee2e2",
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#DC2626",
                      fontFamily: "Tajawal_700Bold",
                      fontSize: 16,
                    }}
                  >
                    {t("cancelRide") || "Cancel Ride"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Optional: Add Cancel Button for Accepted state if needed */}
            </>
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
              <MapPin size={40} color={COLORS.mainPurple} fill="white" />{" "}
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
                // 1. Validation: Check Hover Location
                if (!hoverLocation || hoverLocation.latitude === 0) {
                  Alert.alert("Error", "Please select a valid location");
                  return; // ✅ FIXED: Changed 'retu' to 'return'
                }

                // 2. Validation: Check Pickup Location
                if (!pickupCoords) {
                  Alert.alert(
                    "Missing Pickup",
                    "Please select a pickup location first."
                  );
                  return; // ✅ ADDED: Prevent silent failure
                }

                // 3. Start Loading
                setLoading(true);

                // 4. Calculate Logic
                try {
                  const routeData = await calculateRouteAndFare(
                    pickupCoords,
                    hoverLocation
                  );

                  if (routeData) {
                    // Data is ready! Update everything.
                    setFare(routeData.price);
                    setRouteDetails(routeData.details);

                    // Update the dropoff state
                    setDropoffCoords({
                      latitude: hoverLocation.latitude,
                      longitude: hoverLocation.longitude,
                      address: hoverLocation.address,
                    });

                    // Switch the View
                    setViewMode("CONFIRM");

                    // Animate the Map
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
                      "Could not calculate route price. Please check your internet connection."
                    );
                  }
                } catch (error) {
                  console.error("Confirmation Error:", error);
                  Alert.alert("Error", "An unexpected error occurred.");
                } finally {
                  // 5. Stop Loading (Always run this)
                  setLoading(false);
                }
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
          <View
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
          </View>
        </View>
      )}

      {/* --- CUSTOM PAYMENT MODAL --- */}
      {/* --- CUSTOM ANIMATED PAYMENT MODAL --- */}
      <View
        style={[StyleSheet.absoluteFill, { zIndex: 200 }]}
        pointerEvents={isPaymentModalVisible ? "auto" : "none"}
      >
        {/* 1. FADE OVERLAY (Background) */}
        <Animated.View
          style={[styles.modalOverlay, { opacity: paymentFadeAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsPaymentModalVisible(false)}
          />
        </Animated.View>

        {/* 2. SLIDE CONTENT (Card) */}
        <Animated.View
          style={[
            styles.modalContentWrapper,
            { transform: [{ translateY: paymentSlideAnim }] },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                // 👇 SAFE AREA PADDING APPLIED HERE
                paddingBottom:
                  Platform.OS === "android" ? 25 : insets.bottom + 20,
              },
            ]}
          >
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
                  <Banknote size={24} color="#45986cff" />
                </View>
                <Text style={styles.paymentOptionText}>{t("cashPayment")}</Text>
              </View>
              {paymentMethod === "CASH" && (
                <Check size={20} color="#45986cff" />
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
                  <Wallet size={24} color="#45986cff" />
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
                <Check size={20} color="#45986cff" />
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
        </Animated.View>
      </View>

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
              <Text style={{ fontWeight: "bold", color: "#45986cff" }}>
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
                  backgroundColor: "#45986cff",
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
      <RatingModal
        visible={isRatingVisible}
        rideId={completedRideData?.id}
        reviewerId={session.user.id}
        revieweeId={completedRideData?.driverId}
        revieweeName={completedRideData?.name}
        revieweeRole="DRIVER"
        onClose={() => {
          setIsRatingVisible(false);
          setCompletedRideData(null);
          resetState();
        }}
      />
      {/* --- iOS CUSTOM DATE PICKER MODAL --- */}
      <Modal
        visible={isIOSPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIOSPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.iosDatePickerContainer}>
            {/* Header */}
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setIOSPickerVisible(false)}>
                <Text style={styles.pickerCancelText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>{t("scheduleRide")}</Text>
              <TouchableOpacity
                onPress={() => {
                  setScheduledTime(tempDate);
                  setIOSPickerVisible(false);
                }}
              >
                <Text style={styles.pickerConfirmText}>{t("confirm")}</Text>
              </TouchableOpacity>
            </View>

            {/* The Actual Picker */}
            <View style={styles.pickerWrapper}>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner" // 'spinner' looks most professional on iOS standard
                themeVariant="light"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  if (date) setTempDate(date);
                }}
                textColor="black"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topContainer: { position: "absolute", zIndex: 50 }, // Removed fixed left/right here

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
    backgroundColor: "#45986cff",
    // paddingBottom: 12,      // REMOVE THIS: This pushes text up and ruins vertical center
    borderRadius: 50,
    height: 50,
    marginBottom: 35,
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

  // --- RECENT PLACES CARD ---
  recentSectionTitle: {
    fontSize: 14,
    color: "#6B7280", // Cool Gray Section Header
    fontFamily: "Tajawal_700Bold",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentListCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginHorizontal: 0,
    marginBottom: 20,
    overflow: "hidden", // Ensures children don't bleed out of rounded corners
    // Soft Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 0,
  },
  recentItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: "white",
  },
  recentIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffffff", // Neutral Gray for "Past" items
    justifyContent: "center",
    alignItems: "center",
  },
  recentPlaceTitle: {
    fontSize: 16,
    color: "#1F2937", // Dark text
    fontFamily: "Tajawal_700Bold",
    marginBottom: 2,
  },
  recentPlaceSub: {
    fontSize: 13,
    color: "#9CA3AF", // Light gray subtext
    fontFamily: "Tajawal_500Medium",
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
    color: "#000",
  },
  // --- PROFESSIONAL SEARCH CARD ---
  professionalInputCard: {
    backgroundColor: "white",
    borderRadius: 20,
    marginHorizontal: 15,
    marginTop: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#eaeaeaff",
    // REMOVED: paddingHorizontal: 15 (We will add this padding to the text inputs instead)
    // REMOVED: flexDirection: 'row' (We stack them now)
    zIndex: 50,
    elevation: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    position: "relative", // Necessary for the timeline to be absolute
  },
  pickupContainer: {
    zIndex: 20, // Critical: Higher than dropoff so list floats over it
    elevation: 20, // For Android
    marginBottom: 5,
  },
  dropoffContainer: {
    zIndex: 10, // Lower Z-index
    elevation: 3,
  },

  // Update your existing timeline column if needed to ensure alignment
  timelineColumn: {
    position: "absolute",

    // 👇 ADJUST THESE TWO VALUES
    // Increasing these pushes the Dot down and the Square up
    // to match the center of your 50px inputs.
    top: 32,
    bottom: 32,

    alignItems: "center",
    width: 24,
    zIndex: 2,
    // right: 15 (Managed dynamically in JSX for RTL, so keep this removed from here)
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#0591a7ff", // Brand Purple
    borderWidth: 2,
    borderColor: "#E0D4FC", // Light purple ring
    marginBottom: -10,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 1,
    borderRadius: 1,
  },
  timelineSquare: {
    width: 15,
    height: 15,
    backgroundColor: "#ffffffff", // Accent Magenta
    borderWidth: 3,
    borderColor: "#775BD4",
    borderRadius: 20, // Slightly square for Dropoff
  },
  inputSeparator: {
    height: 1,
    backgroundColor: "#F3F4F6", // Very light gray divider
    marginVertical: 8,
    marginLeft: 5,
  },

  // --- CONFIRM RIDE SHEET ---
  confirmSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF", // <--- CHANGED TO WHITE
    padding: 20,
    paddingBottom: 0,
    borderTopLeftRadius: 32, // Matches Driver curvature
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
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
  selectedOption: { borderColor: "#444444ff", backgroundColor: "#45986cff" },
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
    color: "#111827",
    textAlign: "center",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 5,
    color: "#1F2937",
  },
  confirmBtn: {
    backgroundColor: "#45986cff",
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
    backgroundColor: "#FFFFFF", // <--- CHANGED TO WHITE
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  rideSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 20, // Android Shadow
    shadowColor: "#000", // iOS Shadow
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  rideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  rideStatusText: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937", // ✅ Dark Text (Visible)
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937", // Dark Badge
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timeBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "Tajawal_700Bold",
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // ✅ White Background
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB", // Subtle Border
    marginBottom: 15,
    // Soft Shadow
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3F4F6", // Light Gray Circle
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
    color: "#111827", // ✅ Dark Text
  },
  driverCar: {
    color: "#6B7280", // Gray Text
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    marginTop: 2,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#775BD4", // ✅ Purple Call Button
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    marginTop: 5,
    marginBottom: 10,
  },
  tripAddressText: {
    flex: 1,
    marginHorizontal: 10,
    color: "#374151", // ✅ Dark Text
    fontFamily: "Tajawal_500Medium",
    fontSize: 14,
  },
  cancelTextBtn: {
    marginTop: 20,
    marginBottom: 15,
    alignItems: "center",
    backgroundColor: "#ffffffff",
    borderWidth: 1,
    borderColor: "red",

    borderRadius: 40,
    padding: 15,
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

  cancelBtnText: {
    color: "#DC2626", // ✅ Red Text
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  pinContainer: {
    alignSelf: "center",
    backgroundColor: "#F3E8FF", // ✅ Light Purple Background
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#D8B4FE", // Light Purple Border
  },

  pinLabel: {
    fontSize: 13,
    color: "#6B7280", // Gray text
    marginBottom: 4,
    fontFamily: "Tajawal_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  pinCodeText: {
    fontSize: 36,
    fontFamily: "Tajawal_700Bold",
    color: "#775BD4", // ✅ Purple Code
    letterSpacing: 8,
  },

  fixedPin: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinShadow: {
    width: 6,
    height: 6,
    backgroundColor: "#45986cff",
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
    backgroundColor: "#F3F4F6", // ✅ Light Gray (matches app background)
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
    borderColor: "#E5E7EB", // ✅ Subtle light border
    borderWidth: 1,
  },
  routeText: {
    color: "#1F2937", // ✅ Dark Charcoal (Visible on light background)
    fontFamily: "Tajawal_500Medium",
    fontSize: 18,
    lineHeight: 32,
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
    // color: "#f2f2f2ff", // ❌ DELETE or CHANGE this (it was white)
    color: "#1F2937", // ✅ Default to dark (or rely on the inline style above)
    fontWeight: "bold",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContentWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    minHeight: 300,
    elevation: 20,
    // Remove 'flex: 1' if you have it here, it should only take necessary height
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
    borderColor: "#45986cff",
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
    marginBottom: 30,
    padding: 15,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#6b7280",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },

  noteContainer: {
    backgroundColor: "#F9FAFB", // ✅ Very Light Gray (distinct from white bg)
    borderRadius: 12,
    paddingHorizontal: 10, // Added a bit more padding
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB", // ✅ Subtle Border
  },
  noteInput: {
    flex: 1,
    height: 45,
    color: "#1F2937", // ✅ Dark Text (Visible on light bg)
    fontFamily: "Tajawal_500Medium",
    fontSize: 14,
    textAlign: "left", // Ensure text aligns correctly
  },

  tripAddressMain: {
    color: "#111827", // Dark Black/Charcoal
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
    marginBottom: 2, // Small gap between lines
  },
  tripAddressSub: {
    color: "#6B7280", // Gray
    fontFamily: "Tajawal_400Regular",
    fontSize: 13,
  },
  mapActionCard: {
    backgroundColor: "white",
    borderRadius: 100,
    borderColor: "#f0f0f0ff",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: 5, // Matches the search card width
    marginTop: 5, // Spacing from the search inputs
    alignItems: "center",
    borderWidth: 1,
    // Soft Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  mapActionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffffff", // Very Light Purple
    justifyContent: "center",
    alignItems: "center",
  },
  mapActionText: {
    fontSize: 16,
    color: "#1F2937", // Dark Grey (Professional)
    fontFamily: "Tajawal_700Bold",
    flex: 1, // Takes up remaining space
  },
  // --- FLOATING "NEXT" BUTTON ---
  floatingNextContainer: {
    position: "absolute",
    bottom: 30, // 1. Anchor it to the very bottom
    left: 20,
    right: 20,
    zIndex: 200,

    // 2. Use padding to push the button up
    paddingBottom: 30, // <--- Adjust this value to move button up/down

    // Note: Shadows might look different if applied to the container with padding
    shadowColor: "#775BD4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  gradientButton: {
    height: 56,
    borderRadius: 28, // Fully rounded (Pill shape)
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  gradientButtonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    marginRight: 8, // Spacing for icon
    paddingBottom: -10, // Fine-tune vertical alignment
  },
  // --- AUTOCOMPLETE SUGGESTIONS ---
  // Inside styles = StyleSheet.create({ ... })

  autocompleteRow: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 0, // Keep it borderless for that clean look
  },
  yassirMainText: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    color: "#111827", // Very dark charcoal
    marginBottom: 2,
  },
  yassirSubText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#9CA3AF", // Light gray
  },
  // Update the listView in your GooglePlacesAutocomplete styles to this:
  yassirListView: {
    backgroundColor: "white",
    marginTop: 10,
    elevation: 0, // Remove shadow for that flat clean look
    shadowOpacity: 0, // Remove shadow for iOS
    borderTopWidth: 0,
  },
  autocompleteIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F9FAFB", // Light gray background for icon
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12, // Gap between icon and text (LTR)
  },
  autocompleteText: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937", // Dark professional text
    fontFamily: "Tajawal_500Medium",
    textAlign: "left", // Default alignment
  },

  cleanInput: {
    fontFamily: "Tajawal_500Medium",
    fontSize: 16,
    color: "#1F2937",
    height: 40,
    backgroundColor: "transparent",
  },
  inputSeparator: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 5,
    marginLeft: 0,
  },

  // --- RESULT ROW STYLING (Yassir Style) ---
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: "center",
    backgroundColor: "white",
  },
  resultMainText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
    marginBottom: 2,
  },
  resultSubText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#9CA3AF",
  },
  resultIconBg: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#Fdf4ff", // Very light purple bg for icon
    justifyContent: "center",
    alignItems: "center",
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    marginTop: 15,
  },
  typeBtnActive: {
    backgroundColor: "#775BD4", // Brand Purple
    borderColor: "#775BD4",
  },
  typeBtnInactive: {
    backgroundColor: "white",
    borderColor: "#E5E7EB",
  },
  typeBtnText: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 14,
  },
  // Add/Update these in your StyleSheet
  loadingBarContainer: {
    height: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 20,
    width: "100%",
  },
  loadingBarFill: {
    height: "100%",
    backgroundColor: "#775BD4", // Brand Purple
    width: "50%", // In a real app, animate this width or translateX
  },
  pendingContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  pulseContainer: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3E8FF", // Very light purple
    borderRadius: 40,
    marginBottom: 15,
  },
  searchingTextMain: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
    marginBottom: 5,
  },
  searchingTextSub: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#6B7280",
    marginBottom: 20,
  },
  softCancelBtn: {
    backgroundColor: "#F3F4F6", // Light Gray background
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 10,
  },
  softCancelText: {
    color: "#EF4444", // Red text
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
  // --- NEW RIDE PANEL STYLES ---
  rideFloatingPanel: {
    position: "absolute", // Floats above the map
    bottom: 0, // Anchors to the very bottom (removes bottom margin)
    left: 0, // Anchors to the very left (removes left margin)
    right: 0, // Anchors to the very right (removes right margin)

    // Explicitly resetting margins just in case
    margin: 0,
    marginHorizontal: 0,
    marginBottom: 0,

    // Visual styles for the container
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, // Round top corners only
    borderTopRightRadius: 20,
    padding: 20, // Internal spacing for content

    // Shadow to make it pop
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10, // For Android shadow
  },
  // 1. HEADER
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 25,
  },
  statusTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
  },
  statusSub: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    fontFamily: "Tajawal_500Medium",
  },
  etaPill: {
    backgroundColor: "#111827", // Black pill
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  etaText: {
    color: "white",
    fontFamily: "Tajawal_700Bold",
    fontSize: 12,
  },

  // 2. PIN CODE ROW
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB", // Very light gray background
    borderRadius: 16,
    padding: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  pinLabelTitle: {
    fontSize: 12,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 4,
  },
  pinLabelSub: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "Tajawal_400Regular",
  },
  pinValue: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: "#775BD4", // Brand Purple
    letterSpacing: 6, // W i d e  spacing for code
  },

  // 3. DRIVER INFO ROW
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 15, // Gap between avatar and text
  },
  avatarCircle: {
    width: 65,
    height: 65,
    borderRadius: 50,
    backgroundColor: "#F3E8FF", // Light purple bg for avatar
    justifyContent: "center",
    alignItems: "center",
  },
  ratingBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  driverInfo: {
    flex: 1,
    justifyContent: "center",
  },

  carText: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Tajawal_500Medium",
    marginBottom: 4,
    textAlign: "left",
  },
  plateBox: {
    backgroundColor: "#f8cc1fff", // Light Yellow (Like a license plate)
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 50,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#ebb608ff",
  },
  plateText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
    color: "#2c2c2cff", // Dark yellow/brown text
  },
  callBtnBig: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#775BD4",
    justifyContent: "center",
    alignItems: "center",
    // Glow effect
    elevation: 6,
    shadowColor: "#775BD4",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  // --- SCHEDULE CARD STYLES ---
  // --- SCHEDULE CARD STYLES ---
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // ✅ Pure White Background
    padding: 10, // Increased padding for a premium feel
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB", // Subtle light gray border
    marginBottom: 5,
    marginTop: 5,
    // Add a soft shadow to lift it off the page
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  scheduleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    // marginRight removed (handled in JSX)
  },
  scheduleTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#111827", // ✅ Darkest Charcoal (almost black)
    marginBottom: 2,
  },
  scheduleSub: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563", // ✅ Medium Dark Gray (readable)
  },
  clearScheduleBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#FEE2E2", // Light Red background
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  // --- IOS PICKER MODAL STYLES ---
  iosDatePickerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40, // Safe area for iPhone home bar
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
  },
  pickerCancelText: {
    fontSize: 16,
    fontFamily: "Tajawal_500Medium",
    color: "#6B7280",
  },
  pickerConfirmText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#775BD4", // Brand Color
  },
  pickerWrapper: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
