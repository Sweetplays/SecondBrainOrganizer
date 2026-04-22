const CATEGORIES = {
  ti:          { label: 'TI & Tecnologia',    icon: '⚙️',  color: '#4ade80' },
  saude:       { label: 'Saúde & Bem-estar',  icon: '🌿',  color: '#34d399' },
  aprendizado: { label: 'Aprendizado',         icon: '📚',  color: '#60a5fa' },
  pensamento:  { label: 'Pensamento',          icon: '🧠',  color: '#a78bfa' },
  projeto:     { label: 'Projetos & Ideias',   icon: '🚀',  color: '#f59e0b' },
  financas:    { label: 'Finanças',            icon: '💰',  color: '#fbbf24' },
  relacoes:    { label: 'Relações & Pessoas',  icon: '🤝',  color: '#f472b6' },
  outro:       { label: 'Outro',               icon: '📎',  color: '#94a3b8' },
};

const EXAMPLE = `Hoje aprendi sobre o método Zettelkasten enquanto lia o livro "How to Take Smart Notes". A ideia principal é criar notas atômicas — cada nota contém apenas uma ideia — e linká-las entre si ao invés de organizar por pastas. Isso cria uma rede de conhecimento que cresce organicamente. Lembro que já vi isso sendo aplicado no Obsidian com o graph view. Preciso testar criar minhas notas de estudo de programação com esse método.`;

let vault = [];
let currentResult = null;

function getCat(id) { return CATEGORIES[id] || CATEGORIES.outro; }

const noteInput    = document.getElementById('noteInput');
const charCount    = document.getElementById('charCount');
const analyzeBtn   = document.getElementById('analyzeBtn');
const btnText      = document.getElementById('btnText');
const loadingDots  = document.getElementById('loadingDots');
const resultTabBtn = document.getElementById('resultTabBtn');
const vaultCount   = document.getElementById('vaultCount');
const vaultList    = document.getElementById('vaultList');
const vaultEmpty   = document.getElementById('vaultEmpty');
const vaultSearch  = document.getElementById('vaultSearch');
const vaultFilter  = document.getElementById('vaultFilter');
const noteModal    = document.getElementById('noteModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose   = document.getElementById('modalClose');
const modalCategory= document.getElementById('modalCategory');
const modalBody    = document.getElementById('modalBody');
const resultContent= document.getElementById('resultContent');

// ── Init ──────────────────────────────────────────────────────
async function init() {
  vault = await window.api.loadVault() || [];
  updateStats();
  renderVault();
  await loadSettingsUI();
}
init();

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    switchTab(btn.dataset.tab);
  });
});

function switchTab(id) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="' + id + '"]').classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
}

// ── Input ─────────────────────────────────────────────────────
noteInput.addEventListener('input', () => {
  charCount.textContent = noteInput.value.length + ' caracteres';
});
document.getElementById('useExampleBtn').addEventListener('click', () => {
  noteInput.value = EXAMPLE;
  charCount.textContent = EXAMPLE.length + ' caracteres';
});
document.getElementById('clearBtn').addEventListener('click', () => {
  noteInput.value = '';
  charCount.textContent = '0 caracteres';
});

// ── Analyze ───────────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  const note = noteInput.value.trim();
  if (!note) return;

  analyzeBtn.disabled = true;
  btnText.style.display = 'none';
  loadingDots.style.display = 'flex';

  try {
    const result = await window.api.callOllama({ note, vault });
    currentResult = { ...result, rawNote: note };
    renderResult(result);
    resultTabBtn.disabled = false;
    switchTab('result');
  } catch (e) {
    alert(e.message);
  } finally {
    analyzeBtn.disabled = false;
    btnText.style.display = 'inline';
    loadingDots.style.display = 'none';
  }
});

// ── Render Result ─────────────────────────────────────────────
function renderResult(r) {
  const cat = getCat(r.category);
  const linkedNotes = (r.links || []).map(idx => vault[idx - 1]).filter(Boolean);

  resultContent.innerHTML =
    '<div class="result-section" style="border-color:' + cat.color + '40">' +
      '<div class="category-header">' +
        '<div class="cat-icon-big" style="background:' + cat.color + '20;border:1px solid ' + cat.color + '40">' + cat.icon + '</div>' +
        '<div>' +
          '<div class="cat-name" style="color:' + cat.color + '">' + cat.label.toUpperCase() + '</div>' +
          '<div class="note-title">' + escHtml(r.title) + '</div>' +
        '</div>' +
      '</div>' +
      '<p class="summary-text">' + escHtml(r.summary || '') + '</p>' +
      (r.explanation ? '<p class="summary-text" style="margin-top:10px;color:#94a3b8">' + escHtml(r.explanation) + '</p>' : '') +
    '</div>' +

    '<div class="result-section">' +
      '<div class="result-section-label">TAGS SUGERIDAS</div>' +
      '<div class="tags-container">' + (r.tags||[]).map(t => '<span class="tag">#' + t + '</span>').join('') + '</div>' +
    '</div>' +

    (r.keyPoints?.length ?
      '<div class="result-section"><div class="result-section-label">PONTOS-CHAVE</div><div class="key-points">' +
      r.keyPoints.map(p => '<div class="key-point">' + escHtml(p) + '</div>').join('') +
      '</div></div>' : '') +

    (linkedNotes.length ?
      '<div class="result-section"><div class="result-section-label">🔗 CONEXÕES COM O VAULT</div>' +
      linkedNotes.map((n, i) => {
        const idx = r.links[i];
        return '<div class="link-item"><span class="link-bracket">[[</span><div><div class="link-title">' + escHtml(n.title) + '</div><div class="link-reason">' + escHtml(r.linkReasons?.[String(idx)] || 'Tópicos relacionados') + '</div></div></div>';
      }).join('') + '</div>' : '') +

    '<div class="result-section">' +
      '<div class="formatted-note-header">' +
        '<div class="result-section-label" style="margin-bottom:0">NOTA FORMATADA (MARKDOWN)</div>' +
        '<button class="btn-ghost" id="copyMdBtn">COPIAR</button>' +
      '</div>' +
      '<pre>' + escHtml(r.formattedNote || '') + '</pre>' +
    '</div>' +

    '<div class="result-actions">' +
      '<button class="btn-save" id="saveNoteBtn">+ SALVAR NO VAULT</button>' +
      '<button class="btn-secondary" id="newNoteBtn">NOVA NOTA</button>' +
    '</div>';

  document.getElementById('copyMdBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(r.formattedNote || '');
    document.getElementById('copyMdBtn').textContent = '✓ COPIADO';
    setTimeout(() => { document.getElementById('copyMdBtn').textContent = 'COPIAR'; }, 2000);
  });
  document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
  document.getElementById('newNoteBtn').addEventListener('click', () => {
    noteInput.value = ''; charCount.textContent = '0 caracteres';
    currentResult = null; resultTabBtn.disabled = true;
    switchTab('input');
  });
}

function saveNote() {
  if (!currentResult) return;
  vault.push({
    id: Date.now(),
    title: currentResult.title,
    category: currentResult.category,
    tags: currentResult.tags || [],
    summary: currentResult.summary,
    keyPoints: currentResult.keyPoints || [],
    links: currentResult.links || [],
    linkReasons: currentResult.linkReasons || {},
    formattedNote: currentResult.formattedNote || '',
    rawContent: currentResult.rawNote || '',
    date: new Date().toLocaleDateString('pt-BR'),
  });
  window.api.saveVault(vault);
  updateStats();
  renderVault();
  switchTab('vault');
  currentResult = null;
  resultTabBtn.disabled = true;
  noteInput.value = '';
  charCount.textContent = '0 caracteres';
}

// ── Vault ─────────────────────────────────────────────────────
function renderVault(filter, catFilter) {
  filter = filter || ''; catFilter = catFilter || '';
  const filtered = vault.filter(n => {
    const q = filter.toLowerCase();
    const matchText = !q || n.title.toLowerCase().includes(q) || (n.tags||[]).some(t => t.includes(q)) || (n.summary||'').toLowerCase().includes(q);
    return matchText && (!catFilter || n.category === catFilter);
  });

  if (vault.length === 0) {
    vaultList.innerHTML = '';
    vaultEmpty.style.display = 'block';
    return;
  }
  vaultEmpty.style.display = 'none';
  vaultList.innerHTML = filtered.map(n => {
    const cat = getCat(n.category);
    return '<div class="vault-item" data-id="' + n.id + '">' +
      '<div class="vault-cat-icon" style="background:' + cat.color + '20;border:1px solid ' + cat.color + '40">' + cat.icon + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="vault-meta">' +
          '<div class="vault-note-title">' + escHtml(n.title) + '</div>' +
          '<div class="vault-date">' + n.date + '</div>' +
        '</div>' +
        '<div class="vault-note-cat" style="color:' + cat.color + '">' + cat.label.toUpperCase() + '</div>' +
        '<div class="vault-tags">' + (n.tags||[]).map(t => '<span class="vault-tag">#' + t + '</span>').join('') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  vaultList.querySelectorAll('.vault-item').forEach(el => {
    el.addEventListener('click', () => {
      const note = vault.find(n => n.id === Number(el.dataset.id));
      if (note) openNoteModal(note);
    });
  });
}

vaultSearch.addEventListener('input', () => renderVault(vaultSearch.value, vaultFilter.value));
vaultFilter.addEventListener('change', () => renderVault(vaultSearch.value, vaultFilter.value));

// ── Note Modal ────────────────────────────────────────────────
function openNoteModal(note) {
  const cat = getCat(note.category);
  const linkedNotes = (note.links||[]).map(idx => vault[idx-1]).filter(Boolean);

  modalCategory.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="width:40px;height:40px;border-radius:9px;background:' + cat.color + '20;border:1px solid ' + cat.color + '40;display:flex;align-items:center;justify-content:center;font-size:20px">' + cat.icon + '</div>' +
      '<div>' +
        '<div style="font-size:9px;color:' + cat.color + ';letter-spacing:1.5px">' + cat.label.toUpperCase() + '</div>' +
        '<div style="font-family:Syne,sans-serif;font-size:18px;font-weight:800;color:#e2e8f0;letter-spacing:-0.3px">' + escHtml(note.title) + '</div>' +
      '</div>' +
    '</div>';

  modalBody.innerHTML =
    '<div class="modal-section"><div class="modal-section-label">DATA</div><div class="modal-summary">' + note.date + '</div></div>' +
    '<div class="modal-section"><div class="modal-section-label">RESUMO</div><div class="modal-summary">' + escHtml(note.summary||'—') + '</div></div>' +

    (note.keyPoints?.length ?
      '<div class="modal-section"><div class="modal-section-label">PONTOS-CHAVE</div><div class="key-points">' +
      note.keyPoints.map(p => '<div class="key-point">' + escHtml(p) + '</div>').join('') +
      '</div></div>' : '') +

    '<div class="modal-section"><div class="modal-section-label">TAGS</div><div class="tags-container">' +
    (note.tags||[]).map(t => '<span class="tag">#' + t + '</span>').join('') + '</div></div>' +

    (linkedNotes.length ?
      '<div class="modal-section"><div class="modal-section-label">🔗 CONEXÕES</div>' +
      linkedNotes.map((n,i) => {
        const idx = note.links[i];
        return '<div class="link-item"><span class="link-bracket">[[</span><div><div class="link-title">' + escHtml(n.title) + '</div><div class="link-reason">' + escHtml(note.linkReasons?.[String(idx)]||'Tópicos relacionados') + '</div></div></div>';
      }).join('') + '</div>' : '') +

    (note.rawContent ?
      '<div class="modal-section"><div class="modal-section-label">NOTA ORIGINAL</div>' +
      '<div class="modal-summary" style="white-space:pre-wrap;font-size:12px;color:#6b9e7a;background:#0d1a14;border:1px solid #1e3a2f;border-radius:8px;padding:14px;line-height:1.8">' +
      escHtml(note.rawContent) + '</div></div>' : '') +

    (note.formattedNote ?
      '<div class="modal-section"><div class="modal-section-label">MARKDOWN PARA OBSIDIAN</div><pre>' + escHtml(note.formattedNote) + '</pre></div>' : '');

  const existing = document.querySelector('.modal-actions');
  if (existing) existing.remove();

  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  footer.innerHTML = '<button class="btn-danger" id="deleteNoteBtn">🗑 EXCLUIR</button><button class="btn-copy" id="copyModalMdBtn">COPIAR MARKDOWN</button>';
  document.querySelector('.modal-content').appendChild(footer);

  document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
    if (!confirm('Excluir esta nota?')) return;
    vault = await window.api.deleteNote(note.id);
    closeModal(); updateStats(); renderVault();
  });
  document.getElementById('copyModalMdBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(note.formattedNote || '');
    document.getElementById('copyModalMdBtn').textContent = '✓ COPIADO';
    setTimeout(() => { document.getElementById('copyModalMdBtn').textContent = 'COPIAR MARKDOWN'; }, 2000);
  });

  noteModal.style.display = 'flex';
}

function closeModal() { noteModal.style.display = 'none'; }
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  const uniqueCats = new Set(vault.map(n => n.category)).size;
  const totalLinks = vault.reduce((acc, n) => acc + (n.links?.length||0), 0);
  document.getElementById('statNotes').textContent = vault.length;
  document.getElementById('statCats').textContent = uniqueCats;
  document.getElementById('statLinks').textContent = totalLinks;
  vaultCount.textContent = vault.length;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Settings (Ollama) ─────────────────────────────────────────
const settingsModal = document.getElementById('settingsModal');

document.getElementById('settingsBtn').addEventListener('click', async () => {
  await loadSettingsUI();
  settingsModal.style.display = 'flex';
});

document.getElementById('settingsOverlay').addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

document.getElementById('refreshModelsBtn').addEventListener('click', async () => {
  await loadModels();
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const model = document.getElementById('modelSelect').value;
  const host  = document.getElementById('ollamaHost').value.trim() || 'localhost';
  const port  = parseInt(document.getElementById('ollamaPort').value) || 11434;
  await window.api.setConfig({ ollamaModel: model, ollamaHost: host, ollamaPort: port });
  settingsModal.style.display = 'none';
  document.getElementById('currentModel').textContent = model;
});

async function loadModels() {
  const select = document.getElementById('modelSelect');
  const status = document.getElementById('modelStatus');
  select.innerHTML = '<option>Carregando...</option>';
  status.textContent = '';

  const models = await window.api.listModels();
  if (models.length === 0) {
    select.innerHTML = '<option value="">Nenhum modelo encontrado</option>';
    status.textContent = '⚠ Verifique se o Ollama está rodando';
    status.style.color = '#f59e0b';
  } else {
    const cfg = await window.api.getConfig();
    select.innerHTML = models.map(m =>
      '<option value="' + m + '"' + (m === cfg.ollamaModel ? ' selected' : '') + '>' + m + '</option>'
    ).join('');
    status.textContent = models.length + ' modelo(s) disponível(is)';
    status.style.color = '#4ade80';
  }
}

async function loadSettingsUI() {
  const cfg = await window.api.getConfig();
  document.getElementById('ollamaHost').value = cfg.ollamaHost || 'localhost';
  document.getElementById('ollamaPort').value = cfg.ollamaPort || 11434;
  document.getElementById('currentModel').textContent = cfg.ollamaModel || 'llama3';
  await loadModels();
}
