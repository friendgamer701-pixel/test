import { supabase } from '../supabase.js';

// Check if the user is logged in
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  // Redirect to the login page if not logged in
  window.location.href = '/login/auth.html';
}
