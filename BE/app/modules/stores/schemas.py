from pydantic import BaseModel


class StoreResponse(BaseModel):
    id: int
    name: str
    address: str | None = None
