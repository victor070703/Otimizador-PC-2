# PC Optimizer

App desktop de otimização de desempenho para Windows e macOS, construído com Python + pywebview.

---

## Visão Geral

O PC Optimizer monitora o sistema em tempo real e permite ao utilizador melhorar o desempenho do computador de forma simples — encerrando processos pesados, pausando serviços desnecessários e limpando ficheiros temporários. Inclui modos pré-configurados para Gaming e Uso Diário, além de um modo totalmente personalizável.

---

## Funcionalidades

### Painel (Dashboard)
- Métricas em tempo real atualizadas a cada 2 segundos: CPU, RAM, GPU e Disco
- Deteção automática do hardware: nome do processador, modelo da GPU, espaço livre
- Atalhos rápidos para as principais ações de otimização

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
| Janela desktop | pywebview 4.x (WebKit/WebView2) |
| Monitorização | psutil |
| Serviços Windows | subprocess + `sc` / PowerShell |
| Serviços macOS | subprocess + `launchctl` / psutil |
| Ícones | Tabler Icons (bundled localmente) |
| Distribuição | PyInstaller → `.exe` (Windows) / `.app` (macOS) |
| CI/CD | GitHub Actions (build Windows .exe automático) |

---

## Estrutura do Projeto

```
pc-optimizer/
├── main.py                          # Entrada — inicia janela pywebview
├── requirements.txt                 # Dependências Python
├── pc_optimizer.spec                # Configuração PyInstaller
├── run.sh                           # Script de arranque rápido (macOS/Linux)
│
├── backend/
│   ├── api.py                       # Classe exposta ao JavaScript via pywebview
│   ├── system.py                    # Métricas CPU/RAM/GPU/Disco (thread background)
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

### Desenvolvimento (macOS / Linux / Windows)

```bash
# 1. Instalar dependências
pip install pywebview psutil

# 2. Iniciar o app
python3 main.py
```

Ou usar o script incluído (macOS/Linux):
```bash
./run.sh
```

### Gerar o executável Windows (.exe)

O build é feito automaticamente pelo GitHub Actions a cada `git push` na branch `main`.  
O `.exe` fica disponível em **Releases** no repositório.

Para buildar manualmente (numa máquina Windows):
```bash
pip install pywebview psutil pyinstaller
pyinstaller pc_optimizer.spec --clean
# Resultado: dist/PCOptimizer.exe
```

---

## Requisitos

| Plataforma | Requisitos |
|------------|------------|
| **macOS** | macOS 10.14+, Python 3.9+ |
| **Windows** | Windows 10/11 (WebView2 incluído), Python 3.9+ |

---

## Histórico de Alterações

### Fase 1 — Base e Métricas Reais
- Estrutura do projeto (backend + frontend)
- Monitorização em tempo real com thread dedicada
- Lista de processos com consumo real (cache de 2 em 2 segundos)
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
- Modo **Personalizado** com painel de configuração dedicado: checkboxes de serviços e ficheiros, botão "Aplicar configuração"
- Ícones Tabler bundled localmente (sem CDN — funciona offline no `.exe`)
- Pipeline GitHub Actions para build automático do `.exe` Windows

---

## Licença

Projeto pessoal de uso livre.
