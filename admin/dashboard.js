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

    // --- UPDATED "Add Book" Button Listener ---
    if (addBookBtn) {
        addBookBtn.addEventListener("click", () => {
            addBookForm.reset(); // Clear any old data
            document.getElementById("edit-book-id").value = ""; // Ensure no ID
            document.getElementById("form-title").textContent = "Add a New Book";
            document.getElementById("save-book-btn").textContent = "Save Book";
            addBookFormContainer.style.display = "block";
        });
    }

    // --- UPDATED "Cancel" Button Listener ---
    if (cancelAddBookBtn) {
        cancelAddBookBtn.addEventListener("click", () => {
            addBookFormContainer.style.display = "none";
            addBookForm.reset();
            // Reset form UI back to "Add" mode
            document.getElementById("edit-book-id").value = "";
            document.getElementById("form-title").textContent = "Add a New Book";
            document.getElementById("save-book-btn").textContent = "Save Book";
        });
    }

    // --- UPDATED Form Submit Listener (Handles both Add and Edit) ---
    if (addBookForm) {
        addBookForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(addBookForm);
            const bookId = formData.get("book_id"); // Get the hidden ID

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
                
                // We must calculate the new available_copies correctly
                // new_available = new_total - (old_total - old_available)
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

                // Prevent setting total quantity lower than books already checked out
                if (newTotal < checkedOutCount) {
                    alert(`Cannot set total quantity to ${newTotal}. There are already ${checkedOutCount} books checked out.`);
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
                const { error: insertError } = await supabase.from("books").insert([bookData]);
                error = insertError;
                successMessage = "Book added successfully!";
            }

            // --- COMMON AFTER-SUBMIT LOGIC ---
            if (error) {
                console.error("Error saving book:", error);
                alert(`Error saving book: ${error.message}`);
            } else {
                // Hide and reset the form
                addBookFormContainer.style.display = "none";
                addBookForm.reset();
                document.getElementById("edit-book-id").value = "";
                document.getElementById("form-title").textContent = "Add a New Book";
                document.getElementById("save-book-btn").textContent = "Save Book";
                
                searchInput.value = ""; // Clear search
                fetchBooks(); // Refresh book list
                alert(successMessage);
                // fetchStats() will be triggered by the realtime listener
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

    // --- UPDATED Table Click Listener (Handles Delete and Edit) ---
    if (booksTableBody) {
        booksTableBody.addEventListener("click", async (e) => {
          // Find the button that was clicked, even if the user clicked the icon inside it
          const button = e.target.closest(".action-btn-sm");
          if (!button) return;
    
          const id = button.dataset.id;
          
          // --- DELETE ACTION (Unchanged) ---
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
    
          // --- UPDATED EDIT ACTION ---
          if (button.classList.contains("edit-btn")) {
            // 1. Fetch book data from Supabase
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

            // 2. Populate the form with the book's data
            addBookForm.querySelector('[name="title"]').value = book.title;
            addBookForm.querySelector('[name="author"]').value = book.author;
            addBookForm.querySelector('[name="isbn"]').value = book.isbn;
            addBookForm.querySelector('[name="genre"]').value = book.genre;
            addBookForm.querySelector('[name="quantity"]').value = book.total_copies;
            
            // 3. Set hidden ID and update UI for "edit mode"
            document.getElementById("edit-book-id").value = book.id;
            document.getElementById("form-title").textContent = "Edit Book";
            document.getElementById("save-book-btn").textContent = "Update Book";

            // 4. Show the form and scroll to it
            addBookFormContainer.style.display = "block";
            // Scroll to the top of the page to see the form
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }

    document.querySelector('.sidebar-btn[data-section="dashboard"]').classList.add("active");
    document.getElementById("dashboard-section").style.display = "block";
});