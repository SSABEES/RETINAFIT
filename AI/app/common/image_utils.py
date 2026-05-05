# 현재는 no-op placeholder. 추후 EXIF 제거/리사이즈/포맷 변환 등이 필요해지면 여기서 처리.
def normalize_image_payload(image: bytes) -> bytes:
    return image
