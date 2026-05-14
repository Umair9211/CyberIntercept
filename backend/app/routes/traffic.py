from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, AnyHttpUrl
import httpx
import uuid
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import app.storage as storage

router = APIRouter()


class RepeaterRequest(BaseModel):
    method: str
    url: AnyHttpUrl
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None


class RepeaterResponse(BaseModel):
    status_code: int
    headers: Dict[str, str]
    body: str
    url: str
    elapsed: float
    error: Optional[str] = None


def _normalize_headers(headers: Optional[Dict[str, Any]]) -> Dict[str, str]:
    if not headers:
        return {}
    normalized: Dict[str, str] = {}
    for name, value in headers.items():
        if isinstance(value, list):
            normalized[name] = ", ".join(str(item) for item in value)
        else:
            normalized[name] = str(value)
    return normalized


# Hop-by-hop / framing headers from captured traffic must not be forwarded as-is:
# httpx sets Content-Length (or chunked) from `content=`; a stale Content-Length breaks h11.
_HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "proxy-connection",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "content-length",
    }
)


def _sanitize_repeater_outbound_headers(headers: Dict[str, str]) -> Dict[str, str]:
    return {
        name: value
        for name, value in headers.items()
        if name.lower() not in _HOP_BY_HOP
    }


def _is_backend_self_request(url: str) -> bool:
    parsed = urlparse(url)
    hostname = parsed.hostname
    if hostname not in {"127.0.0.1", "localhost"}:
        return False
    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme == "https" else 80
    # Prevent self-loop requests to known backend control endpoints.
    if port not in {8000, 8080}:
        return False
    return parsed.path.startswith("/api/") or parsed.path.startswith("/proxy")

@router.post("/api/traffic")
async def receive_traffic(data: dict):
    storage.captured_requests.append(data)
    print(f"\n[BACKEND] Traffic stored: {data.get('method')} {data.get('url')}")
    print(f"Total captured requests: {len(storage.captured_requests)}")
    return {
        "status": "captured"
    }

@router.post("/api/intercept")
async def create_intercept_request(data: dict):
    if not storage.intercept_mode:
        return {"intercept": False}

    request_id = uuid.uuid4().hex
    storage.pending_requests[request_id] = {
        "id": request_id,
        "method": data.get("method"),
        "url": data.get("url"),
        "host": data.get("host"),
        "headers": data.get("headers", {}),
        "body": data.get("body"),
        "status": "pending",
        "decision": "pending",
        "created_at": time.time(),
    }
    print(f"\n[BACKEND] Intercept queued: {request_id} {data.get('method')} {data.get('url')}")
    return {"intercept": True, "id": request_id}

@router.get("/api/intercept/{request_id}/decision")
async def get_intercept_decision(request_id: str):
    request = storage.pending_requests.get(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Intercept request not found")
    return {
        "id": request_id,
        "decision": request["decision"],
        "status": request["status"],
    }

@router.get("/api/requests")
async def get_requests():
    return storage.captured_requests


@router.delete("/api/requests")
async def clear_requests():
    storage.captured_requests.clear()
    storage.pending_requests.clear()
    return {"status": "cleared"}


@router.post("/api/repeater/send")
async def send_repeater_request(data: RepeaterRequest):
    if _is_backend_self_request(str(data.url)):
        return JSONResponse(
            status_code=400,
            content={
                "status_code": 400,
                "headers": {},
                "body": "",
                "url": str(data.url),
                "elapsed": 0.0,
                "error": "Repeater requests to backend control endpoints are not allowed.",
            },
        )

    request_headers = _sanitize_repeater_outbound_headers(_normalize_headers(data.headers))
    request_content = data.body.encode("utf-8") if data.body is not None else None

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.request(
                method=data.method.upper(),
                url=str(data.url),
                headers=request_headers,
                content=request_content,
            )
        except Exception as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "status_code": 502,
                    "headers": {},
                    "body": "",
                    "url": str(data.url),
                    "elapsed": 0.0,
                    "error": f"Failed to execute repeater request: {exc}",
                },
            )

    return RepeaterResponse(
        status_code=response.status_code,
        headers=dict(response.headers),
        body=response.text,
        url=str(response.url),
        elapsed=response.elapsed.total_seconds(),
        error=None,
    )