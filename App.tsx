import React, { useState, useEffect } from "react";
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

import {
  useFonts,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from "@expo-google-fonts/tajawal";

import { LanguageProvider, useLanguage } from "./src/context/LanguageContext";

// Screens
import OnboardingScreen from "./src/screens/OnboardingScreen";
import PassengerDashboard from "./src/screens/PassengerDashboard";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AddSavedPlaceScreen from "./src/screens/AddSavedPlaceScreen";
import CustomDrawer from "./src/CustomDrawer"; // Ensure path is correct

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
  // 1. Get isRTL from our custom context, NOT I18nManager
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  return (
    <Drawer.Navigator
      // 2. Use the language string for the key to force re-render when lang changes
      key={`drawer-${language}-${session?.user?.id}`}
      id="LeftDrawer"
      screenOptions={{
        headerShown: false,
        swipeEnabled: false,
        drawerStyle: { width: 0 },
        // 3. This manually moves the drawer to the Right if Arabic
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

  const { language } = useLanguage();

  // 1. DEFINE THIS FUNCTION FIRST (Before useEffect)
  const startRolePolling = (userId: string) => {
    setLoading(true);
    const intervalId = setInterval(async () => {
      // 👇 CHANGE 1: Select both columns or just roles
      const { data } = await supabase
        .from("profiles")
        .select("role, roles") 
        .eq("id", userId)
        .single();
        
      // 👇 CHANGE 2: Check either column
      if (data && (data.role || (data.roles && data.roles.includes("PASSENGER")))) {
        clearInterval(intervalId);
        // Prefer the array check if available, otherwise fallback to string
        setRole(data.role || "PASSENGER"); 
        setLoading(false);
      }
    }, 1000);

    // Timeout to stop polling after 15 seconds if nothing found
    setTimeout(() => {
      clearInterval(intervalId);
      // Only stop loading if we haven't found a role yet to avoid overwriting success state
      if (!role) setLoading(false);
    }, 15000);
  };

  // 2. NOW USE IT IN USEEFFECT
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) startRolePolling(session.user.id);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          // Force NavigationContainer recreation on login to fix Drawer RTL/LTR
          setNavKey((prev) => prev + 1);
          startRolePolling(session.user.id);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
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
    // CHANGE IS HERE: Remove the `key` prop that contained `language`
    // We only keep `navKey` which is used for login/logout resets, not language changes.
    <NavigationContainer key={`nav-${navKey}`}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session || !role ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            {/* The Dashboard contains the Drawer. 
                The Drawer has its own key inside 'PassengerDrawer', 
                so it will update internally without closing this parent Stack. */}
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
// 4. EXPORT WRAPPED APP
// =================================================================
export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
