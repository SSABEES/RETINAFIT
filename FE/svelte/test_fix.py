from pathlib import Path

path = Path(r'C:\Users\SSAFY\Desktop\TTT\S14P31S107\FE\svelte\src\components\camera\camera_view.svelte')


def replace_line(lines: list[str], line_no: int, new_text: str) -> None:
    index = line_no - 1
    if index < 0 or index >= len(lines):
        raise IndexError(f'line {line_no} is out of range')
    lines[index] = f'{new_text}\n'


with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# camera_view.svelte에서 깨진 한글 주석/문자열을 라인 번호 기준으로 복구한다.
replacements = {
    51: '// FRAME_SKIP: 60fps / 5 = 12Hz 추론 (성능과 반응성의 타협점)',
    52: '// STABILITY_FRAMES: 12Hz 기준 30프레임, 약 2.5초 동안 유지',
    53: '// STABILITY_THRESHOLD: 최근 10프레임 face_width/height 평균 변화 허용치 (640x480 기준 경험값)',
    63: '// 비동기 카메라 시작 요청과 cleanup 사이에서 stale rAF/이벤트 핸들러 등록을 막기 위한 내부 세대 토큰.',
    64: '// on_stop_camera 이후에도 on_start_camera의 await 뒤 로직이 남아 있을 수 있어 토큰으로 유효성을 확인한다.',
    108: '// 정면 포즈 + 자동 모드에서만 안정화 기반 자동 캡처를 활성화한다.',
    110: '// 정면 포즈에서만 check_frontal 결과를 UI와 상태에 반영한다.',
    113: '// 가이드 테두리 색상은 pose_target과 현재 상태에 따라 결정한다.',
    117: '\t\t// 프로필 포즈: 정면 판정 미적용',
    123: '// 사용자에게 보여주는 힌트 문구는 pose_target과 현재 상태에 따라 결정한다.',
    159: '\t// 상태 표시 배지 색상 (inline style로 적용할 문자열).',
    171: '// active prop이 true로 바뀌면 카메라를 시작하고, false로 돌아가거나 언마운트되면 정리한다.',
    220: '\t// 사용자 카메라 권한을 요청하고 MediaPipe 모델을 로드한 뒤 rAF 루프를 시작한다.',
    221: '\t// 각 await 이후에 토큰을 다시 확인해, 중간에 on_stop_camera가 호출되면 조용히 중단한다.',
    239: '\t\t\t// 480x640 (3:4 세로 비율): 얼굴 분석 UX에 맞춘 세로 비율로 요청한다.',
    240: '\t\t\t// 해상도 증가는 추론 비용과 지연 사이의 타협으로 보고 640 기준값을 사용한다.',
    241: '\t\t\t// 가로 화면일 경우 가장 가까운 대응값으로 대체하고 object-cover로 자동 크롭한다.',
    252: '\t\t// active 전환 직후 <video>가 아직 마운트되지 않았을 가능성을 기다린다.',
    258: '\t\t\t// metadata 콜백이 늦게 도착해도 이미 정리되었다면 재생하지 않는다.',
    268: "\t\t\t\terror_message = '카메라 접근 권한이 거부되었습니다.';",
    270: "\t\t\t\terror_message = '카메라를 찾을 수 없습니다.';",
    272: "\t\t\t\terror_message = `카메라 시작 실패: ${e.message ?? String(err)}`;",
    277: '\t// rAF 루프를 중지시키고 스트림을 해제한다. 진행 중인 on_start_camera의 async tail도 무효화한다.',
    278: '\t// 이후 재진입을 막기 위해 내부 세대 토큰도 증가시킨다.',
    435: '\t * 안정화 버퍼를 갱신하고 stable_count를 조정한다.',
    436: '\t * 최근 10프레임 face_width/height 평균 변화가 임계치 미만이면 안정으로 본다.',
    437: '\t * 불안정 프레임은 1씩 감점해 조금 더 부드럽게 판정한다.',
    462: '\t * 최근 10프레임 측정값의 평균을 반환한다.',
    479: '\t\t// rAF 루프 본체. FRAME_SKIP 프레임마다 추론을 수행하고 매 프레임 canvas를 다시 그린다.',
    497: '\t\t\t\t// 정면 포즈에서만 안정화 진행. 프로필 포즈에서는 버퍼 유지가 필요 없다.',
    525: '\t\t\t// 정면 + 자동 모드에서만 안정화 후 자동 캡처. measurement 평균값을 사용한다.',
    534: '\t * 현재 비디오 프레임을 Blob으로 캡처하고 oncapture 콜백으로 전달한다.',
    535: '\t * g_already_dispatched로 동일 액션의 중복 호출을 방지한다.',
    545: '\t\t\t\t// 캡처 시점의 랜드마크 좌표를 절대 공간 좌표로 변환한다. 랜드마크가 없으면 null.',
    562: '\t\t\t// 촬영 실패 시 재시도 가능하도록 dispatched 플래그 해제와 부모 에러 전달을 수행한다.',
    571: '\t * 외부 호출용 메서드 (수동 캡처 버튼 등이 호출하는 촬영 트리거).',
    572: "\t * capture_mode='manual'에서만 언제든 정상 동작한다. auto 모드에서는 내부 안정화 뒤 자동 발사된다.",
    573: '\t * 중복 호출은 무시한다(g_already_dispatched로 보호).',
    574: '\t * 얼굴 검출 가이드는 **정면 포즈에서만** 적용한다. 프로필 포즈(left/right)에서는 MediaPipe가',
    575: '\t * 강한 측면 각도에서는 검출에 실패해 g_face_detected=false가 지속될 수 있기 때문이다. 해당 상태에서는',
    576: '\t * 비디오 프레임 자체가 유효하면 촬영은 계속 가능해야 한다.',
    577: '\t * 비디오 프레임이 아직 준비되지 않은 경우(videoWidth=0)만 false로 취소한다.',
    578: '\t * @returns {Promise<boolean>} true = 촬영 트리거됨, false = 비디오 미준비 또는 정면 포즈에서 얼굴 미검출로 취소됨',
    584: "\t\tconsole.warn('[camera_view] trigger_capture: auto 모드에서는 외부 수동 호출이 비활성화됩니다');",
    587: "\t\tconsole.warn('[camera_view] trigger_capture: 비디오 프레임이 준비되지 않음');",
    591: "\t\tconsole.warn('[camera_view] trigger_capture: 정면 포즈에서 얼굴이 감지되지 않음');",
    598: '\t// canvas 크기와 해상도를 비디오 해상도에 맞춘다.',
    610: '\t * 상태값이 적용된 얼굴형 가이드를 canvas 위에 그린다.',
    611: '\t * 단순 타원이 아니라 4구간(이마, 광대, 턱, 턱선) 베지어 곡선으로 실제 얼굴 외곽에 가깝게 그린다.',
    612: '\t * 경험적 비율 근사: 얼굴 세로/가로 약 1.32, 광대 중심선은 세로 중앙보다 아래, 하반부가 상반부보다 길다.',
    624: '\t// 얼굴 전체 세로(이마 ~ 턱). 카메라 프레임 세로의 60%를 얼굴 영역으로 가정한다.',
    625: '\t// 광대 너비(최대 가로). 얼굴 세로 대비 76%가 일반적인 성인 평균.',
    628: '\t// 4개 점: top(이마), right(광대), bottom(턱), left(광대 좌측)',
    631: '\t// 상반부 46% (이마 포함 영역이 하반부보다 약간 짧음)',
    632: '\t// 하반부 54% (턱이 아래로 조금 더 돌출)',
    635: '\t// 광대 중심선은 중단보다 아래',
    638: '\t// 베지어 제어점은 상단을 수평으로 벌려 넓은 이마, 하단을 좁게 모아 둥근 턱을 만든다.',
    640: '\t// 배경 색상과 관계없이 잘 보이도록 은은한 그림자도 추가한다.',
    642: '\t// 이마 쪽 오른쪽 광대 (크게 벌어짐)',
    643: '\t// 오른쪽 광대 아래 (입쪽으로 좁아짐)',
    645: '\t// 아래쪽 광대 (대칭)',
    646: '\t// 좌광대 위 이마 (대칭)',
    679: '\t * 재사용을 위해 안정화와 상태값을 초기화한다.',
    680: '\t * 부모에서 `bind:this`로 참조해 호출하면 자동 촬영 이후에도 `oncapture`가 다시 발사될 수 있다.',
    681: '\t * 수동 촬영 모드에서 `trigger_capture()` 호출을 다시 허용하도록 보장한다.',
    691: '\t * yaw/pitch/roll 각도 진행 바의 색상과 너비를 계산한다.',
    715: "\tif (!g_face_detected) return '얼굴을 가이드 안에 맞춰 주세요';",
    719: "\tif (!g_complete_obj.is_complete) return '얼굴 전체가 타원 안에 들어오도록 맞춰 주세요';",
    723: "\tif (pose_target === 'left_profile') return '고개를 왼쪽으로 돌려 주세요';",
    724: "\tif (pose_target === 'right_profile') return '고개를 오른쪽으로 돌려 주세요';",
    726: "\tif (!g_frontal_obj) return '정면을 바라봐 주세요';",
    729: "\tif (g_is_countdown_active) return `${g_countdown_remaining}초 후 촬영`;",
    732: "\t\treturn g_is_stable ? '안정화 완료' : `안정화 중 ${g_stability_progress}%`;",
    733: "\t\treturn g_frontal_obj.yaw > 0 ? '고개를 오른쪽으로 돌려 주세요' : '고개를 왼쪽으로 돌려 주세요';",
    734: "\t\treturn g_frontal_obj.pitch > 0 ? '턱을 들어 주세요' : '턱을 내려 주세요';",
    735: "\t\treturn g_frontal_obj.roll > 0 ? '오른쪽으로 기울어졌어요' : '왼쪽으로 기울어졌어요';",
    737: "\treturn '정면을 바라봐 주세요';",
}

for line_no, new_text in replacements.items():
    replace_line(lines, line_no, new_text)

with open(path, 'w', encoding='utf-8-sig', newline='') as f:
    f.writelines(lines)

print(f'Applied {len(replacements)} line replacements to {path.name}')
