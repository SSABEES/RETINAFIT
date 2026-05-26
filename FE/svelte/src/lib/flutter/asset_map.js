const g_asset_path_map_obj = {
  'glasses.glb': 'fixtures/glasses/sample_glasses/glasses.glb',
  'ssample_glass.glb': 'fixtures/glasses/ssample_glasses/ssample_glass.glb',
  'ssample_glasses.glb': 'fixtures/glasses/ssample_glasses/ssample_glasses.glb',
  'ssample_glasses_v2.glb': 'fixtures/glasses/ssample_glasses/ssample_glasses_v2.glb',
  'ssample_glasses_v3.glb': 'fixtures/glasses/ssample_glasses/ssample_glasses_v3.glb',
}

/**
 * 3D URL 또는 파일명으로 Flutter native asset 경로를 추론한다.
 * @param {string} asset_source_text
 * @returns {string}
 */
export function get_flutter_asset_path(asset_source_text) {
  const local_asset_source_text = String(asset_source_text ?? '').trim()

  if (!local_asset_source_text) {
    return ''
  }

  if (local_asset_source_text.startsWith('fixtures/')) {
    return local_asset_source_text
  }

  try {
    const local_url_obj = new URL(local_asset_source_text)
    const local_file_name = decodeURIComponent(local_url_obj.pathname.split('/').pop() ?? '')

    return g_asset_path_map_obj[local_file_name] ?? ''
  } catch {
    const local_file_name = local_asset_source_text.split(/[\\/]/).pop() ?? ''

    return g_asset_path_map_obj[local_file_name] ?? ''
  }
}
