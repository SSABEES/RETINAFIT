<script>
  import { Link } from '@maks11060/svelte5-router'
  import { PATH } from '../lib/routes'
</script>

<h1>home</h1>
<Link href={PATH.login}>로그인 페이지로 이동</Link>
<br />
<Link href={PATH.customerDetail(1)}>고객 1 상세 페이지로 이동</Link>
