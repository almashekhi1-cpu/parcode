const express = require('express');
const compression = require('compression');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Data storage (JSON file)
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Cache form HTML in memory
const formHTML = fs.readFileSync(path.join(__dirname, 'form.html'), 'utf8');

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the form
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(formHTML);
});

// Handle form submission
app.post('/submit', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'الاسم ورقم الجوال مطلوبان' });
  }

  const data = loadData();
  const now = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
  data.push({ id: data.length + 1, name, phone, created_at: now });
  saveData(data);

  console.log(`✅ تم حفظ: ${name} - ${phone}`);
  res.json({ success: true });
});

// Download Excel
app.get('/download', (req, res) => {
  const data = loadData();
  const rows = data.map(r => ({ 'الاسم': r.name, 'رقم الجوال': r.phone, 'التاريخ والوقت': r.created_at }));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows, { header: ['الاسم', 'رقم الجوال', 'التاريخ والوقت'] });
  ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }];
  xlsx.utils.book_append_sheet(wb, ws, 'البيانات');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Admin page
app.get('/admin', (req, res) => {
  const data = loadData();
  const total = data.length;

  const tableRows = [...data].reverse().map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.phone}</td>
      <td>${r.created_at}</td>
    </tr>`).join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>لوحة البيانات - ورود الواحة الزراعية</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }
    .header { background: linear-gradient(135deg,#1a1a2e,#0f3460); color: white; padding: 24px 30px; border-radius: 14px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; font-size: 1.4rem; }
    .badge { background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 0.9rem; }
    .download-btn { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; margin-bottom: 20px; }
    .download-btn:hover { background: #219a52; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    th { background: #1a1a2e; color: white; padding: 14px 16px; text-align: right; font-weight: 600; }
    td { padding: 13px 16px; border-bottom: 1px solid #f0f0f0; color: #333; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8f9ff; }
    .empty { text-align: center; padding: 40px; color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ورود الواحة الزراعية — لوحة البيانات</h1>
    <span class="badge">إجمالي المسجلين: ${total}</span>
  </div>
  <a href="/download" class="download-btn">⬇️ تحميل Excel</a>
  <table>
    <thead><tr><th>#</th><th>الاسم</th><th>رقم الجوال</th><th>التاريخ والوقت</th></tr></thead>
    <tbody>${tableRows || '<tr><td colspan="4" class="empty">لا توجد بيانات بعد</td></tr>'}</tbody>
  </table>
</body>
</html>`);
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n🚀 السيرفر شغال على: http://${ip}:${PORT}`);
  console.log(`📊 لوحة البيانات: http://${ip}:${PORT}/admin`);
  console.log(`⬇️  تحميل Excel:   http://${ip}:${PORT}/download\n`);
});
