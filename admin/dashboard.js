import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const pageContainer = document.querySelector(".page-container");
  const menuToggle = document.querySelector(".menu-toggle");
  const logoutButton = document.getElementById("logout-btn");
  const sidebarBtns = document.querySelectorAll(".sidebar-btn");
  const dashboardSection = document.getElementById("dashboard-section");
  const contentFrame = document.getElementById("content-frame");
  const searchInput = document.getElementById("search-box");

  // Modal Elements
  const checkoutModal = document.getElementById("checkout-modal");
  const checkoutForm = document.getElementById("checkout-form");
  const cancelCheckoutBtn = document.getElementById("cancel-checkout-btn");
  const checkoutBookTitle = document.getElementById("checkout-book-title");
  const checkoutBookIdInput = document.getElementById("checkout-book-id");
  const studentSelect = document.getElementById("student-select");
  const dueDateInput = document.getElementById("due-date-select");
  
  // New Filter Elements
  const yearFilterSelect = document.getElementById("checkout-filter-year");
  const deptFilterSelect = document.getElementById("checkout-filter-dept");

  let studentSelectInstance = null;

  // --- SECURITY FIX 1: STRICT AUTH CHECK ---
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // If not logged in, Redirect immediately
  if (userError || !user) {
    window.location.href = "/login/auth.html"; 
    return; 
  }

  // --- SECURITY FIX 2: MULTI-TAB SYNC (NEW) ---
  // If user logs out in Tab A, this listener fires in Tab B and redirects it.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
        window.location.href = "/login/auth.html";
    }
  });

  // --- MOBILE SIDEBAR FIX START ---
  if (window.innerWidth <= 768) {
    pageContainer.classList.add("sidebar-hidden");
  }

  if (pageContainer) pageContainer.style.visibility = "visible";

  if (menuToggle && pageContainer) {
    menuToggle.addEventListener("click", (e) => {
        e.stopPropagation(); 
        pageContainer.classList.toggle("sidebar-hidden");
    });
  }

  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
        if (!pageContainer.classList.contains("sidebar-hidden")) {
            if (!e.target.closest('.sidebar') && !e.target.closest('.menu-toggle')) {
                pageContainer.classList.add("sidebar-hidden");
            }
        }
    }
  });
  // --- MOBILE SIDEBAR FIX END ---

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await supabase.auth.signOut();
      // The onAuthStateChange listener above will handle the redirect, 
      // but we can add it here for good measure.
      window.location.href = "/login/auth.html";
    });
  }

  // --- Stats Logic ---
  const fetchStats = async () => {
    const [
      { data: booksData },
      { count: checkedOutCount },
      { count: studentsCount },
    ] = await Promise.all([
      supabase.from("books").select("total_copies, available_copies"),
      supabase.from("checkouts").select("*", { count: "exact", head: true }).eq("status", "checked_out"),
      supabase.from("student").select("*", { count: "exact", head: true }),
    ]);

    const totalBooks = booksData?.reduce((sum, book) => sum + (book.total_copies || 0), 0) || 0;
    const availableBooks = booksData?.reduce((sum, book) => sum + (book.available_copies || 0), 0) || 0;
    
    if(document.getElementById("stats-total-books")) document.getElementById("stats-total-books").textContent = totalBooks;
    if(document.getElementById("stats-available-books")) document.getElementById("stats-available-books").textContent = availableBooks;
    if(document.getElementById("stats-checked-out")) document.getElementById("stats-checked-out").textContent = checkedOutCount || 0;
    if(document.getElementById("stats-total-students")) document.getElementById("stats-total-students").textContent = studentsCount || 0;
  };
  
  await fetchStats();

  supabase.channel("dashboard-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "books" }, fetchStats)
    .on("postgres_changes", { event: "*", schema: "public", table: "checkouts" }, fetchStats)
    .on("postgres_changes", { event: "*", schema: "public", table: "student" }, fetchStats)
    .subscribe();

  // --- Navigation ---
  const navigateToSection = (sectionName) => {
    sidebarBtns.forEach((b) => b.classList.remove("active"));
    const activeBtn = document.querySelector(`.sidebar-btn[data-section="${sectionName}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    if (sectionName === "dashboard") {
      dashboardSection.style.display = "block";
      contentFrame.style.display = "none";
    } else {
      dashboardSection.style.display = "none";
      contentFrame.style.display = "block";
      contentFrame.src = `${sectionName}.html`;
    }
    
    if (window.innerWidth <= 768) {
        pageContainer.classList.add("sidebar-hidden");
    }
  };

  sidebarBtns.forEach((btn) => {
    btn.addEventListener("click", () => navigateToSection(btn.dataset.section));
  });

  // --- FILTER LOGIC START ---
  const populateFilterDropdowns = async () => {
    yearFilterSelect.innerHTML = '<option value="">All Years</option>';
    deptFilterSelect.innerHTML = '<option value="">All Departments</option>';

    const { data: students, error } = await supabase
        .from("student")
        .select("year, department");
    
    if (error || !students) return;

    const years = [...new Set(students.map(s => s.year).filter(y => y))].sort();
    years.forEach(year => {
        const opt = document.createElement("option");
        opt.value = year;
        opt.textContent = year;
        yearFilterSelect.appendChild(opt);
    });

    const depts = [...new Set(students.map(s => s.department).filter(d => d))].sort();
    depts.forEach(dept => {
        const opt = document.createElement("option");
        opt.value = dept;
        opt.textContent = dept;
        deptFilterSelect.appendChild(opt);
    });
  };

  const fetchAndPopulateStudents = async () => {
    if (!studentSelectInstance) return;

    studentSelectInstance.clear();
    studentSelectInstance.clearOptions();
    studentSelectInstance.disable();
    studentSelectInstance.settings.placeholder = "Loading...";
    studentSelectInstance.refreshOptions(false);

    let query = supabase.from("student").select("admission_no, student_name, email, year, department, phone, section");

    const selectedYear = yearFilterSelect.value;
    const selectedDept = deptFilterSelect.value;

    if (selectedYear) query = query.eq("year", selectedYear);
    if (selectedDept) query = query.eq("department", selectedDept);

    const { data: students, error } = await query;

    if (error) {
      console.error("Error fetching students:", error);
      studentSelectInstance.settings.placeholder = "Error loading students";
      studentSelectInstance.enable();
      return;
    }

    if (!students || students.length === 0) {
      studentSelectInstance.settings.placeholder = "No students match filters";
      studentSelectInstance.enable();
      return;
    }

    students.forEach((student) => {
      const studentName = student.student_name || student.email || `ID: ${student.admission_no}`;
      
      const extraDetails = [
        student.phone ? `Ph: ${student.phone}` : null,
        student.year ? `Yr: ${student.year}` : null,
        student.department ? `Dept: ${student.department}` : null
      ].filter(Boolean).join(" | ");

      studentSelectInstance.addOption({
        value: student.admission_no,
        text: `${studentName} (${student.admission_no}) ${extraDetails ? '- ' + extraDetails : ''}`,
      });
    });

    studentSelectInstance.enable();
    studentSelectInstance.settings.placeholder = "Type Name, ID, or Phone...";
    studentSelectInstance.refreshOptions(false);
  };

  if (yearFilterSelect) yearFilterSelect.addEventListener("change", fetchAndPopulateStudents);
  if (deptFilterSelect) deptFilterSelect.addEventListener("change", fetchAndPopulateStudents);
  // --- FILTER LOGIC END ---

  const openCheckoutModal = (bookId, bookTitle) => {
    checkoutModal.style.display = "flex";
    checkoutBookTitle.textContent = bookTitle;
    checkoutBookIdInput.value = bookId;

    const today = new Date();
    const twoWeeks = new Date(new Date().setDate(today.getDate() + 14));
    dueDateInput.value = twoWeeks.toISOString().split("T")[0];

    if (!studentSelectInstance) {
      studentSelectInstance = new TomSelect("#student-select", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        placeholder: "Type Name, ID, or Phone...",
        maxOptions: 50 
      });
    }

    populateFilterDropdowns();
    fetchAndPopulateStudents();
  };

  window.openCheckoutModal = openCheckoutModal;

  const closeCheckoutModal = () => {
    checkoutModal.style.display = "none";
    checkoutForm.reset();
    yearFilterSelect.value = "";
    deptFilterSelect.value = "";
    if (studentSelectInstance) studentSelectInstance.clear();
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    const bookId = checkoutBookIdInput.value;
    const admissionNo = studentSelect.value;
    const dueDate = dueDateInput.value;

    if (!admissionNo) {
      alert("Please select a student.");
      return;
    }

    const { data: book, error: fetchError } = await supabase
      .from("books")
      .select("available_copies")
      .eq("id", bookId)
      .single();

    if (fetchError || !book || book.available_copies < 1) {
      alert("Book unavailable. Please refresh.");
      closeCheckoutModal();
      if (contentFrame.contentWindow.fetchBooks) contentFrame.contentWindow.fetchBooks();
      return;
    }

    const { error: updateError } = await supabase
      .from("books")
      .update({ available_copies: book.available_copies - 1 })
      .eq("id", bookId);

    if (updateError) return alert("Error updating book count.");

    const { error: insertError } = await supabase.from("checkouts").insert({
      book_id: bookId,
      admission_no: admissionNo,
      due_date: dueDate,
      status: "checked_out",
      checkout_date: new Date().toISOString(),
    });

    if (insertError) {
      alert("Error creating record.");
      return;
    }

    alert("Checkout successful!");
    closeCheckoutModal();
    if (contentFrame.contentWindow.fetchBooks) contentFrame.contentWindow.fetchBooks();
  };

  if (checkoutForm) checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  if (cancelCheckoutBtn) cancelCheckoutBtn.addEventListener("click", closeCheckoutModal);
  if (checkoutModal) {
    checkoutModal.addEventListener("click", (e) => {
      if (e.target === checkoutModal) closeCheckoutModal();
    });
  }

  if (searchInput && contentFrame) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.trim();
      const win = contentFrame.contentWindow;
      if (win && win.fetchBooks) win.fetchBooks(term);
    });
    searchInput.addEventListener("focus", () => navigateToSection("books"));
  }

  navigateToSection("dashboard");
});