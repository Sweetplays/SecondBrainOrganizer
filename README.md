# 🧠 Second Brain Organizer

Aplicativo desktop que usa IA local (Ollama) para organizar suas notas no estilo Zettelkasten do Obsidian — sem internet, sem API key, sem custo.

![Second Brain Organizer](obsidian-organizer-pkg/dist/screenshot.png)

---

## Requisitos

- Windows 10/11 x64
- [Ollama](https://ollama.com/download) instalado e rodando
- Modelo de linguagem baixado (ex: `llama3`)

---

## Instalação rápida

### 1. Instale o Ollama

Baixe e instale em: https://ollama.com/download

### 2. Baixe um modelo

Abra o terminal e execute:

```bash
ollama pull llama3
```

> Modelos recomendados:
> - `llama3` — bom equilíbrio velocidade/qualidade (4.7 GB)
> - `mistral` — rápido, bom para português (4.1 GB)
> - `llama3.1:8b` — mais preciso, um pouco mais lento

### 3. Inicie o servidor Ollama

```bash
ollama serve
```

> No Windows, o Ollama normalmente já inicia automaticamente na bandeja do sistema após a instalação.

### 4. Baixe e execute o app

Vá em [Releases](https://github.com/Sweetplays/SecondBrainOrganizer/releases) ou baixe direto de [`obsidian-organizer-pkg/dist/SecondBrainOrganizer.exe`](obsidian-organizer-pkg/dist/SecondBrainOrganizer.exe).

Execute diretamente — não precisa instalar.

---

## Como usar

### Analisar uma nota

1. Abra o app
2. Clique em **Nova Nota**
3. Cole ou escreva seu texto no campo de entrada
4. Clique em **Analisar**
5. A IA vai gerar automaticamente:
   - Título descritivo
   - Categoria (TI, Saúde, Aprendizado, etc.)
   - Tags sugeridas
   - Resumo e explicação expandida
   - Pontos-chave
   - Nota formatada em Markdown pronta para o Obsidian

### Salvar no Vault

Após a análise, clique em **+ Salvar no Vault** para guardar a nota.

### Vault

Acesse todas as notas salvas pela aba **Vault**. Você pode:
- Buscar por texto ou tag
- Filtrar por categoria
- Ver conexões entre notas
- Copiar o Markdown para colar no Obsidian
- Excluir notas

### Configurações

Clique no ícone de engrenagem (canto inferior esquerdo) para:
- Alterar o host/porta do Ollama
- Escolher o modelo de IA

> **Dica:** Se aparecer "Nenhum modelo encontrado", certifique-se de que o Ollama está rodando e que o host está configurado como `127.0.0.1` (não `localhost`).

---

## Compilar do código-fonte

```bash
git clone https://github.com/Sweetplays/SecondBrainOrganizer.git
cd SecondBrainOrganizer/obsidian-organizer-pkg
npm install
npm run dist
```

O executável será gerado em `dist/SecondBrainOrganizer.exe`.

---

## Tecnologias

- [Electron](https://www.electronjs.org/) — app desktop
- [Ollama](https://ollama.com/) — execução local de LLMs
- [llama3](https://ollama.com/library/llama3) — modelo de linguagem padrão

---

## Licença

MIT
