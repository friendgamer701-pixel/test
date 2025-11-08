import { supabase } from '../supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    // Icons are rendered in the main HTML file, so no need to call createIcons here.

    const fetchStats = async () => {
        // Fetch all statistics in parallel for better performance.
        const [
            { data: booksData, error: booksError },
            { count: checkedOutCount, error: checkedOutError },
            { count: studentsCount, error: studentsError }
        ] = await Promise.all([
            supabase.from('books').select('total_copies, available_copies'),
            supabase.from('checkouts').select('*', { count: 'exact', head: true }).eq('status', 'checked_out'),
            supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'student')
        ]);

        // Log any errors to the console without stopping execution.
        if (booksError) console.error('Error fetching books:', booksError.message);
        if (checkedOutError) console.error('Error fetching checkouts:', checkedOutError.message);
        if (studentsError) console.error('Error fetching students:', studentsError.message);

        // Calculate total and available books, handling potential null values.
        const totalBooks = booksData ? booksData.reduce((sum, book) => sum + (book.total_copies || 0), 0) : 0;
        const availableBooks = booksData ? booksData.reduce((sum, book) => sum + (book.available_copies || 0), 0) : 0;

        // Update the dashboard with the fetched statistics.
        document.getElementById('stats-total-books').textContent = totalBooks;
        document.getElementById('stats-available-books').textContent = availableBooks;
        document.getElementById('stats-checked-out').textContent = checkedOutCount || 0;
        document.getElementById('stats-total-students').textContent = studentsCount || 0;
    };

    // Set up the tab switching functionality.
    const tabs = document.querySelectorAll('.tab-trigger');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetPanel = document.getElementById(tab.dataset.target);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // Fetch the initial data when the page loads.
    fetchStats();
});
