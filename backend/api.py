import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import system, processes, services, cleanup, history, optimizer


class Api:
    """Exposed to JavaScript via window.pywebview.api"""

    # ── Métricas ────────────────────────────────────────────────────────────
    def get_metrics(self):
        return system.get_all()

    # ── Processos ───────────────────────────────────────────────────────────
    def get_processes(self, limit=25):
        return processes.get_processes(int(limit))

    def kill_process(self, pid):
        return processes.kill_process(int(pid))

    # ── Serviços ────────────────────────────────────────────────────────────
    def get_services(self):
        return services.get_services()

    def stop_service(self, service_id):
        return services.stop_service(str(service_id))

    # ── Limpeza ─────────────────────────────────────────────────────────────
    def get_cleanup_items(self):
        return cleanup.get_cleanable_items()

    def clean_item(self, item_id):
        return cleanup.clean_item(str(item_id))

    # ── Histórico ───────────────────────────────────────────────────────────
    def get_history(self):
        return history.load()

    # ── RAM Reset ───────────────────────────────────────────────────────────
    def reset_ram(self):
        import platform, subprocess, psutil, os, signal
        system = platform.system()
        freed  = 0
        errors = []

        if system == 'Windows':
            # Empty working set of every accessible process via ctypes
            try:
                import ctypes
                k32 = ctypes.windll.kernel32
                PROCESS_ALL_ACCESS = 0x1F0FFF
                for proc in psutil.process_iter(['pid', 'name']):
                    try:
                        pid  = proc.info['pid']
                        before = proc.memory_info().rss
                        handle = k32.OpenProcess(PROCESS_ALL_ACCESS, False, pid)
                        if handle:
                            k32.SetProcessWorkingSetSize(handle, -1, -1)
                            k32.CloseHandle(handle)
                            try:
                                after = proc.memory_info().rss
                                freed += max(0, before - after)
                            except Exception:
                                pass
                    except Exception:
                        pass
            except Exception as e:
                errors.append(str(e))

        elif system == 'Darwin':
            try:
                result = subprocess.run(
                    ['sudo', '-n', 'purge'],
                    capture_output=True, text=True, timeout=10
                )
                if result.returncode != 0:
                    errors.append('purge requer sudo — tente manualmente')
            except Exception as e:
                errors.append(str(e))

        freed_label = (
            f'{freed / (1024**3):.1f} GB' if freed >= 1024**3 else
            f'{freed / (1024**2):.0f} MB' if freed >= 1024**2 else
            f'{freed / 1024:.0f} KB'
        )

        return {
            'success':     True,
            'freed_bytes': freed,
            'freed_label': freed_label,
            'errors':      errors,
        }

    # ── Otimizador ──────────────────────────────────────────────────────────
    def get_optimization_preview(self, mode='gaming'):
        return optimizer.get_preview(str(mode))

    def run_optimization(self, plan):
        return optimizer.run(plan)
