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

    // --- 1. Login Handler ---
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const admissionNo = admissionInput.value.trim();
        const dob = dobInput.value;

        loginError.textContent = "";
        loginBtn.textContent = "Verifying...";
        loginBtn.disabled = true;

        try {
            // Verify Student Credentials
            const { data: student, error: studentError } = await supabase
                .from("student")
                .select("*")
                .eq("admission_no", admissionNo)
                .eq("dob", dob)
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
        
        if (!checkouts || checkouts.length === 0) {
            emptyState.style.display = "block";
            return;
        }

        emptyState.style.display = "none";
        const today = new Date().toISOString().split("T")[0];

        checkouts.forEach(record => {
            const tr = document.createElement("tr");
            
            const bookTitle = record.books?.title || "Unknown Book";
            const borrowedDate = new Date(record.checkout_date).toLocaleDateString();
            const dueDate = new Date(record.due_date).toLocaleDateString();
            const returnedDate = record.returned_date 
                ? new Date(record.returned_date).toLocaleDateString() 
                : "-";

            // Determine Status Logic
            let statusBadge = "";
            let statusText = "";

            if (record.status === 'returned') {
                statusBadge = "status-returned";
                statusText = "Returned";
            } else {
                // Check if overdue
                const isOverdue = record.due_date < today;
                if (isOverdue) {
                    statusBadge = "status-overdue";
                    statusText = "Overdue";
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
    });
});