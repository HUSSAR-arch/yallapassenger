import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { latLngToCell, gridDisk } from "https://esm.sh/h3-js@4.1.0"; // Import H3 library

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS (Browser security)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 1. Get data from the App
    const {
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      pickup_address,
      dropoff_address,
      fare_estimate,
    } = await req.json();

    // 2. Get the Passenger's User ID
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not found");

    // 3. CALCULATE HEXAGONS (The Search Area)
    // Resolution 8 is good for cities (hexagons are ~460m wide)
    const originIndex = latLngToCell(pickup_lat, pickup_lng, 8);

    // Get the center hex + 1 ring of neighbors (7 hexagons total)
    const nearbyIndices = gridDisk(originIndex, 1);

    // 4. Insert the Ride into Database
    const { data: rideData, error: insertError } = await supabaseClient
      .from("rides")
      .insert({
        passenger_id: user.id,
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
        pickup_address,
        dropoff_address,
        fare_estimate,
        status: "PENDING",
        nearby_h3_indices: nearbyIndices, // <--- IMPORTANT: We save the search area here
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. TRIGGER THE DISPATCHER (The Logic from Snippet 1)
    // We manually tell the database: "Hey, I made a ride (ID X), go find drivers!"
    const { error: rpcError } = await supabaseClient.rpc(
      "find_and_offer_ride",
      { target_ride_id: rideData.id }
    );

    if (rpcError) console.error("Dispatch Error:", rpcError);

    // 6. Return success to the app
    return new Response(JSON.stringify(rideData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
