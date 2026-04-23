<script>
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from './config/routes'

  let url = ''
</script>

<Router {url}>
  {#each routes as route (route.path)}
    <Route path={route.path} component={route.component} />
  {/each}
</Router>
