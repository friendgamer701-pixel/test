import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // --- SECURITY CHECK ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.top.location.href = "/login/auth.html"; 
        return; 
    }
    // ---------------------

    const tableBody = document.getElementById("books-table-body");
    const addBookBtn = document.getElementById("add-book-btn");
    
    // Modal Elements
    const bookModal = document.getElementById("book-modal");
    const bookForm = document.getElementById("book-form");
    const cancelBtn = document.getElementById("cancel-btn");
    const modalTitle = document.getElementById("modal-title");
    const saveBtn = document.getElementById("save-btn");

    let activeDropdown = null;

    // --- PAGINATION VARIABLES ---
    let currentPage = 1;
    const itemsPerPage = 10; // Only load 10 books at a time
    let currentSearchTerm = "";
    let totalBooksCount = 0;

    // --- 0. Setup Pagination UI (Next/Prev Buttons) ---
    const setupPaginationUI = () => {
        if (document.getElementById("pagination-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "pagination-wrapper";
        wrapper.style.cssText = "display: flex; justify-content: flex-end; align-items: center; gap: 15px; margin-top: 20px; padding: 20px;";
        
        wrapper.innerHTML = `
            <span id="page-info" style="font-weight: 500; color: #374151; font-size: 0.9rem;">Page 1</span>
            <div style="display: flex; gap: 8px;">
                <button id="prev-page-btn" class="btn" style="padding: 6px 14px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; color: #374151;">Previous</button>
                <button id="next-page-btn" class="btn" style="padding: 6px 14px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; color: #374151;">Next</button>
            </div>
        `;

        // Insert after table
        const table = document.querySelector("table");
        if (table && table.parentElement) {
            table.parentElement.appendChild(wrapper);
        } else {
            document.body.appendChild(wrapper);
        }

        document.getElementById("prev-page-btn").addEventListener("click", () => changePage(-1));
        document.getElementById("next-page-btn").addEventListener("click", () => changePage(1));
    };

    const changePage = (direction) => {
        const totalPages = Math.ceil(totalBooksCount / itemsPerPage);
        const newPage = currentPage + direction;

        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            fetchBooks(currentSearchTerm, false);
        }
    };

    const updatePaginationButtons = () => {
        const totalPages = Math.ceil(totalBooksCount / itemsPerPage) || 1;
        const prevBtn = document.getElementById("prev-page-btn");
        const nextBtn = document.getElementById("next-page-btn");
        const info = document.getElementById("page-info");

        if (info) info.textContent = `Page ${currentPage} of ${totalPages} (${totalBooksCount} books)`;
        
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
            prevBtn.style.opacity = currentPage === 1 ? "0.5" : "1";
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.style.opacity = currentPage >= totalPages ? "0.5" : "1";
        }
    };

    // --- 1. Fetch & Render Books (Optimized) ---
    const fetchBooks = async (searchTerm = "", resetPage = false) => {
        if (resetPage) currentPage = 1;
        currentSearchTerm = searchTerm;

        // Show Loading State
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #6b7280;">Loading books...</td></tr>`;

        // Start Query
        let query = supabase
            .from("books")
            .select("*", { count: 'exact' }); // Get total count for pagination

        // Apply Search
        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
        }

        // Apply Pagination (Server-Side)
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        query = query.order("title", { ascending: true }).range(from, to);

        const { data: books, error, count } = await query;

        if (error) {
            console.error("Error loading books:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding: 20px;">Error loading data.</td></tr>`;
            return;
        }

        if (count !== null) totalBooksCount = count;
        
        updatePaginationButtons();
        renderTable(books);
    };

    const renderTable = (books) => {
        tableBody.innerHTML = "";

        if (books.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #6b7280;">No books found.</td></tr>`;
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
        const dotsBtn = e.target.closest(".action-btn-dots");
        if (dotsBtn) {
            e.stopPropagation();
            const id = dotsBtn.dataset.id;
            const menu = document.getElementById(`menu-${id}`);
            
            // Close other menus
            if (activeDropdown && activeDropdown !== menu) {
                activeDropdown.style.display = "none";
            }

            // Toggle current menu
            if (menu.style.display === "block") {
                menu.style.display = "none";
                activeDropdown = null;
            } else {
                menu.style.display = "block";
                activeDropdown = menu;
            }
            return;
        }

        const actionBtn = e.target.closest(".dropdown-item");
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            const menu = actionBtn.closest(".dropdown-menu");
            menu.style.display = "none";
            activeDropdown = null;

            if (actionBtn.classList.contains("delete-btn")) {
                handleDelete(id);
            } else if (actionBtn.classList.contains("edit-btn")) {
                handleEdit(id);
            } else if (actionBtn.classList.contains("checkout-btn")) {
                const title = actionBtn.dataset.title;
                if (window.parent && window.parent.openCheckoutModal) {
                    window.parent.openCheckoutModal(id, title);
                } else {
                    alert("Checkout modal not found in parent.");
                }
            }
        }
    });

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

        if (bookData.available_copies > bookData.total_copies) {
            alert("Error: 'Available Copies' cannot be greater than 'Total Copies'.");
            return; 
        }

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
            fetchBooks(currentSearchTerm, false);
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
            if (!error) fetchBooks(currentSearchTerm, false);
            else alert("Error deleting book.");
        }
    };

    // --- INIT ---
    setupPaginationUI();
    fetchBooks();

    // Expose for dashboard.js search bar
    window.fetchBooks = (term) => fetchBooks(term, true);
});