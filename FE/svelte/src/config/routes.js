import HomePage from '@/router/HomePage.svelte'
import LoginPage from '@/router/auth/login.svelte'
import OpticianSelectPage from '@/router/auth/optician_select.svelte'
import VisitSelectPage from '@/router/auth/visit_select.svelte'
import AnalysisPage from '@/router/analysis/index.svelte'
import AnalysisFaceMeasurementPage from '@/router/analysis/face_measurement.svelte'
import AnalysisResultPage from '@/router/analysis/result.svelte'
import AnalysisReportPage from '@/router/analysis/report.svelte'
import AnalysisLensConsultPage from '@/router/analysis/lens_consult.svelte'
import AnalysisArFittingPage from '@/router/analysis/arfitting.svelte'
import TestPage from '@/router/test.svelte'
import UsersPage from '@/router/dashboard/users.svelte'
import UserAnalysisHistoryPage from '@/router/dashboard/users/[id]/analysis_history.svelte'
import UserMeasurementPage from '@/router/dashboard/users/[id]/measurement.svelte'
import UserRecordsPage from '@/router/dashboard/users/[id]/records.svelte'
import SalesPage from '@/router/dashboard/sales.svelte'
import BranchesPage from '@/router/dashboard/branches.svelte'
import AdminLoginPage from '@/router/auth/admin/login.svelte'
import AdminLensPage from '@/router/auth/admin/lens.svelte'
import AdminGlassPage from '@/router/auth/admin/glass.svelte'
import { PATH, ROUTE_PATH } from '@/config/path'

export const routes = [
  { path: PATH.home, component: HomePage },
  { path: PATH.login, component: LoginPage },
  { path: PATH.opticianSelect, component: OpticianSelectPage },
  { path: PATH.visitSelect, component: VisitSelectPage },
  { path: PATH.analysis, component: AnalysisPage },
  { path: PATH.analysisFaceMeasurement, component: AnalysisFaceMeasurementPage },
  { path: PATH.analysisResult, component: AnalysisResultPage },
  { path: PATH.analysisReport, component: AnalysisReportPage },
  { path: PATH.analysisLensConsult, component: AnalysisLensConsultPage },
  { path: PATH.analysisLensConsultLegacy, component: AnalysisLensConsultPage },
  { path: PATH.analysisArFitting, component: AnalysisArFittingPage },
  { path: PATH.test, component: TestPage },
  { path: PATH.users, component: UsersPage },
  { path: PATH.sales, component: SalesPage },
  { path: PATH.branches, component: BranchesPage },
  { path: PATH.adminLogin, component: AdminLoginPage },
  // 얼굴형 기준 설정(adminFace)은 일단 라우트에서 제외. PATH.adminFace 와 face.svelte 는 보존.
  { path: PATH.admin, component: AdminLensPage },
  { path: PATH.adminLens, component: AdminLensPage },
  { path: PATH.adminGlass, component: AdminGlassPage },
  { path: ROUTE_PATH.userMeasurement, component: UserMeasurementPage },
  { path: ROUTE_PATH.userRecords, component: UserRecordsPage },
  { path: ROUTE_PATH.userAnalysisHistory, component: UserAnalysisHistoryPage },
]
