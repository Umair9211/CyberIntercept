import threading
import time

import requests
from mitmproxy import ctx, http

paused_requests = {}

# Bypass any system proxy for internal backend calls
_NO_PROXY = {"http": None, "https": None}


def load(loader):
    loader.add_option(
        name="backend_ip",
        typespec=str,
        default="127.0.0.1",
        help="IP address of the backend server to send intercepted traffic to",
    )
    loader.add_option(
        name="backend_port",
        typespec=int,
        default=8000,
        help="Port number of the backend server to send intercepted traffic to",
    )
    resume_thread = threading.Thread(target=_resume_worker, daemon=True)
    resume_thread.start()


def _backend_base():
    return f"http://{ctx.options.backend_ip}:{ctx.options.backend_port}"


def _post_to_backend(path: str, payload: dict):
    try:
        response = requests.post(
            f"{_backend_base()}{path}",
            json=payload,
            timeout=10,
            proxies=_NO_PROXY,
        )
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


    """Return decision JSON, None on transient error, or 'gone' if backend cleared the queue (404)."""
    try:
        response = requests.get(
            f"{_backend_base()}/api/intercept/{request_id}/decision",
            timeout=10,
            proxies=_NO_PROXY,
        )
        if response.status_code == 404:
            return "gone"
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


def _is_backend_control_request(flow: http.HTTPFlow) -> bool:
    backend_hosts = {ctx.options.backend_ip, "127.0.0.1", "localhost"}
    return (
        flow.request.host in backend_hosts
        and flow.request.port == ctx.options.backend_port
    )


def _resume_worker():
    while True:
        time.sleep(0.2)
        for request_id, item in list(paused_requests.items()):
            flow = item["flow"]
            request_data = item["request_data"]
            decision_data = _get_intercept_decision(request_id)

            if decision_data is None:
                continue

            if decision_data == "gone":
                # Backend cleared pending map (e.g. intercept off) — release the flow.
                try:
                    requests.post(
                        f"{_backend_base()}/api/traffic",
                        json=request_data,
                        timeout=10,
                        proxies=_NO_PROXY,
                    )
                except Exception:
                    pass
                try:
                    flow.resume()
                except Exception:
                    pass
                del paused_requests[request_id]
                continue

            decision = decision_data.get("decision")

            if decision == "forward":
                try:
                    requests.post(
                        f"{_backend_base()}/api/traffic",
                        json=request_data,
                        timeout=10,
                        proxies=_NO_PROXY,
                    )
                except Exception:
                    pass
                try:
                    flow.resume()
                except Exception:
                    pass
                del paused_requests[request_id]

            elif decision == "drop":
                try:
                    flow.kill()
                except Exception:
                    pass
                del paused_requests[request_id]


def request(flow: http.HTTPFlow):
    if _is_backend_control_request(flow):
        return

    backend_url = f"{_backend_base()}/api/traffic"
    request_data = {
        "method": flow.request.method,
        "url": flow.request.pretty_url,
        "host": flow.request.host,
        "headers": dict(flow.request.headers),
        "body": flow.request.get_text(strict=False),
    }

    intercept_response = _post_to_backend("/api/intercept", request_data)
    if not intercept_response or not intercept_response.get("intercept"):
        try:
            requests.post(backend_url, json=request_data, timeout=10, proxies=_NO_PROXY)
        except Exception:
            pass
        return

    request_id = intercept_response.get("id")
    if not request_id:
        try:
            requests.post(backend_url, json=request_data, timeout=10, proxies=_NO_PROXY)
        except Exception:
            pass
        return

    paused_requests[request_id] = {
        "flow": flow,
        "request_data": request_data,
    }
    flow.intercept()
