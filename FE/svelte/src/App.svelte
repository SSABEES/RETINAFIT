<script>
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'

  let url = ''
</script>

<div class="app-frame-shell">
  <div class="app-frame">
    <div class="app-frame-content">
      <Router {url}>
        {#each routes as route (route.path)}
          <Route path={route.path} component={route.component} />
        {/each}
      </Router>
    </div>
  </div>
</div>
