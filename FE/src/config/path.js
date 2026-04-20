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
