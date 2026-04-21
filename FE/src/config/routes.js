import HomePage from '../router/HomePage.svelte'
import LoginPage from '../router/auth/login.svelte'
import SignupPage from '../router/auth/signup.svelte'
import AnalysisPage from '../router/analysis/index.svelte'
import AnalysisResultPage from '../router/analysis/result.svelte'
import AnalysisReportPage from '../router/analysis/report.svelte'
import AnalysisGlassesPage from '../router/analysis/glasses.svelte'
import AnalysisArFittingPage from '../router/analysis/arfitting.svelte'
import UsersPage from '../router/dashboard/users.svelte'
import UserDetailPage from '../router/dashboard/users/[id].svelte'
import RecordsPage from '../router/dashboard/records.svelte'
import SalesPage from '../router/dashboard/sales.svelte'
import BranchesPage from '../router/dashboard/branches.svelte'
import { PATH, ROUTE_PATH } from './path'

export const routes = [
  { path: PATH.home, component: HomePage },
  { path: PATH.login, component: LoginPage },
  { path: PATH.signup, component: SignupPage },
  { path: PATH.analysis, component: AnalysisPage },
  { path: PATH.analysisResult, component: AnalysisResultPage },
  { path: PATH.analysisReport, component: AnalysisReportPage },
  { path: PATH.analysisGlasses, component: AnalysisGlassesPage },
  { path: PATH.analysisArFitting, component: AnalysisArFittingPage },
  { path: PATH.users, component: UsersPage },
  { path: PATH.records, component: RecordsPage },
  { path: PATH.sales, component: SalesPage },
  { path: PATH.branches, component: BranchesPage },
  { path: ROUTE_PATH.userDetail, component: UserDetailPage },
]
