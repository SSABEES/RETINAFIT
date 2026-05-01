<script>
  import { Link } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path'
</script>

<main class="min-h-screen bg-[#F7F8FA] px-8 py-8 text-zinc-950">
  <div class="mb-10 flex justify-end">
    <Link
      href={PATH.adminLogin}
      class="inline-flex min-h-11 items-center rounded-xl border border-[#E7DDED] bg-white px-5 text-sm font-extrabold text-[#4B0055] transition hover:border-[#4B0055] hover:bg-[#F8F1F8]"
    >
      관리자 페이지 이동
    </Link>
  </div>

  <div class="grid gap-3">
    <h1 class="m-0">home</h1>
    <Link href={PATH.login}>로그인 페이지로 이동</Link>
  </div>
</main>
