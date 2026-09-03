from typing import Generic, Optional, TypeVar, Any
from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class PaginationMeta(BaseModel):
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)
    total: int = Field(0, ge=0)
    total_pages: int = Field(0, ge=0)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class StandardResponse(BaseModel, Generic[DataT]):
    status: str = "success"
    data: Optional[DataT] = None
    meta: Optional[PaginationMeta] = None
    error: Optional[ErrorDetail] = None
