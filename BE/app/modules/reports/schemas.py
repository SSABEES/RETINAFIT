from pydantic import BaseModel


class ReportResponse(BaseModel):
    id: int
    title: str
