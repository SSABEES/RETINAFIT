from pydantic import BaseModel


class VisitCreate(BaseModel):
    customer_name: str
    customer_phone: str | None = None
    test_json: dict | None = None
    vp_json: dict | None = None
    report_json: dict | None = None


class VisitResponse(VisitCreate):
    id: int
