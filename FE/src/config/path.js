export const PATH = {
  home: '/',
  login: '/auth/login',
  signup: '/auth/signup',
  analysis: '/analysis',
  analysisResult: '/dashboard/analysis/result',
  analysisReport: '/dashboard/analysis/report',
  analysisGlasses: '/dashboard/analysis/glasses',
  analysisArFitting: '/dashboard/analysis/arfitting',
  users: '/dashboard/users',
  records: '/dashboard/records',
  sales: '/dashboard/sales',
  branches: '/dashboard/branches',
  admin: '/dashboard/admin',
  /** @param {string | number} id */
  userDetail: (id) => `/dashboard/users/${String(id)}`,
}

export const ROUTE_PATH = {
  userDetail: '/dashboard/users/:id',
}
