# Cockpit — Guia de Instalação

Este documento descreve os pré-requisitos e os passos para rodar o projeto em modo de desenvolvimento com `npx tauri dev`.

---

## Pré-requisitos comuns

- **Node.js** ≥ 18 e **npm** ≥ 9
- **Rust** (instalado via `rustup`)

---

## Windows

### 1. Instalar Node.js

Baixe e instale em: https://nodejs.org

Ou via winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

### 2. Instalar Rust

```powershell
winget install Rustlang.Rustup
```

Feche e reabra o terminal para que o PATH seja atualizado. Verifique:

```powershell
cargo --version
rustc --version
```

### 3. Instalar Visual Studio Build Tools (C++ / MSVC linker)

O compilador Rust para Windows (`msvc` target) depende do linker `link.exe`, que faz parte das ferramentas de build do Visual Studio.

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

> **Alternativa manual:** acesse https://visualstudio.microsoft.com/visual-cpp-build-tools/ e instale a carga de trabalho **"Desenvolvimento para desktop com C++"**.

### 4. (Se necessário) Excluir a pasta de build do Windows Defender / App Control

Em ambientes com políticas de segurança restritivas, os binários gerados pelo Cargo podem ser bloqueados. Execute como Administrador:

```powershell
Add-MpPreference -ExclusionPath "$PWD\src-tauri\target"
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.cargo"
Add-MpPreference -ExclusionProcess "cargo.exe"
```

### 5. Instalar dependências e rodar

```powershell
cd cockpit
npm install
npx tauri dev
```

---

## macOS

### 1. Instalar Xcode Command Line Tools

```bash
xcode-select --install
```

### 2. Instalar Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 3. Instalar Node.js

Via Homebrew:

```bash
brew install node
```

Ou baixe em: https://nodejs.org

### 4. Instalar dependências e rodar

```bash
cd cockpit
npm install
npx tauri dev
```

---

## Linux (Debian/Ubuntu)

### 1. Instalar dependências de sistema

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

> Para outras distros, consulte: https://tauri.app/start/prerequisites/

### 2. Instalar Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 3. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

### 4. Instalar dependências e rodar

```bash
cd cockpit
npm install
npx tauri dev
```

---

## Verificação rápida

Antes de rodar `npx tauri dev`, confirme que todos os requisitos estão presentes:

```bash
node --version   # >= 18
npm --version    # >= 9
cargo --version  # qualquer versão estável
rustc --version
```
