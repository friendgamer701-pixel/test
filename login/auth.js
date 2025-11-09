// auth.js
import { supabase, checkAdmin } from "../supabase.js"; // Import checkAdmin function

// Handle the login form submission
const loginForm = document.querySelector("form"); //
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); //

  const email = document.getElementById("login-email").value; //
  const password = document.getElementById("login-password").value; //

  // 1. Attempt to sign the user in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  }); //

  if (error) {
    // This handles incorrect email/password
    alert(`Error: ${error.message}`); //
  } else {
    // 2. Login was successful. NOW, check if they are an admin.
    const isAdmin = await checkAdmin(data.user); //

    if (isAdmin) {
      // 3. User is an admin. Proceed to the dashboard.
      window.location.href = "/admin/dashboard.html"; //
    } else {
      // 4. User is NOT an admin. Sign them out immediately.
      await supabase.auth.signOut();
      alert("Access denied. Only admin accounts are allowed to log in.");
    }
  }
});