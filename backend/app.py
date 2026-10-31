from flask import Flask, jsonify
from db import get_db_connection
from flask import Flask, request, jsonify
from psycopg import errors
from flask_cors import CORS

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "https://college-courses-exam-management-sys.vercel.app"
            ]
        }
    }
)

@app.get("/")
def home() :
    return jsonify({
        "message" : "College Courses and Examination Management System",
        "status" : "running"
    })

@app.get("/api/health")
def health():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        current_database() AS database_name,
                        current_user AS username
            """)
                result = cur.fetchone()

            return jsonify({
                "status" : "connected",
                "database" : result["database_name"],
                "user" : result["username"]
            })
    except Exception:
        app.logger.exception("Database connection failed")
        return jsonify({
            "status" : "error",
            "message": "Could not connect to the database"
        }), 503

@app.get("/api/students")
def get_students():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    s.student_id,
                    s.roll_number,
                    s.name,
                    s.email,
                    s.admission_year,
                    d.department_name
                FROM students s
                JOIN departments d
                    ON s.department_id = d.department_id
                ORDER BY s.student_id;
        """)
            students = cur.fetchall()
    return jsonify(students)

@app.get("/api/courses")
def get_courses() :
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    c.course_id,
                    c.course_code,
                    c.course_name,
                    c.credits, 
                    d.department_name
                FROM courses c
                JOIN departments d
                    On c.department_id = d.department_id
                ORDER BY c.course_code;
        """)
            courses = cur.fetchall()
        return jsonify(courses)
# CREATE
@app.post("/api/students")
def create_students():
    data = request.get_json(silent=True) or {}

    required = ["roll_number", "name", "department_id"]

    if any(data.get(field) in (None, "") for field in required):
        return jsonify({
            "error" : "roll_number, name and department_id are required"
        }),400
    try :
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO students
                        (roll_number, name, email,
                        department_id, admission_year)
                    VALUES(%s, %s, %s, %s, %s)
                    RETURNING student_id, roll_number, name, email;
                """, (
                data["roll_number"],
                data["name"],
                data.get("email"),
                data["department_id"],
                data.get("admission_year")
                ))
                student = cur.fetchone()
        return jsonify(student), 201
    except Exception:
        app.logger.exception("Could not create student")
        return jsonify({
            "error" : "Could not create student. Check the input and database"
        }), 400
# UPDATE
@app.put("/api/students/<int:student_id>")
def update_student(student_id):
    data = request.get_json(silent=True) or {}

    allowed_fields = {
        "roll_number",
        "name",
        "email",
        "department_id",
        "admission_year"
    }

    if not data or not set(data).issubset(allowed_fields):
        return jsonify({
            "error" : "Provide valid student fields to update"
        }), 400
    
    assignments = []
    values = []

    for field in allowed_fields:
        if field in data :
            assignments.append(f"{field} = %s")
            values.append(data[field])

    values.append(student_id)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE students
                    SET {", ".join(assignments)}
                    WHERE student_id = %s
                    RETURNING student_id, roll_number, name, email,
                            department_id, admission_year;
                    """,
                    values
                )
                student = cur.fetchone()

        if student is None :
            return jsonify({"error" : "Student not found"}),404

        return jsonify(student)
    except Exception:
        app.logger.exception("Could not update student")
        return jsonify({
            "error" : "Could not update student. Check input and constraints."
        }), 400

# DELETE
@app.delete("/api/students/<int:student_id>")
def delete_student(student_id) :
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM students
                    WHERE student_id = %s
                    RETURNING student_id, roll_number, name;
            """, (student_id,))
                student = cur.fetchone()
        if student is None:
            return jsonify({"error" : "student not found"}), 404
        return jsonify({
            "message" : "Student deleted successfully",
            "student" : student
        })
    except Exception:
        app.logger.exception("Could not delete student")
        return jsonify({
            "error" : "Could not delete student. Check related records."
        }), 409

@app.post("/api/enrollments")
def create_enrollment():
    data = request.get_json(silent=True) or {}

    student_id = data.get("student_id")
    offering_id = data.get("offering_id")

    if student_id is None or offering_id is None:
        return jsonify({
            "error" : "student and offering_id are required"
        }), 400
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO enrollments (student_id, offering_id)
                    VALUES (%s, %s)
                    RETURNING enrollment_id, student_id,
                                offering_id, enrollment_date;
                    """, (student_id, offering_id))
                enrollment = cur.fetchone()
        return jsonify(enrollment), 201
    except errors.UniqueViolation:
        return jsonify({
            "error" : "This student is already enrolled in this offering"
        }), 409
    except errors.ForeignKeyViolation:
        return jsonify({
            "error": "Invalid student_id or offering_id"
        }), 400

# Course for a particular student
@app.get("/api/students/<int:student_id>/courses")
def get_student_courses(student_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    s.student_id,
                    s.name AS student_name,
                    c.course_code,
                    c.course_name,
                    c.credits,
                    sem.semester_number,
                    sem.academic_year,
                    f.name AS faculty_name
                FROM enrollments en
                JOIN students s
                    ON s.student_id = en.student_id
                JOIN course_offerings co
                    ON co.offering_id = en.offering_id
                JOIN courses c
                    ON c.course_id = co.course_id
                JOIN semesters sem
                    ON sem.semester_id = co.semester_id
                JOIN faculty f
                    ON f.faculty_id = co.faculty_id
                WHERE s.student_id = %s
                ORDER BY c.course_code;
            """, (student_id,))
            courses = cur.fetchall()
    return jsonify(courses)

@app.get("/api/examinations")
def get_examinations():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    e.exam_id,
                    e.exam_type,
                    e.exam_date,
                    e.max_marks,
                    c.course_code,
                    c.course_name,
                    sem.semester_number,
                    sem.academic_year
                FROM examinations e
                JOIN course_offerings co
                    ON co.offering_id = e.offering_id
                JOIN courses c
                    ON c.course_id = co.course_id
                JOIN semesters sem
                    ON sem.semester_id = co.semester_id
                ORDER BY e.exam_date;
            """)
            examinations = cur.fetchall()
    return jsonify(examinations)

@app.post("/api/marks")
def save_marks():
    data = request.get_json(silent=True) or {}

    required = ["enrollment_id", "exam_id", "marks_obtained"]

    if any(data.get(field) is None for field in required):
        return jsonify({
            "error" : "enrollment_id, exam_id, and marks_obtained are required"
        }), 400

    try:
        marks_obtained = float(data["marks_obtained"])

        if not 0 <= marks_obtained:
            return jsonify({
                "error":"Marks cannot be negative"
            }),400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        en.offering_id AS enrollment_offering,
                        e.offering_id AS exam_offering,
                        e.max_marks
                    FROM enrollments en
                    CROSS JOIN examinations e
                    WHERE en.enrollment_id = %s
                        AND e.exam_id = %s
                """, (data["enrollment_id"], data["exam_id"]))

                record = cur.fetchone()

                if record is None:
                    return jsonify({
                        "error" : "Enrollment or examination not found"
                    }), 404

                if record["enrollment_offering"] != record["exam_offering"]:
                    return jsonify({
                        "error" : "Enrollment and examination belong to different offerings"
                    }), 400

                if marks_obtained > float(record["max_marks"]):
                    return jsonify({
                        "error" : "Marks cannot exceed maximum marks"
                    }), 400

                cur.execute("""
                    INSERT INTO marks
                            (enrollment_id, exam_id, marks_obtained)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (enrollment_id, exam_id)
                    DO UPDATE SET
                        marks_obtained = EXCLUDED.marks_obtained
                    RETURNING mark_id, enrollment_id,
                                exam_id, marks_obtained;
                """, (
                    data["enrollment_id"],
                    data["exam_id"],
                    marks_obtained
                ))

                result = cur.fetchone()

        return jsonify(result), 200
    
    except (ValueError, TypeError):
        return jsonify({"error" : "invalid Marks value"}), 400

@app.get("/api/students/<int:student_id>/results")
def get_student_results(student_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    s.student_id,
                    s.name AS student_name,
                    c.course_code,
                    c.course_name,
                    e.exam_type,
                    e.exam_date,
                    m.marks_obtained,
                    e.max_marks,
                    ROUND(
                    m.marks_obtained*100.00/ e.max_marks, 2) 
                    AS percentage
                    FROM students s
                    JOIN enrollments en
                        ON en.student_id = s.student_id
                    JOIN marks m
                        ON m.enrollment_id = en.enrollment_id
                    JOIN examinations e
                        ON e.exam_id = m.exam_id
                    JOIN course_offerings co
                        ON co.offering_id = e.offering_id
                    AND co.offering_id = en.offering_id
                    JOIN courses c
                        ON c.course_id = co.course_id
                    WHERE s.student_id = %s
                    ORDER BY e.exam_date, c.course_code;
                """, (student_id,))
            
            results = cur.fetchall()

    return jsonify(results)

@app.get("/api/faculty")
def get_faculty() :
    try :
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        f.faculty_id,
                        f.name,
                        f.email,
                        d.department_name
                    FROM faculty f
                    JOIN departments d
                        ON d.department_id = f.department_id
                    ORDER BY f.faculty_id;
                """)
                faculty = cur.fetchall()

        return jsonify(faculty)
    
    except Exception :
        app.logger.exception("Failed to fetch faculty")
        return jsonify({
            "error": "Could not retrieve faculty records"
        }), 500

@app.route("/api/courses", methods = ["POST"])
def add_course():
    data = request.get_json(silent= True) or {}

    course_code = str(data.get("course_code", "")).strip()
    course_name = str(data.get("course_name", "")).strip()

    try:
        credits = int(data.get("credits"))
        department_id = int(data.get("department_id"))
    except (TypeError, ValueError) :
        return jsonify({
            "error": "Credits  and department are required."
        }), 400
    if not course_code or not course_name:
        return jsonify({
            "error": "Course code and name are required."
        }), 400

    if credits <= 0:
        return jsonify({
            "error": "Credits must be greater than zero."
        }), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    '''
                    INSERT INTO courses
                        (course_code, course_name, credits, department_id)
                    VALUES (%s, %s, %s, %s)
                    RETURNING course_id, course_code, course_name,
                                credits, department_id
                    ''',
                    (course_code, course_name, credits, department_id)
                )
                course = cur.fetchone()
        return jsonify(dict(course)), 201

    except errors.UniqueViolation:
        return jsonify({
            "error":"This course code already exists."
        }), 409

    except errors.ForeignKeyViolation:
        return jsonify({
            "error": "The selected department does not exists"
        }), 400

@app.route("/api/departments", methods = ["GET"])
def get_departments():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT department_id, department_name
                FROM departments
                ORDER BY department_name
            ''')
            departments = cur.fetchall()
    return jsonify(departments)

@app.route("/api/semesters", methods=["GET"])
def get_semesters():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT semester_id, semester_number, academic_year
                FROM semesters
                ORDER BY academic_year, semester_number
            """)
            semesters = cur.fetchall()

    return jsonify(semesters)
@app.route("/api/offerings", methods=["GET"])
def get_offerings():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    co.offering_id,
                    c.course_code,
                    c.course_name,
                    s.semester_number,
                    s.academic_year,
                    f.name AS faculty_name,
                    co.capacity
                FROM course_offerings co
                JOIN courses c ON c.course_id = co.course_id
                JOIN semesters s ON s.semester_id = co.semester_id
                JOIN faculty f ON f.faculty_id = co.faculty_id
                ORDER BY s.academic_year, s.semester_number, c.course_code
            """)
            offerings = cur.fetchall()

    return jsonify(offerings)

@app.route("/api/offerings", methods=["POST"])
def create_offering():
    data = request.get_json(silent=True) or {}

    course_code = str(data.get("course_code", "")).strip()
    course_name = str(data.get("course_name", "")).strip()

    try:
        credits = int(data.get("credits"))
        department_id = int(data.get("department_id"))
        semester_id = int(data.get("semester_id"))
        faculty_id = int(data.get("faculty_id"))
        capacity = int(data.get("capacity", 60))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Enter valid course, department, semester, faculty, credits, and capacity details."
        }), 400

    if not course_code or not course_name:
        return jsonify({
            "error": "Course code and course name are required."
        }), 400

    if credits <= 0 or capacity <= 0:
        return jsonify({
            "error": "Credits and capacity must be greater than zero."
        }), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Find an existing course using its unique course code.
                cur.execute(
                    """
                    SELECT course_id, course_name
                    FROM courses
                    WHERE course_code = %s
                    """,
                    (course_code,)
                )
                course = cur.fetchone()

                if course:
                    # Reuse an existing course rather than creating a duplicate.
                    course_id = course["course_id"]
                else:
                    # Create the new course.
                    cur.execute(
                        """
                        INSERT INTO courses
                            (course_code, course_name, credits, department_id)
                        VALUES (%s, %s, %s, %s)
                        RETURNING course_id
                        """,
                        (course_code, course_name, credits, department_id)
                    )
                    course_id = cur.fetchone()["course_id"]

                # Create the offering for the selected semester and faculty.
                cur.execute(
                    """
                    INSERT INTO course_offerings
                        (course_id, semester_id, faculty_id, capacity)
                    VALUES (%s, %s, %s, %s)
                    RETURNING offering_id
                    """,
                    (course_id, semester_id, faculty_id, capacity)
                )

                offering = cur.fetchone()

        return jsonify({
            "message": f"Offering created successfully for {course_name}.",
            "offering_id": offering["offering_id"],
            "course_id": course_id,
            "course_code": course_code,
            "course_name": course_name
        }), 201

    except errors.UniqueViolation:
        return jsonify({
            "error": "This course already has an offering for that semester."
        }), 409

    except errors.ForeignKeyViolation:
        return jsonify({
            "error": "The selected department, semester, or faculty member does not exist."
        }), 400    
@app.route("/api/faculty", methods=["POST"])
def add_faculty():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email") or "").strip() or None

    try:
        department_id = int(data.get("department_id"))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Please select a valid department."
        }), 400

    if not name:
        return jsonify({"error": "Faculty name is required."}), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO faculty (name, email, department_id)
                    VALUES (%s, %s, %s)
                    RETURNING faculty_id, name, email, department_id
                """, (name, email, department_id))

                faculty_member = cur.fetchone()

        return jsonify(dict(faculty_member)), 201

    except errors.UniqueViolation:
        return jsonify({
            "error": "This email address is already registered."
        }), 409

    except errors.ForeignKeyViolation:
        return jsonify({
            "error": "The selected department does not exist."
        }), 400

if __name__ == "__main__":
    app.run(debug=True)