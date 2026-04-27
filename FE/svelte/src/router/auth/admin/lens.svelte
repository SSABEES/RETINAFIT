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
  page_description="렌즈 추천에 사용하는 카테고리별 옵션을 추가하고 순서를 조정합니다."
  category_meta_arr={g_lens_category_meta_arr}
/>
