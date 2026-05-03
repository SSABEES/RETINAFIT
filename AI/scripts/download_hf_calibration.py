"""
HuggingFace 의 face crop 데이터셋에서 캘리브레이션 이미지를 N장 받아 로컬 디렉토리에 저장한다.

# 두 가지 모드
1. 단순 모드 (--model 미지정): streaming 으로 처음 N장만 받음. 빠르지만 분포는 dataset 그대로.
2. 분포 균등 모드 (--model 지정): FP32 ONNX 로 각 sample 의 yaw 를 추정해 bin 별로 sampling.
   portrait dataset 처럼 정면 편향이 심한 경우에 측면 케이스를 최대한 끌어모음.

# 왜 분포 균등 모드가 필요한가
6DRepNet360 의 강점은 측면 ±90° 감지인데, 일반 face dataset 은 정면 portrait 위주라 측면이
거의 없다. 정면 편향 캘리브레이션은 측면 입력에서 activation 분포가 어긋나 양자화 정확도가
나빠진다. yaw bin (좌측면/좌중/좌약/정면/우약/우중/우측면 7구간) 별로 균등 sampling 해서
조금이라도 분포를 펼쳐주는 게 목표.

# 기본 dataset
prithivMLmods/Realistic-Face-Portrait-1024px (Apache 2.0, 6712장, 1024×1024)

# 실행
# 단순 모드
uv run --group export python AI/scripts/download_hf_calibration.py \
    --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
    --num-images 200

# 분포 균등 모드 (권장)
uv run --group export python AI/scripts/download_hf_calibration.py \
    --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
    --num-images 200 \
    --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

DEFAULT_DATASET = "prithivMLmods/Realistic-Face-Portrait-1024px"
DEFAULT_NUM = 200

# yaw bin 정의 — 단위 도(°). 좌측 음수, 우측 양수.
# 7개 bin: 좌측면(-90~-60) / 좌중(-60~-30) / 좌약(-30~-10) / 정면(-10~10) /
#         우약(10~30) / 우중(30~60) / 우측면(60~90)
DEFAULT_BINS_DEG = [(-90.0, -60.0), (-60.0, -30.0), (-30.0, -10.0),
                    (-10.0, 10.0),
                    (10.0, 30.0), (30.0, 60.0), (60.0, 90.0)]
BIN_LABELS = ["L75", "L45", "L20", "F00", "R20", "R45", "R75"]

# 모델 입력 정규화 — FE inference.js 와 일치해야 함.
INPUT_SIZE = 224
INPUT_NAME = "pixel_values"
OUTPUT_NAME = "rotation_matrix"
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


# PIL.Image → 모델 입력 텐서 (1, 3, 224, 224). ImageNet 정규화 후 CHW + batch dim.
def _to_input_tensor(pil_image, Image) -> np.ndarray:
    img = pil_image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)
    arr = (arr - MEAN) / STD
    return arr[np.newaxis, :, :, :]


# 회전행렬에서 yaw(°) 추출. ZYX intrinsic Euler — yaw 는 Y 축 회전 (좌우 도리도리).
# atan2 의 두 인자가 모두 0 일 때만 정의 안 됨 (gimbal lock) → 정상 face 입력에서는 발생 안 함.
def _rotation_matrix_to_yaw_deg(R: np.ndarray) -> float:
    yaw_rad = np.arctan2(-R[2, 0], np.sqrt(R[2, 1] ** 2 + R[2, 2] ** 2))
    return float(np.degrees(yaw_rad))


# yaw 값을 bin index 로 매핑. 범위 밖 (이상치) 은 가장 가까운 bin 에 배정.
def _yaw_to_bin(yaw_deg: float, bins: list[tuple[float, float]]) -> int:
    for bi, (lo, hi) in enumerate(bins):
        if lo <= yaw_deg < hi:
            return bi
    # 범위 밖 — 양 끝 bin 에 배정
    return 0 if yaw_deg < bins[0][0] else len(bins) - 1


# 단순 모드: dataset 의 처음 N장을 그대로 저장.
def _download_simple(ds, image_column: str, output_dir: Path, num_images: int) -> int:
    saved = 0
    for i, sample in enumerate(ds.take(num_images)):
        image = sample.get(image_column)
        if image is None:
            print(f"[error] sample[{i}] 에 '{image_column}' 컬럼 없음. 컬럼: {list(sample.keys())}",
                  file=sys.stderr)
            return -1
        out_path = output_dir / f"face_{i:04d}.jpg"
        image.convert("RGB").save(out_path, format="JPEG", quality=92)
        saved += 1
    return saved


# 분포 균등 모드: 각 sample 의 yaw 를 FP32 모델로 추정 → bin 별로 sampling.
# 모든 bin 이 채워지거나 max_candidates 까지 시도하면 종료.
def _download_balanced(
    ds,
    image_column: str,
    output_dir: Path,
    num_images: int,
    model_path: Path,
    max_candidates: int,
) -> int:
    import onnxruntime as ort
    from PIL import Image

    print(f"[balanced] FP32 모델로 yaw 추정: {model_path}")
    session = ort.InferenceSession(model_path.as_posix(), providers=["CPUExecutionProvider"])

    n_bins = len(DEFAULT_BINS_DEG)
    # ceil 분할 — num_images 가 7로 나눠떨어지지 않으면 앞 bin 부터 1장씩 더.
    quotas = [num_images // n_bins + (1 if i < num_images % n_bins else 0) for i in range(n_bins)]
    counts = [0] * n_bins

    print(f"[balanced] bin 별 목표 수량: " +
          ", ".join(f"{BIN_LABELS[i]}={quotas[i]}" for i in range(n_bins)))
    print(f"[balanced] 후보 풀 최대 {max_candidates} 장까지 시도\n")

    saved = 0
    candidates_seen = 0
    for sample in ds.take(max_candidates):
        candidates_seen += 1
        image = sample.get(image_column)
        if image is None:
            continue

        tensor = _to_input_tensor(image, Image)
        R = session.run([OUTPUT_NAME], {INPUT_NAME: tensor})[0][0]
        yaw_deg = _rotation_matrix_to_yaw_deg(R)
        bi = _yaw_to_bin(yaw_deg, DEFAULT_BINS_DEG)

        if counts[bi] >= quotas[bi]:
            continue  # 해당 bin 가득 — skip

        # 파일명에 bin 라벨 + 추정 yaw + 후보 인덱스 → 디스크에서 분포 확인 용이.
        out_path = output_dir / f"face_{BIN_LABELS[bi]}_yaw{yaw_deg:+06.1f}_{candidates_seen:05d}.jpg"
        image.convert("RGB").save(out_path, format="JPEG", quality=92)
        counts[bi] += 1
        saved += 1

        # 진행 상황 (50 후보마다)
        if candidates_seen % 50 == 0:
            filled = "/".join(f"{counts[i]}" for i in range(n_bins))
            print(f"  [{candidates_seen:>5}] saved={saved}/{num_images}  bins={filled}")

        if all(counts[i] >= quotas[i] for i in range(n_bins)):
            print(f"  [{candidates_seen:>5}] 모든 bin 충족 — 조기 종료")
            break

    print()
    print(f"[balanced] 후보 {candidates_seen} 장 중 {saved} 장 저장")
    print(f"[balanced] 최종 bin 분포:")
    for i in range(n_bins):
        bar = "#" * counts[i] + "." * (quotas[i] - counts[i])
        status = "OK" if counts[i] >= quotas[i] else "부족"
        print(f"  {BIN_LABELS[i]} ({DEFAULT_BINS_DEG[i][0]:+.0f}°~{DEFAULT_BINS_DEG[i][1]:+.0f}°): "
              f"{counts[i]:3d}/{quotas[i]:3d} [{bar}] {status}")
    return saved


def main() -> int:
    parser = argparse.ArgumentParser(
        description="HuggingFace face dataset 에서 캘리브레이션 이미지를 streaming 으로 다운로드"
    )
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help=f"HF dataset id (기본: {DEFAULT_DATASET})")
    parser.add_argument("--split", default="train", help="dataset split (기본: train)")
    parser.add_argument("--image-column", default="image", help="이미지 컬럼명 (기본: image)")
    parser.add_argument("--output-dir", type=Path, required=True, help="저장 디렉토리. 없으면 생성")
    parser.add_argument("--num-images", type=int, default=DEFAULT_NUM,
                        help=f"받을 이미지 수 (기본: {DEFAULT_NUM})")
    parser.add_argument("--model", type=Path, default=None,
                        help="지정 시 분포 균등 모드 — FP32 ONNX 로 yaw 추정해 bin 별 sampling")
    parser.add_argument("--max-candidates", type=int, default=None,
                        help="분포 균등 모드에서 후보 풀 최대 수 (기본: num_images × 10)")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    from datasets import load_dataset

    print(f"[1/2] streaming load: {args.dataset} (split={args.split})")
    ds = load_dataset(args.dataset, split=args.split, streaming=True)

    if args.model is None:
        print(f"[2/2] 단순 모드 — 처음 {args.num_images} 장 → {args.output_dir}")
        saved = _download_simple(ds, args.image_column, args.output_dir, args.num_images)
    else:
        if not args.model.exists():
            print(f"[error] FP32 ONNX 없음: {args.model}", file=sys.stderr)
            return 1
        max_cand = args.max_candidates or args.num_images * 10
        print(f"[2/2] 분포 균등 모드 — yaw bin sampling → {args.output_dir}")
        saved = _download_balanced(ds, args.image_column, args.output_dir,
                                   args.num_images, args.model, max_cand)

    if saved < 0:
        return 1

    print(f"\n다운로드 완료: {saved} 장 saved at {args.output_dir}")
    print(
        "다음 단계: 이 디렉토리를 quantize_6drepnet360_onnx.py 의 --calibration-dir 로 전달.\n"
        f"  uv run --group export python scripts/quantize_6drepnet360_onnx.py \\\n"
        f"    --input ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx \\\n"
        f"    --calibration-dir {args.output_dir.as_posix()}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
