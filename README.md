# PC Optimizer

App desktop de otimização de desempenho para Windows e macOS, construído com Python + pywebview.

---

## Visão Geral

O PC Optimizer monitora o sistema em tempo real e permite ao utilizador melhorar o desempenho do computador de forma simples — encerrando processos pesados, pausando serviços desnecessários e limpando ficheiros temporários. Inclui modos pré-configurados para Gaming e Uso Diário, além de um modo totalmente personalizável.

---

## Funcionalidades

### Painel (Dashboard)
- Métricas em tempo real atualizadas a cada **1 segundo**: CPU, RAM e GPU
- Deteção automática do hardware: nome do processador, modelo da GPU, temperatura
- Secção **Armazenamento** com cards individuais por disco físico (GB livres, total e % usada)
- Atalhos rápidos para as principais ações de otimização
- Botão **Liberar RAM** — esvazia o working set de todos os processos acessíveis

### GPU Real por Plataforma
| Plataforma | Método |
|---|---|
| **Windows (NVIDIA)** | pynvml — uso % e temperatura em tempo real |
| **Windows (AMD / Intel)** | Contador perfmon `GPU Engine` — sem instalar nada extra |
| **macOS Apple Silicon** | `powermetrics` (requer sudo sem password) |

### Armazenamento — Múltiplos Discos
- Detecta automaticamente todos os discos físicos via `psutil.disk_partitions()`
- Filtra volumes do sistema no macOS (`/System/Volumes/*`) — mostra apenas discos reais
- Cada card mostra: ponto de montagem, % usada, GB livres e GB total
- Barra de progresso colorida (verde / amarelo / vermelho conforme ocupação)

### Modos de Otimização
Três modos disponíveis na sidebar, todos iniciados com o toggle **desligado** por padrão:

| Modo | O que faz |
|------|-----------|
| **Gaming** | Pausa 6 serviços em background (Spotlight, iCloud, Análise de Fotos, Sugestões Siri, CloudKit, Knowledge Agent) · Encerra processos com mais de 200 MB de RAM · Prioriza CPU e GPU |
| **Uso Diário** | Pausa indexação Spotlight · Limpa cache de aplicativos · Libera memória de processos inactivos acima de 500 MB |
| **Personalizado** | Exibe painel de configuração com checkboxes — o utilizador escolhe exatamente quais serviços pausar e ficheiros limpar |

Ao ativar Gaming ou Uso Diário, o modal **"O que vai acontecer"** abre automaticamente mostrando tudo que será feito antes de confirmar.

### Modal de Pré-Visualização
Antes de qualquer otimização, um modal apresenta:
- Lista de processos a encerrar (com CPU% e RAM, checkboxes individuais)
- Lista de serviços a pausar (checkboxes individuais)
- Ficheiros a limpar com os respetivos tamanhos
- Estimativa de RAM e espaço em disco a libertar
- Botões **Cancelar** e **Confirmar e otimizar**

### Processos
- Lista os 25 processos com maior consumo de recursos
- Ordena por CPU + RAM combinados
- Mostra PID, estado, CPU% e RAM de cada processo
- Botão **Encerrar** por processo individual com feedback visual

### Serviços do Sistema
**macOS:** Spotlight, iCloud Drive, Análise de Fotos, Sugestões Siri, CloudKit Daemon, Knowledge Agent  
**Windows:** Windows Update, Print Spooler, Windows Search, SysMain, Telemetria, Fax

- Mostra estado em tempo real (Em execução / Parado)
- Botão **Parar** por serviço com feedback imediato

### Limpeza de Ficheiros
**macOS:** Cache de Aplicativos (`~/Library/Caches`), Logs (`~/Library/Logs`), Lixeira (`~/.Trash`)  
**Windows:** Temporários do Utilizador (`%TEMP%`), Temporários do Sistema (`C:\Windows\Temp`)

- Calcula tamanhos reais via `du` (rápido)
- Cards de resumo com o total por categoria
- Limpeza individual com confirmação

### Histórico
- Regista cada otimização em `~/.pc_optimizer_history.json`
- Guarda: data/hora, modo, processos encerrados, serviços pausados, espaço libertado
- Apresenta as últimas 50 otimizações com todos os detalhes

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Interface | HTML · CSS · JavaScript |
| Janela desktop | pywebview 6.x (WebKit/WebView2) |
| Monitorização | psutil |
| GPU NVIDIA | pynvml |
| GPU AMD/Intel (Windows) | PowerShell perfmon counter |
| Serviços Windows | subprocess + PowerShell `Get-CimInstance` |
| Serviços macOS | subprocess + `launchctl` / psutil |
| Ícones | Tabler Icons (bundled localmente) |
| Distribuição | PyInstaller → `.exe` (Windows) / `.app` (macOS) |

---

## Estrutura do Projeto

```
pc-optimizer/
├── main.py                          # Entrada — inicia janela pywebview
├── requirements.txt                 # Dependências Python
├── pc_optimizer.spec                # Config PyInstaller — Windows (.exe)
├── pc_optimizer_mac.spec            # Config PyInstaller — macOS (.app)
├── build_windows.bat                # Build .exe com duplo clique
├── build_mac.sh                     # Build .app no terminal macOS
├── run.sh                           # Arranque rápido em desenvolvimento
│
├── backend/
│   ├── api.py                       # Classe exposta ao JavaScript via pywebview
│   ├── system.py                    # Métricas CPU/RAM/GPU/Discos (thread background)
│   ├── processes.py                 # Listagem e encerramento de processos
│   ├── services.py                  # Gestão de serviços (macOS + Windows)
│   ├── cleanup.py                   # Scan e limpeza de ficheiros temporários
│   ├── history.py                   # Histórico de otimizações (JSON)
│   └── optimizer.py                 # Orquestra a execução do plano de otimização
│
├── frontend/
│   ├── index.html                   # Interface principal
│   ├── css/style.css                # Estilos
│   ├── js/
│   │   ├── api.js                   # Wrapper das chamadas ao backend Python
│   │   └── app.js                   # Lógica da interface
│   └── vendor/
│       ├── tabler-icons.min.css     # Ícones (bundled — funciona offline)
│       └── fonts/                   # Ficheiros de fonte dos ícones
│
└── .github/
    └── workflows/
        └── build-windows.yml        # GitHub Actions: build .exe automático
```

---

## Como Executar

### Desenvolvimento (macOS / Windows)

```bash
# 1. Instalar dependências
pip3 install pywebview psutil

# macOS — se pip3 der erro de permissão:
pip3 install pywebview psutil --break-system-packages

# 2. Iniciar o app
python3 main.py
```

> **macOS:** recomendado instalar Python via Homebrew (`brew install python@3.12`) para evitar conflitos com o Python do sistema.

### Gerar o executável

#### Windows — duplo clique em `build_windows.bat`
O script instala as dependências automaticamente e gera `dist/PCOptimizer.exe`.

#### macOS — terminal
```bash
./build_mac.sh
# Resultado: dist/PCOptimizer.app
```

---

## Requisitos

| Plataforma | Requisitos |
|------------|------------|
| **macOS** | macOS 10.14+, Python 3.12+ (Homebrew recomendado) |
| **Windows** | Windows 10/11 (WebView2 incluído), Python 3.10+ |

### Dependências Python
```
pywebview >= 6.0
psutil    >= 5.9
pynvml    >= 11.0   # opcional — GPU NVIDIA
```

---

## Histórico de Alterações

### Fase 1 — Base e Métricas Reais
- Estrutura do projeto (backend + frontend)
- Monitorização em tempo real com thread dedicada
- Lista de processos com consumo real
- Interface fiel ao mockup original

### Fase 2 — Serviços, Limpeza, Histórico e Modal
- Página **Serviços** com serviços reais por plataforma
- Página **Limpeza** com tamanhos calculados via `du`
- Página **Histórico** persistida em JSON local
- Modal **"O que vai acontecer"** com checkboxes antes de otimizar
- Correção do toggle (usa `translateX` para rendering consistente)
- `.gitignore` para excluir `__pycache__`, `.DS_Store`, `dist/`, `build/`

### Fase 3 — Modos, Preview e Personalizado
- App inicia com todos os modos **desligados** por padrão
- Banner do modo mostra antecipadamente o que será feito (preview de ações)
- Ativar Gaming/Uso Diário abre o modal de confirmação automaticamente
- Trocar de modo reseta o toggle para OFF
- Modo **Personalizado** com painel de configuração dedicado
- Ícones Tabler bundled localmente (sem CDN — funciona offline no `.exe`)
- Pipeline GitHub Actions para build automático do `.exe` Windows

### Fase 4 — GPU Real, Múltiplos Discos, Reset de RAM e Scripts de Build
- **GPU real** por plataforma: pynvml (NVIDIA), perfmon (AMD/Intel Windows), powermetrics (Apple Silicon)
- **CPU no Windows 11** corrigida: substituído `wmic` (removido no Win 11) por `Get-CimInstance` via PowerShell
- **Múltiplos discos**: detecta e exibe todos os discos físicos com cards individuais; filtra volumes de sistema no macOS
- **Auto-refresh** reduzido de 2 s para **1 s**
- **Botão Liberar RAM**: esvazia working set de todos os processos via ctypes (Windows) ou `purge` (macOS)
- **Dashboard redesenhado**: 3 cards no topo (CPU · RAM · GPU) + secção Armazenamento separada
- **Scripts de build**: `build_windows.bat` (CRLF, duplo clique) e `build_mac.sh` com spec dedicado para `.app`

---

## Licença

Projeto pessoal de uso livre.
