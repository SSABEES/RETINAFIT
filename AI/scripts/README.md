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
