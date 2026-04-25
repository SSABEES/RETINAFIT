from fastapi import APIRouter

from app.modules.auth.router import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router)

# 모듈 구현
from app.modules.visit.router import router as visit_router
from app.modules.analysis.router import router as analysis_router
from app.modules.recommendations.router import router as recommendations_router
from app.modules.fitting.router import router as fitting_router


api_router.include_router(visit_router)
api_router.include_router(analysis_router)
api_router.include_router(recommendations_router)
api_router.include_router(fitting_router)