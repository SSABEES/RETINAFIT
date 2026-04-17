import HomePage from '../pages/HomePage.svelte'
import LoginPage from '../pages/auth/login.svelte'
import SignupPage from '../pages/auth/signup.svelte'
import AnalysisPage from '../pages/analysis/index.svelte'
import AnalysisResultPage from '../pages/analysis/result.svelte'
import AnalysisReportPage from '../pages/analysis/report.svelte'
import AnalysisGlassesPage from '../pages/analysis/glasses.svelte'
import AnalysisArFittingPage from '../pages/analysis/arfitting.svelte'
import DashboardPage from '../pages/dashboard/index.svelte'
import UsersPage from '../pages/users/index.svelte'
import UserDetailPage from '../pages/users/[id].svelte'

export const PATH = {
  home: '/',
  login: '/auth/login',
  signup: '/auth/signup',
  analysis: '/analysis',
  analysisResult: '/analysis/result',
  analysisReport: '/analysis/report',
  analysisGlasses: '/analysis/glasses',
  analysisArFitting: '/analysis/arfitting',
  dashboard: '/dashboard',
  users: '/users',
  /** @param {string | number} id */
  userDetail: (id) => `/users/${String(id)}`,
}

export const ROUTE_PATH = {
  userDetail: '/users/:id',
}

export const routes = [
  { path: PATH.home, component: HomePage },
  { path: PATH.login, component: LoginPage },
  { path: PATH.signup, component: SignupPage },
  { path: PATH.analysis, component: AnalysisPage },
  { path: PATH.analysisResult, component: AnalysisResultPage },
  { path: PATH.analysisReport, component: AnalysisReportPage },
  { path: PATH.analysisGlasses, component: AnalysisGlassesPage },
  { path: PATH.analysisArFitting, component: AnalysisArFittingPage },
  { path: PATH.dashboard, component: DashboardPage },
  { path: PATH.users, component: UsersPage },
  { path: ROUTE_PATH.userDetail, component: UserDetailPage },
]
