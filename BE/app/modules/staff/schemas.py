from pydantic import BaseModel, EmailStr


class StaffResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    is_active: bool = True
