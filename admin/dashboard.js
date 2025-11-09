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
        document.getElementById("stats-available-books").textContent = availableBooks;
        document.getElementById("stats-checked-out").textContent = checkedOutCount || 0;
        document.getElementById("stats-total-students").textContent = studentsCount || 0;
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
    const addBookFormContainer = document.getElementById("add-book-form-container");
    const cancelAddBookBtn = document.getElementById("cancel-add-book-btn");
    const addBookForm = document.getElementById("add-book-form");
    if (addBookBtn) {
        addBookBtn.addEventListener("click", () => {
            addBookFormContainer.style.display = "block";
        });
    }
    if (cancelAddBookBtn) {
        cancelAddBookBtn.addEventListener("click", () => {
            addBookFormContainer.style.display = "none";
            addBookForm.reset();
        });
    }
    if (addBookForm) {
        addBookForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(addBookForm);
            const book = {
                title: formData.get("title"),
                author: formData.get("author"),
                isbn: formData.get("isbn"),
                genre: formData.get("genre"),
                total_copies: parseInt(formData.get("quantity"), 10),
                available_copies: parseInt(formData.get("quantity"), 10),
            };
            const { error } = await supabase.from("books").insert([book]);
            if (error) {
                console.error("Error adding book:", error);
                alert(`Error adding book: ${error.message}`);
            } else {
                addBookFormContainer.style.display = "none";
                addBookForm.reset();
                searchInput.value = "";
                fetchBooks();
                alert("Book added successfully!");
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

            // Add a title attribute to the cell for the full text tooltip
            const createCell = (text) => {
                const cell = document.createElement("td");
                cell.textContent = text;
                cell.title = text; // Show full text on hover
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
                <button class="action-btn-sm edit-btn" data-id="${book.id}"><i data-lucide="edit"></i></button>
                <button class="action-btn-sm delete-btn" data-id="${book.id}"><i data-lucide="trash"></i></button>
            `;
            row.appendChild(actionsCell);

            booksTableBody.appendChild(row);
        });
        lucide.createIcons();
    };
    if (booksTableBody) {
        booksTableBody.addEventListener("click", async (e) => {
          // Find the button that was clicked, even if the user clicked the icon inside it
          const button = e.target.closest(".action-btn-sm");
          if (!button) return;
    
          const id = button.dataset.id;
          
          // --- DELETE ACTION ---
          if (button.classList.contains("delete-btn")) {
            // Get the book title from the first cell of the row
            const bookTitle = button.closest("tr").querySelector("td:first-child").textContent;
            
            // 1. Confirm deletion
            if (confirm(`Are you sure you want to delete "${bookTitle}"?`)) {
              // 2. Delete from Supabase
              const { error } = await supabase
                .from("books")
                .delete()
                .eq("id", id);
              
              if (error) {
                console.error("Error deleting book:", error);
                alert(`Error deleting book: ${error.message}`);
              } else {
                // 3. Refresh the book list
                alert("Book deleted successfully.");
                fetchBooks(searchInput.value.trim()); // Re-fetch with current search
                // fetchStats() will be triggered by the realtime listener
              }
            }
          }
    
          // --- EDIT ACTION ---
          if (button.classList.contains("edit-btn")) {
            // We can add the edit functionality here next
            console.log("Edit button clicked for ID:", id);
            alert("Edit functionality is not implemented yet.");
          }
        });
      }

    document.querySelector('.sidebar-btn[data-section="dashboard"]').classList.add("active");
    document.getElementById("dashboard-section").style.display = "block";
});
