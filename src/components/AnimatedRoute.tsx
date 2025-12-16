// AnimatedRoute.tsx
import React, { useState, useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { Polyline } from "react-native-maps";

interface AnimatedRouteProps {
  pickup: { latitude: number; longitude: number };
  dropoff: { latitude: number; longitude: number };
}

const AnimatedRoute = ({ pickup, dropoff }: AnimatedRouteProps) => {
  const [animatedPath, setAnimatedPath] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  // Use a ref for the animation value so it persists
  const drawProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Reset
    setAnimatedPath([]);
    drawProgress.setValue(0);

    // 2. Define Animation Loop (Snake Effect)
    const animationLoop = Animated.loop(
      Animated.sequence([
        // Fill (A -> B)
        Animated.timing(drawProgress, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.delay(100),
        // Unfill (Tail follows A -> B)
        Animated.timing(drawProgress, {
          toValue: 2,
          duration: 1500,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.delay(100),
      ])
    );

    animationLoop.start();

    // 3. Listener to calculate smooth coordinates
    const listener = drawProgress.addListener(({ value }) => {
      let startPoint, endPoint;

      if (value <= 1) {
        // Phase 1: Growing
        startPoint = { latitude: pickup.latitude, longitude: pickup.longitude };

        const currentLat =
          pickup.latitude + (dropoff.latitude - pickup.latitude) * value;
        const currentLng =
          pickup.longitude + (dropoff.longitude - pickup.longitude) * value;

        endPoint = { latitude: currentLat, longitude: currentLng };
      } else {
        // Phase 2: Shrinking (Tail moves)
        const phase2Progress = value - 1;

        const startLat =
          pickup.latitude +
          (dropoff.latitude - pickup.latitude) * phase2Progress;
        const startLng =
          pickup.longitude +
          (dropoff.longitude - pickup.longitude) * phase2Progress;

        startPoint = { latitude: startLat, longitude: startLng };
        endPoint = { latitude: dropoff.latitude, longitude: dropoff.longitude };
      }

      setAnimatedPath([startPoint, endPoint]);
    });

    return () => {
      drawProgress.removeListener(listener);
      animationLoop.stop();
    };
  }, [pickup, dropoff]);

  if (animatedPath.length < 2) return null;

  return (
    <>
      {/* Static Gray Background Path */}
      <Polyline
        coordinates={[pickup, dropoff]}
        strokeColor="#e5e7eb"
        strokeWidth={4}
        lineCap="round"
      />

      {/* Animated Foreground Path */}
      <Polyline
        coordinates={animatedPath}
        strokeColor="#1F2937"
        strokeWidth={4}
        lineCap="round"
      />
    </>
  );
};

// React.memo prevents unnecessary re-renders
export default React.memo(AnimatedRoute);
