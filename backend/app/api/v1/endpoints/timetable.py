import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.services.timetable_service import get_today_schedule
from app.api.v1.endpoints.auth import get_current_user
from app.models.schema import User, UserRole

router = APIRouter()

@router.get("/schedule")
def get_schedule(
    date_str: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if date_str:
        try:
            target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.date.today()
    else:
        target_date = datetime.date.today()

    schedule = get_today_schedule(db, target_date=target_date, class_id=1)

    # Filter schedule if faculty logged in to show faculty's lectures or all
    if current_user.role == UserRole.FACULTY.value and current_user.faculty_profile:
        fac_abbrev = current_user.faculty_profile.abbreviation
        # Keep faculty lectures or highlight them
        for item in schedule:
            item["is_mine"] = (item["faculty_abbrev"] == fac_abbrev)

    return {
        "date": target_date.isoformat(),
        "day_name": target_date.strftime("%A"),
        "lectures": schedule
    }
