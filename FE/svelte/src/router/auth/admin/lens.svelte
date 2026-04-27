<script>
  import RecommendOptionManager from '@/router/auth/admin/recommend_option_manager.svelte'

  const g_lens_category_meta_arr = [
    { key: 'lens_type', label: '렌즈 종류' },
    { key: 'coating', label: '코팅' },
    { key: 'usage', label: '주 사용 환경' },
    { key: 'lens_material', label: '렌즈 소재' },
  ]
</script>

<RecommendOptionManager
  active_key="lens"
  page_title="렌즈 추천 옵션 설정"
  category_meta_arr={g_lens_category_meta_arr}
/>
