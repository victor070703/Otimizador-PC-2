import psutil
import platform
import subprocess
import threading
import copy
import time

_system = platform.system()  # 'Darwin', 'Windows', 'Linux'

_metrics = {
    'cpu':      {'percent': 0, 'model': 'Carregando...', 'cores': 0, 'threads': 0},
    'ram':      {'used_gb': 0.0, 'total_gb': 0.0, 'percent': 0},
    'gpu':      {'name': 'N/A', 'percent': 0, 'temp': 0, 'available': False},
    'disk':     {'read_mb': 0.0, 'write_mb': 0.0, 'free_gb': 0.0, 'total_gb': 0.0, 'percent': 0},
    'disks':    [],   # list of {mount, label, free_gb, total_gb, percent}
    'platform': _system,
}
_lock = threading.Lock()


def _ps(command: str, timeout: int = 5) -> str:
    """Run a PowerShell command silently in the background and return stdout stripped."""
    flags = 0
    if _system == 'Windows':
        flags = subprocess.CREATE_NO_WINDOW  # never show a terminal window
    result = subprocess.run(
        ['powershell', '-NoProfile', '-NonInteractive', '-Command', command],
        capture_output=True, text=True, timeout=timeout,
        creationflags=flags
    )
    return result.stdout.strip()


def _get_cpu_model():
    try:
        if _system == 'Darwin':
            result = subprocess.run(
                ['sysctl', '-n', 'machdep.cpu.brand_string'],
                capture_output=True, text=True, timeout=3
            )
            name = result.stdout.strip()
            if name:
                return name
            result2 = subprocess.run(
                ['sysctl', '-n', 'hw.model'],
                capture_output=True, text=True, timeout=3
            )
            return result2.stdout.strip() or 'Apple Silicon'

        elif _system == 'Windows':
            # PowerShell CIM (works on Windows 10 and 11)
            name = _ps("(Get-CimInstance Win32_Processor).Name")
            if name:
                return name
    except Exception:
        pass
    return platform.processor() or 'CPU Desconhecida'


def _get_gpu_name():
    try:
        if _system == 'Darwin':
            result = subprocess.run(
                ['system_profiler', 'SPDisplaysDataType'],
                capture_output=True, text=True, timeout=8
            )
            for line in result.stdout.splitlines():
                stripped = line.strip()
                if stripped.startswith('Chipset Model:'):
                    return stripped.split(':', 1)[1].strip()
            return 'Apple GPU'

        elif _system == 'Windows':
            # Prefer dedicated GPU (NVIDIA/AMD) over Intel integrated
            name = _ps(
                "(Get-CimInstance Win32_VideoController |"
                " Where-Object { $_.Name -notlike '*Intel*' } |"
                " Select-Object -First 1).Name"
            )
            if not name:
                # Fallback: return whatever is first
                name = _ps("(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name")
            if name:
                return name
    except Exception:
        pass
    return 'GPU'


def _try_nvidia_gpu():
    """Returns (percent, temp) for NVIDIA GPU via pynvml, or (0, 0) if unavailable."""
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util   = pynvml.nvmlDeviceGetUtilizationRates(handle)
        temp   = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        return util.gpu, temp
    except Exception:
        return 0, 0


def _try_gpu_windows_perfmon():
    """Returns (percent, 0) for any GPU (NVIDIA/AMD/Intel) via Windows perfmon counter."""
    try:
        val = _ps(
            '(Get-Counter "\\GPU Engine(*engtype_3D)\\Utilization Percentage"'
            ' -ErrorAction SilentlyContinue).CounterSamples |'
            ' Measure-Object -Property CookedValue -Sum |'
            ' Select-Object -ExpandProperty Sum',
            timeout=4
        )
        if val:
            # Handle both '26.82' and '26,82' (European locale)
            return min(100, int(float(val.replace(',', '.')))), 0
    except Exception:
        pass
    return 0, 0


def _try_apple_gpu():
    """Returns (percent, temp) for Apple Silicon GPU via powermetrics, or (0, 0) otherwise."""
    try:
        result = subprocess.run(
            ['sudo', '-n', 'powermetrics', '--samplers', 'gpu_power', '-n', '1', '-i', '500'],
            capture_output=True, text=True, timeout=3
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if 'GPU Active residency' in line or 'GPU active residency' in line:
                # line looks like: "GPU Active residency:  12.34%"
                parts = line.split(':')
                if len(parts) == 2:
                    pct = parts[1].strip().rstrip('%')
                    return int(float(pct)), 0
    except Exception:
        pass
    return 0, 0


# Initialise static info once at import time (runs in background to avoid blocking)
_cpu_model   = 'Carregando...'
_gpu_name    = 'Carregando...'
_gpu_available = False
_gpu_backend = 'none'   # 'nvidia' | 'amd_wmi' | 'apple' | 'none'


def _detect_gpu_backend():
    """Probe which GPU backend is available and return the backend name."""
    # NVIDIA via pynvml (Windows/Linux, needs driver)
    try:
        import pynvml
        pynvml.nvmlInit()
        pynvml.nvmlDeviceGetHandleByIndex(0)
        return 'nvidia'
    except Exception:
        pass
    # Any GPU on Windows via perfmon (NVIDIA/AMD/Intel — no extra packages)
    if _system == 'Windows':
        return 'perfmon'
    # Apple Silicon via passwordless sudo powermetrics
    if _system == 'Darwin':
        pct, _ = _try_apple_gpu()
        if pct >= 0:
            return 'apple'
    return 'none'


def _load_static_info():
    global _cpu_model, _gpu_name, _gpu_available, _gpu_backend
    _cpu_model  = _get_cpu_model()
    _gpu_name   = _get_gpu_name()
    _gpu_backend = _detect_gpu_backend()
    _gpu_available = _gpu_backend != 'none'
    with _lock:
        _metrics['cpu']['model'] = _cpu_model
        _metrics['gpu']['name']  = _gpu_name
        _metrics['gpu']['available'] = _gpu_available


# Warm up cpu_percent (first call always returns 0.0)
psutil.cpu_percent(interval=None)


def _update_loop():
    prev_disk_io = None
    try:
        prev_disk_io = psutil.disk_io_counters()
    except Exception:
        pass

    while True:
        try:
            cpu_pct = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()

            # Disk I/O delta
            read_mb = write_mb = 0.0
            try:
                curr_disk_io = psutil.disk_io_counters()
                if prev_disk_io and curr_disk_io:
                    read_mb = max(0.0, (curr_disk_io.read_bytes - prev_disk_io.read_bytes) / (1024 ** 2))
                    write_mb = max(0.0, (curr_disk_io.write_bytes - prev_disk_io.write_bytes) / (1024 ** 2))
                prev_disk_io = curr_disk_io
            except Exception:
                pass

            disk_path = 'C:\\' if _system == 'Windows' else '/'
            disk_usage = psutil.disk_usage(disk_path)

            # Per-disk I/O
            per_disk_io = {}
            try:
                per_disk_io = psutil.disk_io_counters(perdisk=True) or {}
            except Exception:
                pass

            # Physical disks only
            disks_list = []
            try:
                for part in psutil.disk_partitions(all=False):
                    mp = part.mountpoint

                    # macOS: skip APFS system snapshots — only keep / and external volumes
                    if _system == 'Darwin':
                        if mp.startswith('/System/Volumes/'):
                            continue
                        if mp.startswith('/private/'):
                            continue

                    # Windows: skip optical drives and unmounted
                    if _system == 'Windows':
                        if 'cdrom' in part.opts or part.fstype == '':
                            continue

                    try:
                        u = psutil.disk_usage(mp)
                        # Skip volumes smaller than 1 GB (ram disks, etc.)
                        if u.total < 1 * (1024 ** 3):
                            continue

                        label = mp.rstrip('\\').rstrip('/') or mp

                        # Try to get I/O speed for this disk
                        read_mb = 0.0
                        dev = part.device.split('/')[-1].rstrip('0123456789') if _system == 'Darwin' else part.device.replace('\\', '').replace(':', '')
                        if dev in per_disk_io:
                            # We only have cumulative bytes here; show 0 for now (delta tracked globally)
                            pass

                        disks_list.append({
                            'mount':    mp,
                            'label':    label,
                            'free_gb':  round(u.free  / (1024 ** 3), 1),
                            'total_gb': round(u.total / (1024 ** 3), 1),
                            'percent':  round(u.percent, 1),
                            'read_mb':  round(read_mb, 1),
                        })
                    except Exception:
                        pass
            except Exception:
                pass

            gpu_pct, gpu_temp = 0, 0
            if _gpu_backend == 'nvidia':
                gpu_pct, gpu_temp = _try_nvidia_gpu()
            elif _gpu_backend == 'perfmon':
                gpu_pct, gpu_temp = _try_gpu_windows_perfmon()
            elif _gpu_backend == 'apple':
                gpu_pct, gpu_temp = _try_apple_gpu()

            with _lock:
                _metrics['cpu'].update({
                    'percent': round(cpu_pct, 1),
                    'model': _cpu_model,
                    'cores': psutil.cpu_count(logical=False) or psutil.cpu_count(),
                    'threads': psutil.cpu_count(logical=True),
                })
                _metrics['ram'].update({
                    'used_gb': round(mem.used / (1024 ** 3), 1),
                    'total_gb': round(mem.total / (1024 ** 3), 0),
                    'percent': round(mem.percent, 1),
                })
                _metrics['gpu'].update({
                    'name': _gpu_name,
                    'percent': gpu_pct,
                    'temp': gpu_temp,
                    'available': _gpu_available,
                })
                _metrics['disk'].update({
                    'read_mb':  round(read_mb, 1),
                    'write_mb': round(write_mb, 1),
                    'free_gb':  round(disk_usage.free  / (1024 ** 3), 0),
                    'total_gb': round(disk_usage.total / (1024 ** 3), 0),
                    'percent':  round(disk_usage.percent, 1),
                })
                _metrics['disks'] = disks_list
        except Exception:
            pass

        time.sleep(1)


_static_thread = threading.Thread(target=_load_static_info, daemon=True)
_static_thread.start()

_monitor_thread = threading.Thread(target=_update_loop, daemon=True)
_monitor_thread.start()


def get_all():
    with _lock:
        return copy.deepcopy(_metrics)
