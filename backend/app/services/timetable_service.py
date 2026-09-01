import datetime
from sqlalchemy.orm import Session
from app.models.schema import TimetableEntry, ScheduledLecture, LectureStatus, AttendanceSession, SessionStatus, Subject, Faculty, User, Class

def get_today_schedule(db: Session, target_date: datetime.date, class_id: int = 1):
    """
    Retrieves or creates scheduled lecture instances for the target_date
    based on the configured timetable entries.
    """
    day_of_week = target_date.weekday()  # 0 = Monday, ..., 4 = Friday
    
    # Fetch timetable entries for this day of week
    entries = db.query(TimetableEntry).filter(
        TimetableEntry.class_id == class_id,
        TimetableEntry.day_of_week == day_of_week,
        TimetableEntry.effective_from <= target_date,
        TimetableEntry.effective_until >= target_date
    ).order_by(TimetableEntry.start_time).all()

    result = []
    for entry in entries:
        # Check if scheduled lecture already exists for this date and timetable entry
        lecture = db.query(ScheduledLecture).filter(
            ScheduledLecture.timetable_id == entry.id,
            ScheduledLecture.date == target_date
        ).first()

        if not lecture:
            # Create a new SCHEDULED lecture instance
            lecture = ScheduledLecture(
                timetable_id=entry.id,
                date=target_date,
                scheduled_start=entry.start_time,
                scheduled_end=entry.end_time,
                lecture_number=1,
                status=LectureStatus.SCHEDULED.value
            )
            db.add(lecture)
            db.commit()
            db.refresh(lecture)

        # Get active session token if any
        active_token = None
        session_stat = None
        opened_at_str = None
        duration_mins = None
        if lecture.attendance_session:
            active_token = lecture.attendance_session.token
            session_stat = lecture.attendance_session.status
            opened_at_str = lecture.attendance_session.opened_at.isoformat() if lecture.attendance_session.opened_at else None
            duration_mins = lecture.attendance_session.duration_minutes

        result.append({
            "id": lecture.id,
            "timetable_id": entry.id,
            "date": lecture.date.isoformat(),
            "scheduled_start": lecture.scheduled_start.strftime("%H:%M"),
            "scheduled_end": lecture.scheduled_end.strftime("%H:%M"),
            "lecture_number": lecture.lecture_number,
            "status": lecture.status,
            "cancel_reason": lecture.cancel_reason,
            "rescheduled_date": lecture.rescheduled_date.isoformat() if lecture.rescheduled_date else None,
            "rescheduled_start": lecture.rescheduled_start.strftime("%H:%M") if lecture.rescheduled_start else None,
            "rescheduled_end": lecture.rescheduled_end.strftime("%H:%M") if lecture.rescheduled_end else None,
            "subject_code": entry.subject.code,
            "subject_name": entry.subject.name,
            "faculty_name": entry.faculty.user.full_name,
            "faculty_abbrev": entry.faculty.abbreviation,
            "room": entry.room,
            "active_session_token": active_token,
            "session_status": session_stat,
            "opened_at": opened_at_str,
            "duration_minutes": duration_mins
        })

    return result
