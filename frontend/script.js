const API_BASE = "https://college-courses-exam-management-system.onrender.com/api";

const studentsTable = document.getElementById("studentsTable");
const message = document.getElementById("message");

async function fetchAPI(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);

    if (!response.ok) {
        throw new Error(`Request failed: ${endpoint}`);
    }

    return response.json();
}

async function loadStudents() {
    message.textContent = "Loading student records...";
    studentsTable.innerHTML = "";

    try {
        const students = await fetchAPI("/students");

        if (students.length == 0) {
            message.textContent = "No student records found";
            return;
        }

        message.textContent = `${students.length} student(s) found.`;

        students.forEach(student => {
            const row = document.createElement("tr");

            const values = [
                student.roll_number,
                student.name,
                student.email || "-",
                student.department_name,
                student.admission_year ?? "-"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "-";
                row.appendChild(cell);
            });

            const actionsCell = document.createElement("td");

            const editButton = document.createElement("button");
            editButton.textContent = "Edit";
            editButton.className = "secondary_button";
            editButton.addEventListener("click", () => openEditForm(student));

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.style.background = "#dc2626";
            deleteButton.style.marginLeft = "8px";
            deleteButton.addEventListener("click", () => deleteStudent(student));

            actionsCell.append(editButton, deleteButton);
            row.appendChild(actionsCell);

            studentsTable.appendChild(row);
        });

        document.getElementById("studentCount").textContent = students.length;
    } catch (error) {
        console.error("Unable to load students :", error);
        message.textContent =
            "Could not load students. Check whether Flask is running.";
    }
}

async function loadCourses() {
    const coursesTable = document.getElementById("coursesTable");
    const coursesMessage = document.getElementById("coursesMessage");
    try {
        const courses = await fetchAPI("/courses");

        document.getElementById("courseCount").textContent =
            courses.length;
        coursesTable.innerHTML = "";

        if (courses.length === 0) {
            coursesMessage.textContent = "No courses found";
            return;
        }

        courses.forEach(courses => {
            const row = document.createElement("tr");
            [
                courses.course_code,
                courses.course_name,
                courses.credits,
                courses.department_name
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "-";
                row.appendChild(cell);
            });

            coursesTable.appendChild(row);
        });
    } catch (error) {
        console.error("Unable to load courses:", error);
        document.getElementById("courseCount").textContent = "-";
        coursesMessage.textContent = "Could not load courses.";
    }
}

document.getElementById("refreshCourses").addEventListener("click", loadCourses);

async function loadCourseDepartments() {
    const select = document.getElementById("courseDepartment");

    if (!select) return;

    try {
        const departments = await fetchAPI("/departments");

        select.innerHTML = '<option value="">Select department</option>';

        departments.forEach(department => {
            const option = document.createElement("option");
            option.value = department.department_id;
            option.textContent = department.department_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Unable to load departments:", error);
        select.innerHTML = '<option value ="">Failed to load departments</option>';
    }
}
async function loadFacultyDepartments() {
    const select = document.getElementById("facultyDepartment");

    if (!select) return;

    try {
        const departments = await fetchAPI("/departments");

        select.innerHTML = '<option value="">Select department</option>';

        departments.forEach(department => {
            const option = document.createElement("option");
            option.value = department.department_id;
            option.textContent = department.department_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Unable to load faculty departments:", error);
        select.innerHTML =
            '<option value="">Failed to load departments</option>';
    }
}

async function loadFaculty() {
    const table = document.getElementById("facultyTable");
    const message = document.getElementById("facultyMessage");

    if (!table || !message) return;

    try {
        const facultyMembers = await fetchAPI("/faculty");

        table.innerHTML = "";
        message.textContent =
            `${facultyMembers.length} faculty member(s) found.`;

        facultyMembers.forEach(member => {
            const row = document.createElement("tr");

            const values = [
                member.faculty_id,
                member.name,
                member.email || "—",
                member.department_name
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "—";
                row.appendChild(cell);
            });

            table.appendChild(row);
        });

    } catch (error) {
        console.error("Unable to load faculty:", error);
        message.textContent = "Could not load faculty members.";
    }
}

const addFacultyForm = document.getElementById("addFacultyForm");

if (addFacultyForm) {
    addFacultyForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("facultyFormMessage");
        const button = addFacultyForm.querySelector('button[type="submit"]');

        const facultyData = {
            name: document.getElementById("facultyName").value.trim(),
            email: document.getElementById("facultyEmail").value.trim() || null,
            department_id: Number(
                document.getElementById("facultyDepartment").value
            )
        };

        try {
            button.disabled = true;

            const response = await fetch(`${API_BASE}/faculty`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(facultyData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Unable to add faculty member.");
            }

            message.style.color = "green";
            message.textContent =
                `${result.name} added successfully!`;

            addFacultyForm.reset();

            await loadFaculty();
            await loadDashboard();

        } catch (error) {
            console.error("Unable to add faculty:", error);
            message.style.color = "red";
            message.textContent = error.message;

        } finally {
            button.disabled = false;
        }
    });
}

document.getElementById("refreshFaculty")
    .addEventListener("click", async () => {
        await loadFacultyDepartments();
        await loadFaculty();
    });





async function loadOfferingOptions() {
    const semesterSelect = document.getElementById("offeringSemester");
    const facultySelect = document.getElementById("offeringFaculty");
    const departmentSelect = document.getElementById("offeringCourseDepartment");

    try {
        const [semesters, faculty, departments] = await Promise.all([
            fetchAPI("/semesters"),
            fetchAPI("/faculty"),
            fetchAPI("/departments")
        ]);

        semesterSelect.innerHTML = '<option value="">Select semester</option>';

        semesters.forEach(semester => {
            const option = document.createElement("option");
            option.value = semester.semester_id;
            option.textContent =
                `Semester ${semester.semester_number} (${semester.academic_year})`;
            semesterSelect.appendChild(option);
        });

        facultySelect.innerHTML = '<option value="">Select faculty</option>';

        faculty.forEach(member => {
            const option = document.createElement("option");
            option.value = member.faculty_id;
            option.textContent = member.name;
            facultySelect.appendChild(option);
        });

        departmentSelect.innerHTML = '<option value="">Select department</option>';

        departments.forEach(department => {
            const option = document.createElement("option");
            option.value = department.department_id;
            option.textContent = department.department_name;
            departmentSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Unable to load offering options:", error);
    }
}
async function loadOfferings() {
    const table = document.getElementById("offeringsTable");
    const message = document.getElementById("offeringsMessage");

    try {
        const offerings = await fetchAPI("/offerings");
        table.innerHTML = "";

        if (offerings.length === 0) {
            message.textContent = "No course offerings found.";
            return;
        }

        message.textContent = `${offerings.length} offering(s) found.`;

        offerings.forEach(offering => {
            const row = document.createElement("tr");

            const values = [
                offering.course_code,
                offering.course_name,
                `Semester ${offering.semester_number}`,
                offering.academic_year,
                offering.faculty_name,
                offering.capacity
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "—";
                row.appendChild(cell);
            });

            table.appendChild(row);
        });
    } catch (error) {
        console.error("Unable to load offerings:", error);
        message.textContent = "Could not load course offerings.";
    }
}

const addOfferingForm = document.getElementById("addOfferingForm");

if (addOfferingForm) {
    addOfferingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = document.getElementById("offeringMessage");
        const button = addOfferingForm.querySelector('button[type="submit"]');

        const data = {
            course_code: document.getElementById("offeringCourseCode").value.trim(),
            course_name: document.getElementById("offeringCourseName").value.trim(),
            credits: Number(document.getElementById("offeringCourseCredits").value),
            department_id: Number(document.getElementById("offeringCourseDepartment").value),
            semester_id: Number(document.getElementById("offeringSemester").value),
            faculty_id: Number(document.getElementById("offeringFaculty").value),
            capacity: Number(document.getElementById("offeringCapacity").value)
        };

        try {
            button.disabled = true;
            button.textContent = "Creating...";
            message.textContent = "";

            const result = await fetch(`${API_BASE}/offerings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            const response = await result.json();

            if (!result.ok) {
                throw new Error(response.error || "Unable to create offering.");
            }

            message.style.color = "green";
            message.textContent = response.message || "Course offering created successfully!";

            addOfferingForm.reset();
            document.getElementById("offeringCapacity").value = 60;
            document.getElementById("offeringCourseCredits").value = 3;

            await loadOfferings();
            await loadCourses();
            await loadDashboard();

        } catch (error) {
            message.style.color = "red";
            message.textContent = error.message;
            console.error("Unable to create offering:", error);
        } finally {
            button.disabled = false;
            button.textContent = "Create Offering";
        }
    });
}
document.getElementById("refreshOfferings")
    .addEventListener("click", async () => {
        await loadOfferingOptions();
        await loadOfferings();
    });

const addCourseForm = document.getElementById("addCourseForm");

if (addCourseForm) {
    addCourseForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("addCourseMessage");
        const submitButton = addCourseForm.querySelector(
            'button[type="submit"]'
        );

        const courseData = {
            course_code: document.getElementById("courseCode").value.trim(),
            course_name: document.getElementById("courseName").value.trim(),
            credits: Number(document.getElementById("courseCredits").value),
            department_id: Number(
                document.getElementById("courseDepartment").value
            )
        };

        try {
            submitButton.disabled = true;
            submitButton.textContent = "Adding...";
            message.textContent = "";

            const response = await fetch(`${API_BASE}/courses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(courseData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Unable to add course.");
            }

            message.textContent =
                `Course ${courseData.course_code} added successfully!`;

            message.style.color = "green";

            addCourseForm.reset();

            await loadCourses();
            await loadDashboard();

        } catch (error) {
            console.error("Unable to add course:", error);

            message.textContent = error.message;
            message.style.color = "red";

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add Course";
        }
    });
}
async function loadExaminations() {
    const table = document.getElementById("examinationsTable");
    const message = document.getElementById("examinationsMessage");

    if (!table || !message) {
        console.error("Examinations elements missing in index.html");
        return;
    }
    try {
        const examinations = await fetchAPI("/examinations");

        document.getElementById("examCount").textContent =
            examinations.length;
        table.innerHTML = "";

        if (examinations.length === 0) {
            message.textContent = "No examinations scheduled.";
            return;
        }

        message.textContent =
            `${examinations.length} examination(s) found.`;
        examinations.forEach(exam => {
            const row = document.createElement("tr");

            const values = [
                exam.course_code,
                exam.course_name,
                exam.exam_type,
                exam.exam_date,
                exam.max_marks,
                exam.semester_number != null
                    ? `Semester ${exam.semester_number} (${exam.academic_year})` : "-"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "-";
                row.appendChild(cell);
            });

            table.appendChild(row);
        });
    } catch (error) {
        console.error("unable to load examinations:", error);
        message.textContent = "Could not load examinations";
    }
}
document.getElementById("refreshExaminations").addEventListener("click", loadExaminations);

async function loadResultStudents() {
    const select = document.getElementById("resultStudentId");

    if (!select) {
        console.error("Dropdown #resultStudentId not found.");
        return;
    }

    try {
        console.log("Loading students for Results page...");

        const students = await fetchAPI("/students");

        console.log("Students received:", students);

        select.innerHTML = '<option value="">Select a student</option>';

        students.forEach(student => {
            const option = document.createElement("option");

            option.value = student.student_id;
            option.textContent =
                `${student.roll_number} - ${student.name}`;

            select.appendChild(option);
        });

        console.log(
            "Dropdown populated with",
            select.options.length - 1,
            "students."
        );

    } catch (error) {
        console.error("Unable to load students for Results:", error);
        select.innerHTML = '<option value="">Failed to load students</option>';
    }
}

async function loadStudentResults() {
    const studentId = document.getElementById("resultStudentId").value;
    const table = document.getElementById("resultsTable");
    const message = document.getElementById("resultsMessage");

    table.innerHTML = "";

    if (!studentId) {
        message.textContent = "Please select a student.";
        return;
    }

    try {
        const results = await fetchAPI(`/students/${studentId}/results`);

        if (results.length === 0) {
            message.textContent = "No results available for this student.";
            return;
        }

        message.textContent = `${results.length} result(s) found.`;

        results.forEach(result => {
            const row = document.createElement("tr");

            const values = [
                result.course_code,
                result.course_name,
                result.exam_type,
                result.marks_obtained,
                result.max_marks,
                `${Number(result.percentage).toFixed(2)}%`
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "—";
                row.appendChild(cell);
            });

            table.appendChild(row);
        });
    } catch (error) {
        console.error("Unable to load student results:", error);
        message.textContent = "Could not load results. Check the backend API.";
    }
}

document.getElementById("resultStudentId")
    .addEventListener("change", loadStudentResults);

document.getElementById("refreshResults")
    .addEventListener("click", async () => {
        await loadResultStudents();
        await loadStudentResults();
    });

async function loadFacultyCount() {
    try {
        const faculty = await fetchAPI("/faculty");

        document.getElementById("facultyCount").textContent =
            faculty.length;
    } catch (error) {
        console.error("Unable to load faculty.", error);
        document.getElementById("facultyCount").textContent = "-";
    }
}

document.getElementById("refreshStudents").addEventListener("click", loadStudents);

async function loadDashboard() {
    await Promise.all([
        loadStudents(),
        loadCourses(),
        loadExaminations(),
        loadFacultyCount()
    ]);
}

const studentForm = document.getElementById("studentForm");
const openStudentFormButton = document.getElementById("openStudentForm");
const cancelStudentFormButton = document.getElementById("cancelStudentForm");
const saveStudentButton = document.getElementById("saveStudentButton");
const formMessage = document.getElementById("formMessage");

openStudentFormButton.addEventListener("click", () => {
    studentForm.hidden = false;
    formMessage.textContent = "";
    formMessage.className = "";
    document.getElementById("roll_number").focus();
});

cancelStudentFormButton.addEventListener("click", () => {
    studentForm.reset();
    studentForm.hidden = true;
    formMessage.textContent = "";
    formMessage.className = "";
});

studentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(studentForm);

    const student = {
        roll_number: formData.get("roll_number").trim(),
        name: formData.get("name").trim(),
        email: formData.get("email").trim() || null,
        department_id: Number(formData.get("department_id")),
        admission_year: Number(formData.get("admission_year"))
    };

    if (!student.roll_number || !student.name || !student.department_id) {
        formMessage.textContent = "Please fill in all required fields.";
        formMessage.className = "error";
        return;
    }

    saveStudentButton.disabled = true;
    saveStudentButton.textContent = "Saving...";
    formMessage.textContent = "";

    try {
        const response = await fetch(`${API_BASE}/students`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(student)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || result.message || "Could not register student."
            );
        }

        formMessage.textContent = "Student registered successfully!";
        formMessage.className = "success";

        studentForm.reset();
        document.getElementById("admission_year").value = 2026;

        await loadStudents();

        // Keep the success message visible after refreshing the table.
        formMessage.textContent = "Student registered successfully!";
        formMessage.className = "success";
    } catch (error) {
        formMessage.textContent = error.message;
        formMessage.className = "error";
    } finally {
        saveStudentButton.disabled = false;
        saveStudentButton.textContent = "Save Student";
    }
});

const editStudentForm = document.getElementById("editStudentForm");
const editFormMessage = document.getElementById("editFormMessage");
const updateStudentButton = document.getElementById("updateStudentButton");

function openEditForm(student) {
    editStudentForm.hidden = false;

    document.getElementById("edit_student_id").value = student.student_id;
    document.getElementById("edit_roll_number").value = student.roll_number;
    document.getElementById("edit_name").value = student.name;
    document.getElementById("edit_email").value = student.email || "";
    document.getElementById("edit_department_id").value =
        String(student.department_id);
    document.getElementById("edit_admission_year").value =
        student.admission_year ?? "";

    editFormMessage.textContent = "";
    editFormMessage.className = "";

    editStudentForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("cancelEditStudent").addEventListener("click", () => {
    editStudentForm.hidden = true;
    editStudentForm.reset();
    editFormMessage.textContent = "";
    editFormMessage.className = "";
});

editStudentForm.addEventListener("submit", async event => {
    event.preventDefault();

    const studentId = document.getElementById("edit_student_id").value;

    const updatedStudent = {
        roll_number: document.getElementById("edit_roll_number").value.trim(),
        name: document.getElementById("edit_name").value.trim(),
        email: document.getElementById("edit_email").value.trim() || null,
        department_id: Number(
            document.getElementById("edit_department_id").value
        ),
        admission_year: Number(
            document.getElementById("edit_admission_year").value
        )
    };

    updateStudentButton.disabled = true;
    updateStudentButton.textContent = "Updating...";

    try {
        const response = await fetch(`${API_BASE}/students/${studentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedStudent)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not update student.");
        }

        editFormMessage.textContent = "Student updated successfully!";
        editFormMessage.className = "success";

        await loadStudents();
        editStudentForm.hidden = true;
        editStudentForm.reset();
    } catch (error) {
        editFormMessage.textContent = error.message;
        editFormMessage.className = "error";
    } finally {
        updateStudentButton.disabled = false;
        updateStudentButton.textContent = "Update Student";
    }
});

async function deleteStudent(student) {
    const confirmed = window.confirm(
        `Delete ${student.name} (${student.roll_number})? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API_BASE}/students/${student.student_id}`,
            { method: "DELETE" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not delete student."
            );
        }

        await loadStudents();
        alert("Student deleted successfully.");
    } catch (error) {
        alert(error.message);
    }
}


const navLinks = document.querySelectorAll(".sidebar nav a");
const pageSections = document.querySelectorAll(".page-section");

navLinks.forEach(link => {
    link.addEventListener("click", async event => {
        event.preventDefault();

        const targetId = link.getAttribute("href").slice(1);
        const targetSection = document.getElementById(targetId);

        if (!targetSection) {
            return;
        }

        pageSections.forEach(section => {
            section.hidden = section.id !== targetId;
        });

        navLinks.forEach(navLink => {
            navLink.classList.toggle("active", navLink === link);
        });

        if (targetId === "courses") {
            await loadCourses();
            await loadCourseDepartments();
        }

        if (targetId === "students") {
            await loadStudents();
        }

        if (targetId === "dashboard") {
            await loadDashboard();
        }

        if (targetId === "examinations") {
            await loadExaminations();
        }

        if (targetId === "results") {
            await loadResultStudents();

            document.getElementById("resultsTable").innerHTML = "";
            document.getElementById("resultsMessage").textContent =
                "Select a student to view results.";
        }
        if (targetId === "faculty") {
            await loadFacultyDepartments();
            await loadFaculty();
        }
    });
});

loadDashboard();