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
