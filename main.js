const { app, BrowserWindow, Menu, Tray, screen, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const multer = require('multer');
const fs = require('fs');

let noteWindows = new Map();
let server = null;
let io = null;
let onNoteCreatedViaHTTP = null;
let tray = null;

const PORT = 3456;
const userDataPath = app.getPath('userData');
const uploadsDir = path.join(userDataPath, 'uploads');
const dbPath = path.join(userDataPath, 'db.json');
const configPath = path.join(userDataPath, 'config.json');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function generateAuthCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (cfg.alwaysOnTop === undefined) cfg.alwaysOnTop = process.platform !== 'win32';
    // 服务器模式且无验证码时自动生成
    if (!cfg.serverAddress && !cfg.authCode) {
      cfg.authCode = generateAuthCode();
      saveConfig(cfg);
    }
    return cfg;
  } catch {
    return { serverAddress: '', alwaysOnTop: process.platform !== 'win32' };
  }
}

function saveConfig(cfg) {
  // 合并已有配置，避免只传部分字段时覆盖其他设置
  const merged = { ...loadConfig(), ...cfg };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
  return merged;
}

const config = loadConfig();
const isServer = !config.serverAddress;
const serverUrl = isServer ? `http://localhost:${PORT}` : config.serverAddress;

const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({ notes: [] }).write();

function genId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function startLocalServer() {
  const expressApp = express();
  server = http.createServer(expressApp);
  io = new Server(server);

  io.on('connection', (socket) => {
  });

  // 验证码中间件
  function authMiddleware(req, res, next) {
    const serverAuthCode = config.authCode;
    // 如果服务器未设置验证码，则不验证（向后兼容）
    if (!serverAuthCode) return next();
    // 本机请求放行（验证码仅用于拦截局域网内其他机器）
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
    const clientCode = req.headers['x-auth-code'];
    if (clientCode !== serverAuthCode) {
      return res.status(401).json({ error: '验证码错误或缺失' });
    }
    next();
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  });
  const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

    expressApp.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, maxAge: 0 }));
    expressApp.use('/uploads', express.static(uploadsDir));
  expressApp.use(express.json());

  // 应用验证码中间件到所有 API 路由
  expressApp.use('/api', authMiddleware);

  expressApp.get('/api/notes', (req, res) => {
    res.json(db.get('notes').value());
  });

  expressApp.get('/api/notes/:id', (req, res) => {
    const note = db.get('notes').find({ id: req.params.id }).value();
    if (note) res.json(note);
    else res.status(404).json({ error: 'Not found' });
  });

  expressApp.post('/api/notes', (req, res) => {
    const { content = '', type = 'text', color = '#ffeb3b', x = 100, y = 100, width = 240, height = 200 } = req.body;
    const note = {
      id: genId(),
      content, type, color, x, y, width, height,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.get('notes').push(note).write();
    io.emit('note:created', note);
    if (onNoteCreatedViaHTTP) onNoteCreatedViaHTTP(note);
    res.json(note);
  });

  expressApp.put('/api/notes/:id', (req, res) => {
    const { content, type, color, x, y, width, height } = req.body;
    const note = db.get('notes').find({ id: req.params.id });
    if (note.value()) {
      const patch = { updated_at: new Date().toISOString() };
      if (content !== undefined) patch.content = content;
      if (type !== undefined) patch.type = type;
      if (color !== undefined) patch.color = color;
      if (x !== undefined) patch.x = x;
      if (y !== undefined) patch.y = y;
      if (width !== undefined) patch.width = width;
      if (height !== undefined) patch.height = height;
      note.assign(patch).write();
      const updated = db.get('notes').find({ id: req.params.id }).value();
      io.emit('note:updated', updated);
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  expressApp.delete('/api/notes/:id', (req, res) => {
    db.get('notes').remove({ id: req.params.id }).write();
    io.emit('note:deleted', { id: req.params.id });
    const win = noteWindows.get(req.params.id);
    if (win && !win.isDestroyed()) win.close();
    res.json({ ok: true });
  });

  expressApp.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({
      url: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        dialog.showErrorBox(
          '端口被占用',
          `端口 ${PORT} 已被占用，可能有另一个便签实例正在运行。\n请先退出已有实例（菜单栏托盘图标 → 退出）后再启动。`
        );
      } else {
        dialog.showErrorBox('服务启动失败', String(err.message || err));
      }
      app.quit();
      reject(err);
    });
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server on port ${PORT}`);
      resolve();
    });
  });
}

function addNote(data) {
  const { content = '', type = 'text', color = '#ffeb3b' } = data;
  const note = {
    id: genId(),
    content, type, color,
    x: 100 + Math.random() * 300,
    y: 100 + Math.random() * 200,
    width: type === 'image' ? 280 : 240,
    height: type === 'image' ? 280 : 200,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (isServer) {
    db.get('notes').push(note).write();
    if (io) io.emit('note:created', note);
    createNoteWindow(note);
  } else {
    const http_ = require('http');
    const postData = JSON.stringify(note);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    // 客户端模式：添加验证码到请求头
    if (config.clientAuthCode) {
      headers['X-Auth-Code'] = config.clientAuthCode;
    }
    const req = http_.request(`${serverUrl}/api/notes`, {
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const saved = JSON.parse(data);
          createNoteWindow(saved);
        } catch (e) {}
      });
    });
    req.on('error', () => {});
    req.write(postData);
    req.end();
  }
}

ipcMain.on('note:create', (e, data) => addNote(data));

ipcMain.on('note:close', (e, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

ipcMain.on('note:minimize', (e, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on('note:maximize', (e, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('note:focus', (e, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

ipcMain.on('note:togglePin', (e, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    const current = win.isAlwaysOnTop();
    win.setAlwaysOnTop(!current);
    e.returnValue = !current; // 同步返回新状态
  } else {
    e.returnValue = false;
  }
});

ipcMain.on('note:isPinned', (e, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    e.returnValue = win.isAlwaysOnTop();
  } else {
    e.returnValue = false;
  }
});

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (e, cfg) => {
  saveConfig(cfg);
  // 实时应用「总是置顶」设置到所有打开的便签窗口
  if (cfg.alwaysOnTop !== undefined) {
    noteWindows.forEach(w => {
      if (!w.isDestroyed()) w.setAlwaysOnTop(!!cfg.alwaysOnTop);
    });
  }
  return { ok: true };
});
ipcMain.handle('config:generateAuthCode', () => {
  const newCode = generateAuthCode();
  saveConfig({ authCode: newCode });
  return { authCode: newCode };
});

function createNoteWindow(note) {
  const win = new BrowserWindow({
    x: Math.round(note.x),
    y: Math.round(note.y),
    width: note.width || 240,
    height: note.height || 200,
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: true,
    alwaysOnTop: config.alwaysOnTop,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL(`${serverUrl}/note.html?id=${note.id}&server=${encodeURIComponent(serverUrl)}`);
  noteWindows.set(note.id, win);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    noteWindows.delete(note.id);
  });

  win.on('move', () => {
    if (win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const n = db.get('notes').find({ id: note.id });
    if (n.value()) n.assign({ x, y, width: w, height: h }).write();
  });
}

function loadAllNotes() {
  const notes = db.get('notes').value();
  notes.forEach(note => createNoteWindow(note));
}

function restoreAllNotes() {
  noteWindows.forEach(w => {
    if (!w.isDestroyed()) {
      if (w.isMinimized()) w.restore();
      w.show();
    }
  });
}

function createTray() {
  // 创建应用菜单（macOS 显示在顶部菜单栏）
  const template = [
    {
      label: '共享便签',
      submenu: [
        { label: '新增便签', accelerator: 'CommandOrControl+N', click: () => addNote({ type: 'text', color: '#ffeb3b' }) },
        { label: '显示所有便签', click: () => restoreAllNotes() },
        { type: 'separator' },
        { label: '设置', accelerator: 'CommandOrControl+,', click: () => openSettings() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CommandOrControl+Q', click: () => { noteWindows.forEach(w => !w.isDestroyed() && w.destroy()); app.quit(); } },
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // 创建系统托盘图标（Windows/Linux 显示在任务栏托盘区）
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, 'iconTemplate.png')
    : path.join(__dirname, 'icon.png');

  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: '新增便签', click: () => addNote({ type: 'text', color: '#ffeb3b' }) },
      { label: '显示所有便签', click: () => restoreAllNotes() },
      { type: 'separator' },
      { label: '设置', click: () => openSettings() },
      { type: 'separator' },
      { label: '退出', click: () => { noteWindows.forEach(w => !w.isDestroyed() && w.destroy()); app.quit(); } },
    ]);
    tray.setToolTip('共享便签');
    tray.setContextMenu(contextMenu);

    // Windows 下双击托盘图标显示所有便签，单击弹出菜单
    if (process.platform === 'win32') {
      tray.on('click', () => {
        tray.popUpContextMenu();
      });
      tray.on('double-click', () => restoreAllNotes());
    }
  }
}

function openSettings() {
  const win = new BrowserWindow({
    width: 420,
    height: 400,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`${serverUrl}/settings.html?server=${encodeURIComponent(serverUrl)}`);
}

function loadAllNotesFromRemote() {
  const http_ = require('http');
  function poll() {
    const url = new URL(`${serverUrl}/api/notes`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      headers: {},
    };
    // 客户端模式：添加验证码到请求头
    if (config.clientAuthCode) {
      options.headers['X-Auth-Code'] = config.clientAuthCode;
    }
    http_.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const notes = JSON.parse(data);
          const remoteIds = new Set(notes.map(n => n.id));
          notes.forEach(note => {
            if (!noteWindows.has(note.id)) {
              createNoteWindow(note);
            }
          });
          noteWindows.forEach((win, id) => {
            if (!remoteIds.has(id) && !win.isDestroyed()) {
              win.close();
            }
          });
        } catch (e) {}
      });
    }).on('error', () => {});
  }
  poll();
  setInterval(poll, 3000);
}

app.whenReady().then(async () => {
  if (isServer) {
    onNoteCreatedViaHTTP = (note) => createNoteWindow(note);
    await startLocalServer();
  }
  createTray();
  if (isServer) {
    loadAllNotes();
  } else {
    loadAllNotesFromRemote();
  }
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    addNote({ type: 'text', color: '#ffeb3b' });
  });
});

app.on('window-all-closed', () => {});
app.on('activate', () => noteWindows.forEach(w => !w.isDestroyed() && w.show()));
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (server) { try { server.close(); } catch (e) {} }
});
