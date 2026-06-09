@echo off
chcp 65001 >nul
title PC Optimizer — Build Windows

echo.
echo ============================================
echo   PC Optimizer — Gerando PCOptimizer.exe
echo ============================================
echo.

:: Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado. Instale em python.org e marque "Add to PATH".
    pause
    exit /b 1
)

:: Instala/actualiza dependências
echo [1/3] Instalando dependencias...
python -m pip install pywebview psutil pyinstaller --quiet --upgrade
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

:: Limpa builds anteriores
echo [2/3] Limpando build anterior...
if exist "dist\PCOptimizer.exe" del /f /q "dist\PCOptimizer.exe"
if exist "build" rmdir /s /q "build"

:: Gera o .exe
echo [3/3] Gerando .exe (pode demorar 1-2 minutos)...
python -m PyInstaller pc_optimizer.spec --clean --noconfirm
if errorlevel 1 (
    echo.
    echo [ERRO] Build falhou. Veja o log acima.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   PRONTO!
echo   Ficheiro: dist\PCOptimizer.exe
echo ============================================
echo.

:: Abre a pasta dist automaticamente
explorer dist

pause
