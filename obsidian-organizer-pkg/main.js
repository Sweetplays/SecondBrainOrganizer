const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DATA_FILE   = path.join(app.getPath('userData'), 'vault.json');
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function loadVault() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e){}
  return [];
}
function saveVault(vault) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(vault, null, 2)); return true; } catch(e){ return false; }
}
function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch(e){}
  return { ollamaModel: 'llama3', ollamaHost: '127.0.0.1', ollamaPort: 11434 };
}
function saveConfig(config) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch(e){}
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 780, minWidth: 800, minHeight: 600,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d1117', symbolColor: '#4ade80', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('load-vault', () => loadVault());
ipcMain.handle('save-vault', (_, vault) => saveVault(vault));
ipcMain.handle('delete-note', (_, id) => {
  const vault = loadVault().filter(n => n.id !== id);
  saveVault(vault);
  return vault;
});
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('set-config', (_, cfg) => { saveConfig({ ...loadConfig(), ...cfg }); return true; });

ipcMain.handle('list-models', () => {
  const cfg = loadConfig();
  return new Promise((resolve) => {
    const req = http.request({
      hostname: cfg.ollamaHost || 'localhost',
      port: cfg.ollamaPort || 11434,
      path: '/api/tags',
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve((JSON.parse(data).models || []).map(m => m.name)); }
        catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
});

ipcMain.handle('call-ollama', (_, { note, vault }) => {
  const cfg   = loadConfig();
  const model = cfg.ollamaModel || 'llama3';
  const host  = cfg.ollamaHost  || 'localhost';
  const port  = cfg.ollamaPort  || 11434;

  return new Promise((resolve, reject) => {
    const vaultContext = vault.length > 0
      ? '\n\nNotas existentes no vault:\n' + vault.map((n,i) =>
          '[' + (i+1) + '] Titulo: "' + n.title + '" | Tags: ' + n.tags.join(', ') + ' | Categoria: ' + n.category + '\nResumo: ' + (n.summary || n.rawContent?.substring(0,150) || '')
        ).join('\n\n')
      : '\n\nVault ainda vazio.';

    const today = new Date().toISOString().split('T')[0];

    const prompt = 'Voce e um assistente de organizacao de conhecimento no Obsidian. Analise a nota do usuario e preencha o JSON abaixo com informacoes REAIS sobre o conteudo da nota. NAO copie os valores de exemplo.\n\nJSON a preencher:\n{\n  "title": "titulo descritivo de ate 6 palavras sobre o assunto real da nota",\n  "category": "escolha uma: ti, saude, aprendizado, pensamento, projeto, financas, relacoes, outro",\n  "tags": ["palavra-chave-1", "palavra-chave-2", "palavra-chave-3"],\n  "summary": "frase curta descrevendo o que a nota diz",\n  "explanation": "explicacao detalhada em 3 a 5 frases expandindo o conceito da nota com contexto adicional relevante",\n  "keyPoints": ["conclusao importante 1", "conclusao importante 2", "conclusao importante 3"],\n  "links": [],\n  "linkReasons": {}\n}\n' + vaultContext + '\n\nNota do usuario:\n"' + note + '"\n\nRetorne SOMENTE o JSON preenchido, sem texto adicional.';

    const body = JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.2 }
    });

    const req = http.request({
      hostname: host,
      port,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.response || '';
          const clean = text.replace(/```json|```/g, '').trim();
          const result = JSON.parse(clean);
          result.formattedNote =
            '---\ntitle: ' + result.title + '\ndate: ' + today +
            '\ncategory: ' + result.category +
            '\ntags: [' + (result.tags || []).join(', ') + ']\n---\n\n' +
            '# ' + result.title + '\n\n' +
            '> ' + (result.summary || '') + '\n\n' +
            (result.explanation || '') + '\n\n' +
            '## Pontos-chave\n\n' +
            (result.keyPoints || []).map(p => '- ' + p).join('\n') + '\n\n' +
            '## Nota original\n\n' + note;
          resolve(result);
        } catch(e) {
          reject(new Error('Erro ao processar resposta do Ollama. Tente um modelo diferente.'));
        }
      });
    });

    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED')
        reject(new Error('Ollama nao esta rodando. Abra o Ollama no seu PC e tente novamente.'));
      else
        reject(e);
    });

    req.write(body);
    req.end();
  });
});

// ── Merge note (Progressive Summarization) ────────────────────
ipcMain.handle('merge-note', (_, { existingNote, newContent, vault }) => {
  const cfg   = loadConfig();
  const model = cfg.ollamaModel || 'llama3';
  const host  = cfg.ollamaHost  || 'localhost';
  const port  = cfg.ollamaPort  || 11434;

  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    const captureCount = (existingNote.captures || []).length + 2;

    const prompt =
      'Voce e um especialista em Progressive Summarization (Building a Second Brain).\n\n' +
      'O usuario esta lendo um livro/conteudo e adicionou um novo trecho a uma nota existente.\n' +
      'Seu trabalho e fazer o MERGE inteligente — densificar a nota sem perder informacao.\n\n' +
      'NOTA EXISTENTE:\n' +
      'Titulo: "' + existingNote.title + '"\n' +
      'Resumo atual: ' + (existingNote.summary || '') + '\n' +
      'Pontos-chave atuais: ' + (existingNote.keyPoints || []).join(' | ') + '\n' +
      'Tags atuais: ' + (existingNote.tags || []).join(', ') + '\n\n' +
      'NOVO CONTEUDO ADICIONADO:\n"' + newContent + '"\n\n' +
      'Retorne APENAS um JSON com o merge:\n' +
      '{\n' +
      '  "title": "titulo atualizado se necessario, ou mantenha o original",\n' +
      '  "summary": "resumo DENSO e atualizado integrando antigo + novo conteudo em 1-2 frases",\n' +
      '  "keyPoints": ["todos os insights importantes antigos + novos, sem repeticao, max 6"],\n' +
      '  "tags": ["tags antigas + novas relevantes, sem duplicatas, max 6"],\n' +
      '  "mergeNote": "explique em 1 frase o que o novo conteudo adicionou a nota"\n' +
      '}\n\n' +
      'Retorne SOMENTE o JSON.';

    const body = JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.2 }
    });

    const req = http.request({
      hostname: host,
      port,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.response || '';
          const clean = text.replace(/```json|```/g, '').trim();
          const result = JSON.parse(clean);

          // Build updated captures history
          const captures = existingNote.captures || [
            { index: 1, date: existingNote.date, content: existingNote.rawContent || '' }
          ];
          captures.push({ index: captureCount, date: today, content: newContent });

          // Rebuild formatted markdown
          result.formattedNote =
            '---\n' +
            'title: ' + result.title + '\n' +
            'date: ' + existingNote.date + '\n' +
            'updated: ' + today + '\n' +
            'category: ' + existingNote.category + '\n' +
            'tags: [' + (result.tags || []).join(', ') + ']\n' +
            'captures: ' + captures.length + '\n' +
            '---\n\n' +
            '# ' + result.title + '\n\n' +
            '> ' + (result.summary || '') + '\n\n' +
            '## Pontos-chave\n\n' +
            (result.keyPoints || []).map(p => '- ' + p).join('\n') + '\n\n' +
            '---\n\n' +
            captures.map(c =>
              '## Captura ' + c.index + ' — ' + c.date + '\n\n' + c.content
            ).join('\n\n');

          result.captures = captures;
          resolve(result);
        } catch(e) {
          reject(new Error('Erro ao processar merge. Tente novamente.'));
        }
      });
    });

    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED')
        reject(new Error('Ollama nao esta rodando.'));
      else
        reject(e);
    });

    req.write(body);
    req.end();
  });
});
