import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    const booksTableBody = document.getElementById("books-table-body");
    const searchInput = parent.document.getElementById("search-box");

    const addBookBtn = document.getElementById("add-book-btn");
    const addBookFormContainer = document.getElementById("add-book-form-container");
    const cancelAddBookBtn = document.getElementById("cancel-add-book-btn");
    const addBookForm = document.getElementById("add-book-form");

    const openCheckoutModal = parent.openCheckoutModal;

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
                bookData.available_copies = bookData.total_copies;
                const { error: insertError } = await supabase
                    .from("books")
                    .insert([bookData]);
                error = insertError;
                successMessage = "Book added successfully!";
            }

            if (error) {
                console.error("Error saving book:", error);
                alert(`Error saving book: ${error.message}`);
            } else {
                addBookFormContainer.style.display = "none";
                addBookForm.reset();
                document.getElementById("edit-book-id").value = "";
                document.getElementById("form-title").textContent = "Add a New Book";
                document.getElementById("save-book-btn").textContent = "Save Book";

                if (searchInput) searchInput.value = "";
                fetchBooks();
                alert(successMessage);
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
    window.fetchBooks = fetchBooks;

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
            const checkoutDisabled = book.available_copies === 0 ? 'style="pointer-events: none; opacity: 0.5;"' : '';
            actionsCell.innerHTML = `
                <div class="action-menu-wrapper">
                    <button class="action-btn-sm menu-toggle-btn" aria-label="Open actions menu">
                        <i data-lucide="more-vertical"></i>
                    </button>
                    <div class="action-menu-dropdown">
                        <a href="#" class="menu-item edit-btn" data-id="${book.id}">
                            <i data-lucide="edit"></i> Edit
                        </a>
                        <a href="#" class="menu-item checkout-btn" data-id="${book.id}" data-title="${book.title}" ${checkoutDisabled}>
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

            if (menuItem.classList.contains("checkout-btn")) {
                const bookTitle = menuItem.dataset.title;
                if (openCheckoutModal) {
                    openCheckoutModal(id, bookTitle);
                } else {
                    alert("Error: Checkout function not found.");
                }
            }
        });

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
    }

    fetchBooks(searchInput ? searchInput.value.trim() : "");
});
