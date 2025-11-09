import { supabase } from "../supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    const studentsTableBody = document.getElementById("students-table-body");
    const searchInput = parent.document.getElementById("search-box");

    const addStudentBtn = document.getElementById("add-student-btn");
    const addStudentFormContainer = document.getElementById("add-student-form-container");
    const cancelAddStudentBtn = document.getElementById("cancel-add-student-btn");
    const addStudentForm = document.getElementById("add-student-form");

    if (addStudentBtn) {
        addStudentBtn.addEventListener("click", () => {
            addStudentForm.reset();
            document.getElementById("edit-student-id").value = "";
            document.getElementById("student-form-title").textContent = "Add a New Student";
            document.getElementById("save-student-btn").textContent = "Save Student";
            addStudentFormContainer.style.display = "block";
        });
    }

    if (cancelAddStudentBtn) {
        cancelAddStudentBtn.addEventListener("click", () => {
            addStudentFormContainer.style.display = "none";
            addStudentForm.reset();
            document.getElementById("edit-student-id").value = "";
            document.getElementById("student-form-title").textContent = "Add a New Student";
            document.getElementById("save-student-btn").textContent = "Save Student";
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
                department: formData.get("department"),
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
                alert(`Error saving student: ${error.message}`);
            } else {
                addStudentFormContainer.style.display = "none";
                addStudentForm.reset();
                document.getElementById("edit-student-id").value = "";
                document.getElementById("student-form-title").textContent = "Add a New Student";
                document.getElementById("save-student-btn").textContent = "Save Student";

                if (searchInput) searchInput.value = "";
                fetchStudents();
                alert(successMessage);
            }
        });
    }

    const fetchStudents = async (searchTerm = "") => {
        let query = supabase.from("student").select("*").order("student_name");
        if (searchTerm) {
            const filterTerm = `%${searchTerm}%`;
            query = query.or(
                `student_name.ilike.${filterTerm},admission_no.ilike.${filterTerm},email.ilike.${filterTerm},department.ilike.${filterTerm}`
            );
        }
        const { data: students, error } = await query;
        if (error) {
            console.error("Error fetching students:", error);
        } else {
            displayStudents(students);
        }
    };

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const searchTerm = searchInput.value.trim();
            fetchStudents(searchTerm);
        });
    }

    const displayStudents = (students) => {
        if (!studentsTableBody) return;
        studentsTableBody.innerHTML = "";
        if (students.length === 0) {
            studentsTableBody.innerHTML =
                '<tr><td colspan="5">No students found.</td></tr>';
            return;
        }
        students.forEach((student) => {
            const row = document.createElement("tr");

            const createCell = (text) => {
                const cell = document.createElement("td");
                cell.textContent = text;
                cell.title = text;
                return cell;
            };

            row.appendChild(createCell(student.student_name));
            row.appendChild(createCell(student.admission_no));
            row.appendChild(createCell(student.email));
            row.appendChild(createCell(student.department));

            const actionsCell = document.createElement("td");
            actionsCell.className = "actions";
            actionsCell.innerHTML = `
                <div class="action-menu-wrapper">
                    <button class="action-btn-sm menu-toggle-btn" aria-label="Open actions menu">
                        <i data-lucide="more-vertical"></i>
                    </button>
                    <div class="action-menu-dropdown">
                        <a href="#" class="menu-item edit-student-btn" data-id="${student.admission_no}">
                            <i data-lucide="edit"></i> Edit
                        </a>
                        <a href="#" class="menu-item delete-student-btn delete-item" data-id="${student.admission_no}">
                            <i data-lucide="trash"></i> Delete
                        </a>
                    </div>
                </div>
            `;
            row.appendChild(actionsCell);

            studentsTableBody.appendChild(row);
        });
        lucide.createIcons();
    };

    if (studentsTableBody) {
        studentsTableBody.addEventListener("click", async (e) => {
            const menuItem = e.target.closest(".menu-item");
            if (!menuItem) return;

            e.preventDefault();
            const id = menuItem.dataset.id;
            const dropdown = menuItem.closest(".action-menu-dropdown");

            if (dropdown) dropdown.style.display = "none";

            if (menuItem.classList.contains("delete-student-btn")) {
                const studentName = menuItem
                    .closest("tr")
                    .querySelector("td:first-child").textContent;

                if (confirm(`Are you sure you want to delete "${studentName}"?`)) {
                    const { error } = await supabase.from("student").delete().eq("admission_no", id);

                    if (error) {
                        console.error("Error deleting student:", error);
                        alert(`Error deleting student: ${error.message}`);
                    } else {
                        alert("Student deleted successfully.");
                        fetchStudents(searchInput.value.trim());
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
                    console.error("Error fetching student for edit:", error);
                    alert("Could not load student data to edit.");
                    return;
                }

                addStudentForm.querySelector('[name="name"]').value = student.student_name;
                addStudentForm.querySelector('[name="admission_no"]').value = student.admission_no;
                addStudentForm.querySelector('[name="email"]').value = student.email;
                addStudentForm.querySelector('[name="department"]').value = student.department;

                document.getElementById("edit-student-id").value = student.admission_no;
                document.getElementById("student-form-title").textContent = "Edit Student";
                document.getElementById("save-student-btn").textContent = "Update Student";

                addStudentFormContainer.style.display = "block";
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });

        studentsTableBody.addEventListener("click", (e) => {
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

    fetchStudents(searchInput ? searchInput.value.trim() : "");
});
