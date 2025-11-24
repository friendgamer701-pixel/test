import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // --- SECURITY CHECK: IFRAME BREAKOUT FIX ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.top.location.href = "/login/auth.html"; 
        return; 
    }
    // -------------------------------------------------

    // --- DOM Elements ---
    const studentsContainer = document.getElementById("students-grid");
    const searchInput = document.getElementById("student-search");
    const departmentFilter = document.getElementById("department-filter");
    const yearFilter = document.getElementById("year-filter"); 

    const addStudentBtn = document.getElementById("add-student-btn");
    const addStudentFormContainer = document.getElementById("add-student-form-container");
    const cancelAddStudentBtn = document.getElementById("cancel-add-student-btn");
    const addStudentForm = document.getElementById("add-student-form");

    // --- PAGINATION VARIABLES ---
    let currentPage = 1;
    const itemsPerPage = 10; 
    let currentSearchTerm = "";
    let totalStudentsCount = 0;
    let debounceTimer;

    // --- 0. Setup Pagination UI (FIXED LAYOUT) ---
    const setupPaginationUI = () => {
        if (document.getElementById("pagination-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "pagination-wrapper";
        
        // Full-width footer style to eliminate the "gap" look
        wrapper.style.cssText = `
            width: 100%;
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            gap: 15px; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0;
        `;
        
        wrapper.innerHTML = `
            <span id="page-info" style="font-weight: 500; color: #64748b; font-size: 0.9rem;">Page 1</span>
            <div style="display: flex; gap: 10px;">
                <button id="prev-page-btn" class="btn" style="padding: 8px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; color: #334155; font-size: 0.9rem; transition: all 0.2s;">Previous</button>
                <button id="next-page-btn" class="btn" style="padding: 8px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; color: #334155; font-size: 0.9rem; transition: all 0.2s;">Next</button>
            </div>
        `;

        // Append to parent so it sits strictly below the grid
        studentsContainer.parentNode.appendChild(wrapper);

        // Add hover effects via JS
        const btns = wrapper.querySelectorAll("button");
        btns.forEach(btn => {
            btn.onmouseover = () => btn.style.background = "#f1f5f9";
            btn.onmouseout = () => btn.style.background = "white";
        });

        document.getElementById("prev-page-btn").addEventListener("click", () => changePage(-1));
        document.getElementById("next-page-btn").addEventListener("click", () => changePage(1));
    };

    const changePage = (direction) => {
        const totalPages = Math.ceil(totalStudentsCount / itemsPerPage);
        const newPage = currentPage + direction;

        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            fetchStudents(currentSearchTerm, false);
        }
    };

    const updatePaginationButtons = () => {
        const totalPages = Math.ceil(totalStudentsCount / itemsPerPage) || 1;
        const prevBtn = document.getElementById("prev-page-btn");
        const nextBtn = document.getElementById("next-page-btn");
        const info = document.getElementById("page-info");

        if (info) info.textContent = `Page ${currentPage} of ${totalPages} (${totalStudentsCount} students)`;
        
        if (prevBtn) {
            prevBtn.disabled = currentPage === 1;
            prevBtn.style.opacity = currentPage === 1 ? "0.5" : "1";
            prevBtn.style.cursor = currentPage === 1 ? "not-allowed" : "pointer";
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.style.opacity = currentPage >= totalPages ? "0.5" : "1";
            nextBtn.style.cursor = currentPage >= totalPages ? "not-allowed" : "pointer";
        }
    };

    // --- 1. Load Filters ---
    const loadFilters = async () => {
        const { data, error } = await supabase
            .from("student")
            .select("department, year");
        
        if (!error && data) {
            if (departmentFilter) {
                const uniqueDepts = [...new Set(data.map(item => item.department).filter(Boolean))].sort();
                departmentFilter.innerHTML = '<option value="">All Departments</option>';
                uniqueDepts.forEach(dept => {
                    const option = document.createElement("option");
                    option.value = dept;
                    option.textContent = dept;
                    departmentFilter.appendChild(option);
                });
            }

            if (yearFilter) {
                const uniqueYears = [...new Set(data.map(item => item.year).filter(Boolean))].sort((a, b) => a - b);
                yearFilter.innerHTML = '<option value="">All Years</option>';
                uniqueYears.forEach(yr => {
                    const option = document.createElement("option");
                    option.value = yr;
                    option.textContent = `Year ${yr}`;
                    yearFilter.appendChild(option);
                });
            }
        }
    };

    await loadFilters();

    // --- 2. Form Interactions ---
    if (addStudentBtn) {
        addStudentBtn.addEventListener("click", () => {
            addStudentForm.reset();
            document.getElementById("edit-student-id").value = "";
            document.getElementById("student-form-title").textContent = "Add a New Student";
            document.getElementById("save-student-btn").textContent = "Save Student";
            addStudentFormContainer.style.display = "block";
            addStudentFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    if (cancelAddStudentBtn) {
        cancelAddStudentBtn.addEventListener("click", () => {
            addStudentFormContainer.style.display = "none";
            addStudentForm.reset();
        });
    }

    if (addStudentForm) {
        addStudentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(addStudentForm);
            const studentId = formData.get("student_id");

            const studentData = {
                student_name: formData.get("name"),
                admission_no: formData.get("admission_no"),
                email: formData.get("email"),
                phone: formData.get("phone"),
                department: formData.get("department"),
                year: formData.get("year") || null,
                section: formData.get("section"),
                dob: formData.get("dob") || null
            };

            let error;
            let successMessage = "";

            if (studentId) {
                const { error: updateError } = await supabase
                    .from("student")
                    .update(studentData)
                    .eq("admission_no", studentId);
                error = updateError;
                successMessage = "Student updated successfully!";
            } else {
                const { error: insertError } = await supabase
                    .from("student")
                    .insert([studentData]);
                error = insertError;
                successMessage = "Student added successfully!";
            }

            if (error) {
                console.error("Error saving student:", error);
                alert(`Error: ${error.message}`);
            } else {
                addStudentFormContainer.style.display = "none";
                addStudentForm.reset();
                fetchStudents(currentSearchTerm, false);
                loadFilters(); 
                alert(successMessage);
            }
        });
    }

    // --- 3. Fetch & Filter Logic ---
    const fetchStudents = async (searchTerm = "", resetPage = false) => {
        if (resetPage) currentPage = 1;
        currentSearchTerm = searchTerm;

        // Show Loading
        studentsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: #666; padding: 40px;">Loading students...</p>';

        const selectedDept = departmentFilter ? departmentFilter.value : "";
        const selectedYear = yearFilter ? yearFilter.value : "";

        let query = supabase
            .from("student")
            .select("*", { count: 'exact' });

        if (selectedDept) query = query.eq("department", selectedDept);
        if (selectedYear) query = query.eq("year", selectedYear);

        if (searchTerm) {
            const filterTerm = `%${searchTerm}%`;
            query = query.or(`student_name.ilike.${filterTerm},admission_no.ilike.${filterTerm},email.ilike.${filterTerm}`);
        }

        // Apply Pagination
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        
        query = query.order("student_name").range(from, to);

        const { data: students, error, count } = await query;
        
        if (error) {
            console.error("Error fetching students:", error);
            studentsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: red;">Error loading data.</p>';
            return;
        }

        if (count !== null) totalStudentsCount = count;
        updatePaginationButtons();
        displayStudents(students);
    };

    // --- Listeners with Debounce ---
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchStudents(e.target.value.trim(), true);
            }, 500);
        });
    }

    if (departmentFilter) departmentFilter.addEventListener("change", () => fetchStudents(currentSearchTerm, true));
    if (yearFilter) yearFilter.addEventListener("change", () => fetchStudents(currentSearchTerm, true));

    // --- 4. Display Cards ---
    const displayStudents = (students) => {
        if (!studentsContainer) return;
        studentsContainer.innerHTML = "";
        
        if (!students || students.length === 0) {
            studentsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: #666; padding: 20px;">No students found.</p>';
            return;
        }

        students.forEach((student) => {
            const card = document.createElement("div");
            card.className = "student-card";
            
            const initials = student.student_name
                .split(" ")
                .map(n => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

            const formattedDOB = student.dob ? new Date(student.dob).toLocaleDateString() : "N/A";

            card.innerHTML = `
                <div class="card-header">
                    <div class="student-identity">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-info">
                            <h4 class="student-name">${student.student_name}</h4>
                            <div class="student-dept">${student.department} Department</div>
                            <div class="admission-badge">ID: ${student.admission_no}</div>
                        </div>
                    </div>
                    <div class="action-menu-wrapper">
                        <button class="menu-toggle-btn" aria-label="Actions">
                            <i data-lucide="more-vertical" width="20" height="20"></i>
                        </button>
                        <div class="action-menu-dropdown">
                            <a href="#" class="menu-item edit-student-btn" data-id="${student.admission_no}">
                                <i data-lucide="edit" width="16" height="16"></i> Edit
                            </a>
                            <a href="#" class="menu-item delete-student-btn delete-item" data-id="${student.admission_no}">
                                <i data-lucide="trash" width="16" height="16"></i> Delete
                            </a>
                        </div>
                    </div>
                </div>
                
                <div class="card-body">
                    <div class="info-group">
                        <span class="info-label"><i data-lucide="calendar" width="12"></i> Year / Sec</span>
                        <span class="info-value">${student.year || '-'} / ${student.section || '-'}</span>
                    </div>
                     <div class="info-group">
                        <span class="info-label"><i data-lucide="cake" width="12"></i> DOB</span>
                        <span class="info-value">${formattedDOB}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label"><i data-lucide="phone" width="12"></i> Phone</span>
                        <span class="info-value">${student.phone || 'N/A'}</span>
                    </div>
                     <div class="info-group" style="grid-column: 1/-1;">
                        <span class="info-label"><i data-lucide="mail" width="12"></i> Email</span>
                        <span class="info-value email">${student.email}</span>
                    </div>
                </div>
            `;
            studentsContainer.appendChild(card);
        });
        
        if (window.lucide) lucide.createIcons();
    };

    // --- 5. Event Delegation ---
    if (studentsContainer) {
        studentsContainer.addEventListener("click", async (e) => {
            const toggleBtn = e.target.closest(".menu-toggle-btn");
            if (toggleBtn) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = toggleBtn.nextElementSibling;
                document.querySelectorAll(".action-menu-dropdown").forEach(d => {
                   if (d !== dropdown) d.style.display = "none"; 
                });
                dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                return;
            }

            const menuItem = e.target.closest(".menu-item");
            if (!menuItem) return;

            e.preventDefault();
            const id = menuItem.dataset.id;
            const dropdown = menuItem.closest(".action-menu-dropdown");
            if (dropdown) dropdown.style.display = "none";

            if (menuItem.classList.contains("delete-student-btn")) {
                const card = menuItem.closest(".student-card");
                const studentName = card.querySelector(".student-name").textContent;
                if (confirm(`Are you sure you want to delete "${studentName}"?`)) {
                    const { error } = await supabase.from("student").delete().eq("admission_no", id);
                    if (error) alert(`Error: ${error.message}`);
                    else {
                        fetchStudents(currentSearchTerm, false);
                        loadFilters();
                    }
                }
            }

            if (menuItem.classList.contains("edit-student-btn")) {
                const { data: student, error } = await supabase
                    .from("student")
                    .select("*")
                    .eq("admission_no", id)
                    .single();

                if (error) {
                    alert("Could not load student data.");
                    return;
                }

                const form = addStudentForm;
                form.querySelector('[name="name"]').value = student.student_name;
                form.querySelector('[name="admission_no"]').value = student.admission_no;
                form.querySelector('[name="email"]').value = student.email;
                form.querySelector('[name="department"]').value = student.department;
                form.querySelector('[name="phone"]').value = student.phone || "";
                form.querySelector('[name="year"]').value = student.year || "";
                form.querySelector('[name="section"]').value = student.section || "";
                form.querySelector('[name="dob"]').value = student.dob || "";

                document.getElementById("edit-student-id").value = student.admission_no;
                document.getElementById("student-form-title").textContent = "Edit Student";
                document.getElementById("save-student-btn").textContent = "Update Student";

                addStudentFormContainer.style.display = "block";
                addStudentFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".action-menu-wrapper")) {
                document.querySelectorAll(".action-menu-dropdown").forEach(el => {
                    el.style.display = "none";
                });
            }
        });
    }

    setupPaginationUI();
    fetchStudents();
});