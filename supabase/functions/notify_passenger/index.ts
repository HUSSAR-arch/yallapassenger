import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { record, old_record } = await req.json();

    // 1. FILTER: Only run if status changed to 'ACCEPTED'
    // We check if it WAS NOT accepted before, and IS accepted now.
    if (record.status !== "ACCEPTED" || old_record.status === "ACCEPTED") {
      return new Response(JSON.stringify({ message: "Status ignored" }), {
        headers: corsHeaders,
      });
    }

    // 2. Initialize Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Get Passenger's Push Token
    const { data: passenger, error } = await supabaseAdmin
      .from("profiles")
      .select("push_token")
      .eq("id", record.passenger_id)
      .single();

    if (error || !passenger?.push_token) {
      console.log("No token found for passenger:", record.passenger_id);
      return new Response(JSON.stringify({ message: "No token" }), {
        headers: corsHeaders,
      });
    }

    if (!passenger.push_token.startsWith("ExponentPushToken")) {
      return new Response(JSON.stringify({ message: "Invalid token format" }), {
        headers: corsHeaders,
      });
    }

    // 4. Construct Notification
    const message = {
      to: passenger.push_token,
      sound: "default", // Or "push.wav" if you added it to the Passenger App
      title: "Yalla! Driver Found 🚗",
      body: `A driver has accepted your ride and is on the way!`,
      data: { rideId: record.id },
      priority: "high",
      channelId: "ride-updates", // Matches the Passenger App channel ID
    };

    // 5. Send to Expo
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Notification Sent:", result);

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
