import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 1. Your Project's URL and Key
const supabaseUrl = "https://bifwksautkkfyvbwgwls.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpZndrc2F1dGtrZnl2Yndnd2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM5OTcsImV4cCI6MjA3ODE4OTk5N30.5lNGfRNN_PKwYDTL92rHnEsZEoAE0x0VRb62WBVo_r4";

// 2. Initialize the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. The Admin Check function
async function checkAdmin(user) {
  // If no user is logged in, they can't be an admin
  if (!user) {
    return false;
  }

  // Query your 'user_roles' table
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle(); // .maybeSingle() is perfect here. It returns null instead of an error if no user is found.

  // If there was an error (like RLS blocking the query), log it and deny access
  if (error) {
    console.error("Error checking admin status:", error);
    return false;
  }

  // Return true ONLY if the query found a user AND their role is 'admin'
  return data && data.role === 'admin';
}

// 4. Export the client and the function so other files can import them
export { supabase, checkAdmin };