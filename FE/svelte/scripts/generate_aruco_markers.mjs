#!/usr/bin/env node
/**
 * ID 0, 1 (ARUCO_MIP_36h12) 을 인쇄 가능한 HTML 로 출력.
 *
 * 사용: node scripts/generate_aruco_markers.mjs   (또는 npm run gen:aruco-markers)
 * 출력: scripts/aruco_markers.html — 브라우저로 열어 "Print → Save as PDF (100% scale)"
 *
 * 마커 8x8 셀 = 30mm. quiet zone 1셀 포함 viewBox 10x10 = 37.5mm 인쇄 영역.
 * MARKER_SIZE_MM (src/lib/measurements/aruco_capture.js) 와 반드시 동일 값을 유지할 것.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

// js-aruco2 imports — node_modules 에서 직접 로드.
// ARUCO_MIP_36h12 은 aruco.js 에 자체 포함되어 있어 별도 dictionary 파일 import 불필요.
// aruco.js 는 CommonJS 스타일(`this.AR = AR`) 이므로 createRequire 로 로드.
const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const aruco_path = resolve(__dirname, '../node_modules/js-aruco2/src/aruco.js')

const { AR } = require(aruco_path)

const MARKER_IDS = [0, 1]
const MARKER_MM = 30 // 마커 본체 (8x8 셀) 인쇄 크기 — capture pipeline 의 MARKER_SIZE_MM 와 일치해야 함
const VIEWBOX_TOTAL = 10 // 8 cells + 2 cell quiet zone (1 each side)
const PRINT_MM = (MARKER_MM * VIEWBOX_TOTAL) / 8 // 37.5mm

const dict = new AR.Dictionary('ARUCO_MIP_36h12')

const markers_html = MARKER_IDS.map((id) => {
  const svg = dict.generateSVG(id)
  return `
    <div class="marker">
      <div class="svg-wrap">${svg}</div>
      <div class="label">ID ${id} · ${MARKER_MM}mm · ARUCO_MIP_36h12</div>
    </div>
  `
}).join('\n')

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>ArUco markers — ID 0, 1 (ARUCO_MIP_36h12, ${MARKER_MM}mm)</title>
<style>
  @page { size: A4; margin: 20mm; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Helvetica Neue", sans-serif; padding: 20mm; }
  .marker { display: flex; align-items: center; gap: 8mm; margin-bottom: 15mm; page-break-inside: avoid; }
  .svg-wrap { width: ${PRINT_MM}mm; height: ${PRINT_MM}mm; }
  .svg-wrap svg { width: 100%; height: 100%; display: block; }
  .label { font-size: 10pt; color: #444; }
  .note { font-size: 9pt; color: #888; margin-top: 20mm; max-width: 120mm; line-height: 1.5; }
  @media print { .note { display: none; } }
</style>
</head>
<body>
${markers_html}
<div class="note">
  인쇄 시 "실제 크기(100%)" 옵션을 사용하세요. 인쇄 후 caliper 로 검정 marker 본체가 정확히 ${MARKER_MM}mm × ${MARKER_MM}mm 인지 확인하고,
  ±0.3mm 초과 시 프린터 스케일을 보정하세요. 무광 라벨지 권장 (광택 라벨은 specular highlight 로 검출 실패).
</div>
</body>
</html>`

const out_path = resolve(__dirname, 'aruco_markers.html')
writeFileSync(out_path, html, 'utf8')
console.log(`Wrote ${out_path}`)
console.log(`Open in a browser, then File → Print → Save as PDF (100% scale).`)
