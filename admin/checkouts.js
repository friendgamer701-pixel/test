import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    const checkoutsGrid = document.getElementById("checkouts-grid");
    
    // UI Elements
    const localSearch = document.getElementById("local-search");
    const filterStatus = document.getElementById("filter-status");
    const sortOrder = document.getElementById("sort-order");
    const clearBtn = document.getElementById("clear-filters");
    const globalSearch = parent.document.getElementById("search-box");

    let allCheckouts = []; 

    // --- 1. FETCH DATA ---
    const fetchCheckouts = async () => {
        checkoutsGrid.innerHTML = '<p style="padding:20px; color:#64748b;">Loading checkouts...</p>';

        const { data, error } = await supabase
            .from("checkouts")
            .select(`
                *, 
                books ( title ),
                student ( student_name, admission_no, phone )
            `);

        if (error) {
            console.error("Error:", error);
            checkoutsGrid.innerHTML = '<p style="color:red;">Error loading data.</p>';
            return;
        }

        allCheckouts = data;
        applyFiltersAndSort(); 
    };

    // --- 2. FILTER & SORT LOGIC ---
    const applyFiltersAndSort = () => {
        // Safety check in case elements aren't loaded yet
        if (!localSearch || !filterStatus || !sortOrder) return;

        const searchTerm = localSearch.value.toLowerCase().trim();
        const statusValue = filterStatus.value; // "checked_out", "returned", or "overdue"
        const sortValue = sortOrder.value;

        // Get Today as a simple string "YYYY-MM-DD" to avoid Timezone issues
        const todayStr = new Date().toISOString().split('T')[0];

        // A. Filter
        let filtered = allCheckouts.filter(checkout => {
            // 1. Search Text Match
            const book = checkout.books?.title?.toLowerCase() || "";
            const student = checkout.student?.student_name?.toLowerCase() || "";
            const admission = checkout.student?.admission_no?.toLowerCase() || "";
            const matchesSearch = !searchTerm || 
                                  book.includes(searchTerm) || 
                                  student.includes(searchTerm) || 
                                  admission.includes(searchTerm);

            // 2. Status Match
            const isReturned = checkout.status === 'returned';
            // Get Due Date as string (Supabase usually returns "YYYY-MM-DD")
            const dueDateStr = checkout.due_date ? checkout.due_date.split('T')[0] : ""; 

            // Simple String Comparison: if "2023-11-20" < "2023-11-22", it is overdue.
            const isOverdue = !isReturned && dueDateStr && (dueDateStr < todayStr);

            let matchesStatus = true;

            if (statusValue === 'checked_out') {
                matchesStatus = !isReturned; // Shows Active AND Overdue
            } else if (statusValue === 'returned') {
                matchesStatus = isReturned;
            } else if (statusValue === 'overdue') {
                matchesStatus = isOverdue; // Shows ONLY Overdue
            }

            return matchesSearch && matchesStatus;
        });

        // B. Sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.checkout_date);
            const dateB = new Date(b.checkout_date);
            return sortValue === 'newest' ? dateB - dateA : dateA - dateB;
        });

        displayCards(filtered);
    };

    // --- 3. DISPLAY CARDS ---
    const displayCards = (items) => {
        if (!checkoutsGrid) return;
        checkoutsGrid.innerHTML = "";

        if (items.length === 0) {
            checkoutsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No results found matching your filters.</div>';
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        items.forEach(checkout => {
            // Safe Data Access
            const bookTitle = checkout.books?.title || "(Deleted Book)";
            const studentName = checkout.student?.student_name || "Unknown";
            const admission = checkout.student?.admission_no || "";
            
            const dateOut = new Date(checkout.checkout_date).toLocaleDateString();
            // Format Due Date for Display
            const dateDueObj = new Date(checkout.due_date);
            const dateDueDisplay = dateDueObj.toLocaleDateString();
            
            const isReturned = checkout.status === 'returned';
            
            // Overdue Logic (Same String Comparison)
            const dueDateStr = checkout.due_date ? checkout.due_date.split('T')[0] : "";
            const isOverdue = !isReturned && dueDateStr && (dueDateStr < todayStr);

            // Determine Styles
            let statusClass = 'status-active';
            let statusText = 'Active';
            let dateColor = 'inherit';
            let cardClass = 'checkout-card';

            if (isReturned) {
                statusClass = 'status-returned';
                statusText = 'Returned';
            } else if (isOverdue) {
                statusClass = 'status-overdue';
                statusText = 'Overdue';
                dateColor = '#b91c1c'; // Red Text
                cardClass = 'checkout-card overdue'; // Red Border
            } else {
                dateColor = '#15803d'; // Green Text
            }

            // Build Card
            const card = document.createElement("div");
            card.className = cardClass;
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="book-title"><i data-lucide="book" size="18"></i> ${bookTitle}</div>
                    <div class="student-name"><i data-lucide="user" size="16"></i> ${studentName} <small>(${admission})</small></div>
                </div>
                <div class="card-details">
                    <div class="detail-row"><span>Borrowed:</span> <strong>${dateOut}</strong></div>
                    <div class="detail-row">
                        <span>Due:</span> 
                        <strong style="color: ${dateColor}">${dateDueDisplay}</strong>
                    </div>
                    <div class="detail-row" style="margin-top:8px;">
                        <span>Status:</span>
                        <span class="status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                </div>
                <div class="card-actions">
                    ${!isReturned ? `
                        <button class="return-btn" data-id="${checkout.id}" data-book-id="${checkout.book_id}">
                            <i data-lucide="check-circle" size="18"></i> Mark Returned
                        </button>
                    ` : `
                        <button class="return-btn" disabled>
                            <i data-lucide="check" size="18"></i> Completed
                        </button>
                    `}
                </div>
            `;
            checkoutsGrid.appendChild(card);
        });
        if (window.lucide) lucide.createIcons();
    };

    // --- 4. EVENT LISTENERS ---
    
    // Filter Inputs
    if(localSearch) localSearch.addEventListener("input", applyFiltersAndSort);
    if(filterStatus) filterStatus.addEventListener("change", applyFiltersAndSort);
    if(sortOrder) sortOrder.addEventListener("change", applyFiltersAndSort);

    // Clear Button
    if(clearBtn) {
        clearBtn.addEventListener("click", () => {
            localSearch.value = "";
            filterStatus.value = "";
            sortOrder.value = "newest";
            applyFiltersAndSort();
        });
    }

    // Global Search Sync
    if (globalSearch) {
        globalSearch.addEventListener("input", (e) => {
            if(localSearch) localSearch.value = e.target.value;
            applyFiltersAndSort();
        });
    }

    // Return Button (Event Delegation)
    checkoutsGrid.addEventListener("click", async (e) => {
        const btn = e.target.closest(".return-btn");
        if (btn && !btn.disabled) {
            if (!confirm("Mark this book as returned?")) return;
            
            const checkoutId = btn.dataset.id;
            const bookId = btn.dataset.bookId;
            btn.textContent = "Processing...";
            btn.disabled = true;

            try {
                // Update Checkout Status
                const { error: cErr } = await supabase.from('checkouts')
                    .update({ status: 'returned', returned_date: new Date().toISOString() })
                    .eq('id', checkoutId);
                if (cErr) throw cErr;

                // Update Book Count
                const { data: book } = await supabase.from('books').select('available_copies').eq('id', bookId).single();
                if (book) {
                    await supabase.from('books').update({ available_copies: (book.available_copies || 0) + 1 }).eq('id', bookId);
                }

                alert("Book returned successfully!");
                fetchCheckouts(); // Reload Data

            } catch (err) {
                console.error(err);
                alert("Error returning book.");
                btn.disabled = false;
                btn.innerHTML = 'Mark Returned';
            }
        }
    });

    // Expose fetch function to parent (for dashboard refreshes)
    window.fetchCheckouts = fetchCheckouts;

    // Initial Load
    fetchCheckouts();
});