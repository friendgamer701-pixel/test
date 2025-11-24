import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("public-search");
    const resultsGrid = document.getElementById("results-grid");
    
    let debounceTimer;

    // --- 1. Main Search Function ---
    const handleSearch = async (searchTerm) => {
        if (!searchTerm.trim()) {
            resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">Start typing to search for books...</div>';
            return;
        }

        resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">Searching library...</div>';

        // A. Fetch Books matching search
        const { data: books, error } = await supabase
            .from("books")
            .select("*")
            .or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%`)
            .order("title");

        if (error) {
            console.error(error);
            resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Error searching books. Please try again.</div>';
            return;
        }

        if (!books || books.length === 0) {
            resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px;">No books found matching your search.</div>';
            return;
        }

        // B. Identify Unavailable Books (0 copies)
        const unavailableBookIds = books
            .filter(b => b.available_copies === 0)
            .map(b => b.id);

        let activeCheckouts = [];

        // C. Fetch specific checkout info ONLY for unavailable books
        if (unavailableBookIds.length > 0) {
            const { data: checkouts, error: checkoutError } = await supabase
                .from("checkouts")
                .select(`
                    book_id,
                    due_date,
                    student ( student_name )
                `)
                .in("book_id", unavailableBookIds) // Only fetch for the books we need
                .eq("status", "checked_out"); // Only active checkouts

            if (!checkoutError && checkouts) {
                activeCheckouts = checkouts;
            }
        }

        // D. Render Results
        renderResults(books, activeCheckouts);
    };

    const renderResults = (books, activeCheckouts) => {
        resultsGrid.innerHTML = "";

        books.forEach(book => {
            const isAvailable = book.available_copies > 0;
            
            let statusHtml = "";
            let extraInfoHtml = "";

            if (isAvailable) {
                statusHtml = `
                    <span class="status-badge status-available">
                        <i data-lucide="check-circle" width="14" style="margin-right:4px;"></i> Available
                    </span>`;
                extraInfoHtml = `
                    <div class="meta-row">
                        <span>Copies:</span>
                        <strong>${book.available_copies} available</strong>
                    </div>`;
            } else {
                // Book is unavailable. Find who has it and when it's due.
                
                // 1. Get all checkouts for this book
                const bookCheckouts = activeCheckouts.filter(c => c.book_id === book.id);
                
                // 2. Sort to find the EARLIEST return date (next available)
                // or if you prefer LATEST, change a - b to b - a
                bookCheckouts.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                
                const nextReturn = bookCheckouts[0]; // The first one is the soonest due date

                const dateStr = nextReturn 
                    ? new Date(nextReturn.due_date).toLocaleDateString() 
                    : "Unknown";
                
                const holderName = nextReturn?.student?.student_name || "a student";

                statusHtml = `
                    <span class="status-badge status-unavailable">
                        <i data-lucide="x-circle" width="14" style="margin-right:4px;"></i> Checked Out
                    </span>`;

                extraInfoHtml = `
                    <div class="meta-row" style="color:#b91c1c;">
                        <span>Available:</span>
                        <strong>0 copies</strong>
                    </div>
                    <div class="student-alert">
                        <div><strong>Next Due:</strong> ${dateStr}</div>
                        <div><strong>Held By:</strong> ${holderName}</div>
                    </div>
                `;
            }

            const card = document.createElement("div");
            card.className = "book-card";
            card.innerHTML = `
                <div class="book-header">
                    <h3 class="book-title">${book.title}</h3>
                    <div class="book-author">by ${book.author}</div>
                </div>
                
                ${statusHtml}

                <div class="meta-info">
                    <div class="meta-row">
                        <span>Genre:</span>
                        <span>${book.genre || '-'}</span>
                    </div>
                    <div class="meta-row">
                        <span>ISBN:</span>
                        <span style="font-family:monospace;">${book.isbn || '-'}</span>
                    </div>
                    ${extraInfoHtml}
                </div>
            `;
            resultsGrid.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
    };

    // --- Event Listeners ---
    searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleSearch(e.target.value);
        }, 500); // Wait 500ms after typing stops before searching
    });
});