path = r'C:\Users\SSAFY\Desktop\TTT\S14P31S107\FE\svelte\src\components\camera\camera_view.svelte'

with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# (corrupted, replacement) pairs. Replacements are reconstructed from
# git history (commit 16a9be2) for unchanged comments and inferred from
# code context for new comments added after that commit.
replacements = [
    # constants header (lines 51-53)
    ('// FRAME_SKIP: 60fps / 5 = 12Hz 異붾줎 (?깅뒫怨?諛섏쓳?깆쓽 ??묒젏)',
     '// FRAME_SKIP: 60fps / 5 = 12Hz 추론 (성능과 반응성의 타협점)'),
    ('// STABILITY_FRAMES: 12Hz 횞 30 ??2.5珥??좎??섏뼱??理쒖쥌 ?뺤젙',
     '// STABILITY_FRAMES: 12Hz × 18 ≈ 1.5초 유지되어야 최종 확정'),
    ('// STABILITY_THRESHOLD: 理쒓렐 10?꾨젅??face_width/height ?쒖??몄감 ?곹븳 (640x480 湲곗? 寃쏀뿕媛?',
     '// STABILITY_THRESHOLD: 최근 10프레임 face_width/height 표준편차 상한 (640x480 기준 경험값)'),

    # generation token (lines 63-64)
    ('// 鍮꾨룞湲?移대찓???쒖옉 ?꾩쨷 cleanup ???쇱뼱????stale rAF/?대깽???몃뱾???깅줉??留됯린 ?꾪븳 ?몃? ?좏겙.',
     '// 비동기 카메라 시작 도중 cleanup 이 끼어들 때 stale rAF/이벤트 핸들러 등록을 막기 위한 세대 토큰.'),
    ('// on_stop_camera 媛 利앷??쒗궎怨? on_start_camera ??媛?await ?ㅼ뿉 ?먯떊???몃?媛 ?꾩쭅 ?좏슚?쒖? ?뺤씤?쒕떎.',
     '// on_stop_camera 가 증가시키고, on_start_camera 는 각 await 뒤에 자신의 세대가 아직 유효한지 확인한다.'),

    # auto-capture / frontal-check derived (lines 108, 110)
    ('// ?뺣㈃ ?ъ쫰 + ?먮룞 紐⑤뱶???뚮쭔 ?덉젙??湲곕컲 ?먮룞 罹≪퀜瑜??묐룞?쒗궓??',
     '// 정면 포즈 + 자동 모드일 때만 안정화 기반 자동 캡쳐를 작동시킨다.'),
    ('// ?뺣㈃ ?ъ쫰???뚮쭔 check_frontal 寃곌낵瑜?UI/?먯젙??諛섏쁺?쒕떎.',
     '// 정면 포즈일 때만 check_frontal 결과를 UI/판정에 반영한다.'),

    # guide color comment (line 113) and inline (line 117)
    ('// 媛?대뱶 ????됱긽??pose_target 怨??곹깭???곕씪 寃곗젙?쒕떎.',
     '// 가이드 테두리 색상은 pose_target 과 상태에 따라 결정한다.'),
    ("// ?꾨줈???ъ쫰: ?뺣㈃ ?먯젙 誘몄쟻??",
     '// 프로필 포즈: 정면 판정 미적용'),

    # hint text comment (line 123)
    ('// ?ъ슜?먯뿉寃?蹂댁뿬以??뚰듃 臾몄옄?댁쓣 pose_target 怨??곹깭???곕씪 寃곗젙?쒕떎.',
     '// 사용자에게 보여줄 힌트 문자열을 pose_target 과 상태에 따라 결정한다.'),

    # badge style comment (line 159)
    ('// ?곹깭蹂??뚰듃 諛곗? ?됱긽 (inline style 濡??곸슜??臾몄옄??.',
     '// 상태별 힌트 배지 색상 (inline style 로 적용할 문자열).'),

    # active effect (line 171)
    ('// active prop ??true 濡?諛붾뚮㈃ 移대찓?쇰? ?쒖옉?섍퀬, false 濡??뚯븘媛嫄곕굹 ?몃쭏?댄듃?섎㈃ ?뺣━?쒕떎.',
     '// active prop 이 true 로 바뀌면 카메라를 시작하고, false 로 돌아가거나 언마운트되면 정리한다.'),

    # on_start_camera (lines 220-221)
    ('// ?ъ슜??移대찓??沅뚰븳???붿껌?섍퀬 MediaPipe 紐⑤뜽??濡쒕뱶??rAF 猷⑦봽瑜??쒖옉?쒕떎.',
     '// 사용자 카메라 권한을 요청하고 MediaPipe 모델을 로드해 rAF 루프를 시작한다.'),
    ('// 媛?await 吏???ㅼ뿉 ?몃? ?좏겙??寃?ы빐, 以묎컙??on_stop_camera 媛 ?쇱뼱?ㅻ㈃ 議곗슜??鍮좎졇?섍컙??',
     '// 각 await 지점 뒤에 세대 토큰을 검사해, 중간에 on_stop_camera 가 일어나면 조용히 빠져나간다.'),

    # getUserMedia (lines 239-241)
    ('// 480x640 (3:4 ?몃줈 鍮꾩쑉): ?쇨뎬 遺꾩꽍 UX ??留욎떠 ?몃Ъ 鍮꾩쑉濡??붿껌.',
     '// 480x640 (3:4 세로 비율): 얼굴 분석 UX 에 맞춰 세로 비율로 요청.'),
    ('// ?섏씠??硫붿떆 ?뺥솗?꾩? 異붾줎 鍮꾩슜????묒젏? ?λ? 640 湲곗??먯꽌 ?숈씪.',
     '// 메시 정확도와 추론 비용의 타협점은 짧은 변 640 기준에서 동일.'),
    ('// 媛濡??꾩슜 ?μ튂??寃쎌슦 媛??媛源뚯슫 ?댁긽?꾨줈 ?泥?諛섑솚 ??object-cover 濡??먮룞 ?щ∼.',
     '// 가로 전용 장치인 경우 가장 가까운 해상도로 대체 반환 후 object-cover 로 자동 트림.'),

    # video metadata (lines 252, 258)
    ('// active ?꾪솚 吏곹썑 <video> 媛 ?꾩쭅 留덉슫?몃릺吏 ?딆븯?????덉뼱 ?????湲?',
     '// active 전환 직후 <video> 가 아직 마운트되지 않았을 수 있어 한 틱 대기'),
    ('// metadata 肄쒕갚??遺덈┫ ?쒖젏???대? ?뺤??섏뿀?쇰㈃ ?ъ깮?섏? ?딅뒗??',
     '// metadata 콜백이 불릴 시점에 이미 정리되었으면 재생하지 않는다'),

    # error messages (lines 268, 270, 272)
    ("'移대찓???묎렐 沅뚰븳??嫄곕??섏뿀?듬땲??'",
     "'카메라 접근 권한이 거부되었습니다.'"),
    ("'移대찓?쇰? 李얠쓣 ???놁뒿?덈떎.'",
     "'카메라를 찾을 수 없습니다.'"),
    ('`移대찓???쒖옉 ?ㅽ뙣: ${e.message ?? String(err)}`',
     '`카메라 시작 실패: ${e.message ?? String(err)}`'),

    # on_stop_camera (lines 277-278)
    ('// rAF 猷⑦봽瑜?以묒??섍퀬 ?ㅽ듃由쇱쓣 ?댁젣?쒕떎. 吏꾪뻾 以묒씤 on_start_camera ??async tail ???⑥? ?묒뾽??',
     '// rAF 루프를 중지시키고 스트림을 해제한다. 진행 중인 on_start_camera 의 async tail 이 남은 작업을'),
    ('// ?댁뼱媛吏 紐삵븯?꾨줉 ?몃? ?좏겙??利앷??쒗궓??',
     '// 이어가지 못하도록 세대 토큰을 증가시킨다.'),

    # update_stability jsdoc (lines 435-438)
    ('* ?덉젙??踰꾪띁瑜?媛깆떊?섍퀬 stable_count 瑜?議곗젙?쒕떎.',
     '* 안정화 버퍼를 갱신하고 stable_count 를 조정한다.'),
    ('* 理쒓렐 10?꾨젅??face_width/height ?쒖??몄감媛 ?꾧퀎移?誘몃쭔?대㈃ ?덉젙.',
     '* 최근 10프레임 face_width/height 표준편차가 한계치 미만이면 안정.'),
    ('* 遺덉븞???꾨젅?꾩? 1?뚮떦 5?뚮텇 ?섍컧??議곌린 ?뺤젙??諛⑹??쒕떎.',
     '* 불안한 프레임은 1 씩 감점해 조금씩 정정하는 방식이다.'),

    # get_average jsdoc (line 462)
    ('* 理쒓렐 10?꾨젅??痢≪젙媛믪쓽 ?됯퇏??諛섑솚?쒕떎.',
     '* 최근 10프레임 측정값의 평균을 반환한다.'),

    # on_loop_frame comment (line 479)
    ('// rAF 猷⑦봽 ???? FRAME_SKIP ?꾨젅?꾨쭏??異붾줎???섑뻾?섍퀬 留???canvas 瑜??ㅼ떆 洹몃┛??',
     '// rAF 루프 본체. FRAME_SKIP 프레임마다 추론을 수행하고 매 틱 canvas 를 다시 그린다.'),

    # frontal stability inline (line 497)
    ('// ?뺣㈃ ?ъ쫰?먯꽌留??덉젙??吏꾪뻾. ?꾨줈???ъ쫰?먯꽌??踰꾪띁 ?좎????꾩슂媛 ?놁쓬.',
     '// 정면 포즈에서만 안정화 진행. 프로필 포즈에서는 버퍼 유지할 필요가 없음.'),

    # disabled auto-capture branch (line 525)
    ('// ?뺣㈃ + ?먮룞 紐⑤뱶???뚮쭔 ?덉젙?????먮룞 罹≪퀜. measurement ???됯퇏媛믪쓣 ?ъ슜.',
     '// 정면 + 자동 모드일 때만 안정화 후 자동 캡쳐. measurement 는 평균값을 사용.'),

    # trigger_capture_internal jsdoc (lines 534-535)
    ('* ?꾩옱 鍮꾨뵒???꾨젅?꾩쓣 Blob ?쇰줈 罹≪퀜?섍퀬 oncapture 肄쒕갚?쇰줈 ?꾨떖?쒕떎.',
     '* 현재 비디오 프레임을 Blob 으로 캡쳐하고 oncapture 콜백으로 전달한다.'),
    ('* g_already_dispatched 濡??숈씪 ?몄뀡??以묐났 ?몄텧???섏? ?딅룄濡?媛??',
     '* g_already_dispatched 로 동일 세션의 중복 호출이 되지 않도록 가드.'),

    # capture inline (lines 545, 562)
    ('// 罹≪퀜 ?쒖젏???쒕뱶留덊겕 ?띿쓣 ?쎌? 怨듦컙 醫뚰몴濡?蹂?? ?쒕뱶留덊겕媛 ?놁쑝硫?null.',
     '// 캡쳐 시점의 랜드마크 셋을 픽셀 공간 좌표로 변환. 랜드마크가 없으면 null.'),
    ('// 珥ъ쁺 ?ㅽ뙣 ???ъ떆??媛?ν븯?꾨줉 dispatched ?뚮옒洹??댁젣 + ?뚮퉬?먯뿉寃??먮윭 ?뚮┝.',
     '// 촬영 실패 시 재시도 가능하도록 dispatched 플래그 해제 + 부모에게 에러 알림.'),

    # trigger_capture jsdoc (lines 571-580)
    ('* ?몃??먯꽌 (?섎룞 罹≪퀜?⑹쑝濡? ?몄텧?섎뒗 珥ъ쁺 ?몃━嫄?',
     '* 외부에서 (수동 캡쳐용으로) 호출하는 촬영 트리거.'),
    ("* capture_mode='manual' ?먯꽌留??곕뒗 寃껋씠 ?뺤긽 ??auto 紐⑤뱶?먯꽌???대? ?덉젙?????먮룞 諛쒖궗?섎?濡?",
     "* capture_mode='manual' 에서만 쓰이는 것이 정상. auto 모드에서는 이미 안정화 후 자동 발사되므로"),
    ('* ?몄텧???꾩슂 ?놁쓬(以묐났 ?몄텧? g_already_dispatched 濡?臾댁떆??.',
     '* 호출할 필요 없음(중복 호출은 g_already_dispatched 로 무시됨).'),
    ('* ?쇨뎬 寃異?媛?쒕뒗 **?뺣㈃ ?ъ쫰?먯꽌留?* ?곸슜?쒕떎. ?꾨줈???ъ쫰(left/right)?먯꽌??MediaPipe 媛',
     '* 얼굴 검출 가드는 **정면 포즈에서만** 적용한다. 프로필 포즈(left/right)에서는 MediaPipe 가'),
    ('* 媛뺥븳 痢〓㈃ 媛곷룄?먯꽌 寃異쒖뿉 ?ㅽ뙣??g_face_detected=false 媛 吏?띾맆 ???덇린 ?뚮Ц?? ???곹깭?먯꽌??',
     '* 강한 측면 각도에서 검출에 실패해 g_face_detected=false 가 지속될 수 있기 때문. 이 상태에서도'),
    ('* 鍮꾨뵒???꾨젅???먯껜???좏슚?섎?濡?珥ъ쁺? 怨꾩냽 媛?ν빐???쒕떎.',
     '* 비디오 프레임 자체는 유효하므로 촬영은 계속 가능해야 한다.'),
    ('* 鍮꾨뵒???꾨젅?꾩씠 ?꾩쭅 以鍮꾨릺吏 ?딆? 寃쎌슦(videoWidth=0)留?false 濡?痍⑥냼?쒕떎.',
     '* 비디오 프레임이 아직 준비되지 않은 경우(videoWidth=0)만 false 로 취소한다.'),
    ('* @returns {Promise<boolean>} true = 珥ъ쁺 ?몃━嫄곕맖, false = 鍮꾨뵒??誘몄?鍮??먮뒗 ?뺣㈃?먯꽌 ?쇨뎬 誘멸?異쒕줈 痍⑥냼??',
     '* @returns {Promise<boolean>} true = 촬영 트리거됨, false = 비디오 미준비 또는 정면에서 얼굴 미검출로 취소됨'),

    # console.warn strings (lines 584, 587, 591)
    ("'[camera_view] trigger_capture: auto 紐⑤뱶?먯꽌???몃? ?몄텧??遺덊븘?뷀빀?덈떎'",
     "'[camera_view] trigger_capture: auto 모드에서는 외부 호출이 불필요합니다'"),
    ("'[camera_view] trigger_capture: 鍮꾨뵒???꾨젅?꾩씠 以鍮꾨릺吏 ?딆쓬'",
     "'[camera_view] trigger_capture: 비디오 프레임이 준비되지 않음'"),
    ("'[camera_view] trigger_capture: ?뺣㈃ ?ъ쫰?먯꽌 ?쇨뎬??媛먯??섏? ?딆쓬'",
     "'[camera_view] trigger_capture: 정면 포즈에서 얼굴이 감지되지 않음'"),

    # sync_canvas_size (line 598)
    ('// canvas ?대? ?댁긽?꾨? 鍮꾨뵒???댁긽?꾩뿉 留욎텣??',
     '// canvas 내부 해상도를 비디오 해상도에 맞춘다'),

    # draw_guide_ellipse jsdoc (lines 610-612)
    ('* ?곹깭?됱씠 ?곸슜???쇨뎬??媛?대뱶瑜?canvas ?꾩뿉 洹몃┛??',
     '* 상태색이 적용된 얼굴형 가이드를 canvas 위에 그린다.'),
    ('* ?⑥닚 ??????怨꾨????대쭏???κ?寃? ?깆? 醫곴쾶) 踰좎???怨≪꽑?쇰줈 ?꾩떎???쇨뎬 ?ㅻ（?ｌ쓣 洹쇱궗?쒕떎.',
     '* 단순 타원 대신 4 단계 (이마 둥글게, 턱 좁게) 베지에 곡선으로 실제와 닮은 얼굴 윤곽을 근사한다.'),
    ('* ?대??숈쟻 鍮꾩쑉 洹쇱궗: ?쇨뎬 ?몃줈/媛濡???1.32, 愿묐?堉??쇱씤???몃줈 以묒븰 ?댁쭩 ?꾨옒, ?섎컲遺媛 ?곷컲遺蹂대떎 湲몃떎.',
     '* 계란형 비율 근사: 얼굴 세로/가로 ≒ 1.32, 광대뼈 라인은 세로 중앙 살짝 아래, 하반부가 상반부보다 길다.'),

    # face geometry comments (lines 624-647)
    ('// ?쇨뎬 ?꾩껜 ?몃줈(?대쭏 ??????. 移대찓???꾨젅???몃줈??60% 瑜??쇨뎬 ?곸뿭?쇰줈 媛??',
     '// 얼굴 전체 세로(이마 ~ 턱). 카메라 프레임 세로의 60% 를 얼굴 영역으로 가정.'),
    ('// 愿묐?堉??덈퉬(理쒕? 媛濡? ???쇨뎬 ?몃줈????76% 媛 ?쇰컲???대????됯퇏.',
     '// 광대뼈 너비(최대 가로). 얼굴 세로 대비 76% 가 일반적인 한국인 평균.'),
    ('// 4媛??듭빱: top(?대쭏), right(愿묐?), bottom(??, left(愿묐? ?移?',
     '// 4개 키: top(이마), right(광대), bottom(턱), left(광대 좌측)'),
    ('// ?곷컲遺 46% (?대쭏 ?꾩そ???섎컲遺蹂대떎 ?댁쭩 吏㏃쓬)',
     '// 상반부 46% (이마 윗면이 하반부보다 살짝 짧음)'),
    ('// ?섎컲遺 54% (?깆씠 ?꾨옒濡????뚯텧)',
     '// 하반부 54% (턱이 아래로 더 돌출)'),
    ('// 愿묐? ?쇱씤? 以묒떖 ?댁쭩 ?꾨옒',
     '// 광대 라인은 중심 살짝 아래'),
    ('// 踰좎????쒖뼱?? ?곷떒? ?섑룊?쇰줈 ?볤쾶 踰뚮젮 ?κ렐 ?대쭏, ?섎떒? 醫곴쾶 紐⑥븘 毓곗”????',
     '// 베지에 제어점. 상단은 수평으로 넓게 벌려 둥근 이마, 하단은 좁게 모아 뾰족한 턱.'),
    ('// 諛곌꼍 ?곸긽??愿怨꾩뾾???좎씠 ??蹂댁씠?꾨줉 ?쏀븳 ?쒕∼???',
     '// 배경 영상과 관계없이 선이 잘 보이도록 약한 그림자 추가'),
    ('// ?대쭏 ???ㅻⅨ 愿묐? (?κ?寃?踰뚯뼱吏?',
     '// 이마 → 오른 광대 (둥글게 벌어짐)'),
    ('// ?ㅻⅨ 愿묐? ????(?덉そ?쇰줈 醫곸븘吏?',
     '// 오른 광대 → 턱 (안쪽으로 좁아짐)'),
    ('// ??????愿묐? (?移?',
     '// 턱 → 왼 광대 (대칭)'),
    ('// ??愿묐? ???대쭏 (?移?',
     '// 왼 광대 → 이마 (대칭)'),

    # reset jsdoc (lines 679-681)
    ('* ?ъ륫?뺤쓣 ?꾪빐 ?덉젙???곹깭瑜?珥덇린?뷀븳??',
     '* 재촬영을 위해 안정화 상태를 초기화한다.'),
    ('* ?몃??먯꽌 `bind:this` 濡?李몄“???몄텧?섎㈃ ?먮룞 ?ㅽ뀦?먯꽌 `oncapture` 媛 ?ㅼ떆 諛쒖궗?섍굅??',
     '* 외부에서 `bind:this` 로 참조해 호출하면 자동 스텝에서 `oncapture` 가 다시 발사되거나'),
    ('* ?섎룞 ?ㅽ뀦?먯꽌 `trigger_capture()` ?몄텧???ㅼ떆 ?섎씫?섎룄濡??ъ옣?꾨맂??',
     '* 수동 스텝에서 `trigger_capture()` 호출이 다시 수락되도록 재장전된다.'),

    # angle_style jsdoc (line 691)
    ('* yaw/pitch/roll 媛곷룄 吏꾪뻾 諛붿쓽 ?됱긽怨??덈퉬瑜?怨꾩궛?쒕떎.',
     '* yaw/pitch/roll 각도 진행 바의 색상과 너비를 계산한다.'),

    # g_display_hint_text (lines 715-734) — duplicate of g_display_hint_text_ko
    ("if (!g_face_detected) return '?쇨뎬??媛?대뱶 ?덉뿉 留욎떠 二쇱꽭??",
     "if (!g_face_detected) return '얼굴을 가이드 안에 맞춰 주세요'"),
    ("if (!g_complete_obj.is_complete) return '?쇨뎬 ?꾩껜媛 ?붾㈃ ?덉뿉 ?ㅼ뼱?ㅻ룄濡?留욎떠 二쇱꽭??",
     "if (!g_complete_obj.is_complete) return '얼굴 전체가 화면 안에 들어오도록 맞춰 주세요'"),
    ("if (pose_target === 'left_profile') return '怨좉컻瑜??쇱そ?쇰줈 ?뚮젮 二쇱꽭??",
     "if (pose_target === 'left_profile') return '고개를 왼쪽으로 돌려 주세요'"),
    ("if (pose_target === 'right_profile') return '怨좉컻瑜??ㅻⅨ履쎌쑝濡??뚮젮 二쇱꽭??",
     "if (pose_target === 'right_profile') return '고개를 오른쪽으로 돌려 주세요'"),
    ("if (!g_frontal_obj) return '?뺣㈃??諛붾씪遊?二쇱꽭??",
     "if (!g_frontal_obj) return '정면을 바라봐 주세요'"),
    ("if (g_is_countdown_active) return `${g_countdown_remaining}珥???珥ъ쁺`",
     "if (g_is_countdown_active) return `${g_countdown_remaining}초 후 촬영`"),
    ("return g_is_stable ? '?덉젙???꾨즺' : `?덉젙??以?${g_stability_progress}%`",
     "return g_is_stable ? '안정화 완료' : `안정화 중 ${g_stability_progress}%`"),
    ("return g_frontal_obj.yaw > 0 ? '怨좉컻瑜??ㅻⅨ履쎌쑝濡??뚮젮 二쇱꽭?? : '怨좉컻瑜??쇱そ?쇰줈 ?뚮젮 二쇱꽭??",
     "return g_frontal_obj.yaw > 0 ? '고개를 오른쪽으로 돌려 주세요' : '고개를 왼쪽으로 돌려 주세요'"),
    ("return g_frontal_obj.pitch > 0 ? '?깆쓣 ?대젮 二쇱꽭?? : '?깆쓣 ?щ젮 二쇱꽭??",
     "return g_frontal_obj.pitch > 0 ? '턱을 내려 주세요' : '턱을 올려 주세요'"),
    ("return g_frontal_obj.roll > 0 ? '?ㅻⅨ履쎌쑝濡?湲곗슱?댁죱?댁슂' : '?쇱そ?쇰줈 湲곗슱?댁죱?댁슂'",
     "return g_frontal_obj.roll > 0 ? '오른쪽으로 기울어졌어요' : '왼쪽으로 기울어졌어요'"),
    ("return '?뺣㈃??諛붾씪遊?二쇱꽭??",
     "return '정면을 바라봐 주세요'"),
]

unmatched = []
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
    else:
        unmatched.append(old[:60])

with open(path, 'w', encoding='utf-8-sig', newline='') as f:
    f.write(content)

print(f'Applied {len(replacements) - len(unmatched)} of {len(replacements)} replacements')
if unmatched:
    print('UNMATCHED:')
    for u in unmatched:
        print(f'  {u!r}')
