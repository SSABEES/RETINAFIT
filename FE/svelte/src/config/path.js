export const PATH = {
  home: '/',
  login: '/auth/login',
  storeSelect: '/auth/store-select',
  opticianSelect: '/auth/optician-select',
  analysis: '/analysis',
  analysisResult: '/analysis/result',
  analysisReport: '/analysis/report',
  analysisLensConsult: '/analysis/lens-consult',
  analysisArFitting: '/analysis/arfitting',
  users: '/dashboard/users',
  sales: '/dashboard/sales',
  branches: '/dashboard/branches',
  admin: '/admin',
  /** @param {string | number} id */
  userDetail: (id) => `/dashboard/users/${String(id)}`,
  /** @param {string | number} id */
  userMeasurement: (id) => `/dashboard/users/${String(id)}/measurement`,
  /** @param {string | number} id */
  userRecords: (id) => `/dashboard/users/${String(id)}/records`,
  /** @param {string | number} id */
  userAnalysisHistory: (id) => `/dashboard/users/${String(id)}/analysis-history`,
}

export const ROUTE_PATH = {
  userDetail: '/dashboard/users/:id',
  userMeasurement: '/dashboard/users/:id/measurement',
  userRecords: '/dashboard/users/:id/records',
  userAnalysisHistory: '/dashboard/users/:id/analysis-history',
}
