from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


try:
    ZONA_HOTEL = ZoneInfo("America/Tegucigalpa")
except ZoneInfoNotFoundError:
    ZONA_HOTEL = timezone(timedelta(hours=-6), name="America/Tegucigalpa")


def ahora_hotel() -> datetime:
    return datetime.now(ZONA_HOTEL)


def fecha_hotel() -> date:
    return ahora_hotel().date()
