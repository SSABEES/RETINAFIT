export const PATH = {
  home: '/',
  login: '/auth/login',
  opticianSelect: '/auth/optician-select',
  visitSelect: '/auth/visit-select',
  analysis: '/analysis',
  analysisResult: '/analysis/result',
  analysisReport: '/analysis/report',
  analysisLensConsult: '/analysis/lens-consult',
  analysisLensConsultLegacy: '/analysis/lens_consult',
  analysisArFitting: '/analysis/arfitting',
  test: '/test',
  users: '/dashboard/users',
  sales: '/dashboard/sales',
  branches: '/dashboard/branches',
  admin: '/admin',
  adminLogin: '/admin/login',
  adminFace: '/admin/face',
  adminLens: '/admin/lens',
  adminGlass: '/admin/glass',
  /** @param {string | number} id */
  userMeasurement: (id) => `/dashboard/users/${String(id)}/measurement`,
  /** @param {string | number} id */
  userRecords: (id) => `/dashboard/users/${String(id)}/records`,
  /** @param {string | number} id */
  userAnalysisHistory: (id) => `/dashboard/users/${String(id)}/analysis-history`,
}

export const ROUTE_PATH = {
  userMeasurement: '/dashboard/users/:id/measurement',
  userRecords: '/dashboard/users/:id/records',
  userAnalysisHistory: '/dashboard/users/:id/analysis-history',
}
