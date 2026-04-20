<script>
  /** @type {{ active?: string }} */
  let { active = 'home' } = $props()

  const items = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'analysis', label: 'Analysis', href: '/analysis' },
    { key: 'users', label: 'Users', href: '/users' },
  ]
</script>

<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white px-4 py-2">
  <ul class="mx-auto grid max-w-sm grid-cols-3 gap-2">
    {#each items as item (item.key)}
      <li>
        <a
          class="block rounded-lg px-3 py-2 text-center text-sm font-semibold {active === item.key
            ? 'bg-violet-50 text-violet-700'
            : 'text-zinc-500'}"
          href={item.href}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
