from pydantic import BaseModel
from typing import Literal

class TestFilePresignedRequest(BaseModel):
    type: Literal["bare", "glasses"]

class TestFilePresignedResponse(BaseModel):
    type: str
    front_url: str
    left_url: str
    right_url: str
    front_key: str
    left_key: str
    right_key: str

class VpFilePresignedRequest(BaseModel):
    glasses_no: int

class VpFilePresignedResponse(BaseModel):
    glasses_no: int
    front_url: str
    left_url: str
    right_url: str
    front_key: str
    left_key: str
    right_key: str

class RealVpFilePresignedResponse(BaseModel):
    front_url: str
    left_url: str
    right_url: str
    front_key: str
    left_key: str
    right_key: str