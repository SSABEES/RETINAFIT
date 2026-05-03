"""
FP32 / INT8 ONNX 모델들을 동일 입력으로 비교한다 — 파일 크기, 노드 수, CPU 추론 latency,
정확도(°). 첫 번째 인자 모델을 ground truth (보통 FP32) 로 잡고 나머지를 그것과 비교.

# 비교 입력 (두 모드)
1. --image-dir 지정: 디렉토리의 jpg/jpeg/png 를 224 리사이즈 + ImageNet 정규화해서 입력으로 사용.
   **static 양자화 평가에 필수** — static 은 calibration 분포에 강하게 의존해서 random
   tensor 로 평가하면 정확도가 80° 이상 튐 (실제 정확도 아니라 분포 mismatch 의 결과).
2. 미지정: random Float32 N(0,1). 빠르지만 weight-only (dynamic) 평가에만 의미.

# 실행
uv run --group export python AI/scripts/compare_6drepnet360_onnx.py \
    --models \
      ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx \
      ../FE/svelte/public/models/sixdrepnet360/6drepnet360.int8.dynamic.onnx \
      ../FE/svelte/public/models/sixdrepnet360/6drepnet360.int8.static.onnx \
    --num-samples 100

# 출력 예
model                          size_mb  nodes  latency_ms  geodesic_mean_deg  geodesic_max_deg
-----------------------------  -------  -----  ----------  -----------------  ----------------
6drepnet360.onnx                94.0    145    37.21       —                  —
6drepnet360.int8.dynamic.onnx   24.1    268    35.40       0.412              1.873
6drepnet360.int8.static.onnx    24.0    312    21.05       0.518              2.314
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort

INPUT_NAME = "pixel_values"
OUTPUT_NAME = "rotation_matrix"
INPUT_SHAPE = (1, 3, 224, 224)

# ImageNet 정규화 (양자화/quantize_6drepnet360_onnx.py 와 동일).
INPUT_SIZE = 224
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


# 디렉토리에서 jpg/jpeg/png 를 모아 224 리사이즈 + ImageNet 정규화 후 [1, 3, 224, 224] 텐서 리스트 반환.
def _load_face_images(image_dir: Path, num_samples: int) -> list[np.ndarray]:
    from PIL import Image

    exts = {".jpg", ".jpeg", ".png"}
    files = sorted(p for p in image_dir.iterdir() if p.suffix.lower() in exts)[:num_samples]
    if not files:
        raise FileNotFoundError(f"이미지 없음: {image_dir} (jpg/jpeg/png)")

    inputs = []
    for path in files:
        img = Image.open(path).convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
        arr = np.asarray(img, dtype=np.float32) / 255.0
        arr = arr.transpose(2, 0, 1)
        arr = (arr - _MEAN) / _STD
        inputs.append(arr[np.newaxis, :, :, :])
    return inputs


# ─────────────────────────────────────────────────────────────────────────────
# 사용자 구현 영역 — 양자화 ship-readiness 의 핵심 metric.
#
# 회전행렬 차이를 의미 있는 단위(도) 로 환산한다. element-wise max|diff| 는 도메인 의미가
# 약해서 (같은 5° 오차여도 행렬 원소로는 위치마다 0.001~0.087 까지 분포) 비교 표에서 쓸모 없음.
#
# 후보 metric:
#   1) geodesic angle — `arccos((trace(R_ref^T @ R_other) - 1) / 2)` 도 단위.
#      head orientation 의 "전체 오차" 단일 스칼라. 표준 head pose 논문 (HopeNet, FSA-Net,
#      6DRepNet, 6DRepNet360) 의 주 metric. ※ trace 가 [-1, 3] 범위를 살짝 벗어날 수
#      있으니 arccos 입력 clamp 필요.
#   2) per-axis Euler error — yaw/pitch/roll 각각 도. UX 디버깅에 유리 (예: yaw 만 망가짐).
#   3) Frobenius norm — `||R_ref - R_other||_F`. 도가 아니라 무차원이라 직관 약함.
#
# N 개 sample 의 집계 방식 — mean / median / max / 95th percentile 중 어떤 게 양자화
# 시그니처를 잘 잡는지도 직접 결정. 추천: mean + max (분포의 중심과 최악 케이스).
#
# 반환 dict 의 key 가 비교 표 컬럼명이 된다. 키 이름은 단위 포함이 가독성 좋음
# (예: "geodesic_mean_deg", "yaw_max_deg").
# ─────────────────────────────────────────────────────────────────────────────
def compute_pose_error(rot_ref: np.ndarray, rot_other: np.ndarray) -> dict[str, float]:
    """
    rot_ref:   shape (N, 3, 3) — ground truth (보통 FP32) 회전행렬 N 개
    rot_other: shape (N, 3, 3) — 비교 대상 회전행렬 N 개

    geodesic angle 을 mean / max 두 값으로 집계. 단위는 도(°).

    공식: angle = arccos((trace(R_ref^T @ R_other) - 1) / 2)
    부동소수점 오차로 trace 가 [-1, 3] 을 살짝 벗어날 수 있어 clip 필수.
    """
    R_diff = np.matmul(rot_ref.transpose(0, 2, 1), rot_other)  # (N, 3, 3)
    trace = np.trace(R_diff, axis1=1, axis2=2)                 # (N,)
    cos_theta = np.clip((trace - 1.0) / 2.0, -1.0, 1.0)
    angles_deg = np.degrees(np.arccos(cos_theta))
    return {
        "geodesic_mean_deg": float(angles_deg.mean()),
        "geodesic_max_deg": float(angles_deg.max()),
    }


# ─────────────────────────────────────────────────────────────────────────────


# 모델 하나에 대해 inputs 전체를 추론하고 결과를 하나로 stack 해서 반환.
# warmup 으로 CPU 캐시/JIT 영향 제거. CPU EP 만 사용 — 비교의 일관성을 위해.
def benchmark_model(
    model_path: Path,
    inputs: list[np.ndarray],
    warmup: int = 5,
) -> tuple[np.ndarray, float, int]:
    nodes = len(onnx.load(model_path.as_posix()).graph.node)
    sess = ort.InferenceSession(model_path.as_posix(), providers=["CPUExecutionProvider"])

    for _ in range(warmup):
        sess.run([OUTPUT_NAME], {INPUT_NAME: inputs[0]})

    outputs = []
    t0 = time.perf_counter()
    for inp in inputs:
        out = sess.run([OUTPUT_NAME], {INPUT_NAME: inp})[0]
        outputs.append(out)
    avg_latency_ms = (time.perf_counter() - t0) * 1000 / len(inputs)

    return np.concatenate(outputs, axis=0), avg_latency_ms, nodes


# 표 한 줄을 컬럼 폭에 맞춰 출력. float 는 소수점 3자리, 빈 값은 "—".
def _fmt(v) -> str:
    if v is None or v == "":
        return "—"
    if isinstance(v, float):
        return f"{v:.3f}"
    return str(v)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="ONNX 모델 비교 (파일크기 / 노드수 / CPU 추론 latency / 정확도°)"
    )
    parser.add_argument(
        "--models",
        nargs="+",
        type=Path,
        required=True,
        help="비교할 ONNX 경로들. 첫 번째가 ground truth (보통 FP32) 로 사용됨.",
    )
    parser.add_argument("--num-samples", type=int, default=100, help="입력 sample 수 (기본 100)")
    parser.add_argument("--seed", type=int, default=42, help="random 모드일 때만 사용")
    parser.add_argument(
        "--image-dir",
        type=Path,
        default=None,
        help="실제 face crop 이미지 디렉토리. static 양자화 평가에 권장 (미지정 시 random tensor)",
    )
    args = parser.parse_args()

    for m in args.models:
        if not m.exists():
            print(f"[error] 모델 없음: {m}", file=sys.stderr)
            return 1

    if args.image_dir is not None:
        if not args.image_dir.is_dir():
            print(f"[error] 이미지 디렉토리 없음: {args.image_dir}", file=sys.stderr)
            return 1
        inputs = _load_face_images(args.image_dir, args.num_samples)
        print(f"입력 sample {len(inputs)} 개 from {args.image_dir}, CPU EP 로 비교\n")
    else:
        # 정규분포 N(0,1) — ImageNet 정규화 후의 입력 분포와 유사. dynamic 양자화 평가에만 신뢰.
        rng = np.random.default_rng(args.seed)
        inputs = [rng.standard_normal(INPUT_SHAPE).astype(np.float32) for _ in range(args.num_samples)]
        print(f"입력 sample {args.num_samples} 개 (random N(0,1), seed={args.seed}), CPU EP 로 비교")
        print("[warn] static 양자화는 calibration 분포 의존성 큼 — 실제 face 평가는 --image-dir 사용\n")

    rows: list[dict] = []
    ref_outputs: np.ndarray | None = None

    for model_path in args.models:
        size_mb = model_path.stat().st_size / 1e6
        outputs, latency_ms, nodes = benchmark_model(model_path, inputs)

        if ref_outputs is None:
            ref_outputs = outputs
            error_metrics: dict[str, float] = {}  # ground truth 자기 자신 — 비교하지 않음
        else:
            error_metrics = compute_pose_error(ref_outputs, outputs)

        rows.append(
            {
                "model": model_path.name,
                "size_mb": size_mb,
                "nodes": nodes,
                "latency_ms": latency_ms,
                **error_metrics,
            }
        )

    # 표 출력 — 모든 행의 union 키를 헤더로 사용 (정확도 컬럼은 ref 행에만 비어 있음).
    base_cols = ["model", "size_mb", "nodes", "latency_ms"]
    metric_cols = sorted({k for r in rows for k in r if k not in base_cols})
    headers = base_cols + metric_cols

    col_widths = {
        h: max(len(h), max(len(_fmt(r.get(h, ""))) for r in rows)) for h in headers
    }
    print("  ".join(h.ljust(col_widths[h]) for h in headers))
    print("  ".join("-" * col_widths[h] for h in headers))
    for r in rows:
        print("  ".join(_fmt(r.get(h, "")).ljust(col_widths[h]) for h in headers))

    return 0


if __name__ == "__main__":
    sys.exit(main())
