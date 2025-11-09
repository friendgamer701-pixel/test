import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    const checkoutsTableBody = document.getElementById("checkouts-table-body");
    const searchInput = parent.document.getElementById("search-box");

    const fetchCheckouts = async (searchTerm = "") => {
        let query = supabase.from("checkouts").select(`
            *, 
            books(title),
            student(student_name)
        `).order("checkout_date", { ascending: false });

        if (searchTerm) {
            query = query.ilike('status', `%${searchTerm}%`);
        }

        const { data: checkouts, error } = await query;

        if (error) {
            console.error("Error fetching checkouts:", error);
        } else {
            displayCheckouts(checkouts);
        }
    };

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const searchTerm = searchInput.value.trim();
            fetchCheckouts(searchTerm);
        });
    }

    const displayCheckouts = (checkouts) => {
        if (!checkoutsTableBody) return;
        checkoutsTableBody.innerHTML = "";
        if (checkouts.length === 0) {
            checkoutsTableBody.innerHTML =
                '<tr><td colspan="6">No checkouts found.</td></tr>';
            return;
        }

        checkouts.forEach((checkout) => {
            const row = document.createElement("tr");

            const createCell = (text) => {
                const cell = document.createElement("td");
                cell.textContent = text;
                cell.title = text;
                return cell;
            };

            row.appendChild(createCell(checkout.books.title));
            row.appendChild(createCell(checkout.student.student_name));
            row.appendChild(createCell(new Date(checkout.checkout_date).toLocaleDateString()));
            row.appendChild(createCell(new Date(checkout.due_date).toLocaleDateString()));
            row.appendChild(createCell(checkout.status));

            const actionsCell = document.createElement("td");
            actionsCell.className = "actions";
            if (checkout.status === 'checked_out') {
                actionsCell.innerHTML = `
                    <button class="btn-primary return-btn" data-id="${checkout.id}" data-book-id="${checkout.book_id}">Return</button>
                `;
            } else {
                actionsCell.innerHTML = 'Returned';
            }
            row.appendChild(actionsCell);

            checkoutsTableBody.appendChild(row);
        });
        lucide.createIcons(); 
    };

    if (checkoutsTableBody) {
        checkoutsTableBody.addEventListener("click", async (e) => {
            if (e.target.classList.contains("return-btn")) {
                const checkoutId = e.target.dataset.id;
                const bookId = e.target.dataset.bookId;

                if (confirm("Are you sure you want to mark this book as returned?")) {
                    try {
                        const { error: checkoutError } = await supabase
                            .from('checkouts')
                            .update({ status: 'returned', returned_date: new Date().toISOString() })
                            .eq('id', checkoutId);

                        if (checkoutError) throw checkoutError;

                        const { error: bookError } = await supabase.rpc('increment_book_on_return', { book_id_to_update: bookId });

                        if (bookError) throw bookError;

                        alert("Book returned successfully!");
                        fetchCheckouts(searchInput.value.trim());

                    } catch (error) {
                        console.error("Error returning book:", error);
                        alert(`Error returning book: ${error.message}`);
                    }
                }
            }
        });
    }

    fetchCheckouts(searchInput ? searchInput.value.trim() : "");
});
