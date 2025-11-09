import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const pageContainer = document.querySelector(".page-container");
  const menuToggle = document.querySelector(".menu-toggle");
  const logoutButton = document.getElementById("logout-btn");
  const sidebarBtns = document.querySelectorAll(".sidebar-btn");
  const dashboardSection = document.getElementById("dashboard-section");
  const contentFrame = document.getElementById("content-frame");
  const searchInput = document.getElementById("search-box");

  const checkoutModal = document.getElementById("checkout-modal");
  const checkoutForm = document.getElementById("checkout-form");
  const cancelCheckoutBtn = document.getElementById("cancel-checkout-btn");
  const checkoutBookTitle = document.getElementById("checkout-book-title");
  const checkoutBookIdInput = document.getElementById("checkout-book-id");
  const studentSelect = document.getElementById("student-select");
  const dueDateInput = document.getElementById("due-date-select");

  let studentSelectInstance = null;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    console.warn("No logged-in user found. Running in open mode.");
  }

  if (user) {
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || !roleData || roleData.role !== "admin") {
      console.warn("User is not admin. Allowing access for testing.");
    }
  }

  if (pageContainer) {
    pageContainer.style.visibility = "visible";
  }

  if (menuToggle && pageContainer) {
    menuToggle.addEventListener("click", () => {
      pageContainer.classList.toggle("sidebar-hidden");
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error logging out:", error.message);
      } else {
        window.location.href = "/login/auth.html";
      }
    });
  }

  const fetchStats = async () => {
    const [
      { data: booksData, error: booksError },
      { count: checkedOutCount, error: checkedOutError },
      { count: studentsCount, error: studentsError },
    ] = await Promise.all([
      supabase.from("books").select("total_copies, available_copies"),
      supabase
        .from("checkouts")
        .select("*", { count: "exact", head: true })
        .eq("status", "checked_out"),
      supabase
        .from("student")
        .select("*", { count: "exact", head: true }),
    ]);

    if (booksError) console.error("Error fetching books:", booksError.message);
    if (checkedOutError)
      console.error("Error fetching checkouts:", checkedOutError.message);
    if (studentsError)
      console.error("Error fetching students:", studentsError.message);

    const totalBooks =
      booksData?.reduce((sum, book) => sum + (book.total_copies || 0), 0) || 0;
    const availableBooks =
      booksData?.reduce((sum, book) => sum + (book.available_copies || 0), 0) ||
      0;
    document.getElementById("stats-total-books").textContent = totalBooks;
    document.getElementById("stats-available-books").textContent =
      availableBooks;
    document.getElementById("stats-checked-out").textContent =
      checkedOutCount || 0;
    document.getElementById("stats-total-students").textContent =
      studentsCount || 0;
  };
  await fetchStats();

  supabase
    .channel("dashboard-stats-updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "books" },
      () => fetchStats()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "checkouts" },
      () => fetchStats()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "student" },
      () => fetchStats()
    )
    .subscribe();

  const navigateToSection = (sectionName) => {
    sidebarBtns.forEach((b) => b.classList.remove("active"));
    const activeBtn = document.querySelector(
      `.sidebar-btn[data-section="${sectionName}"]`
    );
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    if (sectionName === 'dashboard') {
        dashboardSection.style.display = 'block';
        contentFrame.style.display = 'none';
    } else {
        dashboardSection.style.display = 'none';
        contentFrame.style.display = 'block';
        contentFrame.src = `${sectionName}.html`;
    }
  };

  sidebarBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const sectionName = btn.dataset.section;
      navigateToSection(sectionName);
    });
  });

  const fetchAndPopulateStudents = async () => {
    if (!studentSelectInstance) return;

    studentSelectInstance.clear();
    studentSelectInstance.clearOptions();
    studentSelectInstance.disable();
    studentSelectInstance.settings.placeholder = "Loading students...";
    studentSelectInstance.refreshOptions(false);

    const { data: students, error } = await supabase
      .from("student")
      .select("admission_no, student_name, email");

    if (error) {
      console.error("Error fetching students:", error);
      studentSelectInstance.settings.placeholder = "Error loading students";
      studentSelectInstance.enable();
      studentSelectInstance.refreshOptions(false);
      return;
    }

    if (students.length === 0) {
      studentSelectInstance.settings.placeholder = "No students found";
      studentSelectInstance.enable();
      studentSelectInstance.refreshOptions(false);
      return;
    }

    students.forEach((student) => {
      const studentName =
        student.student_name || student.email || `ID: ${student.admission_no}`;

      studentSelectInstance.addOption({
        value: student.admission_no,
        text: `${studentName} (${student.admission_no})`,
      });
    });

    studentSelectInstance.enable();
    studentSelectInstance.settings.placeholder =
      "Type to search for a student...";
    studentSelectInstance.refreshOptions(false);
  };

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
        sortField: {
          field: "text",
          direction: "asc",
        },
        placeholder: "Type to search for a student...",
      });
    }

    fetchAndPopulateStudents();
  };
  
  window.openCheckoutModal = openCheckoutModal;

  const closeCheckoutModal = () => {
    checkoutModal.style.display = "none";
    checkoutForm.reset();

    if (studentSelectInstance) {
      studentSelectInstance.clear();
    }
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

    if (fetchError || !book) {
      alert("Error finding book. Please try again.");
      console.error(fetchError);
      return;
    }

    if (book.available_copies < 1) {
      alert("Sorry, this book is no longer available. The list will refresh.");
      closeCheckoutModal();
      if(contentFrame.contentWindow.fetchBooks) contentFrame.contentWindow.fetchBooks();
      return;
    }

    const newAvailableCopies = book.available_copies - 1;
    const { error: updateError } = await supabase
      .from("books")
      .update({ available_copies: newAvailableCopies })
      .eq("id", bookId);

    if (updateError) {
      alert("Error updating book count. Please try again.");
      console.error(updateError);
      return;
    }

    const { error: insertError } = await supabase.from("checkouts").insert({
      book_id: bookId,
      admission_no: admissionNo,
      due_date: dueDate,
      status: "checked_out",
      checkout_date: new Date().toISOString(),
    });

    if (insertError) {
      alert(
        "CRITICAL ERROR: Book count updated, but checkout record failed to create. Please manually check data."
      );
      console.error(insertError);
      return;
    }

    alert("Book checked out successfully!");
    closeCheckoutModal();
    if(contentFrame.contentWindow.fetchBooks) contentFrame.contentWindow.fetchBooks();
  };

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  }
  if (cancelCheckoutBtn) {
    cancelCheckoutBtn.addEventListener("click", closeCheckoutModal);
  }
  if (checkoutModal) {
    checkoutModal.addEventListener("click", (e) => {
      if (e.target === checkoutModal) {
        closeCheckoutModal();
      }
    });
  }

  if (searchInput && contentFrame) {
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.trim();
      const contentWindow = contentFrame.contentWindow;

      if (contentWindow) {
        if (typeof contentWindow.fetchBooks === 'function') {
          contentWindow.fetchBooks(searchTerm);
        } else if (typeof contentWindow.fetchStudents === 'function') {
          contentWindow.fetchStudents(searchTerm);
        } else if (typeof contentWindow.fetchCheckouts === 'function') {
          contentWindow.fetchCheckouts(searchTerm);
        }
      }
    });

    searchInput.addEventListener("focus", () => {
        navigateToSection('books');
    });
  }

  navigateToSection("dashboard");
});
