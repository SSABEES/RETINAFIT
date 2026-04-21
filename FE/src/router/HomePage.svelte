<script>
  import { Link } from '@maks11060/svelte5-router'
  import { PATH } from '../config/path'
</script>

<h1>home</h1>
<Link href={PATH.login}>로그인 페이지로 이동</Link>
<br />
<Link href={PATH.signup}>회원가입 페이지로 이동</Link>
<br />
<Link href={PATH.analysis}>분석 페이지로 이동</Link>
<br />
<Link href={PATH.analysisResult}>분석 결과 페이지로 이동</Link>
<br />
<Link href={PATH.analysisReport}>분석 리포트 페이지로 이동</Link>
<br />
<Link href={PATH.analysisGlasses}>안경 추천 페이지로 이동</Link>
<br />
<Link href={PATH.analysisArFitting}>AR 피팅 페이지로 이동</Link>
<br />
<Link href={PATH.users}>유저 페이지로 이동</Link>
<br />
<Link href={PATH.userDetail(1)}>유저 1 상세 페이지로 이동</Link>
