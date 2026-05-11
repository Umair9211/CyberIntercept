from mitmproxy import http
from mitmproxy import ctx, options
import requests
import time
import threading

paused_requests = {}

# Bypass any system proxy for internal backend calls
_NO_PROXY = {"http": None, "https": None}


def load(loader):
    loader.add_option(
        name="backend_ip",
        typespec=str,
        default="127.0.0.1",
        help="IP address of the backend server to send intercepted traffic to"
    )
    loader.add_option(
        name="backend_port",
        typespec=int,
        default=8000,
        help="Port number of the backend server to send intercepted traffic to"
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
            proxies=_NO_PROXY  # FIX: don't loop through mitmproxy itself
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        print(f"Failed to post to backend {path}: {exc}")
        return None


def _get_from_backend(path: str):
    try:
        response = requests.get(
            f"{_backend_base()}{path}",
            timeout=10,
            proxies=_NO_PROXY  # FIX: don't loop through mitmproxy itself
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        print(f"Failed to query backend {path}: {exc}")
        return None


def _capture_to_terminal(request_data: dict):
    print("\n" + "=" * 80)
    print(f"[CAPTURED] {request_data['method']} {request_data['url']}")
    print(f"Host: {request_data.get('host')} | Headers: {len(request_data['headers'])} headers")
    if request_data['body']:
        body_preview = request_data['body'][:200]
        print(f"Body: {body_preview}{'...' if len(request_data['body']) > 200 else ''}")
    print("=" * 80)


def _is_backend_control_request(flow: http.HTTPFlow) -> bool:
    """
    FIX: Treat ANY request to our own backend as a control request.
    The old path-prefix whitelist was incomplete — any unlisted endpoint
    (e.g. /api/requests) would get captured and cause an intercept loop.
    """
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
            decision_data = _get_from_backend(f"/api/intercept/{request_id}/decision")

            if not decision_data:
                continue

            decision = decision_data.get("decision")

            if decision == "forward":
                print(f"[INTERCEPTED] Forwarding request: {request_id}")
                try:
                    requests.post(
                        f"{_backend_base()}/api/traffic",
                        json=request_data,
                        timeout=10,
                        proxies=_NO_PROXY
                    )
                except Exception as exc:
                    print("Failed to send request:", exc)
                flow.resume()
                del paused_requests[request_id]

            elif decision == "drop":
                print(f"[INTERCEPTED] Dropping request: {request_id}")
                flow.kill()
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
        "body": flow.request.get_text(strict=False)
    }

    _capture_to_terminal(request_data)

    intercept_response = _post_to_backend("/api/intercept", request_data)
    if not intercept_response or not intercept_response.get("intercept"):
        try:
            requests.post(backend_url, json=request_data, timeout=10, proxies=_NO_PROXY)
        except Exception as exc:
            print("Failed to send request:", exc)
        return

    request_id = intercept_response.get("id")
    if not request_id:
        try:
            requests.post(backend_url, json=request_data, timeout=10, proxies=_NO_PROXY)
        except Exception as exc:
            print("Failed to send request:", exc)
        return

    print(f"[INTERCEPTED] Request paused: {request_id} {request_data['method']} {request_data['url']}")
    paused_requests[request_id] = {
        "flow": flow,
        "request_data": request_data
    }
    flow.intercept()