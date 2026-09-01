import datetime
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models.schema import (
    User, UserRole, Class, Student, Faculty, Subject, SubjectType,
    TimetableEntry, ScheduledLecture, LectureStatus, AttendanceSession,
    SessionStatus, AttendanceRecord, AttendanceStatus, AttendanceSource
)
from app.auth.security import hash_password

STUDENT_SEED_DATA = [
    ("251943004001", "001", "Dhrumil Nandanvar"),
    ("251943004002", "002", "Tanishq Singh Tomar"),
    ("251943004003", "003", "Aikya Bhanu Prakash"),
    ("251943004004", "004", "Drashti Jayshukhbhai Budheliya"),
    ("251943004005", "005", "Sudisht Kumar Jha"),
    ("251943004006", "006", "Anjali Semwal"),
    ("251943004007", "007", "Manvendrasinh Virendrasinh Parmar"),
    ("251943004008", "008", "Tanmay Janardan Das"),
    ("251943004009", "009", "Angelina Ann"),
    ("251943004010", "010", "Kriti Chettri"),
    ("251943004011", "011", "Murali Revathi"),
    ("251943004012", "012", "Singh Anant Hemantraj"),
    ("251943004013", "013", "Anjali Gupta"),
    ("251943004014", "014", "Mann Sanjaykumar Thakkar"),
    ("251943004015", "015", "Tarun Gupta"),
    ("251943004016", "016", "Hardik Mishra"),
    ("251943004017", "017", "Ankit"),
    ("251943004018", "018", "Shashi kant Kumar"),
    ("251943004019", "019", "Jatin Gehlot"),
    ("251943004020", "020", "Triya Rai"),
    ("251943004021", "021", "Vedant Singh"),
    ("251943004022", "022", "Freya Tusharbhai Vaghela"),
    ("251943004023", "023", "Abhishek Mallavarapu"),
    ("251943004024", "024", "Sanghati Sarkar"),
    ("251943004025", "025", "Geethu Krishna"),
    ("251943004026", "026", "Harsh Yadav"),
    ("251943004027", "027", "Harsh Verma"),
    ("251943004028", "028", "Preetham Mukthi"),
    ("251943004029", "029", "Asmita A poal"),
    ("251943004030", "030", "Himani Chandel"),
    ("251943004032", "031", "Chandarlapati Rithvika Bhavana"),
    ("251943004033", "032", "Sanskriti Singh"),
    ("251943004034", "033", "Ankita Kumari"),
]

HISTORICAL_DATES = [
    datetime.date(2026, 7, 27),
    datetime.date(2026, 8, 3),
    datetime.date(2026, 8, 10),
    datetime.date(2026, 8, 17),
    datetime.date(2026, 8, 24),
    datetime.date(2026, 8, 31),
]

HISTORICAL_MATHS_GRID = [
    "PPPPPP", "PPPPPA", "PPPPPP", "PPAPPP", "PPPPPP",
    "APPPPP", "PPPPPP", "PPPPAP", "PPPPPP", "PPPPPP",
    "PPAPPP", "PPPPPP", "PPPPPP", "PPPPPP", "PAPPPP",
    "PPPPPP", "PPPPAP", "PPAPPP", "PPPPPP", "PPPPPP",
    "PPPPPP", "APPPPP", "PPPPPP", "PPPPPP", "PPPPPA",
    "PPPPPP", "PPAPPP", "PPPPPP", "PPPPPP", "PPPPPP",
    "PAPPPP", "PPPPPP", "PPPPPP"
]


def seed_database(db: Session):
    Base.metadata.create_all(bind=engine)

    # 1. Admin User
    admin_user = db.query(User).filter(User.email == "admin@nsit.ac.in").first()
    if not admin_user:
        admin_user = User(
            email="admin@nsit.ac.in",
            password_hash=hash_password("Admin@123"),
            full_name="System Administrator",
            role=UserRole.ADMIN.value
        )
        db.add(admin_user)
        db.commit()

    # 2. Class
    cls = db.query(Class).filter(Class.code == "CSE-CS-3").first()
    if not cls:
        cls = Class(
            name="B.Tech-M.Tech CSE (Cyber Security)",
            code="CSE-CS-3",
            semester="III",
            room_no="109",
            academic_year="2026-27",
            term_start=datetime.date(2026, 7, 22),
            term_end=datetime.date(2026, 12, 31)
        )
        db.add(cls)
        db.commit()
        db.refresh(cls)

    # 3. Faculty
    faculty_members = [
        ("akash.thakkar@nsit.ac.in", "Dr. Akash Thakkar", "FAC001", "Department of Cyber Security", "AT"),
        ("minal.shah@nsit.ac.in", "Dr. Minal Shah", "FAC002", "Department of Computer Science", "MS"),
        ("sailesh.iyer@nsit.ac.in", "Prof. (Dr.) Sailesh Iyer", "FAC003", "Department of Cyber Security", "SI"),
        ("nikunj.tahilramani@nsit.ac.in", "Dr. Nikunj Tahilramani", "FAC004", "Department of Cyber Security", "NT"),
        ("vishali.sharma@nsit.ac.in", "Dr. Vishali Sharma", "FAC005", "Department of Cyber Security", "VS"),
        ("hepi.suthar@nsit.ac.in", "Ms. Hepi Suthar", "FAC006", "Department of Cyber Security", "HS")
    ]

    faculty_map = {}
    for email, name, code, dept, abbrev in faculty_members:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("Faculty@123"),
                full_name=name,
                role=UserRole.FACULTY.value
            )
            db.add(u)
            db.commit()
            db.refresh(u)

        f = db.query(Faculty).filter(Faculty.user_id == u.id).first()
        if not f:
            f = Faculty(
                user_id=u.id,
                employee_code=code,
                department=dept,
                abbreviation=abbrev
            )
            db.add(f)
            db.commit()
            db.refresh(f)

        faculty_map[abbrev] = f

    # 4. Subjects
    subjects_data = [
        ("CTBT-BSC-301", "Engineering Mathematics III", 4, SubjectType.THEORY.value),
        ("CTBT-PCC-301", "Data Structures & Algorithms", 3, SubjectType.THEORY.value),
        ("CTBT-PCC-302", "Database Management Systems", 3, SubjectType.THEORY.value),
        ("CTBT-PCC-303", "Computer Programming with Python", 2, SubjectType.THEORY.value),
        ("CTBT-PCC-304", "Computer Organization & Microprocessors", 3, SubjectType.THEORY.value),
        ("CTBT-ESC-301", "Essentials of Cyber Security", 3, SubjectType.THEORY.value),
        ("CTBT-PCC-301L", "Data Structure & Algorithms Laboratory", 2, SubjectType.LABORATORY.value),
        ("CTBT-PCC-302L", "Database Management Systems Laboratory", 2, SubjectType.LABORATORY.value),
        ("CTBT-PCC-303L", "Computer Programming with Python Laboratory", 4, SubjectType.LABORATORY.value),
        ("CTBT-PCC-304L", "Computer Organization & Microprocessors Laboratory", 2, SubjectType.LABORATORY.value),
    ]

    subject_map = {}
    for code, name, credits, stype in subjects_data:
        sub = db.query(Subject).filter(Subject.code == code).first()
        if not sub:
            sub = Subject(code=code, name=name, credits=credits, subject_type=stype)
            db.add(sub)
            db.commit()
            db.refresh(sub)
        subject_map[code] = sub

    # 5. Students (33 students)
    student_objs = []
    for enroll, roll, name in STUDENT_SEED_DATA:
        email = f"student{roll}@nsit.ac.in"
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("Student@123"),
                full_name=name,
                role=UserRole.STUDENT.value
            )
            db.add(u)
            db.commit()
            db.refresh(u)

        st = db.query(Student).filter(Student.user_id == u.id).first()
        if not st:
            st = Student(
                user_id=u.id,
                enrollment_no=enroll,
                roll_no=roll,
                class_id=cls.id,
                semester="III",
                branch="Cyber Security"
            )
            db.add(st)
            db.commit()
            db.refresh(st)
        student_objs.append(st)

    # 6. Timetable Entries matching Image 2 schedule
    # Monday = 0, Tuesday = 1, Wednesday = 2, Thursday = 3, Friday = 4
    timetable_schedule = [
        # Monday
        (0, "09:30", "10:25", "CTBT-PCC-301", "MS", "109"),
        (0, "10:25", "11:20", "CTBT-BSC-301", "AT", "109"),
        (0, "11:20", "12:15", "CTBT-PCC-302", "SI", "109"),
        (0, "13:15", "14:10", "CTBT-PCC-303", "NT", "109"),
        (0, "14:10", "15:05", "CTBT-ESC-301", "HS", "109"),
        (0, "15:05", "16:00", "CTBT-PCC-304", "VS", "109"),

        # Tuesday
        (1, "09:30", "10:25", "CTBT-PCC-304", "VS", "109"),
        (1, "10:25", "12:15", "CTBT-PCC-303L", "NT", "108 C"),
        (1, "13:15", "15:05", "CTBT-PCC-302L", "MS", "108 C"),
        (1, "15:05", "16:00", "CTBT-ESC-301", "HS", "109"),

        # Wednesday
        (2, "09:30", "10:25", "CTBT-PCC-301", "MS", "109"),
        (2, "10:25", "11:20", "CTBT-BSC-301", "AT", "109"),
        (2, "11:20", "12:15", "CTBT-PCC-302", "SI", "109"),
        (2, "14:10", "16:00", "CTBT-PCC-304L", "VS", "108 C"),

        # Thursday
        (3, "09:30", "10:25", "CTBT-PCC-304", "VS", "109"),
        (3, "10:25", "12:15", "CTBT-PCC-303L", "NT", "108 C"),
        (3, "13:15", "14:10", "CTBT-BSC-301", "AT", "109"),
        (3, "14:10", "16:00", "CTBT-PCC-301L", "MS", "108 C"),

        # Friday
        (4, "09:30", "10:25", "CTBT-ESC-301", "HS", "109"),
        (4, "10:25", "11:20", "CTBT-BSC-301", "AT", "109"),
        (4, "11:20", "12:15", "CTBT-PCC-302", "SI", "109"),
        (4, "14:10", "15:05", "CTBT-PCC-303", "NT", "109"),
        (4, "15:05", "16:00", "CTBT-PCC-301", "MS", "109"),
    ]

    maths_entry = None
    for day, s_time, e_time, sub_code, fac_abbrev, room in timetable_schedule:
        st = datetime.datetime.strptime(s_time, "%H:%M").time()
        et = datetime.datetime.strptime(e_time, "%H:%M").time()
        sub = subject_map[sub_code]
        fac = faculty_map[fac_abbrev]

        te = db.query(TimetableEntry).filter(
            TimetableEntry.class_id == cls.id,
            TimetableEntry.subject_id == sub.id,
            TimetableEntry.day_of_week == day,
            TimetableEntry.start_time == st
        ).first()

        if not te:
            te = TimetableEntry(
                class_id=cls.id,
                subject_id=sub.id,
                faculty_id=fac.id,
                day_of_week=day,
                start_time=st,
                end_time=et,
                room=room,
                effective_from=datetime.date(2026, 7, 22),
                effective_until=datetime.date(2026, 12, 31)
            )
            db.add(te)
            db.commit()
            db.refresh(te)

        if sub_code == "CTBT-BSC-301" and day == 0:  # Monday Maths-3 entry
            maths_entry = te

    # 7. Seed Historical Lectures & Attendance for Maths-3
    if maths_entry:
        for idx, h_date in enumerate(HISTORICAL_DATES):
            lec = db.query(ScheduledLecture).filter(
                ScheduledLecture.timetable_id == maths_entry.id,
                ScheduledLecture.date == h_date
            ).first()

            if not lec:
                lec = ScheduledLecture(
                    timetable_id=maths_entry.id,
                    date=h_date,
                    scheduled_start=maths_entry.start_time,
                    scheduled_end=maths_entry.end_time,
                    lecture_number=idx + 1,
                    status=LectureStatus.COMPLETED.value
                )
                db.add(lec)
                db.commit()
                db.refresh(lec)

            session = db.query(AttendanceSession).filter(AttendanceSession.scheduled_lecture_id == lec.id).first()
            if not session:
                session = AttendanceSession(
                    scheduled_lecture_id=lec.id,
                    token=f"hist_token_{idx+1}_{h_date.isoformat()}",
                    status=SessionStatus.CLOSED.value,
                    opened_at=datetime.datetime.combine(h_date, maths_entry.start_time),
                    closed_at=datetime.datetime.combine(h_date, maths_entry.end_time),
                    duration_minutes=5
                )
                db.add(session)
                db.commit()
                db.refresh(session)

            # Insert student records based on HISTORICAL_MATHS_GRID
            for s_idx, student_obj in enumerate(student_objs):
                status_char = HISTORICAL_MATHS_GRID[s_idx][idx]
                att_status = AttendanceStatus.PRESENT.value if status_char == "P" else AttendanceStatus.ABSENT.value

                rec = db.query(AttendanceRecord).filter(
                    AttendanceRecord.session_id == session.id,
                    AttendanceRecord.student_id == student_obj.id
                ).first()

                if not rec:
                    rec = AttendanceRecord(
                        session_id=session.id,
                        student_id=student_obj.id,
                        device_id=None,
                        timestamp=datetime.datetime.combine(h_date, maths_entry.start_time),
                        status=att_status,
                        source=AttendanceSource.QR_SCAN.value if att_status == "PRESENT" else AttendanceSource.MANUAL_FACULTY.value
                    )
                    db.add(rec)

        db.commit()
    print("Database seeding completed successfully!")
