import os
import signal
import subprocess
import time
import psutil

proxy_process = None
proxy_port = None


def _find_listening_process(port: int):
    for conn in psutil.net_connections(kind="inet"):
        if not conn.laddr:
            continue
        if conn.laddr.port != port:
            continue
        if conn.status != psutil.CONN_LISTEN:
            continue
        if conn.pid is None:
            continue
        try:
            return psutil.Process(conn.pid)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None


def _is_mitm_process(proc: psutil.Process):
    try:
        name = proc.name().lower()
        cmdline = " ".join(proc.cmdline()).lower()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return False
    return "mitmdump" in name or "mitmproxy" in name or "mitmdump" in cmdline or "mitmproxy" in cmdline


def _terminate_process_group(pid: int):
    try:
        pgid = os.getpgid(pid)
        os.killpg(pgid, signal.SIGTERM)
    except ProcessLookupError:
        return False
    except Exception:
        return False
    return True


def start_proxy(port=8080):
    global proxy_process, proxy_port

    existing_proc = _find_listening_process(port)
    if existing_proc:
        if _is_mitm_process(existing_proc):
            return {
                "error": "Mitmproxy already running on port",
                "port": port,
                "pid": existing_proc.pid,
            }
        return {
            "error": "Another service is already listening on port",
            "port": port,
            "process": existing_proc.name(),
            "pid": existing_proc.pid,
        }

    proxy_process = subprocess.Popen(
        [
            "mitmdump",
            "-s",
            "mitm/proxy.py",
            "--listen-port",
            str(port),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid,
    )

    time.sleep(1)

    if proxy_process.poll() is not None:
        error_output = proxy_process.stderr.read().decode("utf-8", errors="ignore").strip()
        proxy_process = None
        return {
            "error": "Failed to start mitmproxy",
            "details": error_output,
        }

    proxy_port = port
    return {
        "status": "started",
        "port": port,
        "pid": proxy_process.pid,
    }


def proxy_status(default_port: int = 8080):
    """Report whether mitm is listening and which port is in use."""
    ports_to_check = []
    if proxy_port is not None:
        ports_to_check.append(proxy_port)
    if default_port not in ports_to_check:
        ports_to_check.append(default_port)

    capture_on = False
    active_port = proxy_port or default_port
    for port in ports_to_check:
        proc = _find_listening_process(port)
        if proc and _is_mitm_process(proc):
            capture_on = True
            active_port = port
            break

    return {
        "capture_on": capture_on,
        "port": active_port,
    }


def stop_proxy(port=None):
    global proxy_process, proxy_port

    if port is None:
        port = proxy_port

    if port is None:
        return {
            "error": "No port specified and no proxy is running",
        }

    # First, try to use the stored proxy_process if it's still alive
    if proxy_process and proxy_process.poll() is None:
        try:
            killed = _terminate_process_group(proxy_process.pid)
            if not killed:
                proxy_process.terminate()
            proxy_process.wait(timeout=5)
        except (subprocess.TimeoutExpired, psutil.TimeoutExpired):
            try:
                os.killpg(os.getpgid(proxy_process.pid), signal.SIGKILL)
                proxy_process.wait(timeout=5)
            except Exception as exc:
                return {
                    "error": "Failed to kill mitmproxy process",
                    "port": port,
                    "details": str(exc),
                }
        except Exception as exc:
            return {
                "error": "Failed to stop mitmproxy process",
                "port": port,
                "details": str(exc),
            }
        finally:
            proxy_process = None
            proxy_port = None

        return {
            "status": "stopped",
            "port": port,
        }

    # If stored process is dead or missing, search by port
    proc = _find_listening_process(port)
    if not proc:
        return {
            "error": "No service is listening on port",
            "port": port,
        }

    if not _is_mitm_process(proc):
        return {
            "error": "Port is occupied by another service",
            "port": port,
            "process": proc.name(),
            "pid": proc.pid,
        }

    if proc.pid == os.getpid():
        return {
            "error": "Cannot stop current Python process",
            "port": port,
        }

    killed = _terminate_process_group(proc.pid)
    if not killed:
        try:
            proc.terminate()
        except Exception as exc:
            return {
                "error": "Failed to stop mitmproxy process",
                "port": port,
                "details": str(exc),
            }

    try:
        proc.wait(timeout=5)
    except (psutil.TimeoutExpired, subprocess.TimeoutExpired):
        try:
            _terminate_process_group(proc.pid)
            os.kill(proc.pid, signal.SIGKILL)
        except Exception as exc:
            return {
                "error": "Failed to kill mitmproxy process",
                "port": port,
                "details": str(exc),
            }

    if proxy_process and proxy_process.pid == proc.pid:
        proxy_process = None
        proxy_port = None

    return {
        "status": "stopped",
        "port": port,
        "pid": proc.pid,
    }
