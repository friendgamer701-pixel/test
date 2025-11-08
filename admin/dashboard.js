import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const pageContainer = document.querySelector('.page-container');

    if (menuToggle && pageContainer) {
        menuToggle.addEventListener('click', () => {
            pageContainer.classList.toggle('sidebar-hidden');
        });
    }

    const fetchStats = async () => {
        const [
            { data: booksData, error: booksError },
            { count: checkedOutCount, error: checkedOutError },
            { count: studentsCount, error: studentsError }
        ] = await Promise.all([
            supabase.from('books').select('total_copies, available_copies'),
            supabase.from('checkouts').select('*', { count: 'exact', head: true }).eq('status', 'checked_out'),
            supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'student')
        ]);

        if (booksError) console.error('Error fetching books:', booksError.message);
        if (checkedOutError) console.error('Error fetching checkouts:', checkedOutError.message);
        if (studentsError) console.error('Error fetching students:', studentsError.message);

        const totalBooks = booksData ? booksData.reduce((sum, book) => sum + (book.total_copies || 0), 0) : 0;
        const availableBooks = booksData ? booksData.reduce((sum, book) => sum + (book.available_copies || 0), 0) : 0;

        document.getElementById('stats-total-books').textContent = totalBooks;
        document.getElementById('stats-available-books').textContent = availableBooks;
        document.getElementById('stats-checked-out').textContent = checkedOutCount || 0;
        document.getElementById('stats-total-students').textContent = studentsCount || 0;
    };

    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    const contentSections = document.querySelectorAll('.content-section');

    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionName = btn.dataset.section;

            sidebarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            contentSections.forEach(section => {
                section.style.display = 'none';
            });

            const activeSection = document.getElementById(`${sectionName}-section`);
            if (activeSection) {
                activeSection.style.display = 'block';
            }

            if (sectionName === 'books') {
                fetchBooks();
            }
        });
    });

    const addBookBtn = document.getElementById('add-book-btn');
    const addBookFormContainer = document.getElementById('add-book-form-container');
    const cancelAddBookBtn = document.getElementById('cancel-add-book-btn');
    const addBookForm = document.getElementById('add-book-form');
    const booksTableBody = document.getElementById('books-table-body');

    if (addBookBtn) {
        addBookBtn.addEventListener('click', () => {
            addBookFormContainer.style.display = 'block';
        });
    }

    if (cancelAddBookBtn) {
        cancelAddBookBtn.addEventListener('click', () => {
            addBookFormContainer.style.display = 'none';
            addBookForm.reset();
        });
    }

    if (addBookForm) {
        addBookForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addBookForm);
            const book = {
                title: formData.get('title'),
                author: formData.get('author'),
                isbn: formData.get('isbn'),
                genre: formData.get('genre'),
                total_copies: parseInt(formData.get('quantity'), 10),
                available_copies: parseInt(formData.get('quantity'), 10)
            };

            const { data, error } = await supabase.from('books').insert([book]).select();

            if (error) {
                console.error('Error adding book:', error);
                alert(`Error adding book: ${error.message}`);
            } else {
                addBookFormContainer.style.display = 'none';
                addBookForm.reset();
                fetchBooks();
                alert('Book added successfully!');
            }
        });
    }

    const fetchBooks = async () => {
        const { data: books, error } = await supabase.from('books').select('*').order('title');

        if (error) {
            console.error('Error fetching books:', error);
        } else {
            displayBooks(books);
        }
    };

    const displayBooks = (books) => {
        if (!booksTableBody) return;
        booksTableBody.innerHTML = '';
        if (books.length === 0) {
            booksTableBody.innerHTML = '<tr><td colspan="6">No books found.</td></tr>';
            return;
        }

        books.forEach(book => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.isbn}</td>
                <td>${book.genre}</td>
                <td>${book.available_copies} of ${book.total_copies}</td>
                <td class="actions">
                    <button class="action-btn-sm edit-btn" data-id="${book.id}"><i data-lucide="edit"></i></button>
                    <button class="action-btn-sm delete-btn" data-id="${book.id}"><i data-lucide="trash"></i></button>
                </td>
            `;
            booksTableBody.appendChild(row);
        });
        lucide.createIcons();
    };

    // Initial setup
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection && dashboardSection.style.display !== 'none') {
        fetchStats();
    }
    
    // Make dashboard active by default
    document.querySelector('.sidebar-btn[data-section="dashboard"]').classList.add('active');
    document.getElementById('dashboard-section').style.display = 'block';
});
