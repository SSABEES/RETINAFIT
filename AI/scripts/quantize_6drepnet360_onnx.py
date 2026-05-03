"""
6DRepNet360 FP32 ONNX 모델을 INT8 로 양자화한다.

산출물 두 개를 같은 디렉토리에 다른 이름으로 저장 — 원본 FP32 는 손대지 않는다.
브라우저 측에서 셋(또는 둘) 을 토글해 비교할 수 있도록 파일명 규약 통일.

# 입력 / 출력
입력: <input_dir>/6drepnet360.onnx                    (FP32, ~94MB)
출력: <input_dir>/6drepnet360.int8.dynamic.onnx       (항상 생성)
      <input_dir>/6drepnet360.int8.static.onnx        (--calibration-dir 제공 시에만)

# 실행
uv run --group export python AI/scripts/quantize_6drepnet360_onnx.py \
    --input ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx
    [--calibration-dir <face crop 이미지 디렉토리>]

# 두 가지 양자화 방식 비교
| 방식    | weight | activation | 캘리브레이션 데이터 | 브라우저 환경 효과 |
|---------|--------|------------|---------------------|--------------------|
| Dynamic | INT8   | runtime FP32→INT8 동적 | 불필요 | weight 메모리 절감만, WASM/WebGPU 에선 속도 향상 거의 없음 |
| Static  | INT8   | INT8       | 100~1000장 face crop | Conv-heavy 모델에서 1.5–2× 속도 향상 (WASM SIMD INT8 GEMM 활용) |

QDQ (QuantizeLinear/DequantizeLinear) 포맷 + per-channel weight 로 통일.
onnxruntime-web 1.20+ WASM/WebGPU 백엔드와 호환.

# 캘리브레이션 데이터 가이드
--calibration-dir 디렉토리에 face crop 이미지 (jpg/jpeg/png) 가 들어 있어야 한다.
- 224×224 가 아니어도 됨 — 로더가 BILINEAR 리사이즈
- ImageNet 정규화 (mean/std) 는 로더가 적용
- 분포가 production 입력과 비슷할수록 정확도 손실 작음
- 권장 출처: 6DRepNet360 학습 셋 (300W-LP / Panoptic) 또는 실제 사용자 카메라 프레임 추출본
- 100장 미만이면 calibration percentile 추정 분산이 커서 정확도 흔들림 — 200장 이상 권장
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import onnx
from onnxruntime.quantization import (
    CalibrationDataReader,
    QuantFormat,
    QuantType,
    quantize_dynamic,
    quantize_static,
)
from onnxruntime.quantization.shape_inference import quant_pre_process


# 학습 시점과 동일해야 하는 ImageNet 정규화 상수.
# FE/svelte/src/lib/sixdrepnet360/inference.js 의 MEAN_*/STD_* 와도 일치.
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)
INPUT_SIZE = 224
INPUT_NAME = "pixel_values"


# 캘리브레이션 이미지 디렉토리에서 jpg/jpeg/png 를 모아 224×224 로 리사이즈하고 ImageNet
# 정규화 후 Float32 [1, 3, 224, 224] 텐서를 하나씩 yield 한다. onnxruntime 의
# CalibrationDataReader 인터페이스 — get_next() 가 None 을 반환하면 종료 신호.
class FaceImageCalibrationReader(CalibrationDataReader):
    def __init__(self, image_dir: Path, max_samples: int) -> None:
        # PIL (Pillow) 은 export 그룹의 torchvision 이 transitive 로 끌고 들어온다.
        from PIL import Image

        exts = {".jpg", ".jpeg", ".png"}
        files = sorted(p for p in image_dir.iterdir() if p.suffix.lower() in exts)[:max_samples]
        if not files:
            raise FileNotFoundError(
                f"캘리브레이션 이미지 없음: {image_dir} — jpg/jpeg/png 가 들어 있어야 한다"
            )
        self._iter = (self._load(f, Image) for f in files)
        self._count = len(files)
        print(f"[calib] {self._count} 장 로드 from {image_dir}")

    @staticmethod
    def _load(path: Path, Image) -> dict:
        img = Image.open(path).convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
        arr = np.asarray(img, dtype=np.float32) / 255.0  # HWC, 0..1
        arr = arr.transpose(2, 0, 1)                      # CHW
        arr = (arr - MEAN) / STD                          # ImageNet 정규화
        return {INPUT_NAME: arr[np.newaxis, :, :, :]}     # batch dim 추가

    def get_next(self) -> dict | None:
        return next(self._iter, None)


# quant_pre_process: shape inference + symbolic shape 정리. 결과는 호출자가 unlink 책임.
#
# 플래그 선택 — 이 모델 특유의 함정들:
# - skip_optimization=True : export_6drepnet360_onnx.py 가 이미 ORT_ENABLE_EXTENDED 로
#   최적화를 베이크해둔 상태. 여기서 ORT 옵티마이저를 다시 돌리면 GatherSliceToSplitFusion 이
#   6D → rotation matrix 변환의 인덱싱 (poses[:, 0:3], poses[:, 3:6]) 을 잘못된 Split 로 fold
#   해서 ShapeInferenceError 발생. 따라서 옵티마이저는 끄고 shape 정리만 한다.
# - auto_merge=True / guess_output_rank=True : view/cat/cross_product 의 dynamic shape 가
#   SymbolicShapeInference 에서 충돌 / rank 미추론 발생 — 이 두 플래그가 자동 해소.
def _preprocess_for_quantization(input_path: Path) -> Path:
    preprocessed_path = input_path.with_suffix(".preprocessed.tmp.onnx")
    quant_pre_process(
        input_model_path=input_path.as_posix(),
        output_model_path=preprocessed_path.as_posix(),
        skip_optimization=True,
        auto_merge=True,
        guess_output_rank=True,
    )
    return preprocessed_path


# 양자화 결과 ONNX 의 value_info 를 비우고 다시 shape inference 를 돌린다.
#
# 왜 필요한가:
#   quant_pre_process 의 auto_merge=True / guess_output_rank=True 가 6D → rotation matrix
#   변환부 (view/cat/select 등) 의 일부 텐서에 잘못된 5차원 shape (예: {-1, 224, 224, -1}) 를
#   value_info 로 박아둔다. CPU EP 는 "Falling back to lenient merge" 경고만 내고 동작하지만
#   onnxruntime-web 의 WASM 백엔드는 strict 검증이라 세션 생성 자체가 실패:
#       ERROR_CODE: 6, ERROR_MESSAGE: [ShapeInferenceError] Mismatch between number of inferred
#       and declared dimensions. inferred=2 declared=5
#
# 해결: 잘못된 value_info 를 모두 제거 → onnx.shape_inference 로 정확한 shape 만 다시 채움.
# onnxruntime 은 어차피 추론 시점에 자체 shape inference 를 하므로 value_info 가 부정확한 것보다
# 비어있거나 정확한 게 낫다.
def _strip_and_reinfer_value_info(model_path: Path) -> None:
    import onnx
    from onnx.shape_inference import infer_shapes

    m = onnx.load(model_path.as_posix())
    del m.graph.value_info[:]
    m = infer_shapes(m, strict_mode=False, data_prop=False)
    onnx.save(m, model_path.as_posix())


# Dynamic PTQ — weight 만 INT8 화. activation scale 은 추론 시 동적 계산.
# per_channel=True 로 Conv 가중치를 채널별 scale 로 양자화 — ResNet 류에서 정확도 크게 향상.
#
# op_types_to_quantize 의 Conv 추가가 핵심: onnxruntime 의 quantize_dynamic 은 기본적으로
# MatMul / Gather / Transpose 등 일부 op 만 양자화하고 Conv 는 제외한다 (Conv 는 보통
# static 경로에서 처리). ResNet50 은 weight 의 99% 이상이 Conv 에 있어서 Conv 미포함 시
# 파일 크기 절감이 미미 (94MB → 70MB). 명시 포함 시 ~24MB 까지 떨어진다.
def quantize_dynamic_step(input_path: Path, output_path: Path) -> None:
    print(f"[dynamic] quantize_dynamic → {output_path.name}")
    preprocessed = _preprocess_for_quantization(input_path)
    quantize_dynamic(
        model_input=preprocessed.as_posix(),
        model_output=output_path.as_posix(),
        weight_type=QuantType.QInt8,
        per_channel=True,
        op_types_to_quantize=["Conv", "MatMul"],
        # 6D → rotation matrix 변환부의 view/cat 노드 일부가 shape inference 후에도 dtype
        # 추론이 안 되어 quantizer 가 죽는다. 모델 입력이 FP32 인 게 확실하므로 default 지정.
        extra_options={"DefaultTensorType": onnx.TensorProto.FLOAT},
    )
    preprocessed.unlink()
    # WASM strict 검증 통과를 위해 잘못된 value_info 정리 — 미실행 시 onnxruntime-web 에서
    # ShapeInferenceError 로 세션 생성 실패한다.
    _strip_and_reinfer_value_info(output_path)


# Static PTQ — activation 도 INT8. 캘리브레이션 데이터로 activation 의 min/max 분포를
# 사전에 측정해 scale/zero-point 를 베이크. WASM SIMD INT8 GEMM 을 활용하려면 이 경로 필수.
def quantize_static_step(
    input_path: Path,
    output_path: Path,
    calibration_dir: Path,
    max_samples: int,
) -> None:
    preprocessed = _preprocess_for_quantization(input_path)

    print(f"[static] quantize_static → {output_path.name}")
    reader = FaceImageCalibrationReader(calibration_dir, max_samples=max_samples)
    quantize_static(
        model_input=preprocessed.as_posix(),
        model_output=output_path.as_posix(),
        calibration_data_reader=reader,
        quant_format=QuantFormat.QDQ,
        weight_type=QuantType.QInt8,
        # WASM SIMD 는 unsigned activation INT8 GEMM 이 더 빠른 경로를 가진다.
        activation_type=QuantType.QUInt8,
        per_channel=True,
        extra_options={"DefaultTensorType": onnx.TensorProto.FLOAT},
    )
    preprocessed.unlink()
    # dynamic 과 동일 — onnxruntime-web 의 strict 검증을 위해 value_info 정리 필수.
    _strip_and_reinfer_value_info(output_path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="6DRepNet360 ONNX → INT8 양자화 (dynamic + optional static)"
    )
    parser.add_argument("--input", type=Path, required=True, help="FP32 ONNX 경로")
    parser.add_argument(
        "--calibration-dir",
        type=Path,
        default=None,
        help="static 양자화용 face crop 이미지 디렉토리. 미지정 시 dynamic 만 수행.",
    )
    parser.add_argument(
        "--max-calibration-samples",
        type=int,
        default=200,
        help="캘리브레이션에 사용할 최대 이미지 수 (기본 200)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"[error] FP32 ONNX 없음: {args.input}", file=sys.stderr)
        return 1

    fp32_size_mb = args.input.stat().st_size / 1e6
    print(f"FP32 입력: {args.input} ({fp32_size_mb:.1f} MB)")

    # Dynamic 산출 (항상 생성)
    dynamic_out = args.input.with_name(args.input.stem + ".int8.dynamic" + args.input.suffix)
    quantize_dynamic_step(args.input, dynamic_out)
    print(f"        → {dynamic_out.name} ({dynamic_out.stat().st_size / 1e6:.1f} MB)")

    # Static 산출 (옵션)
    if args.calibration_dir is None:
        print("[static] 건너뜀 — --calibration-dir 미지정")
    elif not args.calibration_dir.is_dir():
        print(f"[error] 캘리브레이션 디렉토리 없음: {args.calibration_dir}", file=sys.stderr)
        return 1
    else:
        static_out = args.input.with_name(args.input.stem + ".int8.static" + args.input.suffix)
        quantize_static_step(
            args.input, static_out, args.calibration_dir, args.max_calibration_samples
        )
        print(f"        → {static_out.name} ({static_out.stat().st_size / 1e6:.1f} MB)")

    print("\n양자화 완료. 정확도/속도 비교는 compare_6drepnet360_onnx.py 참고.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
