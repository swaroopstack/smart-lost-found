"""
Uniform error handling.

Every error leaving the API has this shape:

    {
      "detail": {
        "code": "REPORT_NOT_FOUND",
        "message": "Human readable explanation.",
        "fields": {"email": "Already registered"}   # optional
      }
    }

Raise :class:`AppError` (or one of its subclasses) anywhere in a router or
service and the handler below takes care of the HTTP response.
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

HTTP_422 = 422


class AppError(Exception):
    """Base application error carrying an HTTP status and a machine-readable code."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BAD_REQUEST"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        fields: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.__class__.__doc__ or "Request could not be processed."
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.fields = fields or {}
        super().__init__(self.message)

    def to_payload(self) -> dict[str, Any]:
        detail: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.fields:
            detail["fields"] = self.fields
        return {"detail": detail}


class NotFoundError(AppError):
    """The requested resource does not exist."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class AuthError(AppError):
    """Authentication failed."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class PermissionDeniedError(AppError):
    """You are not allowed to perform this action."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class ConflictError(AppError):
    """The request conflicts with the current state of the resource."""

    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class ValidationError(AppError):
    """One or more input fields are invalid."""

    status_code = HTTP_422
    code = "VALIDATION_ERROR"


def _error_response(
    status_code: int, code: str, message: str, fields: dict | None = None
) -> JSONResponse:
    detail: dict[str, Any] = {"code": code, "message": message}
    if fields:
        detail["fields"] = fields
    return JSONResponse(status_code=status_code, content={"detail": detail})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for err in exc.errors():
            location = ".".join(str(part) for part in err.get("loc", []) if part != "body")
            fields[location or "body"] = err.get("msg", "Invalid value")
        return _error_response(
            HTTP_422,
            "VALIDATION_ERROR",
            "One or more fields are invalid.",
            fields,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
        }.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return _error_response(exc.status_code, code, message)
