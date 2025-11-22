import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("books-table-body");
    const addBookBtn = document.getElementById("add-book-btn");
    
    // Modal Elements
    const bookModal = document.getElementById("book-modal");
    const bookForm = document.getElementById("book-form");
    const cancelBtn = document.getElementById("cancel-btn");
    const modalTitle = document.getElementById("modal-title");
    const saveBtn = document.getElementById("save-btn");

    let activeDropdown = null;

    // --- 1. Fetch & Render Books ---
    const fetchBooks = async (searchTerm = "") => {
        let query = supabase
            .from("books")
            .select("*")
            .order("title");

        if (searchTerm) {
            // UPDATED: Now searches Title OR ISBN OR Author
            query = query.or(`title.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
        }

        const { data: books, error } = await query;

        if (error) {
            console.error("Error loading books:", error);
            tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell" style="color:red">Error loading data.</td></tr>`;
            return;
        }

        renderTable(books);
    };

    const renderTable = (books) => {
        tableBody.innerHTML = "";

        if (books.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">No books found.</td></tr>`;
            return;
        }

        books.forEach(book => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 500; color:#111827;">${book.title}</div>
                </td>
                <td>${book.author || '-'}</td>
                <td>${book.isbn || '-'}</td>
                <td>${book.genre || '-'}</td>
                <td>
                    ${book.available_copies} of ${book.total_copies}
                </td>
                <td class="action-cell">
                    <button class="action-btn-dots" data-id="${book.id}">
                        <i data-lucide="more-vertical" width="16" height="16"></i>
                    </button>
                    <div class="dropdown-menu" id="menu-${book.id}">
                        <button class="dropdown-item edit-btn" data-id="${book.id}">
                            <i data-lucide="edit-2"></i> Edit
                        </button>
                        <button class="dropdown-item checkout-btn" data-id="${book.id}" data-title="${book.title}">
                            <i data-lucide="arrow-left-right"></i> Check Out
                        </button>
                        <button class="dropdown-item delete-item delete-btn" data-id="${book.id}">
                            <i data-lucide="trash-2"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        if (window.lucide) lucide.createIcons();
    };

    // --- 2. Menu Logic (Dropdowns) ---
    tableBody.addEventListener("click", (e) => {
        // Toggle Dropdown
        const dotsBtn = e.target.closest(".action-btn-dots");
        if (dotsBtn) {
            e.stopPropagation();
            const id = dotsBtn.dataset.id;
            const menu = document.getElementById(`menu-${id}`);
            
            // Close others
            if (activeDropdown && activeDropdown !== menu) {
                activeDropdown.style.display = "none";
            }

            // Toggle current
            if (menu.style.display === "block") {
                menu.style.display = "none";
                activeDropdown = null;
            } else {
                menu.style.display = "block";
                activeDropdown = menu;
            }
            return;
        }

        // Handle Actions inside dropdown
        const actionBtn = e.target.closest(".dropdown-item");
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            const menu = actionBtn.closest(".dropdown-menu");
            menu.style.display = "none"; // Close menu immediately
            activeDropdown = null;

            if (actionBtn.classList.contains("delete-btn")) {
                handleDelete(id);
            } else if (actionBtn.classList.contains("edit-btn")) {
                handleEdit(id);
            } else if (actionBtn.classList.contains("checkout-btn")) {
                const title = actionBtn.dataset.title;
                // Calls the function in the PARENT window (dashboard.js)
                if (window.parent && window.parent.openCheckoutModal) {
                    window.parent.openCheckoutModal(id, title);
                } else {
                    alert("Checkout modal not found in parent.");
                }
            }
        }
    });

    // Close menu when clicking outside
    document.addEventListener("click", () => {
        if (activeDropdown) {
            activeDropdown.style.display = "none";
            activeDropdown = null;
        }
    });

    // --- 3. Add/Edit Logic ---
    const openModal = (isEdit = false, data = null) => {
        bookModal.style.display = "flex";
        if (isEdit && data) {
            modalTitle.textContent = "Edit Book";
            saveBtn.textContent = "Update Book";
            document.getElementById("book-id").value = data.id;
            bookForm.title.value = data.title;
            bookForm.author.value = data.author;
            bookForm.isbn.value = data.isbn;
            bookForm.genre.value = data.genre;
            bookForm.total_copies.value = data.total_copies;
            bookForm.available_copies.value = data.available_copies;
        } else {
            modalTitle.textContent = "Add New Book";
            saveBtn.textContent = "Save Book";
            bookForm.reset();
            document.getElementById("book-id").value = "";
        }
    };

    addBookBtn.addEventListener("click", () => openModal(false));
    cancelBtn.addEventListener("click", () => {
        bookModal.style.display = "none";
        bookForm.reset();
    });

    bookForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(bookForm);
        const id = formData.get("id");
        
        const bookData = {
            title: formData.get("title"),
            author: formData.get("author"),
            isbn: formData.get("isbn"),
            genre: formData.get("genre"),
            total_copies: parseInt(formData.get("total_copies")),
            available_copies: parseInt(formData.get("available_copies"))
        };

        let error;
        if (id) {
            const { error: updateError } = await supabase.from("books").update(bookData).eq("id", id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from("books").insert([bookData]);
            error = insertError;
        }

        if (error) {
            alert("Error saving book: " + error.message);
        } else {
            bookModal.style.display = "none";
            fetchBooks();
        }
    });

    const handleEdit = async (id) => {
        const { data, error } = await supabase.from("books").select("*").eq("id", id).single();
        if (data) openModal(true, data);
        else alert("Error fetching book details");
    };

    const handleDelete = async (id) => {
        if (confirm("Are you sure you want to delete this book?")) {
            const { error } = await supabase.from("books").delete().eq("id", id);
            if (!error) fetchBooks();
            else alert("Error deleting book.");
        }
    };

    // Expose fetchBooks for parent search bar
    window.fetchBooks = fetchBooks;

    fetchBooks();
});