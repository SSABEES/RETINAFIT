<script>
  import RecommendOptionManager from '@/router/auth/admin/recommend_option_manager.svelte'

  const g_face_category_meta_arr = [{ key: 'face_shape', label: '얼굴형' }]
</script>

<RecommendOptionManager
  active_key="face"
  page_title="얼굴형 추천 옵션 설정"
  category_meta_arr={g_face_category_meta_arr}
/>
