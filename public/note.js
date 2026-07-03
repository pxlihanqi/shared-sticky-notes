const params = new URLSearchParams(window.location.search);
const noteId = params.get('id');
const SERVER = params.get('server') || window.location.origin;
const COLORS = ['#ffeb3b', '#ffc107', '#ff9800', '#ff7043', '#e91e63', '#f48fb1', '#4caf50', '#8bc34a', '#009688', '#00bcd4', '#2196f3', '#3f51b5', '#9c27b0', '#795548', '#607d8b', '#ffffff'];

// 主题预设
const THEMES = [
  { id: 'cyberpink', label: '赛博粉', bg: '#1a0a1e', text: '#ff6ec7', shadow: 'rgba(255,110,199,0.4)', glow: '0 0 15px rgba(255,110,199,0.3)', accent: '#00ffff', font: '' },
  { id: 'cyberblue', label: '赛博蓝', bg: '#0a0e27', text: '#00d4ff', shadow: 'rgba(0,212,255,0.4)', glow: '0 0 15px rgba(0,212,255,0.3)', accent: '#ff00ff', font: '' },
  { id: 'solarized', label: 'Solarized', bg: '#002b36', text: '#839496', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#b58900', font: '' },
  { id: 'matrix', label: '矩阵', bg: '#000000', text: '#00ff41', shadow: 'rgba(0,255,65,0.3)', glow: '0 0 12px rgba(0,255,65,0.25)', accent: '#00ff41', font: '' },
  { id: 'terminal', label: '终端', bg: '#1e1e1e', text: '#4ec9b0', shadow: 'rgba(78,201,176,0.3)', glow: '0 0 10px rgba(78,201,176,0.2)', accent: '#dcdcaa', font: 'Consolas,Monaco,monospace' },
  { id: 'dracula', label: 'Dracula', bg: '#282a36', text: '#f8f8f2', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#bd93f9', font: '' },
  { id: 'nord', label: 'Nord', bg: '#2e3440', text: '#d8dee9', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#88c0d0', font: '' },
  { id: 'tokyonight', label: 'Tokyo Night', bg: '#1a1b26', text: '#a9b1d6', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#7aa2f7', font: '' },
  { id: 'gruvbox', label: 'Gruvbox', bg: '#282828', text: '#ebdbb2', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#d65d0e', font: '' },
  { id: 'rose', label: 'Rose Pine', bg: '#191724', text: '#e0def4', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#eb6f92', font: '' },
  { id: 'ocean', label: 'Ocean', bg: '#0f2027', text: '#8ec8c8', shadow: 'rgba(0,0,0,0.5)', glow: '', accent: '#38b2ac', font: '' },
];
let currentNote = null;
let activeTextarea = null;
let authCode = null; // 客户端验证码

// 加载验证码配置
async function loadAuthCode() {
  if (window.electronAPI) {
    const cfg = await window.electronAPI.getConfig();
    authCode = cfg.clientAuthCode || null;
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem('stickyNotesConfig') || '{}');
      authCode = saved.clientAuthCode || null;
    } catch {}
  }
}

// 获取带验证码的请求头
function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (authCode) {
    headers['X-Auth-Code'] = authCode;
  }
  return headers;
}

// 解析图片便签的 content，统一返回 URL 数组（兼容旧的单 URL 字符串格式）
function parseImageList(content) {
  if (!content) return [];
  try {
    const arr = JSON.parse(content);
    if (Array.isArray(arr)) return arr.filter(Boolean);
  } catch {}
  // 旧格式：单个 URL 字符串
  return [content];
}

// 把 URL 转成完整地址
function fullImageUrl(url) {
  return url.startsWith('http') ? url : `${SERVER}${url}`;
}

async function loadNote() {
  try {
    await loadAuthCode();
    const res = await fetch(`${SERVER}/api/notes`, { headers: getAuthHeaders() });
    if (res.status === 401) {
      alert('验证码错误或缺失，请在设置中输入正确的验证码');
      return;
    }
    const notes = await res.json();
    currentNote = notes.find(n => n.id === noteId);
    if (currentNote) renderNote();
  } catch (e) {}
}

// 字体大小调整
const FONT_SIZE_MIN = 9;
const FONT_SIZE_MAX = 40;
const FONT_SIZE_DEFAULT = 13;

function changeFontSize(delta) {
  if (!currentNote) return;
  const current = currentNote.fontSize || FONT_SIZE_DEFAULT;
  const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, current + delta));
  if (next === current) return;
  currentNote.fontSize = next;
  const textarea = document.querySelector('.note-content');
  if (textarea) textarea.style.fontSize = next + 'px';
  whSyncFont();
  fetch(`${SERVER}/api/notes/${noteId}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fontSize: next }),
  });
}

function resetFontSize() {
  if (!currentNote) return;
  currentNote.fontSize = FONT_SIZE_DEFAULT;
  const textarea = document.querySelector('.note-content');
  if (textarea) textarea.style.fontSize = FONT_SIZE_DEFAULT + 'px';
  whSyncFont();
  fetch(`${SERVER}/api/notes/${noteId}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fontSize: FONT_SIZE_DEFAULT }),
  });
}

// ============ 任务清单 ============

function genItemId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function saveChecklist(items) {
  const content = JSON.stringify(items);
  currentNote.content = content;
  fetch(`${SERVER}/api/notes/${noteId}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
}

function renderChecklist(body, items) {
  const done = items.filter(i => i.checked).length;
  const total = items.length;
  body.innerHTML = `
    <div class="checklist">
      <div class="checklist-header">
        <span class="checklist-progress">${total > 0 ? done + '/' + total : '空清单'}</span>
      </div>
      <div class="checklist-items">
        ${items.map((item, idx) => `
          <div class="checklist-item${item.checked ? ' checked' : ''}" data-id="${item.id}" data-index="${idx}" draggable="true">
            <span class="checklist-drag" title="拖动排序">⠿</span>
            <label class="checklist-checkbox">
              <input type="checkbox" ${item.checked ? 'checked' : ''}>
              <span class="checklist-checkmark"></span>
            </label>
            <span class="checklist-text">${escapeHTML(item.text)}</span>
            <button class="checklist-del" title="删除"><i class="ph ph-x"></i></button>
          </div>
        `).join('')}
      </div>
      <div class="checklist-add">
        <textarea class="checklist-input" placeholder="添加任务（支持批量，每行一个）" rows="1"></textarea>
        <button class="checklist-add-btn"><i class="ph ph-plus"></i></button>
      </div>
    </div>
  `;

  // 勾选/取消
  body.querySelectorAll('.checklist-checkbox input').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const itemEl = e.target.closest('.checklist-item');
      const id = itemEl.dataset.id;
      const item = items.find(i => i.id === id);
      if (item) {
        item.checked = e.target.checked;
        itemEl.classList.toggle('checked', item.checked);
        saveChecklist(items);
        body.querySelector('.checklist-progress').textContent = items.filter(i => i.checked).length + '/' + total;
      }
    });
  });

  // 双击编辑
  body.querySelectorAll('.checklist-text').forEach(el => {
    el.addEventListener('dblclick', () => {
      const itemEl = el.closest('.checklist-item');
      const id = itemEl.dataset.id;
      const item = items.find(i => i.id === id);
      if (!item) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'checklist-edit';
      input.value = item.text;
      el.replaceWith(input);
      input.focus();
      input.select();
      function commit() {
        const newText = input.value.trim();
        if (newText && newText !== item.text) {
          item.text = newText;
          saveChecklist(items);
        }
        renderChecklist(body, items);
      }
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = item.text; input.blur(); }
      });
    });
  });

  // 删除
  body.querySelectorAll('.checklist-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.checklist-item').dataset.id;
      const idx = items.findIndex(i => i.id === id);
      if (idx !== -1) items.splice(idx, 1);
      saveChecklist(items);
      renderChecklist(body, items);
    });
  });

  // 拖动排序
  let dragId = null;
  body.querySelectorAll('.checklist-item').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      dragId = el.dataset.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      body.querySelectorAll('.checklist-item').forEach(i => i.classList.remove('drag-over'));
      dragId = null;
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (el.dataset.id === dragId) return;
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const fromIdx = items.findIndex(i => i.id === dragId);
      const toIdx = items.findIndex(i => i.id === el.dataset.id);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      saveChecklist(items);
      renderChecklist(body, items);
    });
  });

  // 添加新任务
  const input = body.querySelector('.checklist-input');
  const addBtn = body.querySelector('.checklist-add-btn');
  function addItem() {
    const lines = input.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    lines.forEach(text => items.push({ id: genItemId(), text, checked: false }));
    input.value = '';
    saveChecklist(items);
    renderChecklist(body, items);
  }
  addBtn.addEventListener('click', addItem);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addItem();
    }
  });
}

function renderNote() {
  const card = document.getElementById('noteCard');
  const theme = currentNote.theme ? THEMES.find(t => t.id === currentNote.theme) : null;
  if (theme) {
    card.style.background = theme.bg;
    card.style.color = theme.text;
    card.style.boxShadow = theme.glow || '0 4px 20px rgba(0,0,0,0.35)';
    card.style.border = `1px solid ${theme.accent}33`;
    card.dataset.theme = theme.id;
  } else {
    card.style.background = currentNote.color;
    card.style.color = isLight(currentNote.color) ? '#333' : '#fff';
    card.style.boxShadow = '';
    card.style.border = '';
    card.dataset.theme = '';
  }
  card.style.opacity = String(currentNote.opacity ?? 1);
  const body = document.getElementById('noteBody');

  if (currentNote.type === 'text') {
    let textContent = currentNote.content;
    let imageUrls = [];
    try {
      const parsed = JSON.parse(currentNote.content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'text' in parsed) {
        textContent = parsed.text || '';
        imageUrls = Array.isArray(parsed.images) ? parsed.images : [];
      }
    } catch {}
    body.innerHTML = `<textarea class="note-content" placeholder="输入内容..." spellcheck="false">${escapeHTML(textContent)}</textarea>` +
      (imageUrls.length > 0 ? `<div class="note-images">${imageUrls.map((url, i) => `
        <div class="note-image-item">
          <img class="note-image" src="${escapeHTML(fullImageUrl(url))}" alt="图片" data-url="${escapeHTML(url)}">
          <button class="img-del-btn" data-index="${i}" title="删除这张图片"><i class="ph ph-x"></i></button>
        </div>
      `).join('')}</div>` : '');
    const textarea = body.querySelector('textarea');
    activeTextarea = textarea;
    let saveTimer;
    textareaDirty = false;
    textarea.addEventListener('input', () => {
      textareaDirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { saveContent(textarea.value); }, 500);
    });
    // 应用已保存的字体大小
    const savedFontSize = currentNote.fontSize || 13;
    textarea.style.fontSize = savedFontSize + 'px';
    // 装配「选中词高亮」层
    setupWordHighlight(textarea);
    // 添加快捷键支持
    textarea.addEventListener('keydown', (e) => {
      // Ctrl+A / Cmd+A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.stopPropagation();
      }
      // Ctrl+C / Cmd+C 复制
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.stopPropagation();
      }
      // Ctrl+V / Cmd+V 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.stopPropagation();
      }
      // Ctrl+X / Cmd+X 剪切
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.stopPropagation();
      }
      // Ctrl+Z / Cmd+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.stopPropagation();
      }
      // Ctrl+S / Cmd+S 保存到本地
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToLocal(textarea.value);
      }
      // Ctrl++ 放大字体
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        changeFontSize(1);
      }
      // Ctrl+- 缩小字体
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        changeFontSize(-1);
      }
      // Ctrl+0 重置字体
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetFontSize();
      }
      // Ctrl+F / Cmd+F 查找替换
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleFindReplacePanel();
      }
    });
    // 文本便签中的图片事件
    body.querySelectorAll('.note-image').forEach(img => {
      img.addEventListener('click', () => showImagePreview(img.src));
    });
    body.querySelectorAll('.img-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteImageAt(parseInt(btn.dataset.index, 10));
      });
    });
  } else if (currentNote.type === 'image') {
    activeTextarea = null;
    const images = parseImageList(currentNote.content);
    body.innerHTML = `<div class="note-images">${images.map((url, i) => `
      <div class="note-image-item">
        <img class="note-image" src="${escapeHTML(fullImageUrl(url))}" alt="图片" data-url="${escapeHTML(url)}">
        <button class="img-del-btn" data-index="${i}" title="删除这张图片"><i class="ph ph-x"></i></button>
      </div>
    `).join('')}</div>`;
    // 点击图片预览
    body.querySelectorAll('.note-image').forEach(img => {
      img.addEventListener('click', () => showImagePreview(img.src));
    });
    // 删除单张图片
    body.querySelectorAll('.img-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteImageAt(parseInt(btn.dataset.index, 10));
      });
    });
  } else if (currentNote.type === 'file') {
    activeTextarea = null;
    try {
      const files = JSON.parse(currentNote.content);
      body.innerHTML = files.map(f => {
        const fileUrl = f.url.startsWith('http') ? f.url : `${SERVER}${f.url}`;
        return `
          <a class="note-file" href="${escapeHTML(fileUrl)}" target="_blank" download="${escapeHTML(f.originalName)}">
            <span class="note-file-icon"><i class="ph ph-file-text"></i></span>
            <div class="note-file-info">
              <div class="note-file-name">${escapeHTML(f.originalName)}</div>
              <div class="note-file-size">${formatFileSize(f.size)}</div>
            </div>
          </a>
        `;
      }).join('');
    } catch {
      body.innerHTML = `<div class="note-content">${escapeHTML(currentNote.content)}</div>`;
    }
  } else if (currentNote.type === 'checklist') {
    activeTextarea = null;
    let items = [];
    try { items = JSON.parse(currentNote.content); } catch {}
    if (!Array.isArray(items)) items = [];
    renderChecklist(body, items);
  }
}

function createChecklistNote() {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const data = { type: 'checklist', content: '[]', color };
  if (window.electronAPI) {
    window.electronAPI.createNote(data);
  } else {
    fetch(`${SERVER}/api/notes`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
  }
}

function setupDrag() {
  const card = document.getElementById('noteCard');
  let isDragging = false, didMove = false, startX, startY, savedWidth, savedHeight;
  const SNAP_THRESHOLD = 15;
  function snapToEdge() {
    const x = window.screenX, y = window.screenY;
    const w = window.outerWidth, h = window.outerHeight;
    const sw = window.screen.availWidth, sh = window.screen.availHeight;
    const sx = window.screen.availLeft || 0, sy = window.screen.availTop || 0;
    let snapX = x, snapY = y;
    if (x - sx < SNAP_THRESHOLD) snapX = sx;
    else if (sx + sw - (x + w) < SNAP_THRESHOLD) snapX = sx + sw - w;
    if (y - sy < SNAP_THRESHOLD) snapY = sy;
    else if (sy + sh - (y + h) < SNAP_THRESHOLD) snapY = sy + sh - h;
    if (snapX !== x || snapY !== y) window.moveTo(snapX, snapY);
  }
  card.addEventListener('mousedown', (e) => {
    if (e.target.closest('.note-ops') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('.color-picker') || e.target.closest('.toolbox') || e.target.closest('.resize-handle') || e.target.closest('a') || e.target.closest('.checklist-item')) return;
    isDragging = true;
    didMove = false;
    startX = e.screenX;
    startY = e.screenY;
    savedWidth = window.outerWidth;
    savedHeight = window.outerHeight;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.screenX - startX, dy = e.screenY - startY;
    if (!didMove && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) didMove = true;
    window.moveTo(window.screenX + dx, window.screenY + dy);
    if (window.outerWidth !== savedWidth || window.outerHeight !== savedHeight) {
      window.resizeTo(savedWidth, savedHeight);
    }
    startX = e.screenX; startY = e.screenY;
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      if (didMove) {
        window.resizeTo(savedWidth, savedHeight);
        snapToEdge();
      }
    }
    isDragging = false;
    didMove = false;
  });
}

function setupOps() {
  let isResizing = false, startX, startY, startW, startH;
  const card = document.getElementById('noteCard');
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.style.opacity = '0.4';
  card.appendChild(handle);
  handle.addEventListener('mousedown', (e) => {
    isResizing = true; startX = e.screenX; startY = e.screenY;
    startW = window.outerWidth; startH = window.outerHeight; e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    window.resizeTo(Math.max(180, startW + e.screenX - startX), Math.max(120, startH + e.screenY - startY));
  });
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      // 工具箱展开时窗口被临时加宽，存库时需扣除该部分
      const offset = (toolboxPanel && window.electronAPI) ? TOOLBOX_WIDTH : 0;
      fetch(`${SERVER}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ width: window.outerWidth - offset, height: window.outerHeight }),
      });
    }
  });
}

document.getElementById('addBtn').addEventListener('click', () => {
  if (window.electronAPI) {
    window.electronAPI.createNote();
  } else {
    fetch(`${SERVER}/api/notes`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ type: 'text', color: COLORS[Math.floor(Math.random() * COLORS.length)] }),
    });
  }
});

// ============ 搜索便签 ============

let searchPanel = null;

function toggleSearchPanel() {
  if (searchPanel) {
    searchPanel.classList.remove('show');
    setTimeout(() => { if (searchPanel) { searchPanel.remove(); searchPanel = null; } }, 300);
    return;
  }

  searchPanel = document.createElement('div');
  searchPanel.className = 'search-panel';
  searchPanel.innerHTML = `
    <div class="sp-header">
      <span class="sp-title"><i class="ph ph-magnifying-glass"></i> 搜索便签</span>
      <button class="sp-close" title="关闭"><i class="ph ph-x"></i></button>
    </div>
    <input class="sp-input" type="text" placeholder="输入关键词搜索...">
    <div class="sp-results"></div>
  `;

  const input = searchPanel.querySelector('.sp-input');
  const results = searchPanel.querySelector('.sp-results');

  async function doSearch(query) {
    if (!query.trim()) { results.innerHTML = ''; return; }
    try {
      const res = await fetch(`${SERVER}/api/notes`, { headers: getAuthHeaders() });
      const notes = await res.json();
      const q = query.toLowerCase();
      function getSearchableText(n) {
        if (n.type === 'text') {
          try {
            const parsed = JSON.parse(n.content);
            if (parsed && typeof parsed === 'object' && 'text' in parsed) return parsed.text || '';
          } catch {}
        }
        return n.content || '';
      }
      const matched = notes.filter(n => getSearchableText(n).toLowerCase().includes(q));
      if (matched.length === 0) {
        results.innerHTML = '<div class="sp-empty">未找到匹配的便签</div>';
        return;
      }
      results.innerHTML = matched.map(n => {
        const typeIcon = { text: '<i class="ph ph-note"></i>', image: '<i class="ph ph-image"></i>', file: '<i class="ph ph-file-text"></i>' }[n.type] || '<i class="ph ph-note"></i>';
        const text = getSearchableText(n);
        const preview = escapeHTML(text).replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`).slice(0, 100);
        return `<div class="sp-item" data-id="${n.id}" style="background:${n.color};color:${isLight(n.color)?'#333':'#fff'}">
          <span class="sp-item-icon">${typeIcon}</span>
          <div class="sp-item-content">${preview}</div>
        </div>`;
      }).join('');

      results.querySelectorAll('.sp-item').forEach(item => {
        item.addEventListener('click', () => {
          if (window.electronAPI) {
            window.electronAPI.focusNote(item.dataset.id);
          }
        });
      });
    } catch (e) {
      results.innerHTML = '<div class="sp-empty">搜索失败</div>';
    }
  }

  let searchTimer;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(input.value), 300);
  });

  searchPanel.querySelector('.sp-close').addEventListener('click', toggleSearchPanel);
  document.body.appendChild(searchPanel);
  setTimeout(() => { searchPanel.classList.add('show'); input.focus(); }, 10);
}

// ============ Monaco 编辑器（新窗口） ============

function openMonacoEditor() {
  if (!currentNote || currentNote.type !== 'text') {
    alert('仅文本便签支持 Monaco 编辑器');
    return;
  }
  const editorUrl = `monaco-editor.html?id=${encodeURIComponent(noteId)}&server=${encodeURIComponent(SERVER)}` +
    (authCode ? `&auth=${encodeURIComponent(authCode)}` : '');
  window.open(editorUrl, '_blank', 'width=960,height=700,noopener=yes');
}

// ============ 文件互传面板 ============

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function openFileTransfer() {
  const existing = document.getElementById('fileTransferPanel');
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.id = 'fileTransferPanel';
  panel.className = 'find-replace';
  panel.style.width = '320px';
  panel.style.maxHeight = '70vh';
  panel.innerHTML = `
    <div class="fr-header">
      <span class="fr-title"><i class="ph ph-folder"></i> 文件互传</span>
      <div style="display:flex;gap:4px;">
        <button class="fr-close ft-refresh-btn" title="刷新"><i class="ph ph-arrows-clockwise"></i></button>
        <button class="fr-close" title="关闭"><i class="ph ph-x"></i></button>
      </div>
    </div>
    <div class="fr-row" style="margin-bottom:8px;">
      <button class="ft-upload-btn" style="flex:1;background:rgba(33,150,243,0.6);border:1px solid rgba(33,150,243,0.8);color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;"><i class="ph ph-folder-open"></i> 选择文件上传</button>
    </div>
    <div class="ft-progress" style="display:none;margin-bottom:8px;">
      <div style="font-size:11px;color:#aaa;margin-bottom:4px;" class="ft-progress-text"></div>
      <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
        <div class="ft-progress-bar" style="height:100%;width:0%;background:rgba(33,150,243,0.8);border-radius:2px;transition:width 0.2s;"></div>
      </div>
    </div>
    <div class="ft-list" style="overflow-y:auto;max-height:50vh;"></div>
  `;

  const listEl = panel.querySelector('.ft-list');
  const progressEl = panel.querySelector('.ft-progress');
  const uploadBtn = panel.querySelector('.ft-upload-btn');

  async function loadFiles() {
    try {
      const res = await fetch(`${SERVER}/api/files`, { headers: getAuthHeaders() });
      const files = await res.json();
      if (files.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#888;font-size:12px;padding:20px 0;">暂无文件</div>';
        return;
      }
      listEl.innerHTML = files.map(f => {
        const url = `${SERVER}/uploads/${encodeURIComponent(f.name)}`;
        const displayName = f.originalName || f.name;
        return `
          <div class="ft-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.06);margin-bottom:4px;cursor:pointer;" title="${escapeHTML(displayName)}">
            <span style="font-size:20px;flex-shrink:0;"><i class="ph ph-file-text"></i></span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(displayName)}</div>
              <div style="font-size:10px;color:#aaa;">${formatFileSize(f.size)}</div>
            </div>
            <button class="ft-download-btn" data-url="${escapeHTML(url)}" data-name="${escapeHTML(displayName)}" style="background:rgba(76,175,80,0.5);border:none;color:#fff;padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;flex-shrink:0;">下载</button>
            <button class="ft-del-btn" data-name="${escapeHTML(f.name)}" style="background:rgba(244,67,54,0.5);border:none;color:#fff;padding:3px 6px;border-radius:4px;font-size:10px;cursor:pointer;flex-shrink:0;"><i class="ph ph-x"></i></button>
          </div>
        `;
      }).join('');
      listEl.querySelectorAll('.ft-download-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const original = btn.textContent;
          btn.textContent = '...';
          btn.disabled = true;
          try {
            const res = await fetch(btn.dataset.url, { headers: getAuthHeaders() });
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = btn.dataset.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            btn.textContent = '✓';
            showToast(`✅ ${btn.dataset.name} 下载成功`, 'ok');
            setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
          } catch {
            btn.textContent = '失败';
            showToast('❌ 下载失败', 'err');
            setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
          }
        });
      });
      listEl.querySelectorAll('.ft-del-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('确定删除此文件？')) return;
          await fetch(`${SERVER}/api/files/${encodeURIComponent(btn.dataset.name)}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          loadFiles();
        });
      });
    } catch {
      listEl.innerHTML = '<div style="text-align:center;color:#f44;font-size:12px;padding:20px 0;">加载失败</div>';
    }
  }

  const progressWrap = panel.querySelector('.ft-progress');
  const progressText = panel.querySelector('.ft-progress-text');
  const progressBar = panel.querySelector('.ft-progress-bar');

  function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:12px;right:12px;padding:8px 14px;border-radius:6px;font-size:12px;z-index:99999;box-shadow:0 2px 12px rgba(0,0,0,0.4);color:#fff;background:${type === 'ok' ? 'rgba(76,175,80,0.9)' : 'rgba(244,67,54,0.9)'};transition:opacity 0.3s;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
  }

  function uploadFiles(fileList) {
    return new Promise((resolve) => {
      const files = Array.from(fileList);
      if (files.length === 0) { resolve(); return; }
      let done = 0, totalSize = 0, loaded = 0;
      files.forEach(f => totalSize += f.size);
      progressWrap.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = `准备上传 ${files.length} 个文件...`;

      function uploadNext() {
        if (done >= files.length) {
          progressText.textContent = `上传完成 (${done}/${files.length})`;
          progressBar.style.width = '100%';
          progressBar.style.background = 'rgba(76,175,80,0.8)';
          showToast(`✅ ${done} 个文件上传成功`, 'ok');
          setTimeout(() => { progressWrap.style.display = 'none'; progressBar.style.background = ''; }, 1500);
          loadFiles();
          resolve();
          return;
        }
        const file = files[done];
        const fd = new FormData();
        fd.append('file', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${SERVER}/api/upload`);
        if (authCode) xhr.setRequestHeader('X-Auth-Code', authCode);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const filePercent = Math.round(e.loaded / e.total * 100);
            const overallPercent = Math.round((loaded + e.loaded) / totalSize * 100);
            progressBar.style.width = overallPercent + '%';
            progressText.textContent = `上传中 (${done + 1}/${files.length}): ${file.name} ${filePercent}%`;
          }
        };
        xhr.onload = () => {
          if (xhr.status === 401) {
            progressWrap.style.display = 'none';
            showToast('❌ 验证码错误或缺失', 'err');
            resolve();
            return;
          }
          loaded += file.size;
          done++;
          uploadNext();
        };
        xhr.onerror = () => {
          progressWrap.style.display = 'none';
          showToast('❌ 上传失败', 'err');
          resolve();
        };
        xhr.send(fd);
      }
      uploadNext();
    });
  }

  uploadBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', () => uploadFiles(input.files));
    input.click();
  });

  panel.querySelector('.ft-refresh-btn').addEventListener('click', loadFiles);
  panel.querySelector('.fr-close:not(.ft-refresh-btn)').addEventListener('click', () => panel.remove());
  document.body.appendChild(panel);
  setTimeout(() => panel.classList.add('show'), 10);

  // 拖拽上传
  panel.addEventListener('dragover', (e) => {
    e.preventDefault();
    panel.style.outline = '2px dashed rgba(33,150,243,0.8)';
    panel.style.outlineOffset = '-4px';
  });
  panel.addEventListener('dragleave', (e) => {
    if (!panel.contains(e.relatedTarget)) {
      panel.style.outline = '';
      panel.style.outlineOffset = '';
    }
  });
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    panel.style.outline = '';
    panel.style.outlineOffset = '';
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });
  loadFiles();
}

// 上传若干图片文件并追加到当前便签
async function uploadAndAppendImages(files) {
  const list = Array.from(files || []).filter(f => f && f.type && f.type.startsWith('image/'));
  if (list.length === 0) return;
  let textContent = '';
  let existingImages = [];
  if (currentNote.type === 'text') {
    try {
      const parsed = JSON.parse(currentNote.content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'text' in parsed) {
        textContent = parsed.text || '';
        existingImages = Array.isArray(parsed.images) ? parsed.images : [];
      } else {
        textContent = currentNote.content;
      }
    } catch {
      textContent = currentNote.content;
    }
  } else if (currentNote.type === 'image') {
    existingImages = parseImageList(currentNote.content);
  }
  const uploaded = [];
  for (const file of list) {
    const fd = new FormData(); fd.append('file', file);
    const uploadRes = await fetch(`${SERVER}/api/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: fd
    });
    if (uploadRes.status === 401) {
      alert('验证码错误或缺失，请在设置中输入正确的验证码');
      return;
    }
    const data = await uploadRes.json();
    uploaded.push(data.url);
  }
  if (uploaded.length === 0) return;
  const merged = existingImages.concat(uploaded);
  const content = JSON.stringify({ text: textContent, images: merged });
  await fetch('/api/notes/' + noteId, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ type: 'text', content }),
  });
  currentNote.type = 'text'; currentNote.content = content; renderNote();
}

function triggerImageUpload() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
  input.addEventListener('change', () => uploadAndAppendImages(input.files));
  input.click();
}

// 粘贴图片：从剪贴板读取图片直接添加到便签
document.addEventListener('paste', (e) => {
  // 在文本框里粘贴时，若剪贴板含文字则交给默认行为（不拦截普通文字粘贴）
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const imageFiles = [];
  let hasText = false;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) imageFiles.push(f);
    } else if (item.kind === 'string') {
      hasText = true;
    }
  }
  if (imageFiles.length === 0) return; // 没有图片就走默认粘贴
  // 焦点在文本框且同时有文字时，优先让文字粘贴生效，不抢图片
  const inTextarea = document.activeElement && document.activeElement.tagName === 'TEXTAREA';
  if (inTextarea && hasText) return;
  e.preventDefault();
  uploadAndAppendImages(imageFiles);
});

// 删除便签里第 index 张图片
async function deleteImageAt(index) {
  let textContent = '';
  let images = [];
  if (currentNote.type === 'text') {
    try {
      const parsed = JSON.parse(currentNote.content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'text' in parsed) {
        textContent = parsed.text || '';
        images = Array.isArray(parsed.images) ? [...parsed.images] : [];
      } else {
        images = parseImageList(currentNote.content);
      }
    } catch {
      images = parseImageList(currentNote.content);
    }
  } else {
    images = parseImageList(currentNote.content);
  }
  images.splice(index, 1);
  const content = JSON.stringify({ text: textContent, images });
  await fetch('/api/notes/' + noteId, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ type: 'text', content }),
  });
  currentNote.type = 'text'; currentNote.content = content;
  renderNote();
}

// ============ 颜色/主题选择器（合并） ============

document.getElementById('themeBtn').addEventListener('click', () => {
  const card = document.getElementById('noteCard');
  const existing = card.querySelector('.theme-picker');
  if (existing) { existing.remove(); return; }

  const picker = document.createElement('div');
  picker.className = 'theme-picker';

  // 颜色标题
  const colorLabel = document.createElement('div');
  colorLabel.className = 'theme-section-label';
  colorLabel.textContent = '颜色';
  picker.appendChild(colorLabel);

  // 颜色圆点行
  const colorRow = document.createElement('div');
  colorRow.className = 'theme-color-row';
  const isDefaultTheme = !currentNote.theme;
  COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (isDefaultTheme && c === currentNote.color ? ' active' : '');
    dot.style.background = c;
    dot.addEventListener('click', async () => {
      delete currentNote.theme;
      currentNote.color = c;
      await fetch(`${SERVER}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ color: c, theme: null }),
      });
      renderNote();
      picker.remove();
    });
    colorRow.appendChild(dot);
  });
  picker.appendChild(colorRow);

  // 主题标题
  const themeLabel = document.createElement('div');
  themeLabel.className = 'theme-section-label';
  themeLabel.textContent = '主题';
  themeLabel.style.marginTop = '6px';
  picker.appendChild(themeLabel);

  // 默认主题选项
  const defaultItem = document.createElement('div');
  defaultItem.className = 'theme-item' + (!currentNote.theme ? ' active' : '');
  defaultItem.innerHTML = '<div class="theme-preview" style="background:#ffeb3b;"><span style="color:#333;font-size:8px;">Aa</span></div><span class="theme-name">默认</span>';
  defaultItem.addEventListener('click', async () => {
    delete currentNote.theme;
    await fetch(`${SERVER}/api/notes/${noteId}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ theme: null }),
    });
    renderNote();
    picker.remove();
  });
  picker.appendChild(defaultItem);

  THEMES.forEach(t => {
    const item = document.createElement('div');
    item.className = 'theme-item' + (currentNote.theme === t.id ? ' active' : '');
    item.innerHTML = `<div class="theme-preview" style="background:${t.bg};border:1px solid ${t.accent}55;"><span style="color:${t.text};font-size:8px;">Aa</span></div><span class="theme-name">${t.label}</span>`;
    item.addEventListener('click', async () => {
      currentNote.theme = t.id;
      await fetch(`${SERVER}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ theme: t.id }),
      });
      renderNote();
      picker.remove();
    });
    picker.appendChild(item);
  });

  // 透明度滑块
  const opacityLabel = document.createElement('div');
  opacityLabel.className = 'theme-section-label';
  opacityLabel.textContent = '透明度';
  opacityLabel.style.marginTop = '4px';
  picker.appendChild(opacityLabel);
  const opacityRow = document.createElement('div');
  opacityRow.className = 'theme-opacity';
  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range';
  opacitySlider.min = '0.1';
  opacitySlider.max = '1';
  opacitySlider.step = '0.05';
  opacitySlider.value = String(currentNote.opacity ?? 1);
  const opacityValue = document.createElement('span');
  opacityValue.className = 'theme-opacity-value';
  opacityValue.textContent = Math.round((currentNote.opacity ?? 1) * 100) + '%';
  opacitySlider.addEventListener('input', () => {
    const val = parseFloat(opacitySlider.value);
    opacityValue.textContent = Math.round(val * 100) + '%';
    card.style.opacity = String(val);
  });
  opacitySlider.addEventListener('change', async () => {
    const val = parseFloat(opacitySlider.value);
    currentNote.opacity = val;
    await fetch(`${SERVER}/api/notes/${noteId}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ opacity: val }),
    });
  });
  opacityRow.appendChild(opacitySlider);
  opacityRow.appendChild(opacityValue);
  picker.appendChild(opacityRow);

  card.appendChild(picker);
  setTimeout(() => {
    const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }, 0);
});

document.getElementById('closeBtn').addEventListener('click', async () => {
  await fetch(SERVER + '/api/notes/' + noteId, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  window.close();
});

const minBtn = document.getElementById('minBtn');
if (minBtn) {
  minBtn.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.minimizeNote) {
      window.electronAPI.minimizeNote(noteId);
    }
  });
}

const maxBtn = document.getElementById('maxBtn');
if (maxBtn) {
  maxBtn.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.maximizeNote) {
      window.electronAPI.maximizeNote(noteId);
    }
  });
}

const pinBtn = document.getElementById('pinBtn');
if (pinBtn) {
  let isPinned = window.electronAPI && window.electronAPI.isPinned ? window.electronAPI.isPinned(noteId) : false;
  pinBtn.classList.toggle('pinned', isPinned);
  pinBtn.title = isPinned ? '取消置顶' : '置顶';
  pinBtn.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.togglePin) {
      isPinned = window.electronAPI.togglePin(noteId);
      pinBtn.classList.toggle('pinned', isPinned);
      pinBtn.title = isPinned ? '取消置顶' : '置顶';
    }
  });
}

// ============ 定时提醒 ============

let remindTimer = null;
let remindTime = null;

function showRemindPanel() {
  const existing = document.querySelector('.remind-panel');
  if (existing) { existing.remove(); return; }
  if (!currentNote) return;

  const panel = document.createElement('div');
  panel.className = 'remind-panel';
  const now = new Date();
  const defaultTime = new Date(now.getTime() + 30 * 60000);
  const timeStr = defaultTime.toTimeString().slice(0, 5);
  const dateStr = defaultTime.toISOString().slice(0, 10);

  panel.innerHTML = `
    <div class="remind-header">
      <span class="remind-title"><i class="ph ph-bell"></i> 定时提醒</span>
      <button class="remind-close" title="关闭"><i class="ph ph-x"></i></button>
    </div>
    <div class="remind-body">
      <label class="remind-label">提醒时间</label>
      <div class="remind-inputs">
        <input type="date" class="remind-date" value="${dateStr}">
        <input type="time" class="remind-time" value="${timeStr}">
      </div>
      <label class="remind-label">提醒内容</label>
      <input type="text" class="remind-msg" placeholder="输入提醒内容（可选）" value="${escapeHTML(currentNote.content || '').slice(0, 50)}">
      <div class="remind-actions">
        <button class="remind-btn remind-set">设置提醒</button>
        <button class="remind-btn remind-cancel" style="display:none">取消提醒</button>
      </div>
      <div class="remind-status"></div>
    </div>
  `;

  if (remindTime) {
    const rt = new Date(remindTime);
    panel.querySelector('.remind-date').value = rt.toISOString().slice(0, 10);
    panel.querySelector('.remind-time').value = rt.toTimeString().slice(0, 5);
    panel.querySelector('.remind-cancel').style.display = '';
  }

  panel.querySelector('.remind-close').addEventListener('click', () => panel.remove());

  panel.querySelector('.remind-set').addEventListener('click', () => {
    const date = panel.querySelector('.remind-date').value;
    const time = panel.querySelector('.remind-time').value;
    const msg = panel.querySelector('.remind-msg').value;
    if (!date || !time) {
      panel.querySelector('.remind-status').textContent = '请选择日期和时间';
      return;
    }
    const target = new Date(`${date}T${time}`);
    if (target <= new Date()) {
      panel.querySelector('.remind-status').textContent = '时间必须在未来';
      return;
    }
    setRemind(target.getTime(), msg);
    panel.querySelector('.remind-status').textContent = `✅ 已设置 ${target.toLocaleString()} 提醒`;
    panel.querySelector('.remind-cancel').style.display = '';
    setTimeout(() => panel.remove(), 1500);
  });

  panel.querySelector('.remind-cancel').addEventListener('click', () => {
    cancelRemind();
    panel.querySelector('.remind-status').textContent = '已取消提醒';
    panel.querySelector('.remind-cancel').style.display = 'none';
    setTimeout(() => panel.remove(), 1000);
  });

  document.body.appendChild(panel);
}

function setRemind(timestamp, message) {
  remindTime = timestamp;
  clearTimeout(remindTimer);
  updateRemindBtnUI();
  checkRemind();
}

function cancelRemind() {
  remindTime = null;
  clearTimeout(remindTimer);
  remindTimer = null;
  updateRemindBtnUI();
}

function updateRemindBtnUI() {
  // 按钮已移至下拉菜单，无需更新UI
}

function checkRemind() {
  if (!remindTime) return;
  const now = Date.now();
  if (now >= remindTime) {
    const msg = currentNote ? (currentNote.content || '').slice(0, 50) : '时间到了';
    showRemindNotification(msg);
    cancelRemind();
    return;
  }
  const delay = Math.min(remindTime - now, 10000);
  remindTimer = setTimeout(checkRemind, delay);
}

function showRemindNotification(message) {
  // 通知触发时：置顶窗口 + 弹窗抖动，5秒后恢复
  if (window.electronAPI && window.electronAPI.setAlwaysOnTop) {
    window.electronAPI.setAlwaysOnTop(noteId, true);
    setTimeout(() => { window.electronAPI.setAlwaysOnTop(noteId, false); }, 5000);
  }

  const overlay = document.createElement('div');
  overlay.className = 'remind-notify';
  overlay.innerHTML = `
    <div class="remind-notify-box remind-shake">
      <div class="remind-notify-icon"><i class="ph ph-bell-ringing"></i></div>
      <div class="remind-notify-title">定时提醒</div>
      <div class="remind-notify-msg">${escapeHTML(message)}</div>
      <button class="remind-notify-ok">知道了</button>
    </div>
  `;
  overlay.querySelector('.remind-notify-ok').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  try { new Audio('data:audio/wav;base64,UklGRl9vT19teleVBmb3JtYXQ=').play().catch(() => {}); } catch {}
}

if (remindTime) { checkRemind(); updateRemindBtnUI(); }

// 保存便签内容到服务器，并同步本地状态
async function saveContent(content) {
  let finalContent = content;
  if (currentNote && currentNote.type === 'text') {
    try {
      const parsed = JSON.parse(currentNote.content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'text' in parsed) {
        finalContent = JSON.stringify({ text: content, images: parsed.images || [] });
      }
    } catch {}
  }
  if (currentNote) currentNote.content = finalContent;
  try {
    await fetch(`${SERVER}/api/notes/${noteId}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content: finalContent }),
    });
    textareaDirty = false; // 保存成功后才重置脏标记
  } catch (e) {}
}

// 保存便签内容到本地文件
function saveToLocal(content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `便签_${noteId}_${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ 文本百宝箱 ============

// 各个文本处理函数：输入字符串，返回处理后的字符串
const TEXT_TOOLS = {
  // 清理类
  trimSpaces: (t) => t
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n'),
  removeBlankLines: (t) => t
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n'),
  removeAllSpaces: (t) => t.replace(/[ \t]+/g, ''),
  newlineToComma: (t) => t.split('\n').map(l => l.trim()).filter(l => l !== '').join(','),
  newlineToQuotedComma: (t) => t.split('\n').map(l => l.trim()).filter(l => l !== '').map(l => `'${l}'`).join(','),
  // 大小写类
  upperCase: (t) => t.toUpperCase(),
  lowerCase: (t) => t.toLowerCase(),
  titleCase: (t) => t.replace(/\b\w/g, c => c.toUpperCase()),
  // 行操作类
  dedupeLines: (t) => {
    const seen = new Set();
    return t.split('\n').filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    }).join('\n');
  },
  sortAsc: (t) => t.split('\n').sort((a, b) => a.localeCompare(b, 'zh')).join('\n'),
  sortDesc: (t) => t.split('\n').sort((a, b) => b.localeCompare(a, 'zh')).join('\n'),
  reverseLines: (t) => t.split('\n').reverse().join('\n'),
  // 编码/解码类
  urlEncode: (t) => encodeURIComponent(t),
  urlDecode: (t) => { try { return decodeURIComponent(t); } catch { return t; } },
  base64Encode: (t) => btoa(unescape(encodeURIComponent(t))),
  base64Decode: (t) => { try { return decodeURIComponent(escape(atob(t.trim()))); } catch { return t; } },
  unicodeEncode: (t) => Array.from(t).map(c => {
    const code = c.codePointAt(0);
    return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : c;
  }).join(''),
  unicodeDecode: (t) => t.replace(/\\u([0-9a-fA-F]{4,6})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16))),
  // JSON类
  jsonFormat: (t) => { try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; } },
  jsonMinify: (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return t; } },
  // YAML 与 Properties 互转
  yamlToProps: (t) => {
    const lines = t.split('\n');
    const result = [];
    const stack = [];
    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');
      const indentMatch = trimmed.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const kvMatch = trimmed.match(/^\s*([^:#][^:]*?):\s*(.*)$/);
      if (!kvMatch) continue;
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
      const fullKey = [...stack.map(s => s.key), key].join('.');
      if (value === '' || value === '|' || value === '>' || value === '[]') {
        stack.push({ indent, key });
      } else {
        let val = value;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result.push(`${fullKey}=${val}`);
      }
    }
    return result.join('\n');
  },
  propsToYaml: (t) => {
    const lines = t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('!'));
    const root = {};
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      const parts = key.split('.');
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    function toYaml(obj, indent = 0) {
      const prefix = '  '.repeat(indent);
      let result = '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          result += `${prefix}${k}:\n${toYaml(v, indent + 1)}`;
        } else {
          const val = String(v);
          const needQuote = /[:{}\[\],&*?|<>=!%@`#'"\n]/.test(val) || val.trim() !== val || val === '';
          result += `${prefix}${k}: ${needQuote ? `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : val}\n`;
        }
      }
      return result;
    }
    return toYaml(root).trimEnd();
  },
  // 全角半角转换
  toFullWidth: (t) => {
    return t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0xFEE0)).replace(/ /g, '　');
  },
  toHalfWidth: (t) => {
    return t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  },
  // SQL类
  sqlFormat: (t) => {
    if (!t.trim()) return t;
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'AS', 'DISTINCT', 'UNION', 'UNION ALL', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT', 'AUTO_INCREMENT', 'VARCHAR', 'INT', 'INTEGER', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BLOB', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'ASC', 'DESC', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'WITH', 'RECURSIVE', 'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE'];
    let result = t.replace(/\s+/g, ' ').trim();
    const topKeywords = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'WITH'];
    topKeywords.forEach(kw => {
      const regex = new RegExp('\\b(' + kw + ')\\b', 'gi');
      result = result.replace(regex, '\n$1');
    });
    const midKeywords = ['AND', 'OR', 'ON', 'SET', 'VALUES', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'UNION', 'UNION ALL', 'FETCH', 'PARTITION'];
    midKeywords.forEach(kw => {
      const regex = new RegExp('\\b(' + kw + ')\\b', 'gi');
      result = result.replace(regex, '\n  $1');
    });
    result = result.split('\n').map(line => {
      let trimmed = line.trim();
      if (!trimmed) return '';
      keywords.forEach(kw => {
        const regex = new RegExp('\\b' + kw + '\\b', 'gi');
        trimmed = trimmed.replace(regex, kw);
      });
      return trimmed;
    }).filter(l => l).join('\n');
    return result;
  },
  sqlMinify: (t) => t.replace(/\s+/g, ' ').trim(),
  // 时间戳类
  timestampToDate: (t) => {
    const n = Number(t.trim());
    if (isNaN(n)) return t;
    // 自动判断秒级(10位)或毫秒级(13位)
    const ms = String(Math.floor(n)).length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return t;
    const pad = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },
  dateToTimestamp: (t) => {
    const d = new Date(t.trim());
    if (isNaN(d.getTime())) return t;
    return String(d.getTime());
  },
  // 哈希类（异步）
  md5: async (t) => {
    // 纯 JS MD5 实现
    function md5hash(str) {
      function safeAdd(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
      function bitRotateLeft(n, c) { return (n << c) | (n >>> (32 - c)); }
      function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
      function md5ff(a,b,c,d,x,s,t){ return md5cmn((b&c)|((~b)&d),a,b,x,s,t); }
      function md5gg(a,b,c,d,x,s,t){ return md5cmn((b&d)|(c&(~d)),a,b,x,s,t); }
      function md5hh(a,b,c,d,x,s,t){ return md5cmn(b^c^d,a,b,x,s,t); }
      function md5ii(a,b,c,d,x,s,t){ return md5cmn(c^(b|(~d)),a,b,x,s,t); }
      function binlMD5(x, len) {
        x[len >> 5] |= 0x80 << (len % 32);
        x[((len + 64) >>> 9 << 4) + 14] = len;
        let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
        for (let i = 0; i < x.length; i += 16) {
          const oa = a, ob = b, oc = c, od = d;
          a=md5ff(a,b,c,d,x[i],7,-680876936);d=md5ff(d,a,b,c,x[i+1],12,-389564586);c=md5ff(c,d,a,b,x[i+2],17,606105819);b=md5ff(b,c,d,a,x[i+3],22,-1044525330);
          a=md5ff(a,b,c,d,x[i+4],7,-176418897);d=md5ff(d,a,b,c,x[i+5],12,1200080426);c=md5ff(c,d,a,b,x[i+6],17,-1473231341);b=md5ff(b,c,d,a,x[i+7],22,-45705983);
          a=md5ff(a,b,c,d,x[i+8],7,1770035416);d=md5ff(d,a,b,c,x[i+9],12,-1958414417);c=md5ff(c,d,a,b,x[i+10],17,-42063);b=md5ff(b,c,d,a,x[i+11],22,-1990404162);
          a=md5ff(a,b,c,d,x[i+12],7,1804603682);d=md5ff(d,a,b,c,x[i+13],12,-40341101);c=md5ff(c,d,a,b,x[i+14],17,-1502002290);b=md5ff(b,c,d,a,x[i+15],22,1236535329);
          a=md5gg(a,b,c,d,x[i+1],5,-165796510);d=md5gg(d,a,b,c,x[i+6],9,-1069501632);c=md5gg(c,d,a,b,x[i+11],14,643717713);b=md5gg(b,c,d,a,x[i],20,-373897302);
          a=md5gg(a,b,c,d,x[i+5],5,-701558691);d=md5gg(d,a,b,c,x[i+10],9,38016083);c=md5gg(c,d,a,b,x[i+15],14,-660478335);b=md5gg(b,c,d,a,x[i+4],20,-405537848);
          a=md5gg(a,b,c,d,x[i+9],5,568446438);d=md5gg(d,a,b,c,x[i+14],9,-1019803690);c=md5gg(c,d,a,b,x[i+3],14,-187363961);b=md5gg(b,c,d,a,x[i+8],20,1163531501);
          a=md5gg(a,b,c,d,x[i+13],5,-1444681467);d=md5gg(d,a,b,c,x[i+2],9,-51403784);c=md5gg(c,d,a,b,x[i+7],14,1735328473);b=md5gg(b,c,d,a,x[i+12],20,-1926607734);
          a=md5hh(a,b,c,d,x[i+5],4,-378558);d=md5hh(d,a,b,c,x[i+8],11,-2022574463);c=md5hh(c,d,a,b,x[i+11],16,1839030562);b=md5hh(b,c,d,a,x[i+14],23,-35309556);
          a=md5hh(a,b,c,d,x[i+1],4,-1530992060);d=md5hh(d,a,b,c,x[i+4],11,1272893353);c=md5hh(c,d,a,b,x[i+6],16,-155497632);b=md5hh(b,c,d,a,x[i+9],23,-1094730640);
          a=md5hh(a,b,c,d,x[i+12],4,681279174);d=md5hh(d,a,b,c,x[i+15],11,-358537222);c=md5hh(c,d,a,b,x[i+2],16,-722521979);b=md5hh(b,c,d,a,x[i+3],23,76029189);
          a=md5hh(a,b,c,d,x[i+6],4,-640364487);d=md5hh(d,a,b,c,x[i+9],11,-421815835);c=md5hh(c,d,a,b,x[i+12],16,530742520);b=md5hh(b,c,d,a,x[i+15],23,-995338651);
          a=md5ii(a,b,c,d,x[i],6,-198630844);d=md5ii(d,a,b,c,x[i+7],10,1126891415);c=md5ii(c,d,a,b,x[i+14],15,-1416354905);b=md5ii(b,c,d,a,x[i+5],21,-57434055);
          a=md5ii(a,b,c,d,x[i+12],6,1700485571);d=md5ii(d,a,b,c,x[i+3],10,-1894986606);c=md5ii(c,d,a,b,x[i+10],15,-1051523);b=md5ii(b,c,d,a,x[i+1],21,-2054922799);
          a=md5ii(a,b,c,d,x[i+8],6,1873313359);d=md5ii(d,a,b,c,x[i+15],10,-30611744);c=md5ii(c,d,a,b,x[i+6],15,-1560198380);b=md5ii(b,c,d,a,x[i+13],21,1309151649);
          a=md5ii(a,b,c,d,x[i+4],6,-145523070);d=md5ii(d,a,b,c,x[i+11],10,-1120210379);c=md5ii(c,d,a,b,x[i+2],15,718787259);b=md5ii(b,c,d,a,x[i+9],21,-343485551);
          a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
        }
        return [a, b, c, d];
      }
      function str2binl(str) {
        const bin = [];
        const mask = (1 << 8) - 1;
        for (let i = 0; i < str.length * 8; i += 8)
          bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (i % 32);
        return bin;
      }
      function binl2hex(binarray) {
        const hexTab = '0123456789abcdef';
        let str = '';
        for (let i = 0; i < binarray.length * 4; i++)
          str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) + hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
        return str;
      }
      const utf8 = unescape(encodeURIComponent(str));
      return binl2hex(binlMD5(str2binl(utf8), utf8.length * 8));
    }
    return md5hash(t);
  },
  sha1: async (t) => {
    const buf = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  sha256: async (t) => {
    const buf = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  sha512: async (t) => {
    const buf = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-512', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  // 二维码生成（异步，返回特殊标记触发特殊处理）
  generateQR: async (t) => {
    if (!t.trim()) return t;
    try {
      const dataURL = await QRCode.toDataURL(t, { width: 300, margin: 1 });
      return `__QR_CODE_DATA_URL__${dataURL}`;
    } catch (err) {
      console.error('QR生成失败:', err);
      return t;
    }
  },
  // 查找替换（特殊标记，触发UI）
  findReplace: () => '__SHOW_FIND_REPLACE_UI__',
  // Excel 模板生成（特殊标记，触发UI）
  excelTemplate: () => '__SHOW_EXCEL_TEMPLATE_UI__',
  // RSA 加解密（特殊标记，触发UI）
  rsaCrypto: () => '__SHOW_RSA_UI__',
  // Markdown 预览（特殊标记，触发切换）
  markdownPreview: () => '__SHOW_MARKDOWN_PREVIEW__',
};

// 工具按钮配置：分组展示
const TOOL_GROUPS = [
  {
    title: '文本清理',
    items: [
      { key: 'trimSpaces', label: '去多余空格' },
      { key: 'removeBlankLines', label: '去空行' },
      { key: 'removeAllSpaces', label: '去所有空格' },
    ],
  },
  {
    title: '格式转换',
    items: [
      { key: 'newlineToComma', label: '换行→逗号' },
      { key: 'newlineToQuotedComma', label: '换行→逗号(带引号)' },
    ],
  },
  {
    title: '大小写',
    items: [
      { key: 'upperCase', label: '大写' },
      { key: 'lowerCase', label: '小写' },
      { key: 'titleCase', label: '首字母大写' },
    ],
  },
  {
    title: '全角半角',
    items: [
      { key: 'toFullWidth', label: '转全角' },
      { key: 'toHalfWidth', label: '转半角' },
    ],
  },
  {
    title: '行操作',
    items: [
      { key: 'dedupeLines', label: '去重行' },
      { key: 'sortAsc', label: '升序排序' },
      { key: 'sortDesc', label: '降序排序' },
      { key: 'reverseLines', label: '反转行序' },
    ],
  },
  {
    title: '编码/解码',
    items: [
      { key: 'urlEncode', label: 'URL编码' },
      { key: 'urlDecode', label: 'URL解码' },
      { key: 'base64Encode', label: 'Base64编码' },
      { key: 'base64Decode', label: 'Base64解码' },
      { key: 'unicodeEncode', label: 'Unicode编码' },
      { key: 'unicodeDecode', label: 'Unicode解码' },
    ],
  },
  {
    title: 'JSON',
    items: [
      { key: 'jsonFormat', label: 'JSON格式化' },
      { key: 'jsonMinify', label: 'JSON压缩' },
    ],
  },
  {
    title: 'SQL',
    items: [
      { key: 'sqlFormat', label: 'SQL格式化' },
      { key: 'sqlMinify', label: 'SQL压缩' },
    ],
  },
  {
    title: '配置转换',
    items: [
      { key: 'yamlToProps', label: 'YAML→Props' },
      { key: 'propsToYaml', label: 'Props→YAML' },
    ],
  },
  {
    title: '时间戳',
    items: [
      { key: 'timestampToDate', label: '时间戳→日期' },
      { key: 'dateToTimestamp', label: '日期→时间戳' },
    ],
  },
  {
    title: '哈希计算',
    items: [
      { key: 'md5', label: 'MD5' },
      { key: 'sha1', label: 'SHA-1' },
      { key: 'sha256', label: 'SHA-256' },
      { key: 'sha512', label: 'SHA-512' },
    ],
  },
  {
    title: '实用工具',
    items: [
      { key: 'findReplace', label: '查找替换' },
      { key: 'generateQR', label: '生成二维码' },
      { key: 'excelTemplate', label: 'Excel模板生成' },
      { key: 'rsaCrypto', label: 'RSA加解密' },
    ],
  },
  {
    title: '预览',
    items: [
      { key: 'markdownPreview', label: 'Markdown预览' },
    ],
  },
  {
    title: '校验码',
    items: [
      { key: 'totp', label: '谷歌校验码', action: 'panel' },
    ],
  },
];

// 统计文本信息
function textStats(t) {
  const chars = t.length;
  const charsNoSpace = t.replace(/\s/g, '').length;
  const lines = t === '' ? 0 : t.split('\n').length;
  const words = charsNoSpace;
  const chinese = (t.match(/[一-鿿]/g) || []).length;
  const punctuation = (t.match(/[，。！？、；：""''【】《》（）…—·\.\,\!\?\;\:\"\'\(\)\[\]\{\}\-\/\\@#\$%\^&\*\+\=\~\`<>]/g) || []).length;
  const spaces = (t.match(/ /g) || []).length;
  const lineBreaks = t === '' ? 0 : (t.match(/\n/g) || []).length;
  const digits = (t.match(/[0-9]/g) || []).length;
  return { chars, charsNoSpace, lines, words, chinese, punctuation, spaces, lineBreaks, digits };
}

// 撤回栈：保存每次工具操作前的文本快照
let undoStack = [];

// 在改写文本前调用，压入当前快照
function pushUndoSnapshot(ta) {
  if (!ta) return;
  undoStack.push({
    value: ta.value,
    selectionStart: ta.selectionStart,
    selectionEnd: ta.selectionEnd,
  });
  // 限制栈深度，避免无限增长
  if (undoStack.length > 50) undoStack.shift();
  updateUndoButton();
}

// 还原到上一个快照
function undoLastEdit() {
  const ta = activeTextarea;
  if (!ta || undoStack.length === 0) return;
  const snap = undoStack.pop();
  ta.value = snap.value;
  ta.focus();
  ta.selectionStart = snap.selectionStart;
  ta.selectionEnd = snap.selectionEnd;
  saveContent(ta.value);
  refreshToolboxStats();
  updateUndoButton();
}

// 根据栈状态更新撤回按钮的可用性
function updateUndoButton() {
  if (!toolboxPanel) return;
  const btn = toolboxPanel.querySelector('.tb-undo');
  if (btn) {
    btn.disabled = undoStack.length === 0;
    btn.title = undoStack.length ? `撤回（可撤回 ${undoStack.length} 步）` : '无可撤回操作';
  }
}

// 二维码弹窗显示
function showQRPopup(dataURL, text) {
  const existing = document.getElementById('qr-popup');
  if (existing) existing.remove();
  const popup = document.createElement('div');
  popup.id = 'qr-popup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(22,33,62,0.98);color:#fff;border-radius:12px;padding:16px;z-index:10001;box-shadow:0 4px 24px rgba(0,0,0,0.5);text-align:center;max-width:90vw;';
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:12px;font-weight:600;">📱 二维码</span>
      <button id="qr-popup-close" style="background:rgba(255,255,255,0.12);border:none;color:#fff;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:10px;"><i class="ph ph-x"></i></button>
    </div>
    <img src="${dataURL}" style="max-width:260px;border-radius:8px;background:#fff;padding:8px;" />
    <div style="font-size:10px;opacity:0.6;margin-top:6px;word-break:break-all;max-width:260px;">${escapeHTML(text.length > 40 ? text.slice(0, 40) + '...' : text)}</div>
  `;
  document.body.appendChild(popup);
  popup.querySelector('#qr-popup-close').addEventListener('click', () => popup.remove());
}

// 对当前 textarea 应用工具：有选区则只处理选区，否则处理全文（支持异步函数）
async function applyTool(fn) {
  const ta = activeTextarea;
  if (!ta) return;
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const hasSelection = s !== e;
  let processed;
  if (hasSelection) {
    const selected = value.slice(s, e);
    processed = await fn(selected);
  } else {
    processed = await fn(value);
  }

  // 特殊处理：二维码生成（返回标记 + Data URL）
  if (typeof processed === 'string' && processed.startsWith('__QR_CODE_DATA_URL__')) {
    const dataURL = processed.replace('__QR_CODE_DATA_URL__', '');
    showQRPopup(dataURL, value.trim());
    closeToolbox();
    return;
  }

  // 特殊处理：查找替换 UI
  if (processed === '__SHOW_FIND_REPLACE_UI__') {
    toggleFindReplacePanel();
    return;
  }

  // 特殊处理：Excel 模板生成 UI
  if (processed === '__SHOW_EXCEL_TEMPLATE_UI__') {
    toggleExcelTemplatePanel();
    return;
  }

  // 特殊处理：RSA 加解密 UI
  if (processed === '__SHOW_RSA_UI__') {
    toggleRsaPanel();
    return;
  }

  // 特殊处理：Markdown 预览切换
  if (processed === '__SHOW_MARKDOWN_PREVIEW__') {
    toggleMarkdownPreview();
    return;
  }

  // 常规处理
  pushUndoSnapshot(ta);
  if (hasSelection) {
    ta.value = value.slice(0, s) + processed + value.slice(e);
    ta.selectionStart = s;
    ta.selectionEnd = s + processed.length;
  } else {
    ta.value = processed;
  }
  ta.focus();
  saveContent(ta.value);
  refreshToolboxStats();
}

let toolboxPanel = null;
let textareaDirty = false;
const TOOLBOX_WIDTH = 340; // 与 CSS .toolbox { width } 保持一致

function expandWindowForToolbox() {
  if (!window.electronAPI) return;
  // 锁定便签卡片为当前像素宽度，防止窗口变宽时内容区跟着拉伸
  const card = document.getElementById('noteCard');
  card.style.width = card.offsetWidth + 'px';
  window.electronAPI.setWidthOffset(noteId, TOOLBOX_WIDTH);
}

function shrinkWindowForToolbox() {
  if (!window.electronAPI) return;
  window.electronAPI.setWidthOffset(noteId, 0);
  const card = document.getElementById('noteCard');
  card.style.width = '';
}

function refreshToolboxStats() {
  if (!toolboxPanel || !activeTextarea) return;
  const ta = activeTextarea;
  const target = ta.selectionStart !== ta.selectionEnd
    ? ta.value.slice(ta.selectionStart, ta.selectionEnd)
    : ta.value;
  const st = textStats(target);
  const scope = ta.selectionStart !== ta.selectionEnd ? '选中' : '全文';
  const statsEl = toolboxPanel.querySelector('.tb-stats');
  if (statsEl) {
    statsEl.innerHTML =
      `<span class="tb-stats-line">${scope} · 总字数 <b>${st.words}</b> · 字符 <b>${st.chars}</b> · 中文 <b>${st.chinese}</b></span>` +
      `<span class="tb-stats-line">标点 <b>${st.punctuation}</b> · 空格 <b>${st.spaces}</b> · 换行 <b>${st.lineBreaks}</b> · 数字 <b>${st.digits}</b> · 行数 <b>${st.lines}</b></span>`;
  }
}

function closeToolbox() {
  if (toolboxPanel) {
    toolboxPanel.classList.remove('show');
    setTimeout(() => {
      if (toolboxPanel) {
        toolboxPanel.remove();
        toolboxPanel = null;
      }
      // 等面板滑出动画结束后再收窄窗口，避免面板回弹遮住便签
      shrinkWindowForToolbox();
    }, 300);
    document.removeEventListener('keydown', onToolboxEsc);
  }
  closeFindReplacePanel();
  closeExcelTemplatePanel();
  closeRsaPanel();
}

function onToolboxEsc(e) {
  if (e.key === 'Escape') closeToolbox();
}

// ============ Excel 模板生成面板 ============

let excelTemplatePanel = null;
let excelData = null; // 存储解析后的 Excel 数据：[{列名: 值, ...}, ...]

function closeExcelTemplatePanel() {
  if (excelTemplatePanel) {
    const panel = excelTemplatePanel;
    excelTemplatePanel = null;
    excelData = null;
    panel.classList.remove('show');
    setTimeout(() => panel.remove(), 300);
  }
}

// 解析 Excel 文件
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        // 读取第一个 sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        // 转为 JSON 对象数组，第一行作为键
        const json = XLSX.utils.sheet_to_json(firstSheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 渲染模板：将 {列名} 替换为对应值
function renderTemplate(template, rowData) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return rowData.hasOwnProperty(trimmedKey) ? String(rowData[trimmedKey]) : match;
  });
}

// 在输入框光标处插入文本
function insertAtCursor(input, text) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;
  input.value = value.slice(0, start) + text + value.slice(end);
  const pos = start + text.length;
  input.selectionStart = input.selectionEnd = pos;
  input.focus();
}

// 预览第一条数据
function updatePreview() {
  if (!excelTemplatePanel) return;
  const templateInput = excelTemplatePanel.querySelector('.et-template');
  const previewEl = excelTemplatePanel.querySelector('.et-preview');
  const generateBtn = excelTemplatePanel.querySelector('.et-generate');

  if (!excelData || excelData.length === 0) {
    previewEl.innerHTML = '<span class="et-preview-title">无数据</span>';
    generateBtn.disabled = true;
    return;
  }

  const template = templateInput.value;
  if (!template.trim()) {
    previewEl.innerHTML = '<span class="et-preview-title">请输入模板</span>';
    generateBtn.disabled = true;
    return;
  }

  generateBtn.disabled = false;
  const firstRow = excelData[0];
  const preview = renderTemplate(template, firstRow);
  previewEl.innerHTML = `<span class="et-preview-title">预览（第1条/共${excelData.length}条）：</span>${escapeHTML(preview)}`;
}

// 批量生成并写入当前便签
async function generateFromTemplate() {
  if (!excelData || excelData.length === 0 || !activeTextarea) return;
  const templateInput = excelTemplatePanel.querySelector('.et-template');
  const template = templateInput.value.trim();
  if (!template) return;

  const results = excelData.map(row => renderTemplate(template, row));
  const combined = results.join('\n');

  // 写入当前便签的文本框
  pushUndoSnapshot(activeTextarea);
  activeTextarea.value = combined;
  activeTextarea.focus();
  saveContent(combined);

  closeExcelTemplatePanel();
  closeToolbox();
}

function toggleExcelTemplatePanel() {
  if (excelTemplatePanel) { closeExcelTemplatePanel(); return; }
  if (!activeTextarea) return;

  const panel = document.createElement('div');
  panel.className = 'excel-template';
  panel.innerHTML = `
    <div class="et-header">
      <span class="et-title"><i class="ph ph-file-xls"></i> Excel模板生成</span>
      <button class="et-close" title="关闭"><i class="ph ph-x"></i></button>
    </div>
    <button class="et-upload-btn">📂 选择 Excel 文件</button>
    <div class="et-info">未选择文件</div>
    <div class="et-columns" style="display:none;"></div>
    <textarea class="et-template" placeholder="输入模板，用 {列名} 作为占位符&#10;例如：尊敬的 {姓名}，您的订单号是 {订单号}"></textarea>
    <div class="et-actions">
      <button class="et-btn et-generate" disabled>✨ 批量生成</button>
    </div>
    <div class="et-preview"></div>
  `;

  const uploadBtn = panel.querySelector('.et-upload-btn');
  const infoEl = panel.querySelector('.et-info');
  const columnsEl = panel.querySelector('.et-columns');
  const templateInput = panel.querySelector('.et-template');
  const generateBtn = panel.querySelector('.et-generate');

  // 上传文件
  uploadBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        infoEl.textContent = '解析中...';
        excelData = await parseExcelFile(file);

        if (excelData.length === 0) {
          infoEl.textContent = '❌ Excel 文件为空';
          columnsEl.style.display = 'none';
          generateBtn.disabled = true;
          return;
        }

        const columns = Object.keys(excelData[0]);
        infoEl.textContent = `✅ 已加载 ${excelData.length} 行数据（点击列名插入占位符）`;
        columnsEl.style.display = 'block';
        columnsEl.innerHTML = '';
        columns.forEach(col => {
          const chip = document.createElement('span');
          chip.className = 'et-col-chip';
          chip.textContent = `{${col}}`;
          chip.title = '点击插入到模板';
          chip.addEventListener('click', () => {
            insertAtCursor(templateInput, `{${col}}`);
            updatePreview();
          });
          columnsEl.appendChild(chip);
        });
        updatePreview();
      } catch (err) {
        console.error('Excel 解析失败:', err);
        infoEl.textContent = `❌ 解析失败: ${err.message}`;
        columnsEl.style.display = 'none';
        generateBtn.disabled = true;
      }
    });
    input.click();
  });

  // 模板输入时更新预览
  templateInput.addEventListener('input', updatePreview);

  // 生成按钮
  generateBtn.addEventListener('click', generateFromTemplate);

  // 关闭按钮
  panel.querySelector('.et-close').addEventListener('click', closeExcelTemplatePanel);
  document.body.appendChild(panel);
  setTimeout(() => panel.classList.add('show'), 10);
  excelTemplatePanel = panel;
}

// ============ RSA 加解密面板 ============

let rsaPanel = null;

function closeRsaPanel() {
  if (rsaPanel) {
    rsaPanel.classList.remove('show');
    setTimeout(() => {
      if (rsaPanel) {
        rsaPanel.remove();
        rsaPanel = null;
      }
    }, 300);
  }
}

// ============ RSA 加解密（原生 JS BigInt 实现，兼容 Java RSA/ECB/NOPadding）============

// 辅助函数：UTF-8 字符串 → 字节数组
function utf8ToBytes(text) {
  return new Uint8Array(new TextEncoder().encode(text));
}

// 辅助函数：字节数组 → BigInt
function bytesToBigInt(bytes) {
  if (bytes.length === 0) return 0n;
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return BigInt('0x' + hex);
}

// 辅助函数：BigInt → 固定长度字节数组
function bigIntToFixedBytes(value, length) {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const rawLength = hex.length / 2;
  if (rawLength > length) throw new Error('结果长度超出密钥块大小');
  hex = hex.padStart(length * 2, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// 辅助函数：字节数组 → Base64
function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// 辅助函数：Base64 → 字节数组
function base64ToBytes(base64Text) {
  const binary = atob(base64Text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 模幂运算：base^exponent mod modulus
function modPow(base, exponent, modulus) {
  if (modulus === 1n) return 0n;
  let result = 1n;
  let currentBase = base % modulus;
  let currentExponent = exponent;
  while (currentExponent > 0n) {
    if ((currentExponent & 1n) === 1n) {
      result = (result * currentBase) % modulus;
    }
    currentExponent >>= 1n;
    currentBase = (currentBase * currentBase) % modulus;
  }
  return result;
}

// 读取 DER 长度
function readDerLength(bytes, offset) {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, nextOffset: offset + 1 };
  const count = first & 0x7f;
  if (count === 0 || count > 4) throw new Error('不支持的 DER 长度格式');
  let length = 0;
  for (let i = 0; i < count; i++) {
    length = (length << 8) | bytes[offset + 1 + i];
  }
  return { length, nextOffset: offset + 1 + count };
}

// 读取 DER 元素
function readDerElement(bytes, offset) {
  if (offset >= bytes.length) throw new Error('DER 读取越界');
  const tag = bytes[offset];
  const lengthInfo = readDerLength(bytes, offset + 1);
  const valueStart = lengthInfo.nextOffset;
  const valueEnd = valueStart + lengthInfo.length;
  if (valueEnd > bytes.length) throw new Error('DER 长度超出范围');
  return {
    tag,
    value: bytes.slice(valueStart, valueEnd),
    nextOffset: valueEnd
  };
}

// 去掉 INTEGER 前导零
function stripIntegerLeadingZero(bytes) {
  return bytes.length > 1 && bytes[0] === 0 ? bytes.slice(1) : bytes;
}

// 解析公钥（X.509 SubjectPublicKeyInfo）
function parsePublicKey(derBytes) {
  const top = readDerElement(derBytes, 0);
  if (top.tag !== 0x30) throw new Error('公钥格式错误');

  let offset = 0;
  const algorithm = readDerElement(top.value, offset);
  offset = algorithm.nextOffset;
  const bitString = readDerElement(top.value, offset);

  if (bitString.tag !== 0x03 || bitString.value[0] !== 0x00) {
    throw new Error('公钥 BIT STRING 格式错误');
  }

  const inner = bitString.value.slice(1);
  const innerSeq = readDerElement(inner, 0);

  let innerOffset = 0;
  const modulusEl = readDerElement(innerSeq.value, innerOffset);
  innerOffset = modulusEl.nextOffset;
  const exponentEl = readDerElement(innerSeq.value, innerOffset);

  const modulusBytes = stripIntegerLeadingZero(modulusEl.value);
  return {
    modulus: bytesToBigInt(modulusBytes),
    exponent: bytesToBigInt(exponentEl.value),
    byteLength: modulusBytes.length
  };
}

// 解析私钥（PKCS#8 PrivateKeyInfo）
function parsePrivateKey(derBytes) {
  const top = readDerElement(derBytes, 0);
  if (top.tag !== 0x30) throw new Error('私钥格式错误');

  let offset = 0;
  const version = readDerElement(top.value, offset);
  offset = version.nextOffset;
  const algorithm = readDerElement(top.value, offset);
  offset = algorithm.nextOffset;
  const privateKeyOctet = readDerElement(top.value, offset);

  const innerSeq = readDerElement(privateKeyOctet.value, 0);

  let innerOffset = 0;
  const rsaVersion = readDerElement(innerSeq.value, innerOffset);
  innerOffset = rsaVersion.nextOffset;
  const modulusEl = readDerElement(innerSeq.value, innerOffset);
  innerOffset = modulusEl.nextOffset;
  const publicExponentEl = readDerElement(innerSeq.value, innerOffset);
  innerOffset = publicExponentEl.nextOffset;
  const privateExponentEl = readDerElement(innerSeq.value, innerOffset);

  const modulusBytes = stripIntegerLeadingZero(modulusEl.value);
  return {
    modulus: bytesToBigInt(modulusBytes),
    exponent: bytesToBigInt(privateExponentEl.value),
    byteLength: modulusBytes.length
  };
}

// 解码密钥文本（去掉 PEM 头尾，转 Base64）
function decodeKeyText(keyText) {
  const normalized = keyText
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (!normalized) throw new Error('密钥内容为空');
  return base64ToBytes(normalized);
}

// 生成密钥对（使用 Web Crypto API 生成，然后导出）
async function rsaGenerateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const pubB64 = bytesToBase64(new Uint8Array(spki));
  const privB64 = bytesToBase64(new Uint8Array(pkcs8));

  return {
    publicKey: `-----BEGIN PUBLIC KEY-----\n${pubB64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`,
    privateKey: `-----BEGIN PRIVATE KEY-----\n${privB64.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`
  };
}

// 公钥加密（RSA/ECB/NoPadding）
function rsaEncrypt(text, publicKeyPem) {
  const derBytes = decodeKeyText(publicKeyPem);
  const keyInfo = parsePublicKey(derBytes);

  const source = utf8ToBytes(text);
  if (source.length > keyInfo.byteLength) {
    throw new Error(`明文过长：${source.length} 字节，最大 ${keyInfo.byteLength} 字节`);
  }

  const message = bytesToBigInt(source);
  if (message >= keyInfo.modulus) {
    throw new Error('明文数值超出模数范围');
  }

  const encrypted = modPow(message, keyInfo.exponent, keyInfo.modulus);
  const encryptedBytes = bigIntToFixedBytes(encrypted, keyInfo.byteLength);
  return bytesToBase64(encryptedBytes);
}

// 私钥解密（RSA/ECB/NoPadding）
function rsaDecrypt(cipherB64, privateKeyPem) {
  const derBytes = decodeKeyText(privateKeyPem);
  const keyInfo = parsePrivateKey(derBytes);

  const cipherBytes = base64ToBytes(cipherB64);
  if (cipherBytes.length > keyInfo.byteLength) {
    throw new Error('密文长度超过密钥块大小');
  }

  const cipherInt = bytesToBigInt(cipherBytes);
  const decrypted = modPow(cipherInt, keyInfo.exponent, keyInfo.modulus);
  const plainBytes = bigIntToFixedBytes(decrypted, keyInfo.byteLength);

  // 去掉前导零和尾部零（模拟 Java 的 trim）
  let start = 0, end = plainBytes.length;
  while (start < end && plainBytes[start] === 0) start++;
  while (end > start && plainBytes[end - 1] === 0) end--;

  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(plainBytes.slice(start, end));
  return decoded.trim();
}

function toggleRsaPanel() {
  if (rsaPanel) { closeRsaPanel(); return; }
  if (!activeTextarea) return;

  const panel = document.createElement('div');
  panel.className = 'rsa-panel';
  panel.innerHTML = `
    <div class="rsa-header">
      <span class="rsa-title"><i class="ph ph-lock-key"></i> RSA 加解密</span>
      <button class="rsa-close" title="关闭"><i class="ph ph-x"></i></button>
    </div>
    <div class="rsa-info">RSA 2048 位 · NoPadding 原始加密 · 完全兼容 Java</div>
    <div class="rsa-actions">
      <button class="rsa-btn rsa-gen">🔑 生成密钥对</button>
    </div>
    <textarea class="rsa-key rsa-pub" placeholder="公钥 (PEM) — 加密时使用"></textarea>
    <textarea class="rsa-key rsa-priv" placeholder="私钥 (PEM) — 解密时使用"></textarea>
    <label class="rsa-batch-label"><input type="checkbox" class="rsa-batch"> 批量模式（每行一条，逐行处理）</label>
    <div class="rsa-actions">
      <button class="rsa-btn rsa-encrypt">🔒 加密文本</button>
      <button class="rsa-btn rsa-decrypt">🔓 解密文本</button>
    </div>
    <div class="rsa-status"></div>
  `;

  const pubInput = panel.querySelector('.rsa-pub');
  const privInput = panel.querySelector('.rsa-priv');
  const statusEl = panel.querySelector('.rsa-status');
  const batchCheckbox = panel.querySelector('.rsa-batch');

  // 处理单条文本（加密或解密）
  function processOne(text, mode) {
    return mode === 'encrypt'
      ? rsaEncrypt(text, pubInput.value.trim())
      : rsaDecrypt(text, privInput.value.trim());
  }

  // 批量处理：按行拆分，逐行处理，保留空行位置
  function processBatch(text, mode) {
    const lines = text.split('\n');
    let success = 0, fail = 0;
    const results = lines.map(line => {
      if (!line.trim()) return line; // 空行保留
      try {
        const result = processOne(line.trim(), mode);
        success++;
        return result;
      } catch (e) {
        fail++;
        return `[失败: ${e.message}]`;
      }
    });
    statusEl.textContent = `✅ 成功 ${success} 条${fail ? `，❌ 失败 ${fail} 条` : ''}`;
    return results.join('\n');
  }

  // PLACEHOLDER_RSA_HANDLERS

  // 生成密钥对
  panel.querySelector('.rsa-gen').addEventListener('click', async () => {
    statusEl.textContent = '生成中...';
    try {
      const { publicKey, privateKey } = await rsaGenerateKeyPair();
      pubInput.value = publicKey;
      privInput.value = privateKey;
      statusEl.textContent = '✅ 已生成密钥对（请妥善保管私钥）';
    } catch (err) {
      statusEl.textContent = '❌ 生成失败: ' + err.message;
    }
  });

  // 加密
  panel.querySelector('.rsa-encrypt').addEventListener('click', () => {
    const ta = activeTextarea;
    if (!ta) return;
    if (!pubInput.value.trim()) { statusEl.textContent = '❌ 请先填入公钥'; return; }
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const hasSelection = s !== e;
    const target = hasSelection ? value.slice(s, e) : value;
    if (!target) { statusEl.textContent = '❌ 没有可加密的文本'; return; }
    try {
      const result = batchCheckbox.checked
        ? processBatch(target, 'encrypt')
        : processOne(target, 'encrypt');
      pushUndoSnapshot(ta);
      if (hasSelection) {
        ta.value = value.slice(0, s) + result + value.slice(e);
      } else {
        ta.value = result;
      }
      ta.focus(); saveContent(ta.value);
      if (!batchCheckbox.checked) statusEl.textContent = '✅ 已加密';
    } catch (err) {
      statusEl.textContent = '❌ 加密失败: ' + err.message;
    }
  });

  // 解密
  panel.querySelector('.rsa-decrypt').addEventListener('click', () => {
    const ta = activeTextarea;
    if (!ta) return;
    if (!privInput.value.trim()) { statusEl.textContent = '❌ 请先填入私钥'; return; }
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const hasSelection = s !== e;
    const target = hasSelection ? value.slice(s, e) : value;
    if (!target.trim()) { statusEl.textContent = '❌ 没有可解密的密文'; return; }
    try {
      const result = batchCheckbox.checked
        ? processBatch(target, 'decrypt')
        : processOne(target, 'decrypt');
      pushUndoSnapshot(ta);
      if (hasSelection) {
        ta.value = value.slice(0, s) + result + value.slice(e);
      } else {
        ta.value = result;
      }
      ta.focus(); saveContent(ta.value);
      if (!batchCheckbox.checked) statusEl.textContent = '✅ 已解密';
    } catch (err) {
      statusEl.textContent = '❌ 解密失败: ' + err.message;
    }
  });

  panel.querySelector('.rsa-close').addEventListener('click', closeRsaPanel);
  document.body.appendChild(panel);
  setTimeout(() => panel.classList.add('show'), 10);
  rsaPanel = panel;
}

// ============ 查找替换面板 ============

let findReplacePanel = null;

function closeFindReplacePanel() {
  if (findReplacePanel) {
    const panel = findReplacePanel;
    findReplacePanel = null;
    panel.classList.remove('show');
    setTimeout(() => panel.remove(), 300);
  }
}

// 执行替换：scope 为 'all' 全部替换，'first' 替换第一个
function doReplace(scope) {
  const ta = activeTextarea;
  if (!ta || !findReplacePanel) return;
  const findVal = findReplacePanel.querySelector('.fr-find').value;
  const replaceVal = findReplacePanel.querySelector('.fr-replace').value;
  const useRegex = findReplacePanel.querySelector('.fr-regex').checked;
  const caseSensitive = findReplacePanel.querySelector('.fr-case').checked;
  const statusEl = findReplacePanel.querySelector('.fr-status');
  if (findVal === '') { statusEl.textContent = '请输入查找内容'; return; }

  // 有选区则只在选区内操作，否则全文
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const hasSelection = s !== e;
  const target = hasSelection ? value.slice(s, e) : value;

  let pattern;
  try {
    if (useRegex) {
      const flags = (scope === 'all' ? 'g' : '') + (caseSensitive ? '' : 'i');
      pattern = new RegExp(findVal, flags);
    } else {
      const escaped = findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = (scope === 'all' ? 'g' : '') + (caseSensitive ? '' : 'i');
      pattern = new RegExp(escaped, flags);
    }
  } catch (err) {
    statusEl.textContent = '正则表达式错误: ' + err.message;
    return;
  }

  // 统计匹配数
  const countPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const matches = target.match(countPattern);
  const count = matches ? matches.length : 0;
  if (count === 0) { statusEl.textContent = '未找到匹配项'; return; }

  const replaced = target.replace(pattern, replaceVal);
  const newValue = hasSelection ? value.slice(0, s) + replaced + value.slice(e) : replaced;
  pushUndoSnapshot(ta);
  ta.value = newValue;
  ta.focus();
  saveContent(ta.value);
  refreshToolboxStats();
  const replacedCount = scope === 'all' ? count : 1;
  statusEl.textContent = `已替换 ${replacedCount} 处`;
}

function toggleFindReplacePanel() {
  if (findReplacePanel) { closeFindReplacePanel(); return; }
  if (!activeTextarea) return;

  const panel = document.createElement('div');
  panel.className = 'find-replace';
  panel.innerHTML = `
    <div class="fr-header">
      <span class="fr-title"><i class="ph ph-magnifying-glass"></i> 查找替换</span>
      <button class="fr-close" title="关闭"><i class="ph ph-x"></i></button>
    </div>
    <input class="fr-find" type="text" placeholder="查找内容">
    <input class="fr-replace" type="text" placeholder="替换为">
    <div class="fr-opts">
      <label><input type="checkbox" class="fr-regex"> 正则</label>
      <label><input type="checkbox" class="fr-case"> 区分大小写</label>
    </div>
    <div class="fr-actions">
      <button class="fr-btn fr-replace-first">替换</button>
      <button class="fr-btn fr-replace-all">全部替换</button>
    </div>
    <div class="fr-status"></div>
  `;
  panel.querySelector('.fr-close').addEventListener('click', closeFindReplacePanel);
  panel.querySelector('.fr-replace-first').addEventListener('click', () => doReplace('first'));
  panel.querySelector('.fr-replace-all').addEventListener('click', () => doReplace('all'));
  document.body.appendChild(panel);
  setTimeout(() => panel.classList.add('show'), 10);
  findReplacePanel = panel;
  panel.querySelector('.fr-find').focus();
}

function openToolbox() {
  if (toolboxPanel) { closeToolbox(); return; }
  if (!activeTextarea) return; // 只对文本便签生效

  // 清空撤回栈
  undoStack = [];

  const panel = document.createElement('div');
  panel.className = 'toolbox';
  panel.innerHTML = `
    <div class="tb-header">
      <span class="tb-title"><i class="ph ph-wrench"></i> 文本工具</span>
      <div class="tb-header-actions">
        <button class="tb-copy" title="复制全部内容"><i class="ph ph-copy"></i> 复制</button>
        <button class="tb-clear" title="清空内容"><i class="ph ph-trash"></i> 清空</button>
        <button class="tb-undo" title="无可撤回操作" disabled><i class="ph ph-arrow-u-up-left"></i> 撤回</button>
        <button class="tb-close" title="关闭"><i class="ph ph-x"></i></button>
      </div>
    </div>
    <div class="tb-stats"></div>
    <div class="tb-groups"></div>
  `;
  const groups = panel.querySelector('.tb-groups');
  TOOL_GROUPS.forEach(group => {
    const g = document.createElement('div');
    g.className = 'tb-group';
    const label = document.createElement('div');
    label.className = 'tb-group-title';
    label.textContent = group.title;
    g.appendChild(label);
    const btns = document.createElement('div');
    btns.className = 'tb-btns';
    group.items.forEach(item => {
      const b = document.createElement('button');
      b.className = 'tb-btn';
      b.textContent = item.label;
      b.addEventListener('click', () => {
        if (item.action === 'panel') { openTotpPanel(); return; }
        applyTool(TEXT_TOOLS[item.key]);
      });
      btns.appendChild(b);
    });
    g.appendChild(btns);
    groups.appendChild(g);
  });

  panel.querySelector('.tb-close').addEventListener('click', closeToolbox);
  panel.querySelector('.tb-undo').addEventListener('click', undoLastEdit);

  // 复制全部内容到剪贴板
  panel.querySelector('.tb-copy').addEventListener('click', async () => {
    const ta = activeTextarea;
    if (!ta) return;
    const copyBtn = panel.querySelector('.tb-copy');
    const original = copyBtn.textContent;
    try {
      await navigator.clipboard.writeText(ta.value);
      copyBtn.textContent = '✅ 已复制';
    } catch {
      // 降级方案：用 execCommand
      ta.select();
      document.execCommand('copy');
      ta.setSelectionRange(ta.value.length, ta.value.length);
      copyBtn.textContent = '✅ 已复制';
    }
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
  });

  // 清空内容（先存撤回快照，可恢复）
  panel.querySelector('.tb-clear').addEventListener('click', () => {
    const ta = activeTextarea;
    if (!ta || ta.value === '') return;
    pushUndoSnapshot(ta);
    ta.value = '';
    ta.focus();
    saveContent('');
    refreshToolboxStats();
  });

  document.body.appendChild(panel);
  toolboxPanel = panel;
  document.addEventListener('keydown', onToolboxEsc);

  // Electron 窗口向右加宽，让工具箱在便签框外侧展开、不遮住内容
  expandWindowForToolbox();

  // 触发动画
  setTimeout(() => panel.classList.add('show'), 10);

  // 选区变化时刷新统计
  activeTextarea.addEventListener('select', refreshToolboxStats);
  activeTextarea.addEventListener('keyup', refreshToolboxStats);
  activeTextarea.addEventListener('click', refreshToolboxStats);
  refreshToolboxStats();
}

const toolboxBtn = document.getElementById('toolBtn');
if (toolboxBtn) {
  toolboxBtn.addEventListener('click', openToolbox);
}

// ============ 工具箱下拉菜单 ============
const moreBtn = document.getElementById('moreBtn');
const toolboxDropdown = document.getElementById('toolboxDropdown');

if (moreBtn && toolboxDropdown) {
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toolboxDropdown.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!toolboxDropdown.contains(e.target) && e.target !== moreBtn) {
      toolboxDropdown.classList.remove('show');
    }
  });

  toolboxDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'search') toggleSearchPanel();
      else if (action === 'checklist') createChecklistNote();
      else if (action === 'image') triggerImageUpload();
      else if (action === 'file') openFileTransfer();
      else if (action === 'remind') showRemindPanel();
      else if (action === 'monaco') openMonacoEditor();
      toolboxDropdown.classList.remove('show');
    });
  });
}

// ============ Markdown 预览 ============

let markdownPreviewActive = false;
let markdownPreviewContainer = null;

function toggleMarkdownPreview() {
  if (!activeTextarea || currentNote.type !== 'text') return;

  if (markdownPreviewActive) {
    if (markdownPreviewContainer) {
      markdownPreviewContainer.remove();
      markdownPreviewContainer = null;
    }
    activeTextarea.style.display = '';
    markdownPreviewActive = false;
    updateMdToolBtn();
  } else {
    markdownPreviewActive = true;
    activeTextarea.style.display = 'none';
    markdownPreviewContainer = document.createElement('div');
    markdownPreviewContainer.className = 'markdown-preview';
    markdownPreviewContainer.innerHTML = marked.parse(activeTextarea.value || '*暂无内容*');
    activeTextarea.parentNode.appendChild(markdownPreviewContainer);
    markdownPreviewContainer.addEventListener('click', () => toggleMarkdownPreview());
    updateMdToolBtn();
  }
}

function updateMdToolBtn() {
  if (!toolboxPanel) return;
  const btn = toolboxPanel.querySelector('.tb-btn-md');
  if (btn) btn.classList.toggle('md-active', markdownPreviewActive);
}

// ============ 谷歌校验码 (TOTP) ============
let totpPanel = null;
let totpTimer = null;
const TOTP_STORAGE_KEY = 'stickyNotesTotpAccounts';

function totpBase32Decode(encoded) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  encoded = encoded.replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const c of encoded) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function totpGenerateCode(secret, period = 30, digits = 6) {
  const keyBytes = totpBase32Decode(secret);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const time = Math.floor(Date.now() / 1000 / period);
  const timeBytes = new ArrayBuffer(8);
  const view = new DataView(timeBytes);
  view.setUint32(4, time, false);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, timeBytes));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % Math.pow(10, digits);
  return String(code).padStart(digits, '0');
}

function totpLoadAccounts() {
  try { return JSON.parse(localStorage.getItem(TOTP_STORAGE_KEY) || '[]'); } catch { return []; }
}

function totpSaveAccounts(accounts) {
  localStorage.setItem(TOTP_STORAGE_KEY, JSON.stringify(accounts));
}

function openTotpPanel() {
  if (totpPanel) { closeTotpPanel(); return; }
  if (totpTimer) { clearInterval(totpTimer); totpTimer = null; }
  const panel = document.createElement('div');
  panel.className = 'totp-panel';
  panel.innerHTML = `
    <div class="totp-header">
      <span class="totp-title"><i class="ph ph-shield-check"></i> 谷歌校验码</span>
      <button class="totp-close" title="关闭"><i class="ph ph-x"></i></button>
    </div>
    <div class="totp-add-section">
      <input class="totp-input totp-name-input" type="text" placeholder="账户名称（如: GitHub）">
      <input class="totp-input totp-secret-input" type="text" placeholder="密钥（Base32，如: JBSWY3DPEHPK3PXP）">
      <button class="totp-add-btn">添加账户</button>
    </div>
    <div class="totp-list"></div>
  `;
  panel.querySelector('.totp-close').addEventListener('click', closeTotpPanel);
  panel.querySelector('.totp-add-btn').addEventListener('click', () => {
    const nameInput = panel.querySelector('.totp-name-input');
    const secretInput = panel.querySelector('.totp-secret-input');
    const name = nameInput.value.trim();
    const secret = secretInput.value.replace(/\s/g, '').trim();
    if (!name || !secret) { alert('请输入账户名称和密钥'); return; }
    if (!/^[A-Z2-7]+=*$/i.test(secret)) { alert('密钥格式错误，仅支持 Base32 字符'); return; }
    const accounts = totpLoadAccounts();
    accounts.push({ id: Date.now(), name, secret: secret.toUpperCase() });
    totpSaveAccounts(accounts);
    nameInput.value = '';
    secretInput.value = '';
    renderTotpList(panel);
  });
  document.body.appendChild(panel);
  setTimeout(() => panel.classList.add('show'), 10);
  totpPanel = panel;
  renderTotpList(panel);
}

function closeTotpPanel() {
  if (totpTimer) { clearInterval(totpTimer); totpTimer = null; }
  if (totpPanel) { totpPanel.classList.remove('show'); setTimeout(() => { if (totpPanel) { totpPanel.remove(); totpPanel = null; } }, 300); }
}

async function renderTotpList(panel) {
  const listEl = panel.querySelector('.totp-list');
  const accounts = totpLoadAccounts();
  if (!accounts.length) {
    listEl.innerHTML = '<div class="totp-empty">暂无账户，请添加</div>';
    return;
  }
  listEl.innerHTML = '';
  for (const acct of accounts) {
    const item = document.createElement('div');
    item.className = 'totp-item';
    item.innerHTML = `
      <div class="totp-item-header">
        <span class="totp-item-name">${escapeHTML(acct.name)}</span>
        <button class="totp-item-del" data-id="${acct.id}" title="删除"><i class="ph ph-x"></i></button>
      </div>
      <div class="totp-code">------</div>
      <div class="totp-progress"><div class="totp-progress-bar" style="width:100%"></div></div>
      <div class="totp-item-meta"></div>
    `;
    item.querySelector('.totp-item-del').addEventListener('click', () => {
      const accts = totpLoadAccounts().filter(a => a.id !== acct.id);
      totpSaveAccounts(accts);
      renderTotpList(panel);
    });
    item.querySelector('.totp-code').addEventListener('click', async (e) => {
      const code = await totpGenerateCode(acct.secret);
      navigator.clipboard.writeText(code).catch(() => {});
      const el = e.target;
      el.classList.add('copied');
      el.textContent = code;
      setTimeout(() => el.classList.remove('copied'), 1000);
    });
    listEl.appendChild(item);
  }
  updateTotpCodes();
  if (totpTimer) clearInterval(totpTimer);
  totpTimer = setInterval(updateTotpCodes, 1000);
}

async function updateTotpCodes() {
  if (!totpPanel) return;
  const accounts = totpLoadAccounts();
  const items = totpPanel.querySelectorAll('.totp-item');
  const period = 30;
  const now = Math.floor(Date.now() / 1000);
  const remaining = period - (now % period);
  for (let i = 0; i < items.length && i < accounts.length; i++) {
    const code = await totpGenerateCode(accounts[i].secret);
    const codeEl = items[i].querySelector('.totp-code');
    if (!codeEl.classList.contains('copied')) codeEl.textContent = code.slice(0, 3) + ' ' + code.slice(3);
    const bar = items[i].querySelector('.totp-progress-bar');
    bar.style.width = (remaining / period * 100) + '%';
    bar.style.background = remaining <= 5 ? '#f44336' : '#4caf50';
    const meta = items[i].querySelector('.totp-item-meta');
    meta.textContent = `${remaining}s 后刷新`;
  }
}

// ============ 选中词高亮 + 计数 + 跳转 ============
// textarea 无法内嵌高亮标记，采用「镜像背板」方案：在文本框背后放一层与其
// 完全同步的 div，把匹配到的词用 <mark> 包裹，滚动时同步位移。
let whTextarea = null, whBackdrop = null, whHighlights = null, whBar = null;
let whMatches = [], whTerm = '', whActive = -1, whJumping = false;

// 复制文本框的排版样式，保证背板换行/字号与文本框完全一致
function whCopyStyle() {
  if (!whTextarea || !whHighlights) return;
  const cs = getComputedStyle(whTextarea);
  ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textTransform', 'textIndent', 'wordSpacing', 'padding'].forEach(p => {
    whHighlights.style[p] = cs[p];
  });
  whHighlights.style.whiteSpace = 'pre-wrap';
  whHighlights.style.wordWrap = 'break-word';
  whHighlights.style.overflowWrap = 'break-word';
  whHighlights.style.boxSizing = 'border-box';
}

// 背板随文本框滚动同步位移
function whSyncScroll() {
  if (!whHighlights || !whTextarea) return;
  whHighlights.style.transform = `translateY(${-whTextarea.scrollTop}px)`;
}

// 重新渲染高亮标记
function whRenderMarks() {
  if (!whHighlights || !whTextarea) return;
  whHighlights.style.width = whTextarea.clientWidth + 'px';
  const text = whTextarea.value;
  let html = '';
  let last = 0;
  whMatches.forEach((m, i) => {
    html += escapeHTML(text.slice(last, m.start));
    const cls = i === whActive ? 'wh-mark wh-active' : 'wh-mark';
    html += `<mark class="${cls}">` + escapeHTML(text.slice(m.start, m.end)) + '</mark>';
    last = m.end;
  });
  html += escapeHTML(text.slice(last));
  whHighlights.innerHTML = html;
  whSyncScroll();
}

function whUpdateBar() {
  if (!whBar) return;
  whBar.querySelector('.wh-count').textContent = `${whActive + 1}/${whMatches.length}`;
  whBar.classList.add('show');
}

function whClear() {
  whMatches = []; whTerm = ''; whActive = -1;
  whJumping = false;
  if (whHighlights) whHighlights.innerHTML = '';
  if (whBar) whBar.classList.remove('show');
}

// 用户主动关闭（X 按钮 / Esc）：清除高亮并折叠选区，
// 避免关闭时残留的选区触发 select 事件把弹窗重新打开
function whDismiss() {
  whClear();
  if (whTextarea) {
    const pos = whTextarea.selectionEnd;
    // 折叠选区会触发一次 select，置位消费标记以跳过，避免重新搜索。
    // 必须在 whClear 之后置位，因为 whClear 会把该标记重置为 false
    whJumping = true;
    whTextarea.setSelectionRange(pos, pos);
  }
}

// 根据当前选区搜索所有相同的词并高亮
function whSearch() {
  if (!whTextarea) return;
  const s = whTextarea.selectionStart, e = whTextarea.selectionEnd;
  const term = whTextarea.value.slice(s, e);
  if (!term || !term.trim()) { whClear(); return; }
  const text = whTextarea.value;
  const matches = [];
  let i = 0;
  while (i <= text.length) {
    const idx = text.indexOf(term, i);
    if (idx === -1) break;
    matches.push({ start: idx, end: idx + term.length });
    i = idx + term.length;
  }
  if (matches.length === 0) { whClear(); return; }
  whTerm = term;
  whMatches = matches;
  whActive = matches.findIndex(m => m.start === s);
  if (whActive === -1) whActive = 0;
  whRenderMarks();
  whUpdateBar();
}

// 让当前激活的匹配项滚动进可视区
function whScrollActiveIntoView() {
  if (!whHighlights || !whTextarea) return;
  const mark = whHighlights.querySelector('mark.wh-active');
  if (!mark) return;
  const top = mark.offsetTop;
  const bottom = top + mark.offsetHeight;
  const viewTop = whTextarea.scrollTop;
  const viewBottom = viewTop + whTextarea.clientHeight;
  if (top < viewTop) whTextarea.scrollTop = Math.max(0, top - 8);
  else if (bottom > viewBottom) whTextarea.scrollTop = bottom - whTextarea.clientHeight + 8;
  whSyncScroll();
}

// 跳转到上/下一个匹配项（step 为 +1 或 -1，循环）
function whJump(step) {
  if (whMatches.length < 2) return;
  whActive = (whActive + step + whMatches.length) % whMatches.length;
  const m = whMatches[whActive];
  // setSelectionRange 触发的 select 事件是异步的，置位「消费一次」标记，
  // 让随后到达的 select 事件跳过 whSearch，避免关闭后又被重新打开
  whJumping = true;
  whTextarea.focus();
  whTextarea.setSelectionRange(m.start, m.end);
  whRenderMarks();
  whScrollActiveIntoView();
  whUpdateBar();
}

function whKeydown(e) {
  if (e.key === 'F3') {
    e.preventDefault();
    whJump(e.shiftKey ? -1 : 1);
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
    e.preventDefault();
    whJump(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Escape' && whMatches.length) {
    whDismiss();
    e.stopPropagation();
  }
}

function whSyncFont() {
  if (!whHighlights) return;
  whCopyStyle();
  if (whMatches.length) whRenderMarks();
}

// 为文本便签的 textarea 装配高亮层与计数条
function setupWordHighlight(textarea) {
  whMatches = []; whTerm = ''; whActive = -1; whJumping = false;
  const card = document.getElementById('noteCard');
  const oldBar = card.querySelector('.word-hl-bar');
  if (oldBar) oldBar.remove();

  const container = document.createElement('div');
  container.className = 'hl-container';
  const backdrop = document.createElement('div');
  backdrop.className = 'hl-backdrop';
  const highlights = document.createElement('div');
  highlights.className = 'hl-highlights';
  backdrop.appendChild(highlights);
  textarea.parentNode.insertBefore(container, textarea);
  container.appendChild(backdrop);
  container.appendChild(textarea);

  whTextarea = textarea;
  whBackdrop = backdrop;
  whHighlights = highlights;
  whCopyStyle();

  const bar = document.createElement('div');
  bar.className = 'word-hl-bar';
  bar.innerHTML = `
    <button class="wh-prev" title="上一个 (Shift+F3)"><i class="ph ph-caret-up"></i></button>
    <span class="wh-count">0/0</span>
    <button class="wh-next" title="下一个 (F3)"><i class="ph ph-caret-down"></i></button>
    <span class="wh-sep"></span>
    <button class="wh-close" title="清除 (Esc)"><i class="ph ph-x"></i></button>
  `;
  // preventDefault 让点击工具条时焦点不离开 textarea，
  // 使 X 按钮的关闭路径与可用的 Esc 路径完全一致（否则点击会先 blur，
  // 折叠选区失效且焦点切换又重新触发搜索，弹窗关不掉）
  bar.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
  bar.querySelector('.wh-prev').addEventListener('click', () => whJump(-1));
  bar.querySelector('.wh-next').addEventListener('click', () => whJump(1));
  bar.querySelector('.wh-close').addEventListener('click', () => whDismiss());
  card.appendChild(bar);
  whBar = bar;

  textarea.addEventListener('select', () => {
    // whJump 触发的 select 事件在此消费标记并跳过搜索
    if (whJumping) { whJumping = false; return; }
    whSearch();
  });
  textarea.addEventListener('scroll', whSyncScroll);
  textarea.addEventListener('input', whClear);
  textarea.addEventListener('keydown', whKeydown);
}

// 窗口尺寸变化时重排高亮层
window.addEventListener('resize', () => {
  if (whHighlights && whMatches.length) { whCopyStyle(); whRenderMarks(); }
});

function showImagePreview(src) {
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay'; overlay.innerHTML = `<img src="${src}">`;
  overlay.addEventListener('click', () => overlay.remove()); document.body.appendChild(overlay);
}

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function escapeHTML(str) {
  const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML;
}


loadNote();
setupDrag();
setupOps();

// ============ 连接状态监控 ============

let isConnected = true;
let statusCheckTimer = null;

function updateStatusUI(online) {
  const statusEl = document.getElementById('noteStatus');
  if (!statusEl) return;
  if (online) {
    statusEl.classList.remove('offline');
    statusEl.querySelector('.status-text').textContent = '在线';
  } else {
    statusEl.classList.add('offline');
    statusEl.querySelector('.status-text').textContent = '离线';
  }
}

async function checkConnection() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SERVER}/api/notes`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: getAuthHeaders(),
    });
    clearTimeout(timeout);
    const online = res.ok || res.status === 401;
    if (online !== isConnected) {
      isConnected = online;
      updateStatusUI(online);
      if (online) syncFromServer();
      restartStatusCheck();
    }
  } catch {
    if (isConnected) {
      isConnected = false;
      updateStatusUI(false);
      restartStatusCheck();
    }
  }
}

function restartStatusCheck() {
  clearInterval(statusCheckTimer);
  statusCheckTimer = setInterval(checkConnection, isConnected ? 5000 : 2000);
}

setInterval(async () => {
  if (!currentNote) return;
  try {
    const res = await fetch(`${SERVER}/api/notes`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const notes = await res.json();
    const latest = notes.find(n => n.id === noteId);
    if (!latest) return;

    const textarea = document.querySelector('.note-content');
    // 正在编辑时，跳过所有同步逻辑（包括重渲染）
    if (textarea && document.hasFocus() && document.activeElement === textarea) return;
    if (textarea && textareaDirty) return;

    // 内容变化时整体重渲染
    if (latest.type !== currentNote.type || latest.content !== currentNote.content || latest.theme !== currentNote.theme) {
      currentNote = latest;
      renderNote();
      return;
    }
    if (textarea) {
      let textVal = latest.content || '';
      try {
        const parsed = JSON.parse(latest.content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'text' in parsed) {
          textVal = parsed.text || '';
        }
      } catch {}
      if (textarea.value !== textVal) textarea.value = textVal;
    }
    const card = document.getElementById('noteCard');
    const theme = latest.theme ? THEMES.find(t => t.id === latest.theme) : null;
    if (theme) {
      if (card && card.style.background !== theme.bg) {
        card.style.background = theme.bg;
        card.style.color = theme.text;
        card.style.boxShadow = theme.glow || '0 4px 20px rgba(0,0,0,0.35)';
        card.style.border = `1px solid ${theme.accent}33`;
        card.dataset.theme = theme.id;
      }
    } else {
      if (card && card.style.background !== latest.color) {
        card.style.background = latest.color;
        card.style.color = isLight(latest.color) ? '#333' : '#fff';
        card.style.boxShadow = '';
        card.style.border = '';
        card.dataset.theme = '';
      }
    }
    currentNote = latest;
  } catch (e) {}
}, 2000);
