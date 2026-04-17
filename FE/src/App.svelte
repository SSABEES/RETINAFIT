<script>
  import { Route, Router } from '@maks11060/svelte5-router'
  import HomePage from './pages/HomePage.svelte'
  import login from './pages/auth/login.svelte'
  import signup from './pages/auth/signup.svelte'

  let url = $state('')
</script>

<Router {url}>
  <Route path="/" component={HomePage} />
  <Route path="/auth/login" component={login} />
  <Route path="/auth/signup" component={signup} />
</Router>
