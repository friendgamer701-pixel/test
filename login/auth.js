import { supabase } from "../supabase.js";
// Handle the login form submission
const loginForm = document.querySelector("form");
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(`Error: ${error.message}`);
  } else {
    // You can redirect the user to another page here
    window.location.href = "/admin/dashboard.html";
    console.log(data);
  }
});
