from fastapi import APIRouter, HTTPException
import app.storage as storage
from app.services.proxy_manager import start_proxy, stop_proxy

router = APIRouter(prefix="/proxy")

@router.get("/start")
def start(port: int = 8080):
    return start_proxy(port)

@router.get("/stop")
def stop(port: int = None):
    return stop_proxy(port)

@router.post("/intercept/on")
def intercept_on():
    storage.intercept_mode = True
    return {"status": "intercept_on"}

@router.post("/intercept/off")
def intercept_off():
    storage.intercept_mode = False
    forced = 0
    for item in storage.pending_requests.values():
        if item["decision"] == "pending":
            item["decision"] = "forward"
            item["status"] = "forwarded"
            forced += 1
    return {"status": "intercept_off", "forwarded": forced}

@router.get("/intercept/pending")
def intercept_pending():
    return [
        {
            "id": request_id,
            "method": request["method"],
            "url": request["url"],
            "host": request["host"],
            "status": request["status"],
        }
        for request_id, request in storage.pending_requests.items()
        if request["status"] == "pending"
    ]

@router.post("/intercept/forward/{request_id}")
def intercept_forward(request_id: str):
    # "all" → forward every pending request
    if request_id == "all":
        count = 0
        for req in storage.pending_requests.values():
            if req["decision"] == "pending":
                req["decision"] = "forward"
                req["status"] = "forwarded"
                count += 1
        return {"status": "forwarded_all", "count": count}

    request = storage.pending_requests.get(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Pending request not found")
    if request["decision"] != "pending":
        return {"status": request["status"], "id": request_id}
    request["decision"] = "forward"
    request["status"] = "forwarded"
    return {"status": "forwarded", "id": request_id}


@router.post("/intercept/drop/{request_id}")
def intercept_drop(request_id: str):
    # "all" → drop every pending request
    if request_id == "all":
        count = 0
        for req in storage.pending_requests.values():
            if req["decision"] == "pending":
                req["decision"] = "drop"
                req["status"] = "dropped"
                count += 1
        return {"status": "dropped_all", "count": count}

    request = storage.pending_requests.get(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Pending request not found")
    if request["decision"] != "pending":
        return {"status": request["status"], "id": request_id}
    request["decision"] = "drop"
    request["status"] = "dropped"
    return {"status": "dropped", "id": request_id}