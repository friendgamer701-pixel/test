import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Initialize the Supabase client
const supabaseUrl = "https://bhmxhcqkwzuckxknzyub.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobXhoY3Frd3p1Y2t4a256eXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1OTk2ODQsImV4cCI6MjA3ODE3NTY4NH0.Q0Gsi9XWE1VqeSagL9D5ZMUCXYVRGnkVwuAk4PYT3Ik";

const supabase = createClient(supabaseUrl, supabaseKey);
export { supabase};
