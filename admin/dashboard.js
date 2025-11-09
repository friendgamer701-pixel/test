import { supabase } from "../supabase.js";
document.addEventListener("DOMContentLoaded", async () => {
  const pageContainer = document.querySelector(".page-container");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    window.location.href = "/login/auth.html";
    return;
  }

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError || !roleData || roleData.role !== "admin") {
    window.location.href = "/index.html";
    return;
  }
  if (pageContainer) {
    pageContainer.style.visibility = "visible";
  }
  const menuToggle = document.querySelector(".menu-toggle");
  const logoutButton = document.getElementById("logout-btn");
  const searchInput = document.getElementById("search-box");
  const booksTableBody = document.getElementById("books-table-body");
  const sidebarBtns = document.querySelectorAll(".sidebar-btn");
  const contentSections = document.querySelectorAll(".content-section");

  // --- [NEW] Modal Element Selectors ---
  const checkoutModal = document.getElementById("checkout-modal");
  const checkoutForm = document.getElementById("checkout-form");
  const cancelCheckoutBtn = document.getElementById("cancel-checkout-btn");
  const checkoutBookTitle = document.getElementById("checkout-book-title");
  const checkoutBookIdInput = document.getElementById("checkout-book-id");
  const studentSelect = document.getElementById("student-select");
  const dueDateInput = document.getElementById("due-date-select");
  // --- End of New Selectors ---

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
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student"),
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
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Subscribed to Realtime changes!");
      }
      if (err) {
        console.error("Realtime subscription error:", err);
      }
    });
  const navigateToSection = (sectionName) => {
    sidebarBtns.forEach((b) => b.classList.remove("active"));
    const activeBtn = document.querySelector(
      `.sidebar-btn[data-section="${sectionName}"]`
    );
    if (activeBtn) {
      activeBtn.classList.add("active");
    }
    contentSections.forEach((section) => {
      section.style.display = "none";
    });
    const activeSection = document.getElementById(`${sectionName}-section`);
    if (activeSection) {
      activeSection.style.display = "block";
    }
    if (sectionName === "books") {
      const searchTerm = searchInput.value.trim();
      fetchBooks(searchTerm);
    }
  };
  sidebarBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const sectionName = btn.dataset.section;
      navigateToSection(sectionName);
    });
  });
  const addBookBtn = document.getElementById("add-book-btn");
  const addBookFormContainer = document.getElementById(
    "add-book-form-container"
  );
  const cancelAddBookBtn = document.getElementById("cancel-add-book-btn");
  const addBookForm = document.getElementById("add-book-form");

  if (addBookBtn) {
    addBookBtn.addEventListener("click", () => {
      addBookForm.reset();
      document.getElementById("edit-book-id").value = "";
      document.getElementById("form-title").textContent = "Add a New Book";
      document.getElementById("save-book-btn").textContent = "Save Book";
      addBookFormContainer.style.display = "block";
    });
  }

  if (cancelAddBookBtn) {
    cancelAddBookBtn.addEventListener("click", () => {
      addBookFormContainer.style.display = "none";
      addBookForm.reset();
      document.getElementById("edit-book-id").value = "";
      document.getElementById("form-title").textContent = "Add a New Book";
      document.getElementById("save-book-btn").textContent = "Save Book";
    });
  }

  if (addBookForm) {
    addBookForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(addBookForm);
      const bookId = formData.get("book_id");

      const bookData = {
        title: formData.get("title"),
        author: formData.get("author"),
        isbn: formData.get("isbn"),
        genre: formData.get("genre"),
        total_copies: parseInt(formData.get("quantity"), 10),
      };

      let error;
      let successMessage = "";

      if (bookId) {
        // --- UPDATE (EDIT) LOGIC ---
        const { data: oldBook, error: fetchError } = await supabase
          .from("books")
          .select("total_copies, available_copies")
          .eq("id", bookId)
          .single();

        if (fetchError) {
          console.error("Error fetching old book data:", fetchError);
          alert("Error updating book. Could not get old data.");
          return;
        }

        const checkedOutCount = oldBook.total_copies - oldBook.available_copies;
        const newTotal = bookData.total_copies;

        if (newTotal < checkedOutCount) {
          alert(
            `Cannot set total quantity to ${newTotal}. There are already ${checkedOutCount} books checked out.`
          );
          return;
        }

        bookData.available_copies = newTotal - checkedOutCount;

        const { error: updateError } = await supabase
          .from("books")
          .update(bookData)
          .eq("id", bookId);
        error = updateError;
        successMessage = "Book updated successfully!";
      } else {
        // --- ADD (INSERT) LOGIC ---
        bookData.available_copies = bookData.total_copies; // For new books
        const { error: insertError } = await supabase
          .from("books")
          .insert([bookData]);
        error = insertError;
        successMessage = "Book added successfully!";
      }

      // --- COMMON AFTER-SUBMIT LOGIC ---
      if (error) {
        console.error("Error saving book:", error);
        alert(`Error saving book: ${error.message}`);
      } else {
        addBookFormContainer.style.display = "none";
        addBookForm.reset();
        document.getElementById("edit-book-id").value = "";
        document.getElementById("form-title").textContent = "Add a New Book";
        document.getElementById("save-book-btn").textContent = "Save Book";

        searchInput.value = "";
        fetchBooks();
        alert(successMessage);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("focus", () => {
      if (document.getElementById("books-section").style.display !== "block") {
        navigateToSection("books");
      }
    });
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.trim();
      if (document.getElementById("books-section").style.display === "block") {
        fetchBooks(searchTerm);
      }
    });
  }
  const fetchBooks = async (searchTerm = "") => {
    let query = supabase.from("books").select("*").order("title");
    if (searchTerm) {
      const filterTerm = `%${searchTerm}%`;
      query = query.or(
        `title.ilike.${filterTerm},author.ilike.${filterTerm},isbn.ilike.${filterTerm},genre.ilike.${filterTerm}`
      );
    }
    const { data: books, error } = await query;
    if (error) {
      console.error("Error fetching books:", error);
    } else {
      displayBooks(books);
    }
  };

  const displayBooks = (books) => {
    if (!booksTableBody) return;
    booksTableBody.innerHTML = "";
    if (books.length === 0) {
      booksTableBody.innerHTML =
        '<tr><td colspan="6">No books found.</td></tr>';
      return;
    }
    books.forEach((book) => {
      const row = document.createElement("tr");

      const createCell = (text) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        cell.title = text;
        return cell;
      };

      row.appendChild(createCell(book.title));
      row.appendChild(createCell(book.author));
      row.appendChild(createCell(book.isbn));
      row.appendChild(createCell(book.genre));

      const availabilityCell = document.createElement("td");
      availabilityCell.textContent = `${book.available_copies} of ${book.total_copies}`;
      row.appendChild(availabilityCell);

      const actionsCell = document.createElement("td");
      actionsCell.className = "actions";
      actionsCell.innerHTML = `
                <div class="action-menu-wrapper">
                    <button class="action-btn-sm menu-toggle-btn" aria-label="Open actions menu">
                        <i data-lucide="more-vertical"></i>
                    </button>
                    <div class="action-menu-dropdown">
                        <a href="#" class="menu-item edit-btn" data-id="${book.id}">
                            <i data-lucide="edit"></i> Edit
                        </a>
                        <a href="#" class="menu-item checkout-btn" data-id="${book.id}" data-title="${book.title}">
                            <i data-lucide="arrow-left-right"></i> Check Out
                        </a>
                        <a href="#" class="menu-item delete-btn delete-item" data-id="${book.id}">
                            <i data-lucide="trash"></i> Delete
                        </a>
                    </div>
                </div>
            `;
      row.appendChild(actionsCell);

      booksTableBody.appendChild(row);
    });
    lucide.createIcons();
  };

  if (booksTableBody) {
    booksTableBody.addEventListener("click", async (e) => {
      const menuItem = e.target.closest(".menu-item");
      if (!menuItem) return;

      e.preventDefault();
      const id = menuItem.dataset.id;
      const dropdown = menuItem.closest(".action-menu-dropdown");

      if (dropdown) dropdown.style.display = "none";

      // --- DELETE ACTION ---
      if (menuItem.classList.contains("delete-btn")) {
        const bookTitle = menuItem
          .closest("tr")
          .querySelector("td:first-child").textContent;

        if (confirm(`Are you sure you want to delete "${bookTitle}"?`)) {
          const { error } = await supabase.from("books").delete().eq("id", id);

          if (error) {
            console.error("Error deleting book:", error);
            alert(`Error deleting book: ${error.message}`);
          } else {
            alert("Book deleted successfully.");
            fetchBooks(searchInput.value.trim());
          }
        }
      }

      // --- EDIT ACTION ---
      if (menuItem.classList.contains("edit-btn")) {
        const { data: book, error } = await supabase
          .from("books")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Error fetching book for edit:", error);
          alert("Could not load book data to edit.");
          return;
        }

        addBookForm.querySelector('[name="title"]').value = book.title;
        addBookForm.querySelector('[name="author"]').value = book.author;
        addBookForm.querySelector('[name="isbn"]').value = book.isbn;
        addBookForm.querySelector('[name="genre"]').value = book.genre;
        addBookForm.querySelector('[name="quantity"]').value =
          book.total_copies;

        document.getElementById("edit-book-id").value = book.id;
        document.getElementById("form-title").textContent = "Edit Book";
        document.getElementById("save-book-btn").textContent = "Update Book";

        addBookFormContainer.style.display = "block";
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // --- [NEW] CHECK OUT ACTION ---
      if (menuItem.classList.contains("checkout-btn")) {
        const bookTitle = menuItem.dataset.title; // Get title from data attribute
        openCheckoutModal(id, bookTitle);
      }
    });
  }

  // Toggles the dropdown menu on 3-dot button click
  booksTableBody.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest(".menu-toggle-btn");
    if (toggleBtn) {
      e.preventDefault();
      const dropdown = toggleBtn.nextElementSibling;
      const currentlyOpen = document.querySelector(
        ".action-menu-dropdown[style*='display: block']"
      );
      if (currentlyOpen && currentlyOpen !== dropdown) {
        currentlyOpen.style.display = "none";
      }
      dropdown.style.display =
        dropdown.style.display === "block" ? "none" : "block";
    }
  });

  // Closes any open menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".action-menu-wrapper")) {
      const openDropdown = document.querySelector(
        ".action-menu-dropdown[style*='display: block']"
      );
      if (openDropdown) {
        openDropdown.style.display = "none";
      }
    }
  });

  // ---
  // --- [START] NEW CHECKOUT MODAL LOGIC ---
  // ---

  /**
   * Fetches students from the 'profiles' table and populates the dropdown.
   * * IMPORTANT: This assumes you have a table named 'profiles'
   * with columns 'user_id', 'full_name' (or 'email'), and 'role'.
   * Adjust the query if your table structure is different.
   */
  const fetchAndPopulateStudents = async () => {
    studentSelect.innerHTML = '<option value="">Loading students...</option>';

    // --- !!! ADJUST THIS QUERY TO MATCH YOUR DATABASE !!! ---
    const { data: students, error } = await supabase
      .from("profiles") // Assumes a 'profiles' table
      .select("user_id, full_name, email") // Assumes these columns
      .eq("role", "student"); // Assumes 'role' is in 'profiles' table
    // --- !!! ---

    if (error) {
      console.error("Error fetching students:", error);
      studentSelect.innerHTML =
        '<option value="">Error loading students</option>';
      return;
    }

    if (students.length === 0) {
      studentSelect.innerHTML = '<option value="">No students found</option>';
      return;
    }

    studentSelect.innerHTML = '<option value="">Select a student...</option>';
    students.forEach((student) => {
      // Use full_name, but fall back to email if full_name is not available
      const studentName =
        student.full_name || student.email || `User ID: ${student.user_id}`;
      const option = document.createElement("option");
      option.value = student.user_id;
      option.textContent = studentName;
      studentSelect.appendChild(option);
    });
  };

  /**
   * Opens the checkout modal and prepares it.
   */
  const openCheckoutModal = (bookId, bookTitle) => {
    checkoutModal.style.display = "flex";
    checkoutBookTitle.textContent = bookTitle;
    checkoutBookIdInput.value = bookId;

    // Set default due date (e.g., 2 weeks from today)
    const today = new Date();
    const twoWeeks = new Date(today.setDate(today.getDate() + 14));
    dueDateInput.value = twoWeeks.toISOString().split("T")[0];

    // Fetch students and populate the dropdown
    fetchAndPopulateStudents();
  };

  /**
   * Closes the checkout modal and resets the form.
   */
  const closeCheckoutModal = () => {
    checkoutModal.style.display = "none";
    checkoutForm.reset();
  };

  /**
   * Handles the checkout form submission.
   */
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    const bookId = checkoutBookIdInput.value;
    const userId = studentSelect.value;
    const dueDate = dueDateInput.value;

    if (!userId) {
      alert("Please select a student.");
      return;
    }

    // 1. Check if book is available
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
      fetchBooks(searchInput.value.trim()); // Refresh list
      return;
    }

    // 2. Decrement available_copies
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

    // 3. Create checkout record
    const { error: insertError } = await supabase.from("checkouts").insert({
      book_id: bookId,
      user_id: userId,
      due_date: dueDate,
      status: "checked_out",
      checkout_date: new Date().toISOString(),
    });

    if (insertError) {
      // This is not ideal (book count is decremented but checkout failed).
      // A database transaction (via an Edge Function) is the robust solution.
      // For now, we alert the user of the critical error.
      alert(
        "CRITICAL ERROR: Book count updated, but checkout record failed to create. Please manually check data."
      );
      console.error(insertError);
      return;
    }

    alert("Book checked out successfully!");
    closeCheckoutModal();
    fetchBooks(searchInput.value.trim()); // Refresh list
    // Realtime listener will update stats
  };

  // --- Add Event Listeners for the Modal ---
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  }
  if (cancelCheckoutBtn) {
    cancelCheckoutBtn.addEventListener("click", closeCheckoutModal);
  }
  // Also close modal by clicking overlay
  if (checkoutModal) {
    checkoutModal.addEventListener("click", (e) => {
      if (e.target === checkoutModal) {
        closeCheckoutModal();
      }
    });
  }

  // --- [END] NEW CHECKOUT MODAL LOGIC ---

  document
    .querySelector('.sidebar-btn[data-section="dashboard"]')
    .classList.add("active");
  document.getElementById("dashboard-section").style.display = "block";
});
