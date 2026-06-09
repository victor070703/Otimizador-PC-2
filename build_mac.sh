#!/bin/bash
set -e

echo ""
echo "============================================"
echo "  PC Optimizer — Gerando PCOptimizer.app"
echo "============================================"
echo ""

# Verifica Python
if ! command -v python3 &>/dev/null; then
    echo "[ERRO] Python3 não encontrado."
    echo "       Instala com: brew install python@3.12"
    exit 1
fi

echo "[1/3] Instalando dependências..."
pip3 install pywebview psutil pyinstaller --quiet --upgrade --break-system-packages 2>/dev/null \
  || pip3 install pywebview psutil pyinstaller --quiet --upgrade

echo "[2/3] Limpando build anterior..."
rm -rf build dist/PCOptimizer.app

echo "[3/3] Gerando .app (pode demorar 1-2 minutos)..."
pyinstaller pc_optimizer_mac.spec --clean --noconfirm

echo ""
echo "============================================"
echo "  PRONTO!"
echo "  Ficheiro: dist/PCOptimizer.app"
echo "============================================"
echo ""

# Abre a pasta dist automaticamente
open dist
