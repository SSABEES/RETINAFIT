import HomePage from '../pages/HomePage.svelte'
import LoginPage from '../pages/auth/login.svelte'
import SignupPage from '../pages/auth/signup.svelte'
import CustomerDetailPage from '../pages/customers/[id].svelte'

export const PATH = {
  home: '/',
  login: '/auth/login',
  signup: '/auth/signup',
  customerDetail: (id) => `/customers/${id}`,
}

export const ROUTE_PATH = {
  customerDetail: '/customers/:id',
}

export const routes = [
  { path: PATH.home, component: HomePage },
  { path: PATH.login, component: LoginPage },
  { path: PATH.signup, component: SignupPage },
  { path: ROUTE_PATH.customerDetail, component: CustomerDetailPage },
]
