# -*- mode: python ; coding: utf-8 -*-
import os

# Localiza os assets JS do pywebview
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
        'webview.platforms.cocoa',
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
    [],
    exclude_binaries=True,
    name='PCOptimizer',
    debug=False,
    strip=False,
    upx=False,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name='PCOptimizer',
)

app = BUNDLE(
    coll,
    name='PCOptimizer.app',
    icon=None,
    bundle_identifier='com.pcoptimizer.app',
    info_plist={
        'NSPrincipalClass':          'NSApplication',
        'NSHighResolutionCapable':   True,
        'CFBundleDisplayName':       'PC Optimizer',
        'CFBundleShortVersionString':'1.1.0',
        'LSMinimumSystemVersion':    '10.14.0',
        'NSAppleEventsUsageDescription': 'Necessário para gerir processos do sistema.',
    },
)
