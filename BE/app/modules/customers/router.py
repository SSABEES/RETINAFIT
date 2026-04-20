from fastapi import APIRouter

from app.modules.customers.schemas import CustomerCreate, CustomerResponse

router = APIRouter()


@router.get("", response_model=list[CustomerResponse])
def list_customers() -> list[CustomerResponse]:
    return []


@router.post("", response_model=CustomerResponse)
def create_customer(payload: CustomerCreate) -> CustomerResponse:
    return CustomerResponse(id=1, **payload.model_dump())
