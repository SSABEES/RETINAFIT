"""
6DRepNet360 PyTorch 체크포인트를 ONNX 로 변환한다.

ONNX 변환 결과는 FE/svelte/public/models/sixdrepnet360/ 에 두고
브라우저(onnxruntime-web)에서 추론한다. 이 스크립트는 1회성 오프라인 도구다.

# 사전 준비
1. 가중치 파일 다운로드 (Full-Rotation 모델 — 측면 ±90도 감지에 필수):
   curl --retry 3 -L \
     "https://cloud.ovgu.de/s/TewGC9TDLGgKkmS/download/6DRepNet360_Full-Rotation_300W_LP+Panoptic.pth" \
     -o AI/scripts/6DRepNet360_Full-Rotation.pth

2. 의존성 설치 (export 그룹은 운영 서버에는 들어가지 않는다):
   cd AI && uv sync --group export

# 실행
uv run --group export python AI/scripts/export_6drepnet360_onnx.py \
  --checkpoint AI/scripts/6DRepNet360_Full-Rotation.pth \
  --output ../FE/svelte/public/models/sixdrepnet360/6drepnet360.onnx

# 백본 메모
원본 6DRepNet 은 RepVGG-B1g2 백본이라 inference reparameterization (multi-branch → single conv)
가 필요하지만, 6DRepNet360 은 ResNet50 (Bottleneck × [3,4,6,3]) 이라 그 단계가 필요 없다.

# 출력 규약
forward 가 6D → 3×3 회전행렬 변환을 모델 안에서 끝내므로 ONNX 출력은 (N, 3, 3) 회전행렬이다.
브라우저에서 Euler 변환은 atan2 3 번이면 된다 (yaw/pitch/roll 추출).

# 라이선스
모델 클래스 / 6D→회전행렬 함수는 6DRepNet360 (https://github.com/thohemp/6DRepNet360, MIT) 에서
가져왔다. 일부 헬퍼 (normalize_vector) 는 ONNX 트레이싱 호환을 위해 정리했다 — 동작은 동일.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torchvision


# ────────────────────────────────────────────────────────────────────────────────
# 6D → 회전행렬 헬퍼 (vendored, ONNX 친화 버전으로 정리)
# 원본은 torch.autograd.Variable 와 .get_device() 를 사용하지만 deprecated 되었고
# ONNX 트레이싱 시 device-specific 분기가 그래프에 박혀 추론 환경(브라우저)에서 깨진다.
# 동작은 그대로 — L2 정규화 + 외적 + Gram-Schmidt 직교화.
# ────────────────────────────────────────────────────────────────────────────────


# 행 단위 L2 정규화. 0 벡터 보호용 epsilon clamp.
def normalize_vector(v: torch.Tensor) -> torch.Tensor:
    v_mag = torch.sqrt(v.pow(2).sum(dim=1, keepdim=True))
    v_mag = torch.clamp(v_mag, min=1e-8)
    return v / v_mag


# 배치 단위 외적.
def cross_product(u: torch.Tensor, v: torch.Tensor) -> torch.Tensor:
    batch = u.shape[0]
    i = u[:, 1] * v[:, 2] - u[:, 2] * v[:, 1]
    j = u[:, 2] * v[:, 0] - u[:, 0] * v[:, 2]
    k = u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]
    return torch.cat((i.view(batch, 1), j.view(batch, 1), k.view(batch, 1)), dim=1)


# 6D 표현 → 3×3 회전행렬 (Zhou et al. 2019, On the Continuity of Rotation Representations).
def compute_rotation_matrix_from_ortho6d(poses: torch.Tensor) -> torch.Tensor:
    x_raw = poses[:, 0:3]
    y_raw = poses[:, 3:6]

    x = normalize_vector(x_raw)
    z = cross_product(x, y_raw)
    z = normalize_vector(z)
    y = cross_product(z, x)

    x = x.view(-1, 3, 1)
    y = y.view(-1, 3, 1)
    z = z.view(-1, 3, 1)
    return torch.cat((x, y, z), dim=2)


# ────────────────────────────────────────────────────────────────────────────────
# SixDRepNet360 모델 클래스 (vendored from official repo, MIT)
# 백본은 ResNet50 변형 — torchvision.models.resnet.Bottleneck + [3,4,6,3].
# forward 가 6D → 3×3 회전행렬까지 처리하므로 ONNX 출력은 행렬 (N, 3, 3).
# ────────────────────────────────────────────────────────────────────────────────


class SixDRepNet360(nn.Module):
    def __init__(self, block, layers, fc_layers: int = 1) -> None:
        self.inplanes = 64
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        self.layer1 = self._make_layer(block, 64, layers[0])
        self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
        self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
        self.layer4 = self._make_layer(block, 512, layers[3], stride=2)
        self.avgpool = nn.AvgPool2d(7)
        self.linear_reg = nn.Linear(512 * block.expansion, 6)

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                n = m.kernel_size[0] * m.kernel_size[1] * m.out_channels
                m.weight.data.normal_(0, math.sqrt(2.0 / n))
            elif isinstance(m, nn.BatchNorm2d):
                m.weight.data.fill_(1)
                m.bias.data.zero_()

    def _make_layer(self, block, planes: int, blocks: int, stride: int = 1) -> nn.Sequential:
        downsample = None
        if stride != 1 or self.inplanes != planes * block.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.inplanes, planes * block.expansion,
                          kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * block.expansion),
            )

        layers = [block(self.inplanes, planes, stride, downsample)]
        self.inplanes = planes * block.expansion
        for _ in range(1, blocks):
            layers.append(block(self.inplanes, planes))
        return nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        x = x.view(x.size(0), -1)
        x = self.linear_reg(x)
        return compute_rotation_matrix_from_ortho6d(x)


# ────────────────────────────────────────────────────────────────────────────────
# 비계 — 학습 모드 TODO 구간은 두 군데:
#   1) export_to_onnx()   torch.onnx.export 호출부
#   2) verify_export()    PyTorch 출력과 ONNX 출력을 비교하는 검증
# ────────────────────────────────────────────────────────────────────────────────


# ResNet50 구성으로 SixDRepNet360 인스턴스를 만든다.
def build_model() -> SixDRepNet360:
    return SixDRepNet360(torchvision.models.resnet.Bottleneck, [3, 4, 6, 3], fc_layers=6)


# .pth 체크포인트를 모델에 로드. 저자 배포본은 dict 형태일 수도, 순수 state_dict 일 수도 있다.
def load_checkpoint(model: nn.Module, checkpoint_path: Path) -> None:
    saved = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    state_dict = saved["model_state_dict"] if isinstance(saved, dict) and "model_state_dict" in saved else saved
    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing:
        print(f"[warn] missing keys: {len(missing)} (예: {missing[:3]})", file=sys.stderr)
    if unexpected:
        print(f"[warn] unexpected keys: {len(unexpected)} (예: {unexpected[:3]})", file=sys.stderr)


# ONNX export 시 사용할 텐서 이름. verify_export 에서 동일하게 사용해야 한다.
ONNX_INPUT_NAME = "pixel_values"
ONNX_OUTPUT_NAME = "rotation_matrix"
ONNX_OPSET = 17  # onnxruntime-web 1.20+ 호환, 모델에 신기능 op 없음


def export_to_onnx(model: nn.Module, output_path: Path) -> None:
    # batch 차원만 동적으로. H/W 는 전처리에서 224 로 고정 리사이즈하므로 굳이 동적일 이유 없음.
    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy_input,
        output_path.as_posix(),
        input_names=[ONNX_INPUT_NAME],
        output_names=[ONNX_OUTPUT_NAME],
        dynamic_axes={ONNX_INPUT_NAME: {0: "batch"}, ONNX_OUTPUT_NAME: {0: "batch"}},
        opset_version=ONNX_OPSET,
        do_constant_folding=True,
    )

    # PyTorch 2.x dynamo exporter 는 가중치를 외부 .onnx.data 파일로 분리한다.
    # 브라우저 onnxruntime-web 에서 single-file 로드가 단순하므로 inline 으로 합쳐 저장.
    import onnx
    loaded = onnx.load(output_path.as_posix(), load_external_data=True)
    onnx.save(loaded, output_path.as_posix(), save_as_external_data=False)
    sidecar = output_path.with_name(output_path.name + ".data")
    if sidecar.exists():
        sidecar.unlink()


def verify_export(checkpoint_model: nn.Module, onnx_path: Path) -> None:
    import onnxruntime as ort

    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    with torch.no_grad():
        torch_out = checkpoint_model(dummy_input).cpu().numpy()

    session = ort.InferenceSession(onnx_path.as_posix(), providers=["CPUExecutionProvider"])
    onnx_out = session.run([ONNX_OUTPUT_NAME], {ONNX_INPUT_NAME: dummy_input.numpy()})[0]

    max_abs_diff = float(np.abs(torch_out - onnx_out).max())
    print(f"      max|PyTorch − ONNX| = {max_abs_diff:.2e}")
    if max_abs_diff > 1e-4:
        print(
            f"[warn] 수치 차이가 {max_abs_diff:.2e} 로 1e-4 초과 — "
            "BatchNorm 이 학습 모드로 트레이싱됐거나 device 분기 가능성. "
            "model.eval() 호출 여부와 normalize_vector 의 device-agnostic 처리를 다시 확인.",
            file=sys.stderr,
        )


# ORT 그래프 최적화를 베이크해서 입력 파일을 덮어쓴다.
# Conv+Relu, Add+Relu, MatMul+Add 등 플랫폼 독립적 fusion 으로 노드 수가 줄어
# 브라우저 콜드 스타트 시간이 단축된다.
#
# Level 선택 — ORT_ENABLE_EXTENDED 사용 이유:
#   ORT_ENABLE_BASIC    : Constant folding, identity 제거 등 보존적 패스만.
#   ORT_ENABLE_EXTENDED : + FusedConv, FusedGemm 등 플랫폼 독립적 fusion. ← 우리 선택
#   ORT_ENABLE_ALL      : + NchwcTransformer 등 하드웨어(x86 CPU)별 레이아웃 최적화.
#                         경고: "should only be used in the same environment the model was optimized in"
#                         → onnxruntime-web (WASM / WebGPU 백엔드) 와 데스크탑 x86 CPU 는 다른 환경이라 위험.
def optimize_with_ort(onnx_path: Path) -> tuple[int, int]:
    import onnx
    import onnxruntime as ort

    before = len(onnx.load(onnx_path.as_posix()).graph.node)

    optimized_path = onnx_path.with_suffix(".onnx.opt.tmp")
    sess_options = ort.SessionOptions()
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED
    sess_options.optimized_model_filepath = optimized_path.as_posix()
    # 세션 생성 자체가 최적화를 트리거하고 optimized_model_filepath 에 저장한다.
    ort.InferenceSession(onnx_path.as_posix(), sess_options, providers=["CPUExecutionProvider"])

    after = len(onnx.load(optimized_path.as_posix()).graph.node)

    onnx_path.unlink()
    optimized_path.rename(onnx_path)
    return before, after


def main() -> int:
    parser = argparse.ArgumentParser(description="6DRepNet360 PyTorch → ONNX 변환")
    parser.add_argument("--checkpoint", type=Path, required=True, help=".pth 가중치 경로")
    parser.add_argument("--output", type=Path, required=True, help="출력 .onnx 경로")
    parser.add_argument("--skip-verify", action="store_true", help="검증 단계 건너뛰기")
    parser.add_argument(
        "--no-ort-optimize",
        action="store_true",
        help="ORT 그래프 최적화 베이크 단계 건너뛰기 (다른 ONNX 런타임과의 호환성을 유지하고 싶을 때)",
    )
    args = parser.parse_args()

    if not args.checkpoint.exists():
        print(f"[error] checkpoint not found: {args.checkpoint}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)

    total_steps = 3 if args.no_ort_optimize else 4
    step = 1

    print(f"[{step}/{total_steps}] 모델 빌드 + 체크포인트 로드: {args.checkpoint}")
    model = build_model()
    load_checkpoint(model, args.checkpoint)
    model.eval()
    step += 1

    print(f"[{step}/{total_steps}] ONNX export: {args.output}")
    export_to_onnx(model, args.output)
    step += 1

    if not args.no_ort_optimize:
        print(f"[{step}/{total_steps}] ORT 그래프 최적화 베이크 (FusedConv, FusedAdd 등)")
        before, after = optimize_with_ort(args.output)
        print(f"      노드 수: {before} → {after} ({before - after}개 감소)")
        step += 1

    if args.skip_verify:
        print(f"[{step}/{total_steps}] verify 건너뜀 (--skip-verify)")
    else:
        print(f"[{step}/{total_steps}] 검증 (PyTorch ↔ ONNX 출력 비교)")
        verify_export(model, args.output)

    print(f"\n변환 완료 → {args.output} ({args.output.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
