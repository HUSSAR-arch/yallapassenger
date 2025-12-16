import React, { useEffect, useRef, useState } from "react";
import { Image, Platform } from "react-native";
import { Marker } from "react-native-maps";
import { supabase } from "../lib/supabase"; // Adjust path to your supabase client

interface DriverMarkerProps {
  driverId: string;
  initialLocation: {
    latitude: number;
    longitude: number;
    heading: number;
  };
}

export default function DriverMarker({
  driverId,
  initialLocation,
}: DriverMarkerProps) {
  const markerRef = useRef<any>(null);
  // Track the current rotation in state
  const [rotation, setRotation] = useState(initialLocation?.heading || 0);

  useEffect(() => {
    // Listen for realtime updates specifically for this driver
    const channel = supabase
      .channel(`driver-tracking-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          const newData = payload.new;

          // 1. Update Rotation State
          if (newData.heading !== null) {
            setRotation(newData.heading);
          }

          // 2. Smoothly Animate the Marker
          // This moves the car from Point A to Point B over 2000ms
          const newCoordinate = {
            latitude: newData.latitude,
            longitude: newData.longitude,
          };

          if (Platform.OS === "android") {
            markerRef.current?.animateMarkerToCoordinate(newCoordinate, 2000);
          } else {
            // iOS supports the same method
            markerRef.current?.animateMarkerToCoordinate(newCoordinate, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return (
    <Marker
      ref={markerRef}
      coordinate={{
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      }}
      // Anchor 0.5, 0.5 means the icon rotates around its exact center
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true} // IMPORTANT: Makes the car lie flat on the map grid
      rotation={rotation}
    >
      {/* Replace this with your own car image asset */}
      <Image
        source={{
          uri: "https://cdn-icons-png.flaticon.com/512/3202/3202926.png",
        }}
        style={{ width: 40, height: 40, resizeMode: "contain" }}
      />
    </Marker>
  );
}
