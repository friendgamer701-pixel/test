import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // Elements
    const loginForm = document.getElementById("student-login-form");
    const loginSection = document.getElementById("login-section");
    const resultsSection = document.getElementById("results-section");
    const loginError = document.getElementById("login-error");
    const logoutBtn = document.getElementById("logout-btn");
    
    const admissionInput = document.getElementById("admission_no");
    const dobInput = document.getElementById("dob");
    const loginBtn = document.getElementById("login-btn");

    // Profile Elements
    const profileName = document.getElementById("profile-name");
    const profileDept = document.getElementById("profile-dept");
    const profileAvatar = document.getElementById("profile-avatar");
    const tableBody = document.getElementById("history-table-body");
    const emptyState = document.getElementById("no-records-msg");
    
    // NEW: Overdue Warning Container
    const historyCard = document.querySelector(".history-card");
    let overdueAlert = document.getElementById("overdue-alert");

    // Create the alert element dynamically if it doesn't exist
    if (!overdueAlert) {
        overdueAlert = document.createElement("div");
        overdueAlert.id = "overdue-alert";
        overdueAlert.className = "overdue-banner";
        overdueAlert.innerHTML = `
            <i data-lucide="alert-circle"></i>
            <span>You have overdue books! Please return them to the library immediately.</span>
        `;
        overdueAlert.style.display = "none"; // Hidden by default
        // Insert it before the table inside the history card
        const tableResponsive = historyCard.querySelector(".table-responsive");
        historyCard.insertBefore(overdueAlert, tableResponsive);
    }

    // --- 0. Auto-Format Date Input (DD/MM/YYYY) ---
    dobInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (value.length > 8) value = value.slice(0, 8); // Limit to 8 digits
        
        if (value.length >= 5) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4);
        } else if (value.length >= 3) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        e.target.value = value;
    });

    // --- 1. Login Handler ---
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const admissionNo = admissionInput.value.trim();
        const dobRaw = dobInput.value.trim(); // DD/MM/YYYY

        // Convert DD/MM/YYYY -> YYYY-MM-DD for Database
        const dateParts = dobRaw.split('/');
        if (dateParts.length !== 3) {
            loginError.textContent = "Please enter date in DD/MM/YYYY format";
            return;
        }
        const dbDob = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // YYYY-MM-DD

        loginError.textContent = "";
        loginBtn.textContent = "Verifying...";
        loginBtn.disabled = true;

        try {
            // Verify Student Credentials
            const { data: student, error: studentError } = await supabase
                .from("student")
                .select("*")
                .eq("admission_no", admissionNo)
                .eq("dob", dbDob) // Compare with converted date
                .maybeSingle();

            if (studentError) throw studentError;

            if (!student) {
                throw new Error("Invalid Admission Number or Date of Birth.");
            }

            // Success: Load Data
            loadStudentData(student);

        } catch (err) {
            console.error(err);
            loginError.textContent = err.message || "An error occurred.";
            loginBtn.textContent = "View Records";
            loginBtn.disabled = false;
        }
    });

    // --- 2. Load Data & Switch View ---
    const loadStudentData = async (student) => {
        // UI Update: Hide Login, Show Results
        loginSection.style.display = "none";
        resultsSection.style.display = "block";

        // Set Profile Info
        profileName.textContent = student.student_name;
        profileDept.textContent = `${student.department} - Year ${student.year}`;
        profileAvatar.textContent = getInitials(student.student_name);

        // Fetch Checkouts
        const { data: checkouts, error: checkoutError } = await supabase
            .from("checkouts")
            .select(`
                *,
                books ( title )
            `)
            .eq("admission_no", student.admission_no)
            .order("checkout_date", { ascending: false });

        if (checkoutError) {
            console.error(checkoutError);
            alert("Error loading history.");
            return;
        }

        renderTable(checkouts);
    };

    // --- 3. Render Table ---
    const renderTable = (checkouts) => {
        tableBody.innerHTML = "";
        overdueAlert.style.display = "none"; // Reset alert
        let hasOverdueBooks = false;
        
        if (!checkouts || checkouts.length === 0) {
            emptyState.style.display = "block";
            return;
        }

        emptyState.style.display = "none";
        const today = new Date().toISOString().split("T")[0];

        checkouts.forEach(record => {
            const tr = document.createElement("tr");
            
            const bookTitle = record.books?.title || "Unknown Book";
            
            // Helper to format YYYY-MM-DD to DD/MM/YYYY for display
            const formatDate = (isoDate) => {
                if (!isoDate) return "-";
                const d = new Date(isoDate);
                return d.toLocaleDateString('en-GB'); // en-GB gives DD/MM/YYYY
            };

            const borrowedDate = formatDate(record.checkout_date);
            const dueDate = formatDate(record.due_date);
            const returnedDate = record.returned_date ? formatDate(record.returned_date) : "-";

            // Determine Status Logic
            let statusBadge = "";
            let statusText = "";

            if (record.status === 'returned') {
                statusBadge = "status-returned";
                statusText = "Returned";
            } else {
                // Check if overdue
                const dueDateStr = record.due_date.split('T')[0];
                const isOverdue = dueDateStr < today;
                
                if (isOverdue) {
                    statusBadge = "status-overdue";
                    statusText = "Overdue";
                    hasOverdueBooks = true; // Flag found overdue book
                } else {
                    statusBadge = "status-active";
                    statusText = "Active";
                }
            }

            tr.innerHTML = `
                <td style="font-weight: 500; color: #1e293b;">${bookTitle}</td>
                <td>${borrowedDate}</td>
                <td>${dueDate}</td>
                <td>${returnedDate}</td>
                <td><span class="status-badge ${statusBadge}">${statusText}</span></td>
            `;
            tableBody.appendChild(tr);
        });

        // Show Alert if any book is overdue
        if (hasOverdueBooks) {
            overdueAlert.style.display = "flex";
            if (window.lucide) lucide.createIcons(); // Re-render icon
        }
    };

    // --- 4. Utilities ---
    const getInitials = (name) => {
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
    };

    // --- 5. Logout ---
    logoutBtn.addEventListener("click", () => {
        loginSection.style.display = "block";
        resultsSection.style.display = "none";
        loginForm.reset();
        loginBtn.textContent = "View Records";
        loginBtn.disabled = false;
        tableBody.innerHTML = "";
        overdueAlert.style.display = "none";
    });
});