from pathlib import Path

from shared.constants import SUPPORTED_IMAGE_EXTENSIONS


def is_supported_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
