# 6DRepNet360 — 측면 헤드 포즈 감지 (검증 단계)

브라우저에서 사용자의 머리가 정확히 90° 측면을 향했을 때 자동 캡처를 트리거하기 위한 헤드 포즈
추정 모델 도입. 본 문서는 S14P31S107-137 기술 검증 단계의 설계와 결정 사항을 정리한다.

## 왜 6DRepNet360인가

| 후보 | 한계 / 강점 |
|------|-------------|
| MediaPipe FaceLandmarker (현재 사용 중) | 4×4 facialTransformationMatrix 에서 yaw/pitch/roll 분해. 정면 ±20° 영역에선 정확하지만 측면(>±60°) 에서 흔들림. 랜드마크 PnP 유도값이라 극단 각도 데이터를 거의 못 봄 |
| 6DRepNet (원본) | 6D 회전 표현 회귀, ~±99° 범위 — 우리 90° 케이스의 경계선 |
| **6DRepNet360** | ±180° 풀 레인지. 300W-LP + CMU Panoptic 학습으로 측면 데이터 풍부. **90° 감지의 안정성이 핵심 설계 목표** |

기존 MediaPipe 가이드(`face_landmarker.js` 의 `check_frontal()`)는 **유지**한다. 6DRepNet360 은
**측면 90° 캡처 트리거**라는 별도 use case 만 담당.

## 모델 정보

| 항목 | 값 |
|------|-----|
| 저자 | Thorsten Hempel et al. (OVGU) |
| 논문 | *Towards Robust and Unconstrained Full Range of Rotation Head Pose Estimation*, IEEE TIP 2024 |
| 라이선스 | MIT |
| 백본 | ResNet50 (Bottleneck × [3, 4, 6, 3]) |
| 학습 데이터 | 300W-LP + CMU Panoptic (Full-Rotation 모델) |
| 입력 | 224×224 RGB, ImageNet 정규화 (mean `[0.485, 0.456, 0.406]`, std `[0.229, 0.224, 0.225]`) |
| 출력 | 3×3 회전행렬 (forward 안에서 6D → Gram-Schmidt → 행렬 처리) |

## 시스템 구성 (검증 단계)

```
┌────────────────────────────────────────────────────────────────────┐
│ AI/scripts/  (오프라인 1회성 도구)                                    │
│   export_6drepnet360_onnx.py                                       │
│   PyTorch .pth → ONNX 변환 + ORT 그래프 최적화 베이크                │
│   세부: AI/scripts/README.md                                        │
└────────────────────────────────────────────────────────────────────┘
                              │ (생성)
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx (94 MB)      │
│   브라우저 onnxruntime-web 추론용 정적 자산                          │
└────────────────────────────────────────────────────────────────────┘
                              │ (런타임 로드)
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ FE/svelte/src/lib/sixdrepnet360/   (예정 — 137 브랜치 다음 단계)     │
│   onnxruntime-web 세션 + face crop 전처리 + 회전행렬 → Euler 변환    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ FE/svelte/src/router/analysis/headpose_debug.svelte  (예정)          │
│   디버그 라우트 — yaw/pitch/roll 작은 오버레이로 표시                 │
│   MediaPipe 의 yaw/pitch/roll 과 나란히 비교 (정확도 검증)            │
└────────────────────────────────────────────────────────────────────┘
```

## 변환 파이프라인 요약

`AI/scripts/export_6drepnet360_onnx.py` 가 다음 4단계를 수행:

1. **체크포인트 로드** + `model.eval()` (BatchNorm 추론 모드 보장)
2. **`torch.onnx.export`** — opset 17, batch 차원만 동적, `do_constant_folding=True`
3. **External data 인라인 병합** — PyTorch 2.x dynamo exporter 가 가중치를 별도 파일로 분리하는
   기본 동작을 되돌려 단일 파일화
4. **ORT 그래프 최적화 베이크** — `ORT_ENABLE_EXTENDED` 로 Conv+Relu fusion 등 플랫폼 독립적
   변환만 적용. `ORT_ENABLE_ALL` 의 NchwcTransformer 는 x86 CPU 특화라 모바일 ARM / WASM /
   WebGPU 에 부적합해서 의도적으로 한 단계 낮춤

검증: PyTorch FP32 출력과 ONNX 출력의 `max|diff|` 가 1e-4 미만인지 자동 확인. 현재 측정값
**1.79e-07** (5자릿수 여유).

상세 사용법은 [`AI/scripts/README.md`](../AI/scripts/README.md) 참조.

## 의도적으로 채택하지 않은 선택지

| 선택지 | 기각 사유 |
|--------|-----------|
| 서버사이드 추론 (FastAPI 에 모델 적재) | 실시간 트리거가 필요한 use case 라 프레임당 네트워크 왕복이 부적합. 또한 검증 단계에서 인프라 변경을 늘리고 싶지 않음 |
| FP16 / INT8 양자화 | 정확도 검증 전 사이즈 최적화는 본말 전도. 90° 영역(분포 극단)에서 양자화 노이즈가 가장 크게 작용하므로 FP32 로 동작 검증 후 별도 PR/브랜치에서 검토 |
| MediaPipe 를 6DRepNet360 으로 완전 대체 | 정면 가이드 영역에선 MediaPipe 가 충분히 정확하고 가벼움(~9MB). 6DRepNet360 은 측면 캡처 트리거로 한정 |
| ONNX 파일 git 커밋 | 94MB 라 저장소 비대화. `.gitignore` + 빌드 스크립트로 재생성하는 패턴(MediaPipe 의 `vite-plugin-static-copy` 와 동일 사상). 정식 도입 시 Git LFS 검토 |
| `ORT_ENABLE_ALL` 베이크 | NchwcTransformer 가 x86 CPU 종속 변환을 모델에 박아 모바일 / WASM 백엔드에서 비호환. EXTENDED 가 이식 안전한 상한 |

## 기술 검증 단계의 성공 조건

1. ONNX 파일이 `onnxruntime-web` 으로 로드되어 단일 프레임 추론이 100ms 이하로 동작
2. 사용자가 카메라 앞에서 측면(±90° 부근)으로 천천히 회전할 때, 6DRepNet360 의 yaw 가
   MediaPipe 의 yaw 보다 측면에서 더 안정적임이 시각적으로 확인됨 (정면 영역은 두 값이
   유사해야 함 — 검증의 sanity check)
3. 모바일 Safari / Chrome 에서 정상 동작 (NchwcTransformer 회피 결정의 가치 검증)

검증 통과 후 단계: 실제 측면 90° 캡처 자동 트리거 로직 + UX 통합 (별도 스토리).

## 관련 자료

- 변환 도구: [`AI/scripts/README.md`](../AI/scripts/README.md), [`AI/scripts/export_6drepnet360_onnx.py`](../AI/scripts/export_6drepnet360_onnx.py)
- 기존 MediaPipe 헤드 포즈: [`FE/svelte/src/lib/mediapipe/face_landmarker.js`](../FE/svelte/src/lib/mediapipe/face_landmarker.js) — `check_frontal()` 함수
- 모델 가중치 출처: https://github.com/thohemp/6DRepNet360
- 논문: https://thohemp.github.io/publication/6drepnet360/
