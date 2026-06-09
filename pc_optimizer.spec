# -*- mode: python ; coding: utf-8 -*-
import os, sys

# Locate pywebview's JS assets (required at runtime)
try:
    import webview
    _webview_js = os.path.join(os.path.dirname(webview.__file__), 'js')
except Exception:
    _webview_js = None

datas = [('frontend', 'frontend')]
if _webview_js and os.path.isdir(_webview_js):
    datas.append((_webview_js, 'webview/js'))

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'webview',
        'webview.platforms.edgechromium',
        'webview.platforms.winforms',
        'webview.platforms.edgehtml',
        'psutil',
        'backend',
        'backend.api',
        'backend.system',
        'backend.processes',
        'backend.services',
        'backend.cleanup',
        'backend.history',
        'backend.optimizer',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'PIL'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PCOptimizer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,           # UPX desativado — evita falsos positivos de antivírus
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    icon=None,
)
