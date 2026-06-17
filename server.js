const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
const dbPath = path.join(__dirname, 'db.json');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({ notes: [] }).write();

// 加载验证码配置（从环境变量或 config.json）
const configPath = path.join(__dirname, 'config.json');
let authCode = process.env.AUTH_CODE || null;
if (!authCode && fs.existsSync(configPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    authCode = cfg.authCode || null;
  } catch {}
}

function genId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// 验证码中间件
function authMiddleware(req, res, next) {
  // 如果服务器未设置验证码，则不验证（向后兼容）
  if (!authCode) return next();
  // 本机请求放行（验证码仅用于拦截局域网内其他机器）
  const ip = req.ip || req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  const clientCode = req.headers['x-auth-code'];
  if (clientCode !== authCode) {
    return res.status(401).json({ error: '验证码错误或缺失' });
  }
  next();
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());

// 应用验证码中间件到所有 API 路由
app.use('/api', authMiddleware);

app.get('/api/notes', (req, res) => res.json(db.get('notes').value()));

app.post('/api/notes', (req, res) => {
  const { content = '', type = 'text', color = '#ffeb3b', x = 100, y = 100, width = 240, height = 200 } = req.body;
  const note = { id: genId(), content, type, color, x, y, width, height, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  db.get('notes').push(note).write();
  io.emit('note:created', note);
  res.json(note);
});

app.put('/api/notes/:id', (req, res) => {
  const note = db.get('notes').find({ id: req.params.id });
  if (!note.value()) return res.status(404).json({ error: 'Not found' });
  const { content, color, x, y, width, height } = req.body;
  const patch = { updated_at: new Date().toISOString() };
  if (content !== undefined) patch.content = content;
  if (color !== undefined) patch.color = color;
  if (x !== undefined) patch.x = x;
  if (y !== undefined) patch.y = y;
  if (width !== undefined) patch.width = width;
  if (height !== undefined) patch.height = height;
  note.assign(patch).write();
  const updated = db.get('notes').find({ id: req.params.id }).value();
  io.emit('note:updated', updated);
  res.json(updated);
});

app.delete('/api/notes/:id', (req, res) => {
  db.get('notes').remove({ id: req.params.id }).write();
  io.emit('note:deleted', { id: req.params.id });
  res.json({ ok: true });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}`, originalName: req.file.originalname, size: req.file.size, type: req.file.mimetype });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
    }
  }
  console.log(`\n  Shared Sticky Notes running!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}\n`);
});
