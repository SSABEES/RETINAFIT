"""
웹캠으로 face crop 캘리브레이션 데이터를 자가 수집한다.

# 왜 필요한가
HF/Kaggle 의 commercial-OK face dataset 들은 거의 다 정면 위주 — 측면(yaw |60°+|) calibration
이 0장이라 static INT8 의 측면 정확도가 가장 큰 손실 영역. 본인 얼굴을 직접 회전해서 측면
30~50장 추가하면 그 영역 max 오차가 6.6° → ~1-2° 로 떨어질 가능성이 큼.

# 흐름
1. 웹캠 켜고 화면 중앙에 얼굴이 가도록 위치
2. 좌→정면→우 천천히 회전 (~30초)
3. 매 N프레임 yaw 추정해서 부족한 bin 만 자동 저장
4. 모든 target bin 채워지면 자동 종료 (또는 ESC/q 키)

# 실행
uv run --group export python AI/scripts/capture_calibration_frames.py \
    --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
    --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx

# 옵션
--target-bins L75=30,R75=30 (기본) — 측면만 보강하려고 할 때.
--target-bins L75=30,L45=20,R45=20,R75=30 — 측면 전체 보강.

# 보강 시나리오
기존 디렉토리에 download_hf_calibration.py 결과가 있으면 그대로 두고 측면만 추가.
파일명에 capture_<timestamp>_ 접두사가 붙어 HF 다운로드분과 구분.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

# yaw bin 정의 — download_hf_calibration.py 와 동일 컨벤션 (Y 축 좌우 회전).
BINS_DEG = [(-90.0, -60.0), (-60.0, -30.0), (-30.0, -10.0),
            (-10.0, 10.0),
            (10.0, 30.0), (30.0, 60.0), (60.0, 90.0)]
BIN_LABELS = ["L75", "L45", "L20", "F00", "R20", "R45", "R75"]

INPUT_SIZE = 224
INPUT_NAME = "pixel_values"
OUTPUT_NAME = "rotation_matrix"
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


# 'L75=30,R75=30' → {'L75': 30, 'R75': 30}
def _parse_target_bins(spec: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for part in spec.split(","):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        k = k.strip()
        if k in BIN_LABELS:
            out[k] = int(v.strip())
    return out


# 짧은 변 기준 중앙 정사각형 crop. inference.js 의 compute_center_square_bbox 와 동일 로직.
# 사용자가 얼굴을 화면 중앙에 두면 6DRepNet360 입력으로 그대로 사용 가능.
def _center_square_crop(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    short = min(h, w)
    y0 = (h - short) // 2
    x0 = (w - short) // 2
    return frame[y0 : y0 + short, x0 : x0 + short]


# BGR uint8 (cv2 기본) → ImageNet 정규화된 RGB Float32 [1, 3, 224, 224].
def _to_input_tensor(bgr_crop: np.ndarray, cv2) -> np.ndarray:
    rgb = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    arr = rgb.astype(np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)
    arr = (arr - MEAN) / STD
    return arr[np.newaxis, :, :, :]


def _estimate_yaw_deg(session, input_tensor: np.ndarray) -> float:
    R = session.run([OUTPUT_NAME], {INPUT_NAME: input_tensor})[0][0]
    yaw_rad = np.arctan2(-R[2, 0], np.sqrt(R[2, 1] ** 2 + R[2, 2] ** 2))
    return float(np.degrees(yaw_rad))


def _yaw_to_bin(yaw_deg: float) -> int:
    for bi, (lo, hi) in enumerate(BINS_DEG):
        if lo <= yaw_deg < hi:
            return bi
    return 0 if yaw_deg < BINS_DEG[0][0] else len(BINS_DEG) - 1


def main() -> int:
    parser = argparse.ArgumentParser(description="웹캠으로 face crop 캘리브레이션 자가 수집")
    parser.add_argument("--output-dir", type=Path, required=True, help="저장 디렉토리. 기존 파일 보존")
    parser.add_argument("--model", type=Path, required=True, help="yaw 추정용 FP32 ONNX 경로")
    parser.add_argument(
        "--target-bins",
        default="L75=30,R75=30",
        help="bin 별 추가 목표 (기본: 측면 ±60-90° 만 30장씩)",
    )
    parser.add_argument("--camera-index", type=int, default=0, help="웹캠 인덱스 (기본 0)")
    parser.add_argument(
        "--inference-stride",
        type=int,
        default=3,
        help="N 프레임마다 1번 yaw 추정 (CPU 부하 절감, 기본 3)",
    )
    args = parser.parse_args()

    targets = _parse_target_bins(args.target_bins)
    if not targets:
        print(f"[error] --target-bins 파싱 실패: {args.target_bins}", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    if not args.model.exists():
        print(f"[error] FP32 ONNX 없음: {args.model}", file=sys.stderr)
        return 1

    import cv2
    import onnxruntime as ort

    session = ort.InferenceSession(args.model.as_posix(), providers=["CPUExecutionProvider"])

    cap = cv2.VideoCapture(args.camera_index)
    if not cap.isOpened():
        print(f"[error] 웹캠 열기 실패 (index={args.camera_index})", file=sys.stderr)
        return 1

    print(f"[capture] 출력: {args.output_dir}")
    print(f"[capture] target bins: {targets}")
    print(f"[capture] FP32 모델: {args.model}")
    print()
    print("=== 가이드 ===")
    print("  1. 얼굴을 화면 중앙에 두고 카메라 정면을 본다.")
    print("  2. 천천히 좌→정면→우로 회전 (~30초). 코가 카메라 가장자리를 향할 때까지.")
    print("  3. 모든 target bin 이 채워지면 자동 종료. 또는 ESC/q 로 중도 종료.")
    print()

    saved = {label: 0 for label in BIN_LABELS}
    frame_idx = 0
    timestamp = int(time.time())

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            crop = _center_square_crop(frame)

            # stride 마다만 yaw 추정 — ResNet50 추론은 CPU 에서 ~30ms, 매 프레임 돌리면 카메라 fps 가 떨어짐.
            do_inference = frame_idx % args.inference_stride == 0
            yaw_deg: float | None = None
            current_bin = -1

            if do_inference:
                tensor = _to_input_tensor(crop, cv2)
                yaw_deg = _estimate_yaw_deg(session, tensor)
                current_bin = _yaw_to_bin(yaw_deg)

                label = BIN_LABELS[current_bin]
                target = targets.get(label, 0)
                if saved[label] < target:
                    out_name = f"face_{label}_yaw{yaw_deg:+06.1f}_capture_{timestamp}_{frame_idx:05d}.jpg"
                    out_path = args.output_dir / out_name
                    cv2.imwrite(out_path.as_posix(), crop)
                    saved[label] += 1

            # 화면에 진행 상황 + 현재 yaw 표시
            display = cv2.resize(crop, (480, 480))

            y = 30
            for label in BIN_LABELS:
                target = targets.get(label, 0)
                if target == 0:
                    continue
                done = saved[label]
                color = (0, 255, 0) if done >= target else (0, 165, 255)
                cv2.putText(
                    display,
                    f"{label}: {done}/{target}",
                    (10, y),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    color,
                    2,
                )
                y += 28

            if yaw_deg is not None:
                # yaw [-90, +90] → bar 위치
                bar_x = int((yaw_deg + 90) / 180 * 460) + 10
                cv2.line(display, (10, 460), (470, 460), (80, 80, 80), 2)
                cv2.circle(display, (bar_x, 460), 8, (0, 255, 255), -1)
                cv2.putText(
                    display,
                    f"yaw: {yaw_deg:+.1f}deg -> {BIN_LABELS[current_bin]}",
                    (10, 445),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 255, 255),
                    2,
                )

            cv2.imshow("Calibration Capture (ESC/q to quit)", display)

            if all(saved[label] >= target for label, target in targets.items()):
                print("[capture] 모든 target bin 충족 — 종료")
                break

            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                print("[capture] 사용자 종료 (ESC/q)")
                break

            frame_idx += 1
    finally:
        cap.release()
        cv2.destroyAllWindows()

    print()
    print("[capture] 추가 저장 분포:")
    for label, target in targets.items():
        status = "OK" if saved[label] >= target else "부족"
        print(f"  {label}: +{saved[label]}/{target} {status}")

    print(
        "\n다음 단계: 같은 디렉토리로 static 재양자화\n"
        f"  uv run --group export python scripts/quantize_6drepnet360_onnx.py \\\n"
        f"    --input ../FE/svelte/public/models/sixdrepnet360/6drepnet360.unoptimized.onnx \\\n"
        f"    --calibration-dir {args.output_dir.as_posix()}\n"
        "(unoptimized.onnx 는 export_6drepnet360_onnx.py --no-ort-optimize 로 재생성 필요)"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
