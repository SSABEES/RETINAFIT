<script>
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from './lib/routes'

  let url = $state('')
</script>

<Router {url}>
  {#each routes as route (route.path)}
    <Route path={route.path} component={route.component} />
  {/each}
</Router>
