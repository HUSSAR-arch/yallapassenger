import React, { useState, useEffect, useRef } from "react";
import MenuScreen from "./src/screens/MenuScreen";
import TopUpScreen from "./src/screens/TopUpScreen";
import SupportScreen from "./src/screens/SupportScreen";
import TicketChatScreen from "./src/screens/TicketChatScreen";
import {
  View,
  ActivityIndicator,
  I18nManager,
  Animated,
  Easing,
  Alert,
} from "react-native";
import RideDetailsScreen from "./src/screens/RideDetailsScreen";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import {
  createStackNavigator,
  CardStyleInterpolators,
} from "@react-navigation/stack";
import { supabase } from "./src/lib/supabase";
import { Home, Clock, User } from "lucide-react-native";

// ✅ FIX: Use expo-font only (no specific names imported)
import { useFonts } from "expo-font";

import { LanguageProvider, useLanguage } from "./src/context/LanguageContext";

// Screens
import OnboardingScreen from "./src/screens/OnboardingScreen";
import PassengerDashboard from "./src/screens/PassengerDashboard";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AddSavedPlaceScreen from "./src/screens/AddSavedPlaceScreen";
import CustomDrawer from "./src/CustomDrawer"; 

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// =================================================================
// 1. CUSTOM ANIMATION CONFIGURATION
// =================================================================
const CustomTransitionSpec = {
  animation: "timing" as const,
  config: {
    duration: 600,
    easing: Easing.out(Easing.exp),
  },
};

const ExactSlideUpTransition = {
  gestureDirection: "vertical" as const,
  transitionSpec: {
    open: CustomTransitionSpec,
    close: CustomTransitionSpec,
  },
  cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
};

// =================================================================
// 2. PASSENGER DRAWER
// =================================================================
function PassengerDrawer({ session }: any) {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  return (
    <Drawer.Navigator
      key={`drawer-${language}-${session?.user?.id}`}
      id="LeftDrawer"
      screenOptions={{
        headerShown: false,
        swipeEnabled: false,
        drawerStyle: { width: 0 },
        drawerPosition: isRTL ? "right" : "left",
      }}
    >
      <Drawer.Screen
        name="Home"
        children={(props) => (
          <PassengerDashboard {...props} session={session} />
        )}
      />
      <Drawer.Screen name="Activity" component={HistoryScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
}

// =================================================================
// 3. MAIN APP LOGIC
// =================================================================
function MainApp() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [navKey, setNavKey] = useState(0);

  // ✅ FIX: Load fonts here so they are available everywhere
  const [fontsLoaded] = useFonts({
    "Tajawal_400Regular": require("./src/assets/fonts/Tajawal-Regular.ttf"),
    "Tajawal_500Medium": require("./src/assets/fonts/Tajawal-Medium.ttf"),
    "Tajawal_700Bold": require("./src/assets/fonts/Tajawal-Bold.ttf"),
    "Tajawal_800ExtraBold": require("./src/assets/fonts/Tajawal-ExtraBold.ttf"),
  });

  // We use a ref for role to access the latest value inside setTimeout closures
  const roleRef = useRef<string | null>(null);

  const startRolePolling = (userId: string) => {
    setLoading(true);
    
    // Start Polling Interval
    const intervalId = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role, roles, is_suspended")
          .eq("id", userId)
          .single();

        if (error) throw error;

        if (data) {
          // CHECK SUSPENSION
          if (data.is_suspended) {
            clearInterval(intervalId);
            setLoading(false);
            
            // Log out logic
            await supabase.auth.signOut();
            setSession(null);
            setRole(null);
            roleRef.current = null;
            
            Alert.alert(
              "Account Suspended",
              "Your account has been suspended. Please contact support."
            );
            return;
          }

          // CHECK ROLE
          if (data.role || (data.roles && data.roles.includes("PASSENGER"))) {
            clearInterval(intervalId);
            const foundRole = data.role || "PASSENGER";
            setRole(foundRole);
            roleRef.current = foundRole;
            setLoading(false);
          }
        }
      } catch (err) {
        console.log("Polling error (ignorable):", err);
      }
    }, 1000);

    // Safety Timeout: Stop polling after 15 seconds
    setTimeout(() => {
      clearInterval(intervalId);
      if (!roleRef.current) {
        setLoading(false);
      }
    }, 15000);
  };

  useEffect(() => {
    // Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        startRolePolling(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Auth State Listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          setNavKey((prev) => prev + 1); // Reset Nav for RTL updates
          startRolePolling(session.user.id);
        } else {
          setRole(null);
          roleRef.current = null;
          setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // ✅ FIX: Wait for BOTH fonts and Auth loading
  if (loading || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFC107",
        }}
      >
        <ActivityIndicator size="large" color="black" />
      </View>
    );
  }

  return (
    <NavigationContainer key={`nav-${navKey}`}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session || !role ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard">
              {(props) => <PassengerDrawer {...props} session={session} />}
            </Stack.Screen>

            <Stack.Screen
              name="MenuScreen"
              component={MenuScreen}
              initialParams={{ session: session }}
              options={{
                headerShown: false,
                presentation: "transparentModal",
                ...ExactSlideUpTransition,
              }}
            />

            <Stack.Screen
              name="AddSavedPlace"
              component={AddSavedPlaceScreen}
              options={{
                headerShown: false,
                presentation: "transparentModal",
                ...ExactSlideUpTransition,
              }}
            />
            <Stack.Screen
              name="TopUpScreen"
              component={TopUpScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SupportScreen"
              component={SupportScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TicketChatScreen"
              component={TicketChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RideDetails"
              component={RideDetailsScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// =================================================================
// 4. EXPORT
// =================================================================
export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}