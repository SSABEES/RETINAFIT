# AI 오프라인 스크립트

운영 서버에는 들어가지 않는 1회성 도구 모음. `pyproject.toml` 의 `export` 의존성 그룹에 의존하므로
`uv sync --group export` 로 필요할 때만 설치한다.

## export_6drepnet360_onnx.py — 6DRepNet360 PyTorch → ONNX 변환

브라우저(`onnxruntime-web`)에서 측면 ±90° 헤드 포즈를 추론하기 위한 ONNX 자산을 생성한다.

### 사전 준비

1. 가중치 다운로드 (~94MB, OVGU 클라우드 — 가끔 응답 느림):

   ```bash
   curl --retry 3 -L \
     "https://cloud.ovgu.de/s/TewGC9TDLGgKkmS/download/6DRepNet360_Full-Rotation_300W_LP+Panoptic.pth" \
     -o AI/scripts/6DRepNet360_Full-Rotation_300W_LP+Panoptic.pth
   ```

   - 파일명에 `+` 가 포함되어 있어도 셸에서 따옴표로 감싸면 문제 없음.
   - **반드시 Full-Rotation 모델**을 받아야 한다. `6DRepNet360_300W_LP.pth` 는 ±99° 한계라
     측면 90° 감지 use case 에 부적합.

2. 의존성 설치 (`AI/` 디렉토리에서):

   ```bash
   uv sync --group export
   ```

   `torch`, `torchvision`, `onnx`, `onnxruntime`, `onnxscript`, `numpy` 가 들어온다. 운영 서버용
   기본 그룹은 영향받지 않는다.

### 실행

```bash
cd C:/PJT/S14P31S107/AI

uv run --group export python scripts/export_6drepnet360_onnx.py \
  --checkpoint scripts/6DRepNet360_Full-Rotation_300W_LP+Panoptic.pth \
  --output ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx
```

성공 출력:

```
[1/4] 모델 빌드 + 체크포인트 로드: scripts\6DRepNet360_Full-Rotation_300W_LP+Panoptic.pth
[2/4] ONNX export: ..\FE\svelte\public\models\sixdrepnet360\6drepnet360.onnx
[torch.onnx] ... ✅
[3/4] ORT 그래프 최적화 베이크 (FusedConv, FusedAdd 등)
      노드 수: 176 → 145 (31개 감소)
[4/4] 검증 (PyTorch ↔ ONNX 출력 비교)
      max|PyTorch − ONNX| = 1.79e-07
변환 완료 → ..\FE\svelte\public\models\sixdrepnet360\6drepnet360.onnx (94.0 MB)
```

### 옵션

| 플래그 | 효과 |
|--------|------|
| `--checkpoint PATH` | 입력 `.pth` 경로 (필수) |
| `--output PATH` | 출력 `.onnx` 경로 (필수). 부모 디렉토리는 자동 생성 |
| `--skip-verify` | PyTorch ↔ ONNX 수치 비교 건너뛰기 (CI 등에서) |
| `--no-ort-optimize` | ORT 그래프 최적화 베이크 건너뛰기 (다른 ONNX 런타임으로 이식할 때) |

### 출력 사양

| 항목 | 값 |
|------|-----|
| 파일 형식 | 단일 ONNX (external data 사이드카 없음) |
| 파일 크기 | 약 94 MB (FP32, ResNet50 백본) |
| IR version | 10 |
| Opset | 17 |
| Input | `pixel_values`, shape `[batch, 3, 224, 224]`, FP32 |
| Output | `rotation_matrix`, shape `[batch, 3, 3]`, FP32 (3×3 회전행렬, row-major) |

브라우저 측 후처리: 회전행렬 → Euler (yaw/pitch/roll) 는 `atan2` 3 회로 충분 (별도 6D Gram-Schmidt
구현 불필요 — 모델 forward 가 이미 처리).

### 변환 파이프라인 요약

1. **체크포인트 로드** — `model_state_dict` 키 유무 자동 분기. `weights_only=True` 로 안전 로드.
2. **`model.eval()`** — BatchNorm 추론 모드. `do_constant_folding=True` 와 함께 BN 을 선행 Conv 에 흡수.
3. **`torch.onnx.export`** — opset 17, batch 차원만 동적 (`dynamic_axes`).
4. **External data 인라인 병합** — PyTorch 2.x dynamo exporter 가 가중치를 분리하므로
   `onnx.load(load_external_data=True)` → `onnx.save(save_as_external_data=False)` 로 단일 파일화.
5. **ORT 그래프 최적화 베이크** — `ORT_ENABLE_EXTENDED` 로 Conv+Relu → FusedConv 등 플랫폼 독립적
   fusion 만 적용. `ORT_ENABLE_ALL` 은 NchwcTransformer 등 x86 CPU 특화 변환을 포함해서
   `onnxruntime-web` 환경에 부적합 — 일부러 한 단계 낮춤.
6. **PyTorch vs ONNX 수치 비교** — 동일 입력으로 두 출력의 `max|diff|` 가 1e-4 미만인지 확인.

### 트러블슈팅

| 증상 | 원인 추정 | 대응 |
|------|-----------|------|
| `ModuleNotFoundError: No module named 'onnxscript'` | PyTorch 2.x dynamo exporter 의존성 누락 | `uv sync --group export` 다시 |
| `max|diff| > 1e-4` 경고 | `model.eval()` 누락, BN 학습 모드로 트레이싱 | 스크립트 main() 의 `model.eval()` 호출 확인 |
| `Setting ONNX exporter to use operator set version 18` 워닝 | PyTorch 2.x 가 17 미지원 op 가 있을 때 18 로 올렸다가 ONNX C API 로 17 fallback | 무시 가능. 최종 파일 opset 은 17 로 저장됨 (`onnx.load(...).opset_import` 로 확인 가능) |
| 출력 파일과 함께 `*.onnx.data` 가 남음 | external data 인라인 병합 실패 (디스크 권한 / 부분 쓰기) | 출력 디렉토리 정리 후 재시도 |
| `Serializing optimized model with Graph Optimization level greater than ORT_ENABLE_EXTENDED` 경고 | `ORT_ENABLE_ALL` 사용 시 발생 — 베이크된 모델이 환경 종속 | 본 스크립트는 EXTENDED 사용이라 발생 안 함. 만약 보이면 `optimize_with_ort()` 의 level 확인 |

### 모델 출처 / 라이선스

- 모델 가중치: [6DRepNet360 공식 리포](https://github.com/thohemp/6DRepNet360) (저자: Thorsten Hempel, OVGU). MIT.
- 논문: Hempel et al., *Towards Robust and Unconstrained Full Range of Rotation Head Pose Estimation*,
  IEEE TIP 2024.
- 스크립트의 vendored 코드 (`SixDRepNet360` 클래스, `compute_rotation_matrix_from_ortho6d`):
  공식 리포에서 가져옴 (MIT). `normalize_vector` 만 ONNX 트레이싱 호환을 위해 device-agnostic 으로
  정리 — 동작은 동일.

### 변환된 모델의 git 관리

**현재 정책**: ONNX 파일(94MB)은 `.gitignore` 처리하고, 빌드 시 본 스크립트로 재생성하거나 사내
정적 호스팅에서 fetch 한다. 정식 도입 결정 시 Git LFS 로 승격 검토.

향후 변경 시 본 README 의 "변환 파이프라인 요약" 섹션 + `export_6drepnet360_onnx.py` 의 헤더
docstring 을 함께 갱신할 것.

## quantize_6drepnet360_onnx.py — FP32 ONNX → INT8 양자화

브라우저 다운로드 비용 절감 및 WASM SIMD INT8 GEMM 활용을 위한 INT8 변환. FP32 원본은
손대지 않고 같은 디렉토리에 별도 파일명으로 산출 — 비교/롤백 용이.

### 산출물

| 파일 | 방식 | 캘리브레이션 | 예상 크기 | 브라우저에서 효과 |
|------|------|--------------|-----------|-------------------|
| `6drepnet360.onnx` | FP32 (원본) | — | ~94 MB | baseline |
| `6drepnet360.int8.dynamic.onnx` | weight-only INT8 | 불필요 | ~24 MB | 다운로드 비용만 절감, 추론 속도 거의 동일 |
| `6drepnet360.int8.static.onnx` | full INT8 (weight + activation) | 200장 이상 face crop | ~24 MB | Conv-heavy 모델에서 1.5–2× 속도 향상 |

### 실행

```bash
cd C:/PJT/S14P31S107/AI

# Dynamic 만 (캘리브레이션 데이터 없을 때)
uv run --group export python scripts/quantize_6drepnet360_onnx.py \
  --input ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx

# Dynamic + Static (캘리브레이션 데이터 있을 때)
uv run --group export python scripts/quantize_6drepnet360_onnx.py \
  --input ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx \
  --calibration-dir <face crop 이미지가 있는 디렉토리> \
  --max-calibration-samples 200
```

### 캘리브레이션 데이터 가이드

`--calibration-dir` 디렉토리에는 jpg/jpeg/png face crop 이미지가 들어 있어야 한다.
- 224×224 가 아니어도 됨 (로더가 BILINEAR 리사이즈)
- ImageNet 정규화는 로더가 적용
- **분포가 production 입력과 비슷할수록 정확도 손실 작음**
- 100장 미만이면 percentile 추정 분산 커서 정확도 흔들림 → 200장 이상 권장

데이터 출처 옵션 (정확도 좋은 순):

1. **자가 캡처** — 실제 production 카메라/조명/거리로 본인 얼굴을 5분 녹화. 분포 일치도 최상.
2. **HuggingFace dataset** — `download_hf_calibration.py` 로 200장 streaming 다운로드.
   기본값 `prithivMLmods/Realistic-Face-Portrait-1024px` (Apache 2.0, 상업 이용 OK).
   포트레이트 위주라 yaw 분포는 좁지만, 합성 노이즈보다 훨씬 좋음.
3. **6DRepNet360 학습 셋** (300W-LP / Panoptic) — 모델 학습 분포와 정확히 일치. 다운로드/추출
   부담이 큼.

## download_hf_calibration.py — HuggingFace 에서 캘리브레이션 이미지 받기

자체 수집이 부담스러울 때 사용하는 1회성 헬퍼. parquet streaming 으로 N장만 가져오므로
dataset 전체 크기(수 GB) 와 무관하게 빠르게 끝난다.

### 두 가지 모드

**단순 모드** — 처음 N장을 그대로. 빠르지만 분포는 dataset 그대로 (정면 편향).

```bash
cd C:/PJT/S14P31S107/AI

uv run --group export python scripts/download_hf_calibration.py \
  --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
  --num-images 200
```

**분포 균등 모드 (권장)** — FP32 ONNX 로 각 sample 의 yaw 를 추정해서 7개 bin
(좌측면/좌중/좌약/정면/우약/우중/우측면) 에 균등 sampling. portrait dataset 에서도 측면 케이스를
최대한 끌어모은다.

```bash
uv run --group export python scripts/download_hf_calibration.py \
  --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
  --num-images 200 \
  --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx
```

### 옵션

| 플래그 | 효과 |
|--------|------|
| `--dataset ID` | HF dataset id (기본: `prithivMLmods/Realistic-Face-Portrait-1024px`) |
| `--split NAME` | dataset split (기본: `train`) |
| `--image-column COL` | 이미지 컬럼명 (기본: `image`) |
| `--output-dir PATH` | 저장 디렉토리 (필수) |
| `--num-images N` | 받을 이미지 수 (기본: 200) |
| `--model PATH` | 지정 시 분포 균등 모드. yaw 추정용 FP32 ONNX 경로 |
| `--max-candidates N` | 분포 균등 모드의 후보 풀 최대 수 (기본: num_images × 10) |

### 분포 균등 모드 출력 예

파일명에 bin 라벨 + 추정 yaw 가 박혀 디스크에서 분포 확인 용이:
```
face_F00_yaw+002.3_00012.jpg   # 정면
face_R20_yaw+018.7_00045.jpg   # 우측 약간
face_L45_yaw-038.4_00123.jpg   # 좌측 중간
...
```

종료 시 표시되는 분포 표 예:
```
[balanced] 최종 bin 분포:
  L75 (-90°~-60°):   3/29 [###..........................] 부족
  L45 (-60°~-30°):  18/29 [##################...........] 부족
  L20 (-30°~-10°):  29/29 [#############################] OK
  F00 (-10°~+10°):  29/29 [#############################] OK
  R20 (+10°~+30°):  29/29 [#############################] OK
  R45 (+30°~+60°):  21/29 [#####################........] 부족
  R75 (+60°~+90°):   2/29 [##...........................] 부족
```

"부족" 표시된 bin 은 portrait dataset 에 해당 yaw 영역 케이스가 거의 없어 후보 풀을 다 봐도
못 채운 것. 측면 케이스 보강이 절실하면 자가 캡처를 추가 권장.

### 기본 dataset 의 한계

`prithivMLmods/Realistic-Face-Portrait-1024px` 는 정면 포트레이트 위주라 yaw ±60° 이상 측면
회전이 거의 없다 — 6712 후보 풀 전체를 봐도 L75/R75 bin 은 0 장. 다음 dataset 들도 비슷한
분포 한계 (실측 또는 라이선스로 검토 결과):

| 후보 | 라이선스 | 측면 |
|------|----------|------|
| `canva999888/SFHQ-Tiny-512-Part1` (HF) | MIT | 정면 위주 (실측) |
| `tropos-labs/eigen-face-dataset-256` (HF) | 미명시 | 자동 streaming 불가 (datasets 인식 X) |
| `Nexdata/Multi-pose_and_Multi-expression_Face_Data` (HF) | sample 만 무료 | 전체는 유료 |
| `marcosv/ffhq-dataset` (HF) | CC mixed | yaw 라벨이 별도 (NC license) |
| `ETHZurich/biwi_kinect_head_pose` (HF) | non-commercial | ±75° but 부적합 |
| EFHQ (450k extreme pose) | CC BY-NC-SA | 부적합 |
| 300W-LP / AFLW2000-3D / QMUL Multiview | research only | 부적합 |

→ 측면 보강 옵션 (ROI 순):
1. **자가 캡처** (`capture_calibration_frames.py`) — production 분포 일치, 5분
2. **Pexels API** (`download_pexels_calibration.py`) — commercial OK 검색 API, 자동화
3. Stable Diffusion 합성 — GPU 필요, 분포 불일치

## download_pexels_calibration.py — Pexels API 로 측면 face 검색

자가 캡처 대안. Pexels License 는 commercial OK 라 RETINAL production 안전. 검색 API 의 noise
는 본 스크립트의 yaw 추정 + bin 필터로 자동 제거 (측면 bin 으로 분류된 것만 저장).

### 사전 준비

1. Pexels API key 발급 (무료, 5분): https://www.pexels.com/api/
   - 무료 한도: 25,000 req/month, 200 req/h. 측면 60장 수집은 ~500 req 면 충분.
2. 환경변수 설정 — 코드에 hardcode 금지.
   ```bash
   # bash/zsh
   export PEXELS_API_KEY="<키>"

   # PowerShell
   $env:PEXELS_API_KEY="<키>"
   ```

### 실행

```bash
cd C:/PJT/S14P31S107/AI

uv run --group export python scripts/download_pexels_calibration.py \
  --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
  --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx
```

### 한계 vs 자가 캡처

- 인물 전체샷이라 face crop 불정확 (중앙 정사각형 crop 으로 처리, 추정 noise 큼)
- 검색 noise — "profile" 키워드에 career profile / 측면 그림자 등 섞임
- 분포 일치도 = 다양한 인종/조명, production 카메라 분포와 불일치

→ production 정확도가 최우선이면 자가 캡처. 자동화/익명성이 우선이면 Pexels.

### 함정 — User-Agent

Pexels 는 default `python-requests/x.y` User-Agent 를 차단 (봇 트래픽 방지). 본 스크립트는
명시적 `User-Agent` 헤더를 보내 우회 — 직접 `requests.get` 으로 호출 시에도 같은 헤더
필수. 안 보내면 모든 요청이 401 Unauthorized.

## capture_calibration_frames.py — 웹캠으로 측면 자가 보강

HF 다운로드분으로 정면/근측면(±0~60°) 은 충분히 채워지지만 측면(±60-90°) 은 dataset 자체에
없어 0장. 이 스크립트는 웹캠으로 본인 얼굴을 회전시키며 부족한 bin 만 자동 캡처한다.

### 흐름

1. 웹캠 켜고 화면 중앙에 얼굴 위치
2. 좌→정면→우 천천히 회전 (~30초)
3. 매 N프레임 yaw 추정해서 부족한 bin 만 저장
4. 모든 target bin 채워지면 자동 종료 (또는 ESC/q)

화면 좌상단에 bin 별 진행 상황, 하단에 현재 yaw 게이지가 실시간 표시된다.

### 실행

```bash
cd C:/PJT/S14P31S107/AI

# 기본 — 측면(L75/R75) 만 30장씩 보강
uv run --group export python scripts/capture_calibration_frames.py \
  --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
  --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx

# 측면 전체 (±30° 이상) 보강
uv run --group export python scripts/capture_calibration_frames.py \
  --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
  --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx \
  --target-bins L75=30,L45=20,R45=20,R75=30
```

### 파일명 규약

자가 캡처 분은 `face_<bin>_yaw<value>_capture_<timestamp>_<frame>.jpg` 형태로 저장 — HF
다운로드분 (`face_<bin>_yaw<value>_<candidate>.jpg`) 과 구분되고, 같은 디렉토리에 합쳐도
충돌 없음.

### 보강 후 재양자화 → 비교

```bash
# 1. unoptimized FP32 재export (양자화 입력 — FusedConv 회피)
uv run --group export python scripts/export_6drepnet360_onnx.py \
  --checkpoint scripts/6DRepNet360_Full-Rotation_300W_LP+Panoptic.pth \
  --output ../FE/svelte/public/models/sixdrepnet360/6drepnet360.unoptimized.onnx \
  --no-ort-optimize --skip-verify

# 2. static 재양자화
uv run --group export python scripts/quantize_6drepnet360_onnx.py \
  --input ../FE/svelte/public/models/sixdrepnet360/6drepnet360.unoptimized.onnx \
  --calibration-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf

# 3. 비교 — 측면 정확도 향상 확인
uv run --group export python scripts/compare_6drepnet360_onnx.py \
  --models \
    ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx \
    ../FE/svelte/public/models/sixdrepnet360/6drepnet360.int8.dynamic.onnx \
    ../FE/svelte/public/models/sixdrepnet360/6drepnet360.int8.static.onnx \
  --image-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf
```

기대 효과: max 6.6° → 1-2° (측면 calibration 충분 시).

### 두 방식 차이의 핵심

`onnxruntime.quantization.quantize_dynamic` 은 weight 만 INT8 화하고 activation scale 은
**런타임에 동적 계산**한다. 이 동적 경로는 CPU EP 에서만 활성화되며 WASM/WebGPU 에서는 사실상
FP32 추론과 동일한 비용 — 즉 dynamic 양자화는 "다운로드 크기 절감" 효과만 남는다. 진짜 INT8
가속이 필요하면 static PTQ (QDQ 포맷) 가 유일한 경로.

## compare_6drepnet360_onnx.py — 모델 간 비교 표

같은 random 입력으로 여러 ONNX 모델의 파일 크기 / 노드 수 / CPU 추론 latency / 정확도(°) 를
한 표로 출력. 첫 번째 모델이 ground truth (보통 FP32) 가 되어 나머지가 그것과 비교된다.

### 실행

```bash
uv run --group export python scripts/compare_6drepnet360_onnx.py \
  --models \
    ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx \
    ../FE/svelte/public/models/sixdrepnet360/6drepnet360.int8.dynamic.onnx \
    ../FE/svelte/public/models/sixdrepnet360/6drepnet360.int8.static.onnx \
  --num-samples 100
```

### 정확도 metric

geodesic angle 기반 — `arccos((trace(R_ref^T @ R_other) − 1) / 2)` 도 단위. 두 컬럼 출력:
- `geodesic_mean_deg`: 평균 오차
- `geodesic_max_deg`: 최악 케이스 오차

### 비교 입력 — random vs --image-dir

**중요**: static 양자화는 calibration 분포에 강하게 의존하므로 random N(0,1) tensor 로
평가하면 정확도가 80° 이상 튄다 (실제 정확도 아니라 분포 mismatch 의 결과). 반드시
`--image-dir` 로 실제 face crop 디렉토리 (calibration 셋 또는 별도 face 이미지) 를 지정.

### 실측 결과 예 (HF calibration 112장으로 양자화, 같은 셋으로 비교, 100 샘플)

| 모델 | 크기 | latency (CPU EP) | geodesic mean | geodesic max |
|------|------|------------------|---------------|--------------|
| FP32 | 94.0 MB | 635 ms | — (ref) | — (ref) |
| INT8 dynamic | 23.7 MB | 799 ms (-26%) | 0.20° | 0.68° |
| INT8 static | 24.0 MB | **43.8 ms (14.5×↑)** | 2.46° | 6.59° |

해석:
- 사이즈는 둘 다 ~1/4 ✅
- **속도 가속은 static 만** — dynamic 은 DynamicQuantizeLinear 오버헤드 때문에 CPU 에서도 더 느림. WASM 에선 격차 더 큼.
- **정확도는 dynamic 압승** (12× 작은 오차) — weight-only 양자화의 inherent advantage.
- static 의 측면 정확도 손실은 portrait dataset 의 측면 케이스 부재 때문. 측면 calibration 보강 시 개선 여지.

→ 결정 가이드:
- **다운로드 비용만 줄이면 충분** → dynamic
- **추론 속도가 critical** → static + 측면 calibration 보강
- 절충: 두 가지를 별도 자산으로 ship 하고 환경별 토글 (모바일=static, 데스크탑=FP32 등)
