"""
Pexels API 로 측면 face 이미지를 검색해 calibration 디렉토리에 추가한다 — 측면(L75/R75) bin
보강 전용. Pexels License 는 commercial 이용 OK 이므로 RETINAL production 에 안전.

# 왜 이 도구가 따로 있나
HuggingFace face dataset 들 (Realistic-Face-Portrait, SFHQ 등 — 라이선스 OK 인 모든 후보) 은
정면 위주라 yaw |60-90°| bin 이 0장. download_hf_calibration.py 의 분포 균등 모드로도 채워지지
않는 fundamental gap. Pexels 는 search API 라 "side profile face" 같은 키워드로 측면 사진을
직접 끌어올 수 있고, 결과의 noise 는 본 스크립트의 yaw 추정 + bin 필터로 자동 제거.

# 사전 준비
1. Pexels API key 발급 (무료, 5분): https://www.pexels.com/api/
2. 환경변수 설정 — 코드에 hardcode 하지 말 것.
   - bash/zsh: `export PEXELS_API_KEY="<키>"`
   - PowerShell: `$env:PEXELS_API_KEY="<키>"`

# 실행
uv run --group export python AI/scripts/download_pexels_calibration.py \
    --output-dir ../FE/svelte/public/models/sixdrepnet360/calibration_hf \
    --model ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx

# 옵션
기본은 측면(L75/R75) 만 30장씩 보강. capture_calibration_frames.py 와 동일한 --target-bins
인터페이스. 기존 디렉토리 파일은 보존, 새로 받은 분만 추가.

# Pexels 의 한계
- 자연 사진이라 face crop 이 아닌 인물 전체샷 — 본 스크립트는 중앙 정사각형 crop 후 yaw 추정.
  얼굴이 frame 중앙이 아니면 yaw 추정 noise 가 커지지만, 측면 bin 으로 분류된 것만 저장하므로
  자동 필터링 효과.
- 검색 noise — "profile" 키워드 중 일부는 "career profile" / 측면 그림자 등 face 와 무관.
  같은 자동 필터로 걸러짐.
- production 분포 일치도는 자가 캡처 (capture_calibration_frames.py) 보다 떨어짐. 측면 보강
  옵션 중 자동화 선호 시 차선책.
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import time
from pathlib import Path

import numpy as np

# bin 정의 — capture/download_hf 와 동일 컨벤션.
BINS_DEG = [(-90.0, -60.0), (-60.0, -30.0), (-30.0, -10.0),
            (-10.0, 10.0),
            (10.0, 30.0), (30.0, 60.0), (60.0, 90.0)]
BIN_LABELS = ["L75", "L45", "L20", "F00", "R20", "R45", "R75"]

INPUT_SIZE = 224
INPUT_NAME = "pixel_values"
OUTPUT_NAME = "rotation_matrix"
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)

# 검색 키워드 — Pexels 는 같은 사진을 여러 키워드로 인덱싱하므로 다양한 query 가 후보 풀을 넓힘.
DEFAULT_QUERIES = [
    "side profile face portrait",
    "profile portrait person",
    "head turned sideways portrait",
    "side view face person",
    "profile photo person looking left",
    "profile photo person looking right",
]

PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
# Pexels 는 default `python-requests/x.y` User-Agent 를 차단 (봇 트래픽 방지 추정).
# 명시적인 User-Agent 가 200 응답을 받는 데 필수.
HTTP_USER_AGENT = "Mozilla/5.0 (compatible; calibration-fetcher/1.0)"


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


# 짧은 변 기준 중앙 정사각형 crop. Pexels 인물 사진은 대체로 얼굴이 frame 중앙.
def _center_square_crop(pil_image):
    w, h = pil_image.size
    short = min(w, h)
    left = (w - short) // 2
    top = (h - short) // 2
    return pil_image.crop((left, top, left + short, top + short))


def _to_input_tensor(pil_crop, Image) -> np.ndarray:
    img = pil_crop.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
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
    parser = argparse.ArgumentParser(
        description="Pexels API 로 측면 face 검색 → calibration 디렉토리에 추가"
    )
    parser.add_argument("--output-dir", type=Path, required=True, help="저장 디렉토리. 기존 파일 보존")
    parser.add_argument("--model", type=Path, required=True, help="yaw 추정용 FP32 ONNX 경로")
    parser.add_argument(
        "--target-bins",
        default="L75=30,R75=30",
        help="bin 별 추가 목표 (기본: 측면 ±60-90° 만 30장씩)",
    )
    parser.add_argument(
        "--queries",
        nargs="*",
        default=None,
        help="검색 query 들 (미지정 시 기본 6개 query 세트)",
    )
    parser.add_argument(
        "--per-page",
        type=int,
        default=80,
        help="query 당 받을 후보 수 (Pexels 최대 80)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print(
            "[error] PEXELS_API_KEY 환경변수가 비어있습니다.\n"
            "  bash/zsh:    export PEXELS_API_KEY=\"<키>\"\n"
            "  PowerShell:  $env:PEXELS_API_KEY=\"<키>\"",
            file=sys.stderr,
        )
        return 1

    targets = _parse_target_bins(args.target_bins)
    if not targets:
        print(f"[error] --target-bins 파싱 실패: {args.target_bins}", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    if not args.model.exists():
        print(f"[error] FP32 ONNX 없음: {args.model}", file=sys.stderr)
        return 1

    import onnxruntime as ort
    import requests
    from PIL import Image

    queries = args.queries if args.queries else DEFAULT_QUERIES
    headers = {"Authorization": api_key, "User-Agent": HTTP_USER_AGENT}

    print(f"[pexels] 출력: {args.output_dir}")
    print(f"[pexels] target bins: {targets}")
    print(f"[pexels] queries: {queries}")

    session = ort.InferenceSession(args.model.as_posix(), providers=["CPUExecutionProvider"])
    saved = {label: 0 for label in BIN_LABELS}
    seen = 0
    timestamp = int(time.time())

    try:
        for q_idx, query in enumerate(queries):
            if all(saved[label] >= targets[label] for label in targets):
                print("[pexels] 모든 target bin 충족 — 조기 종료")
                break

            print(f"\n[query {q_idx + 1}/{len(queries)}] '{query}'")
            try:
                resp = requests.get(
                    PEXELS_SEARCH_URL,
                    params={"query": query, "per_page": args.per_page, "orientation": "portrait"},
                    headers=headers,
                    timeout=30,
                )
                # rate limit 정보 — 25k req/month 한도.
                remaining = resp.headers.get("x-ratelimit-remaining")
                if remaining:
                    print(f"  (rate-limit remaining: {remaining})")
                resp.raise_for_status()
            except requests.HTTPError as e:
                print(f"  [error] {e} — 다음 query 로 진행", file=sys.stderr)
                continue
            except requests.RequestException as e:
                print(f"  [warn] 네트워크 오류: {e}", file=sys.stderr)
                continue

            photos = resp.json().get("photos", [])
            print(f"  {len(photos)} 장 후보")

            for photo in photos:
                seen += 1
                # medium (~350px) 면 224 리사이즈에 충분, 다운로드도 가벼움.
                img_url = photo.get("src", {}).get("medium")
                if not img_url:
                    continue
                try:
                    r = requests.get(img_url, headers={"User-Agent": HTTP_USER_AGENT}, timeout=15)
                    r.raise_for_status()
                    pil_img = Image.open(io.BytesIO(r.content))
                except Exception:
                    continue

                crop = _center_square_crop(pil_img)
                tensor = _to_input_tensor(crop, Image)
                yaw_deg = _estimate_yaw_deg(session, tensor)
                bi = _yaw_to_bin(yaw_deg)
                label = BIN_LABELS[bi]

                if label not in targets or saved[label] >= targets[label]:
                    continue

                # 224 정사각형으로 저장 (calibration loader 가 어차피 다시 224 로 리사이즈하지만
                # 디스크 사용량 절약).
                crop_224 = crop.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
                out_name = (
                    f"face_{label}_yaw{yaw_deg:+06.1f}"
                    f"_pexels_{timestamp}_{photo['id']}.jpg"
                )
                crop_224.save(args.output_dir / out_name, format="JPEG", quality=92)
                saved[label] += 1
                print(f"    saved {label} yaw={yaw_deg:+.1f}deg "
                      f"(id={photo['id']}) — {saved[label]}/{targets[label]}")

                if all(saved[label] >= targets[label] for label in targets):
                    break
    finally:
        print()
        print(f"[pexels] 검토한 후보: {seen} 장")
        print(f"[pexels] 추가 저장 분포:")
        for label, target in targets.items():
            status = "OK" if saved[label] >= target else "부족"
            print(f"  {label}: +{saved[label]:3d}/{target:3d} {status}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
