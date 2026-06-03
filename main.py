import webview
import os
import sys


def _base_dir() -> str:
    """Returns the correct base directory in both dev and PyInstaller frozen mode."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS          # Temp dir where PyInstaller extracts files
    return os.path.dirname(os.path.abspath(__file__))


# Make backend importable regardless of working directory
sys.path.insert(0, _base_dir())

from backend.api import Api


def main():
    api      = Api()
    html_path = os.path.join(_base_dir(), 'frontend', 'index.html')

    window = webview.create_window(
        title='PC Optimizer',
        url=html_path,
        js_api=api,
        width=960,
        height=640,
        min_size=(800, 560),
        resizable=True,
        background_color='#ffffff',
    )

    webview.start(debug=False)


if __name__ == '__main__':
    main()
