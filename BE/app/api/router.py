from fastapi import APIRouter

from app.modules.analysis.router import router as analysis_router
from app.modules.auth.router import router as auth_router
from app.modules.customers.router import router as customers_router
from app.modules.fitting.router import router as fitting_router
from app.modules.glasses.router import router as glasses_router
from app.modules.recommendations.router import router as recommendations_router
from app.modules.reports.router import router as reports_router
from app.modules.staff.router import router as staff_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(staff_router, prefix="/staff", tags=["staff"])
api_router.include_router(customers_router, prefix="/customers", tags=["customers"])
api_router.include_router(glasses_router, prefix="/glasses", tags=["glasses"])
api_router.include_router(analysis_router, prefix="/analysis", tags=["analysis"])
api_router.include_router(
    recommendations_router,
    prefix="/recommendations",
    tags=["recommendations"],
)
api_router.include_router(fitting_router, prefix="/fitting", tags=["fitting"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
