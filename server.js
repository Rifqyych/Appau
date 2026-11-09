'use strict';

require("dotenv").config();
const express = require('express');
const cors = require("cors");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const os = require('os');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());

// Server Express ini menjadi pusat aplikasi: menerima laporan user, membaca/menulis
// database XAMPP, menyediakan dashboard admin, dan menyiapkan integrasi WhatsApp.
const PORT = process.env.PORT || 8890;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const STORAGE = (process.env.STORAGE || 'json').trim().toLowerCase();
const USE_MYSQL = STORAGE === 'mysql';
const MYSQL_DATE_FIELDS = ['createdAt', 'updatedAt', 'assignedAt', 'dueAt'];
const WHATSAPP_PROVIDER = (process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
const WHATSAPP_META_TOKEN = process.env.WHATSAPP_META_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';
const WHATSAPP_WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL || '';
const WHATSAPP_WEBHOOK_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || '';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'reports.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
let mysqlPool = null;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---- upload config (foto bukti pengerjaan) -----------------------------
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Hanya berkas gambar (JPG, PNG, WEBP) yang diperbolehkan.'));
  }
});

const roomImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});

const DEFAULT_ROOMS = [
  { id: 'rektorat-lt1', code: 'RKT-01', name: 'Rektorat Lantai 1', building: 'Rektorat', floor: '1' },
  { id: 'perpus-lt2', code: 'LIB-02', name: 'Ruang Baca Lantai 2', building: 'Perpustakaan Pusat', floor: '2' },
  { id: 'ft-lab-jaringan', code: 'FT-LAB-NET', name: 'Lab Jaringan', building: 'Fakultas Teknik', floor: '2' },
  { id: 'fk-lab-komputer', code: 'FK-LAB-PC', name: 'Lab Komputer', building: 'Fakultas Kedokteran', floor: '3' },
  { id: 'fe-admin', code: 'FE-ADM', name: 'Administrasi Fakultas Ekonomi', building: 'Fakultas Ekonomi', floor: '1' },
  { id: 'asrama-a', code: 'ASM-A', name: 'Asrama Mahasiswa Blok A', building: 'Asrama Mahasiswa', floor: '1' }
];

// ---- storage helpers ---------------------------------------------------
function getMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db-sppd',

      // Semua timestamp database disimpan dan dibaca sebagai UTC.
      timezone: 'Z',

      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      charset: 'utf8mb4'
    });
  }

  return mysqlPool;
}

// baca semua data dari MySQL, rapiin ke struktur yang sama kayak mode JSON
// biar routes di atas gak perlu tau lagi pake storage apa
async function loadDB() {
  if (!USE_MYSQL) return loadJsonDB();
  const pool = getMysqlPool();
  const [reportsRows] = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
  const [logsRows] = await pool.query('SELECT * FROM report_logs ORDER BY created_at ASC, id ASC');
  const [photosRows] = await pool.query('SELECT * FROM report_photos ORDER BY created_at ASC, id ASC');
  const [officerRows] = await pool.query('SELECT * FROM officers ORDER BY name ASC');
  const [tokenRows] = await pool.query('SELECT token, officer_id FROM officer_tokens');
  const [seqRows] = await pool.query("SELECT value FROM app_sequences WHERE name = 'reports' LIMIT 1");

  const logsByTicket = groupBy(logsRows, 'ticket_no');
  const photosByTicket = groupBy(photosRows, 'ticket_no');
  const reports = reportsRows.map(row => ({
    id: row.ticket_no,
    area: row.area,
    roomCategory: row.room_category || '',
    category: row.category,
    reporter: row.reporter,
    contact: row.contact,
    detail: row.detail,
    status: row.status,
    assignedTo: row.assigned_to || null,
    assignedName: row.assigned_name || null,
    assignedAt: toIso(row.assigned_at),
    dueAt: toIso(row.due_at),
    photos: (photosByTicket[row.ticket_no] || []).map(photo => ({
      file: photo.file_name,
      at: toIso(photo.created_at),
      by: photo.uploaded_by || ''
    })),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    log: (logsByTicket[row.ticket_no] || []).map(log => ({
      at: toIso(log.created_at),
      status: log.status,
      note: log.note || ''
    }))
  }));

  const tokens = {};
  tokenRows.forEach(row => { tokens[row.token] = row.officer_id; });

  return {
    reports,
    seq: seqRows[0] ? Number(seqRows[0].value) : reports.length,
    officers: officerRows.map(row => ({
      id: row.id,
      username: row.username,
      name: row.name,
      phone: row.phone || '',
      salt: row.salt,
      hash: row.hash,
      active: !!row.active,
      createdAt: toIso(row.created_at)
    })),
    tokens
  };
}

// mode JSON tinggal tulis file. mode MySQL: delete semua terus insert ulang,
// dibungkus 1 transaction biar kalo gagal di tengah gak korup datanya
async function saveDB(db) {
  normalizeDB(db);
  if (!USE_MYSQL) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return;
  }

  const pool = getMysqlPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM officer_tokens');
    await conn.query('DELETE FROM report_photos');
    await conn.query('DELETE FROM report_logs');
    await conn.query('DELETE FROM reports');
    await conn.query('DELETE FROM officers');
    await conn.query(
      "INSERT INTO app_sequences (name, value) VALUES ('reports', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [db.seq || 0]
    );

    for (const officer of db.officers) {
      await conn.query(
        `INSERT INTO officers (id, username, name, phone, salt, hash, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          officer.id, officer.username, officer.name, officer.phone || '',
          officer.salt, officer.hash, officer.active ? 1 : 0, sqlDate(officer.createdAt)
        ]
      );
    }

    for (const report of db.reports) {
      await conn.query(
        `INSERT INTO reports
         (ticket_no, area, room_category, category, reporter, contact, detail, status, assigned_to, assigned_name, assigned_at, due_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          report.id, report.area, report.roomCategory || '', report.category, report.reporter, report.contact,
          report.detail, report.status, report.assignedTo || null, report.assignedName || null,
          sqlDate(report.assignedAt), sqlDate(report.dueAt), sqlDate(report.createdAt), sqlDate(report.updatedAt)
        ]
      );

      for (const log of report.log || []) {
        await conn.query(
          'INSERT INTO report_logs (ticket_no, status, note, created_at) VALUES (?, ?, ?, ?)',
          [report.id, log.status, log.note || '', sqlDate(log.at)]
        );
      }

      for (const photo of report.photos || []) {
        await conn.query(
          'INSERT INTO report_photos (ticket_no, file_name, uploaded_by, created_at) VALUES (?, ?, ?, ?)',
          [report.id, photo.file, photo.by || '', sqlDate(photo.at)]
        );
      }
    }

    for (const [token, officerId] of Object.entries(db.tokens || {})) {
      await conn.query(
        'INSERT INTO officer_tokens (token, officer_id) VALUES (?, ?)',
        [token, officerId]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// baca dari data/reports.json (mode STORAGE=json)
function loadJsonDB() {
  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    db = { reports: [], seq: 0 };
  }
  return normalizeDB(db);
}

// jaga-jaga file json-nya kosong/rusak/field baru belum ada, dikasih default
function normalizeDB(db) {
  if (!Array.isArray(db.reports)) db.reports = [];
  if (typeof db.seq !== 'number') db.seq = 0;
  if (!Array.isArray(db.officers)) db.officers = [];
  db.officers.forEach(officer => {
    if (officer.phone == null) officer.phone = '';
  });
  if (!db.tokens || typeof db.tokens !== 'object') db.tokens = {};
  return db;
}

// auto-migrate: tambah kolom phone ke tabel officers kalo instalasi lama belum ada
async function ensureMysqlSchema() {
  if (!USE_MYSQL) return;
  const dbName = process.env.DB_NAME || 'db-sppd';
  const pool = getMysqlPool();
  const [columns] = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'officers' AND column_name = 'phone'`,
    [dbName]
  );
  if (!columns.length) {
    await pool.query("ALTER TABLE officers ADD COLUMN phone VARCHAR(80) NULL AFTER name");
  }
}

// ambil daftar ruangan dari MySQL/json, urut per kategori. tabel kosong = auto seed default
async function loadRooms() {
  if (!USE_MYSQL) return loadJsonRooms();
  const [rows] = await getMysqlPool().query(`SELECT * FROM rooms ORDER BY FIELD(category, 'Asisten', 'Staf Ahli', 'Dinas', 'Badan', 'Bagian', 'Kecamatan Dataran Rendah', 'Kecamatan Dataran Tinggi'),code ASC`);
  const rooms = rows.map(row => normalizeRoom({
    id: row.id,
    code: row.code,
    name: row.name,
    building: row.building,
    floor: row.floor,
    category: row.category,
    leader: row.leader,
    phone: row.phone,
    note: row.note
  }));
  if (rooms.length) return rooms;
  const fallback = loadJsonRooms();
  await saveRooms(fallback);
  return fallback;
}

// simpan ruangan baru -- ini REPLACE semua data lama, bukan nambah
async function saveRooms(rooms) {
  const normalized = rooms.map(normalizeRoom).filter(r => r.name);
  if (!USE_MYSQL) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(normalized, null, 2));
    return;
  }
  const conn = await getMysqlPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM rooms');
    for (const room of normalized) {
      await conn.query(
        `INSERT INTO rooms (id, code, name, building, floor, category, leader, phone, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [room.id, room.code, room.name, room.building, room.floor, room.category, room.leader, room.phone, room.note]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// baca dari data/rooms.json (mode STORAGE=json)
function loadJsonRooms() {
  let rooms;
  try {
    rooms = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
  } catch (e) {
    rooms = DEFAULT_ROOMS;
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms.map(normalizeRoom).filter(r => r.name), null, 2));
  }
  if (!Array.isArray(rooms)) rooms = DEFAULT_ROOMS;
  return rooms.map(normalizeRoom).filter(r => r.name);
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key];
    if (!acc[value]) acc[value] = [];
    acc[value].push(row);
    return acc;
  }, {});
}

function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sqlDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Simpan DATETIME MySQL dalam UTC
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// tanggal (YYYY-MM-DD) pake waktu LOKAL, bukan UTC.
// dulu pake toISOString().slice(0,10) -- itu UTC, padahal start rangenya
// dihitung pake waktu lokal. karena WITA/WIB lebih cepet dari UTC, tabelnya
// geser mundur 1 hari dan hari ini gak pernah muncul di ringkasan. udah dibenerin.
function localDateKey(value) {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// rapiin 1 baris ruangan -- nama kolomnya bisa macem2 (indo/inggris, csv/db)
function normalizeRoom(room, index = 0) {
  const name = String(room.name || room.ruangan || room.lokasi || room.room || '').trim();
  const building = String(room.building || room.gedung || room.area || '').trim();
  const floor = String(room.floor || room.lantai || '').trim();
  const code = String(room.code || room.kode || '').trim();
  const category = String(room.category || room.kategori || building || '').trim();
  const leader = String(room.leader || room.pimpinan || room.nama || '').trim();
  const phone = String(room.phone || room.no_hp || room.nohp || room.telepon || '').trim();
  const note = String(room.note || room.keterangan || '').trim();
  const id = String(room.id || code || `${building}-${name}-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { id, code, name, building, floor, category, leader, phone, note };
}
// parse file ruangan yang diupload admin, support JSON array atau CSV
function parseRooms(buffer, filename) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (/\.json$/i.test(filename) || text.trim().startsWith('[')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('JSON ruangan harus berupa array.');
    return parsed.map(normalizeRoom).filter(r => r.name);
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines.shift(), delimiter).map(h => h.trim().toLowerCase());
  return lines.map((line, i) => {
    const values = splitCsvLine(line, delimiter);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    return normalizeRoom(row, i);
  }).filter(r => r.name);
}
// split csv per kolom, handle tanda kutip biar koma di dalem kutip gak ke-split
function splitCsvLine(line, delimiter) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

// ---- password / token helpers -----------------------------------------
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return { salt, hash };
}
// verify password login staf, pake timing-safe compare biar aman dari timing attack
function verifyPassword(pw, salt, hash) {
  try {
    const h = crypto.scryptSync(String(pw), salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) { return false; }
}
function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

// format nomor tiket: TIK-DD-MM-YYYY-XXX
function makeTicket(seq, when) {
  const d = new Date(when);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `TIK${dd}${mm}${yyyy}-${String(seq).padStart(3, '0')}`;
}

// cari nomor urut berikutnya buat tanggal itu, liat urut tertinggi yang udah kepake
function nextTicketSequence(reports, when) {
  const prefix = makeTicket(0, when).replace(/-000$/, '');
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  return reports.reduce((max, report) => {
    const match = pattern.exec(report.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

// deteksi 3 laporan demo bawaan lama, biar auto kehapus pas server restart
function isSeedDemoReport(report) {
  const signature = [
    report.area,
    report.category,
    report.contact,
    report.detail
  ].join('|');

  return [
    'Fakultas Kedokteran|Putus total|0812-3300-1201|Seluruh lantai 3 tidak dapat akses internet sejak pagi. Lampu ODP mati.',
    'Rektorat|Lambat / intermittent|0813-5567-8890|Koneksi putus-nyambung tiap 5 menit, SIMKEU sering timeout.',
    'Perpustakaan Pusat|WiFi tidak terhubung|0852-1120-4478|SSID muncul tapi gagal mendapatkan IP di area baca lantai 2.'
  ].includes(signature);
}

// bikin akun staf default (rifqy, raffi) kalo belum ada, update kalo datanya beda
function upsertSeedOfficer(db, seedOfficer) {
  const existing = db.officers.find(o => o.username === seedOfficer.username);
  if (existing) {
    const changed = existing.name !== seedOfficer.name || existing.phone !== seedOfficer.phone || !existing.active;
    existing.name = seedOfficer.name;
    existing.phone = seedOfficer.phone;
    existing.active = true;
    return changed;
  }

  const { salt, hash } = hashPassword(seedOfficer.password);
  db.officers.push({
    id: seedOfficer.id,
    username: seedOfficer.username,
    name: seedOfficer.name,
    phone: seedOfficer.phone,
    salt,
    hash,
    active: true,
    createdAt: new Date().toISOString()
  });
  return true;
}

// Seed staf default pada pertama kali jalan. Laporan tidak dibuat otomatis.
async function seed() {
  const db = await loadDB();
  let changed = false;
  const reportCount = db.reports.length;
  db.reports = db.reports.filter(report => !isSeedDemoReport(report));
  if (db.reports.length !== reportCount) {
    db.seq = db.reports.reduce((max, report) => {
      const match = /-(\d+)$/.exec(report.id || '');
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    changed = true;
  }
  const defaultCount = db.officers.length;
  db.officers = db.officers.filter(o => !(o.username === 'petugas1' && o.name === 'Petugas Contoh'));
  if (db.officers.length !== defaultCount) changed = true;

  [
    { id: 'ofc-rifqy', username: 'rifqy', password: 'rifqy123', name: 'Rifqy', phone: '081210669659' },
    { id: 'ofc-raffi', username: 'raffi', password: 'raffi123', name: 'Raffi', phone: '082395216908' }
  ].forEach(officer => {
    if (upsertSeedOfficer(db, officer)) changed = true;
  });

  if (changed) await saveDB(db);
}

// ---- middleware --------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Redirect halaman root ke form laporan publik.
app.get('/', (req, res) => res.redirect('/laporan/'));
// Menyajikan halaman dashboard admin.
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'laporan', 'admin.html'));
});
// Menyajikan halaman workspace staf teknis.
app.get(['/staf', '/staf/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'laporan', 'staf.html'));
});

// middleware -- tolak kalo X-Admin-Key gak cocok sama ADMIN_KEY di .env
function requireAdmin(req, res, next) {
  const key = req.get('X-Admin-Key') || req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Kunci admin APPAU tidak valid.' });
  }
  next();
}
// cari staf yang login berdasarkan token di header
function currentOfficer(req, db) {
  const token = req.get('X-Officer-Token') || req.query.token;
  if (!token) return null;
  const officerId = db.tokens[token];
  if (!officerId) return null;
  return db.officers.find(o => o.id === officerId && o.active) || null;
}
// middleware staf -- tolak kalo token invalid/udah logout, simpen ke req._officer
async function requireOfficer(req, res, next) {
  try {
    const db = await loadDB();
    const officer = currentOfficer(req, db);
    if (!officer) return res.status(401).json({ error: 'Sesi petugas tidak valid. Silakan login ulang.' });
    req._officer = officer;
    next();
  } catch (err) {
    next(err);
  }
}
const asyncRoute = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const STATUSES = ['open', 'investigating', 'in_progress', 'user_issue', 'resolved'];

// ---- API: public -------------------------------------------------------

// endpoint buat submit laporan dari form user, publik gak perlu login
app.post('/api/reports', asyncRoute(async (req, res) => {
  const b = req.body || {};
  const area = String(b.area || '').trim();
  const roomCategory = String(b.roomCategory || '').trim();
  const category = String(b.category || '').trim();
  const detail = String(b.detail || '').trim();
  const reporter = String(b.reporter || '').trim();
  const contact = String(b.contact || '').trim();

  if (!area || !category || !detail || !reporter || !contact) {
    return res.status(400).json({ error: 'Lokasi, jenis gangguan, pelapor, kontak, dan detail wajib diisi.' });
  }

  const db = await loadDB();
  const nowIso = new Date().toISOString();
  const ticketSeq = nextTicketSequence(db.reports, Date.now());
  db.seq = Math.max((db.seq || 0) + 1, ticketSeq);
  const report = {
    id: makeTicket(ticketSeq, Date.now()),
    area, roomCategory, category, reporter, contact, detail,
    status: 'open',
    assignedTo: null, assignedName: null, assignedAt: null, dueAt: null,
    photos: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    log: [{ at: nowIso, status: 'open', note: 'Laporan diterima' }]
  };
  db.reports.push(report);
  await saveDB(db);
  notifyReportCreated(report);
  res.status(201).json({ ticket: report.id, report: publicView(report) });
}));

// buat autocomplete ruangan di form
app.get('/api/rooms', asyncRoute(async (req, res) => {
  res.json({ rooms: await loadRooms() });
}));

// import ruangan dari csv/json, admin only
app.post('/api/rooms/import', requireAdmin, roomImport.single('rooms'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Berkas ruangan wajib diunggah.' });
  const rooms = parseRooms(req.file.buffer, req.file.originalname || 'rooms.csv');
  if (!rooms.length) return res.status(400).json({ error: 'Tidak ada data ruangan yang valid.' });
  await saveRooms(rooms);
  res.status(201).json({ rooms, count: rooms.length });
}));

// lacak tiket by nomor, dipake fitur Lacak Tiket
app.get('/api/reports/track/:ticket', asyncRoute(async (req, res) => {
  const db = await loadDB();
  const r = findReport(db, req.params.ticket);
  if (!r) return res.status(404).json({ error: 'Tiket tidak ditemukan. Periksa kembali kodenya.' });
  res.json(publicView(r));
}));

// board publik -- tiket aktif + statistik total
app.get('/api/board', asyncRoute(async (req, res) => {
  const db = await loadDB();
  const reports = [...db.reports].sort(sortByUrgency);
  res.json({
    stats: buildStats(db.reports),
    reports: reports.map(boardView)
  });
}));

// ---- API: admin (NOC) --------------------------------------------------

// list lengkap semua tiket, admin only
app.get('/api/reports', requireAdmin, asyncRoute(async (req, res) => {
  const db = await loadDB();
  res.json({
    reports: [...db.reports].sort(sortByUrgency).map(adminView),
    stats: buildStats(db.reports)
  });
}));

// ubah status + catatan tiket. admin bebas, staf cuma boleh tiket yg ditugasin ke dia
app.patch('/api/reports/:ticket', asyncRoute(async (req, res) => {
  const db = await loadDB();
  const r = findReport(db, req.params.ticket);
  if (!r) return res.status(404).json({ error: 'Tiket tidak ditemukan.' });

  // allow admin OR the officer this ticket is assigned to
  const isAdmin = (req.get('X-Admin-Key') || req.query.key) === ADMIN_KEY;
  const officer = currentOfficer(req, db);
  if (!isAdmin && !(officer && r.assignedTo === officer.id)) {
    return res.status(401).json({ error: 'Tidak berwenang mengubah tiket ini.' });
  }

  const status = String((req.body || {}).status || '').trim();
  const note = String((req.body || {}).note || '').trim();
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }
  const nowIso = new Date().toISOString();
  r.status = status;
  r.updatedAt = nowIso;
  const who = isAdmin ? 'NOC' : (officer ? officer.name : 'Petugas');
  r.log.push({ at: nowIso, status, note: note || `${statusNote(status)} (${who})` });
  await saveDB(db);
  notifyStatusChanged(r, note);
  res.json({ report: adminView(r) });
}));

// hapus tiket + foto2nya, permanen
app.delete('/api/reports/:ticket', requireAdmin, asyncRoute(async (req, res) => {
  const db = await loadDB();
  const idx = db.reports.findIndex(r => r.id.toLowerCase() === String(req.params.ticket).toLowerCase());
  if (idx < 0) return res.status(404).json({ error: 'Tiket tidak ditemukan.' });

  const [removed] = db.reports.splice(idx, 1);
  for (const photo of removed.photos || []) {
    if (photo.file) fs.unlink(path.join(UPLOAD_DIR, photo.file), () => {});
  }
  await saveDB(db);
  res.json({ ok: true, ticket: removed.id });
}));

// disposisi tiket ke staf, bisa kasih tenggat + instruksi
app.post('/api/reports/:ticket/assign', requireAdmin, asyncRoute(async (req, res) => {
  const db = await loadDB();
  const r = findReport(db, req.params.ticket);
  if (!r) return res.status(404).json({ error: 'Tiket tidak ditemukan.' });

  const b = req.body || {};
  const officerId = String(b.officerId || '').trim();
  const officer = db.officers.find(o => o.id === officerId && o.active);
  if (!officer) return res.status(400).json({ error: 'Petugas tidak ditemukan.' });

  let dueAt = null;
  if (b.dueAt) {
    const d = new Date(b.dueAt);
    if (!isNaN(d.getTime())) dueAt = d.toISOString();
  }
  const instruction = String(b.instruction || '').trim();

  const nowIso = new Date().toISOString();
  r.assignedTo = officer.id;
  r.assignedName = officer.name;
  r.assignedAt = nowIso;
  r.dueAt = dueAt;
  // status TIDAK diubah di sini -- tiket tetap 'open' (Pending / Laporan Aktif) sampai
  // teknisi yang bersangkutan sendiri yang mengubah statusnya jadi Dalam Pengecekan/Diproses.
  r.updatedAt = nowIso;
  const dueTxt = dueAt ? ` · tenggat ${fmtId(dueAt)}` : '';
  r.log.push({
    at: nowIso, status: r.status,
    note: `Didisposisikan ke ${officer.name}${dueTxt}${instruction ? ' — ' + instruction : ''}`
  });
  await saveDB(db);
  notifyStatusChanged(r, `Tiket sedang diperiksa oleh ${officer.name}${instruction ? `. Catatan: ${instruction}` : ''}`);
  res.json({ report: adminView(r) });
}));

// upload foto bukti, sama kayak diatas -- admin bebas, staf cuma yg ditugasin
app.post('/api/reports/:ticket/photo', (req, res) => {
  upload.single('photo')(req, res, async err => {
    try {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 6 MB.' : err.message;
        if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
        return res.status(400).json({ error: msg });
      }
      const db = await loadDB();
      const r = findReport(db, req.params.ticket);
      if (!r) {
        if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
        return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
      }
      const isAdmin = (req.get('X-Admin-Key') || req.query.key) === ADMIN_KEY;
      const officer = currentOfficer(req, db);
      if (!isAdmin && !(officer && r.assignedTo === officer.id)) {
        if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
        return res.status(401).json({ error: 'Tidak berwenang menambah foto pada tiket ini.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Tidak ada berkas gambar.' });

      const by = isAdmin ? 'NOC' : (officer ? officer.name : 'Petugas');
      const nowIso = new Date().toISOString();
      if (!Array.isArray(r.photos)) r.photos = [];
      r.photos.push({ file: req.file.filename, at: nowIso, by });
      r.updatedAt = nowIso;
      r.log.push({ at: nowIso, status: r.status, note: `Foto bukti pengerjaan ditambahkan (${by})` });
      await saveDB(db);
      res.status(201).json({ report: adminView(r) });
    } catch (uploadErr) {
      if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
      res.status(500).json({ error: uploadErr.message || 'Gagal menyimpan foto bukti.' });
    }
  });
});

// serve file foto biar pelapor bisa liat di halaman lacak tiket
app.get('/api/reports/:ticket/photo/:idx', asyncRoute(async (req, res) => {
  const db = await loadDB();
  const r = findReport(db, req.params.ticket);
  const idx = parseInt(req.params.idx, 10);
  if (!r || !Array.isArray(r.photos) || !r.photos[idx]) return res.status(404).end();
  res.sendFile(path.join(UPLOAD_DIR, r.photos[idx].file));
}));

// ---- API: officers management (admin) ----------------------------------
// list semua staf
app.get('/api/officers', requireAdmin, asyncRoute(async (req, res) => {
  const db = await loadDB();
  res.json({ officers: db.officers.map(officerView) });
}));

// bikin akun staf baru
app.post('/api/officers', requireAdmin, asyncRoute(async (req, res) => {
  const db = await loadDB();
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Nama, username, dan password wajib diisi.' });
  }
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return res.status(400).json({ error: 'Username minimal 3 karakter (huruf/angka/._-).' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }
  if (db.officers.some(o => o.username === username)) {
    return res.status(409).json({ error: 'Username sudah dipakai.' });
  }
  const { salt, hash } = hashPassword(password);
  const officer = {
    id: newId('ofc'), username, name, phone, salt, hash,
    active: true, createdAt: new Date().toISOString()
  };
  db.officers.push(officer);
  await saveDB(db);
  res.status(201).json({ officer: officerView(officer) });
}));

// hapus staf + cabut semua token sesinya
app.delete('/api/officers/:id', requireAdmin, asyncRoute(async (req, res) => {
  const db = await loadDB();
  const idx = db.officers.findIndex(o => o.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Petugas tidak ditemukan.' });
  const officer = db.officers[idx];
  db.officers.splice(idx, 1);
  // revoke any active tokens for this officer
  for (const t of Object.keys(db.tokens)) {
    if (db.tokens[t] === officer.id) delete db.tokens[t];
  }
  await saveDB(db);
  res.json({ ok: true });
}));

// ---- API: officer auth + workspace -------------------------------------
// login staf, return token
app.post('/api/officer/login', asyncRoute(async (req, res) => {
  const db = await loadDB();
  const b = req.body || {};
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  const officer = db.officers.find(o => o.username === username && o.active);
  if (!officer || !verifyPassword(password, officer.salt, officer.hash)) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens[token] = officer.id;
  await saveDB(db);
  res.json({ token, officer: officerView(officer) });
}));

// logout staf, cabut token
app.post('/api/officer/logout', requireOfficer, asyncRoute(async (req, res) => {
  const db = await loadDB();
  const token = req.get('X-Officer-Token') || req.query.token;
  delete db.tokens[token];
  await saveDB(db);
  res.json({ ok: true });
}));

// tugas staf yang login doang, bukan semua tiket
app.get('/api/officer/reports', requireOfficer, asyncRoute(async (req, res) => {
  const db = await loadDB();
  const mine = db.reports
    .filter(r => r.assignedTo === req._officer.id)
    .sort(sortByUrgency)
    .map(adminView);
  res.json({ officer: officerView(req._officer), reports: mine });
}));

// ---- API: weekly / monthly dashboard -----------------------------------
// data buat dashboard analitik, mingguan/bulanan (bisa pilih bulan+tahun)
app.get('/api/report/summary', requireAdmin, asyncRoute(async (req, res) => {
  const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
  const month = req.query.month ? parseInt(req.query.month, 10) : undefined;
  const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
  const db = await loadDB();
  res.json(buildSummary(db, period, { month, year }));
}));

// ---- helpers: lookups & views ------------------------------------------
function findReport(db, ticket) {
  const t = String(ticket).toLowerCase();
  return db.reports.find(x => x.id.toLowerCase() === t);
}
// cek tiket udah lewat tenggat tapi belum selesai/kena user_issue
function isOverdue(r) {
  return !!(r.dueAt && r.status !== 'resolved' && r.status !== 'user_issue' && new Date(r.dueAt).getTime() < Date.now());
}
// ubah data foto jadi URL publik lewat endpoint /photo/:idx
function photoList(r) {
  if (!Array.isArray(r.photos)) return [];
  return r.photos.map((p, i) => ({ url: `/api/reports/${r.id}/photo/${i}`, at: p.at, by: p.by }));
}
// data laporan versi aman buat pelapor umum, tanpa data internal staf
function publicView(r) {
  return {
    id: r.id, area: r.area, roomCategory: r.roomCategory || '', category: r.category,
    status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
    detail: r.detail, log: r.log,
    assignedName: r.assignedName || null, dueAt: r.dueAt || null, overdue: isOverdue(r),
    photos: photoList(r)
  };
}
// versi ringkas buat board publik, gak ada detail/kontak (privasi)
function boardView(r) {
  return {
    id: r.id, area: r.area, roomCategory: r.roomCategory || '', category: r.category,
    status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
    assignedName: r.assignedName || null, dueAt: r.dueAt || null, overdue: isOverdue(r)
  };
}
// versi lengkap buat admin & staf, ada kontak + detail + disposisi
function adminView(r) {
  return {
    id: r.id, area: r.area, roomCategory: r.roomCategory || '', category: r.category, reporter: r.reporter,
    contact: r.contact, detail: r.detail, status: r.status,
    createdAt: r.createdAt, updatedAt: r.updatedAt, log: r.log,
    assignedTo: r.assignedTo || null, assignedName: r.assignedName || null,
    assignedAt: r.assignedAt || null, dueAt: r.dueAt || null, overdue: isOverdue(r),
    photos: photoList(r)
  };
}
function officerView(o) {
  return { id: o.id, username: o.username, name: o.name, phone: o.phone || '', active: o.active, createdAt: o.createdAt };
}
const STATUS_RANK = { open: 0, investigating: 1, in_progress: 2, user_issue: 3, deferred: 3, resolved: 4 };
// urutan tampil: status mendesak dulu (open), resolved paling akhir. status sama = terbaru dulu
function sortByUrgency(a, b) {
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  return new Date(b.createdAt) - new Date(a.createdAt);
}
// hitung jumlah tiket per status buat kartu ringkasan
function buildStats(reports) {
  const open = reports.filter(r => r.status !== 'resolved');
  return {
    total: reports.length,
    open: reports.filter(r => r.status === 'open').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    user_issue: reports.filter(r => r.status === 'user_issue' || r.status === 'deferred').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    active: open.length,
    overdue: reports.filter(isOverdue).length
  };
}
// catatan default kalo admin ubah status tapi gak isi catatan
function statusNote(status) {
  if (status === 'investigating') return 'Tim APPAU mulai menangani';
  if (status === 'in_progress') return 'Petugas sedang mengerjakan';
  if (status === 'user_issue' || status === 'deferred') return 'Kendala terindikasi pada sisi pengguna';
  if (status === 'resolved') return 'Gangguan selesai ditangani';
  return 'Laporan masuk antrean';
}
// cari kapan terakhir status jadi resolved, buat hitung durasi penyelesaian
function resolvedAtOf(r) {
  for (let i = r.log.length - 1; i >= 0; i--) {
    if (r.log[i].status === 'resolved') return r.log[i].at;
  }
  return null;
}
function fmtId(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

// ---- WhatsApp notifications --------------------------------------------
function notifyReportCreated(report) {
  sendWhatsAppMessage(report.contact, whatsappStatusMessage(report), report.id);
}

// notif WA tiap kali status tiket berubah
function notifyStatusChanged(report, note) {
  const message = whatsappStatusMessage(report, note);
  sendWhatsAppMessage(report.contact, message, report.id);
}

// teks WA otomatis (beda sama yang manual dari tombol admin), dipake 2 fungsi notify di atas
function whatsappStatusMessage(report, note) {
  const labels = {
    open: 'Pending',
    investigating: 'Dalam Pengecekan',
    in_progress: 'Diproses',
    user_issue: 'Sisi Pengguna Bermasalah',
    deferred: 'Sisi Pengguna Bermasalah',
    resolved: 'Selesai'
  };
  const messages = {
    open: 'Laporan Anda sudah kami terima dan masuk antrean. Tim kami akan melakukan pengecekan awal. Mohon menunggu konfirmasi berikutnya.',
    investigating: 'Tim teknis sedang melakukan pengecekan awal pada jaringan dan lokasi terkait. Kami akan menginformasikan hasil pemeriksaan berikutnya.',
    in_progress: 'Laporan sedang diproses oleh tim teknis. Kami sedang melakukan penanganan atau perbaikan agar layanan jaringan kembali normal.',
    user_issue: 'Hasil pengecekan sementara menunjukkan jaringan utama dalam kondisi stabil. Kendala kemungkinan berasal dari sisi perangkat atau koneksi pengguna. Mohon coba restart perangkat, lupakan jaringan WiFi lalu sambungkan ulang, atau hubungi admin jika masih terkendala.',
    deferred: 'Hasil pengecekan sementara menunjukkan jaringan utama dalam kondisi stabil. Kendala kemungkinan berasal dari sisi perangkat atau koneksi pengguna. Mohon coba restart perangkat, lupakan jaringan WiFi lalu sambungkan ulang, atau hubungi admin jika masih terkendala.',
    resolved: 'Laporan sudah selesai ditangani. Silakan cek kembali koneksi jaringan di lokasi Anda. Jika masih mengalami kendala, silakan balas pesan ini atau buat laporan baru.'
  };

  return [
    'Halo, kami dari Tim Teknis.',
    `Terkait laporan jaringan ${report.id}.`,
    `Lokasi: ${report.area}`,
    `Status: ${labels[report.status] || report.status}`,
    '',
    messages[report.status] || 'Mohon menunggu, laporan sedang kami tindak lanjuti.',
    note ? `\nCatatan admin: ${note}` : '',
    report.assignedName ? `Petugas: ${report.assignedName}.` : ''
  ].filter(Boolean).join('\n');
}

// satu pintu buat kirim WA -- pilih provider (meta/webhook/cuma log kalo kosong)
function sendWhatsAppMessage(contact, message, ticketId) {
  const to = normalizePhone(contact);
  if (!to) return;
  if (WHATSAPP_PROVIDER === 'meta') {
    sendMetaWhatsApp(to, message).catch(err => logWaError(ticketId, err));
  } else if (WHATSAPP_PROVIDER === 'webhook') {
    sendWebhookWhatsApp(to, message, ticketId).catch(err => logWaError(ticketId, err));
  } else {
    console.log(`[WA disabled] ${ticketId || '-'} -> ${to}: ${message.split('\n')[0]}`);
  }
}

// normalize nomor HP ke 62xxx sebelum dipake API WA
function normalizePhone(contact) {
  let digits = String(contact || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return digits.length >= 9 ? digits : null;
}

// kirim lewat WA Cloud API resmi Meta, butuh token+phone id di .env
function sendMetaWhatsApp(to, message) {
  if (!WHATSAPP_META_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return Promise.reject(new Error('Konfigurasi Meta WhatsApp belum lengkap.'));
  }
  return requestJson({
    hostname: 'graph.facebook.com',
    path: `/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_META_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: message }
  });
}

// kirim lewat webhook custom (bukan meta), url-nya dari .env
function sendWebhookWhatsApp(to, message, ticketId) {
  if (!WHATSAPP_WEBHOOK_URL) {
    return Promise.reject(new Error('WHATSAPP_WEBHOOK_URL belum diisi.'));
  }
  const url = new URL(WHATSAPP_WEBHOOK_URL);
  const headers = { 'Content-Type': 'application/json' };
  if (WHATSAPP_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${WHATSAPP_WEBHOOK_TOKEN}`;
  return requestJson({
    hostname: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method: 'POST',
    headers
  }, { to, message, ticketId });
}

// helper https request generik, dipake sendMetaWhatsApp & sendWebhookWhatsApp
function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
        reject(new Error(`WhatsApp API ${res.statusCode}: ${data.slice(0, 240)}`));
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function logWaError(ticketId, err) {
  console.warn(`[WA failed] ${ticketId || '-'}: ${err.message}`);
}

// ---- weekly / monthly summary ------------------------------------------
function buildSummary(db, period, options = {}) {
  // Gunakan tanggal lokal server untuk menentukan hari ini.
  const now = new Date();

  let start;
  let end; // batas akhir periode (eksklusif)
  let days;

  if (period === 'monthly') {
    // bulanan = 1 bulan kalender penuh (misal 1-31 Agustus), bukan rolling 30
    // hari kayak dulu (itu bisa nyampur 2 bulan, misal 25 Jul - 23 Agu). kalo
    // month/year gak dikirim, default ke bulan berjalan.
    const year = Number.isInteger(options.year) ? options.year : now.getFullYear();
    const month = Number.isInteger(options.month) && options.month >= 1 && options.month <= 12
      ? options.month
      : now.getMonth() + 1;

    start = new Date(year, month - 1, 1);
    start.setHours(0, 0, 0, 0);

    end = new Date(year, month, 1); // tanggal 1 bulan berikutnya
    end.setHours(0, 0, 0, 0);

    days = Math.round((end.getTime() - start.getTime()) / 86400000);
  } else {
    // Mingguan: tetap rolling 7 hari terakhir sampai sekarang.
    days = 7;
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    end = new Date(now.getTime() + 1); // sedikit lewat "now" agar inklusif
  }

  // Buat bucket berdasarkan tanggal kalender lokal.
  const buckets = [];
  const byKey = {};

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const key = localDateKey(d);

    const bucket = {
      date: key,
      created: 0,
      resolved: 0
    };

    buckets.push(bucket);
    byKey[key] = bucket;
  }

  // Hanya laporan yang dibuat di dalam rentang [start, end).
  const inWindow = r => {
    const createdAt = new Date(r.createdAt).getTime();
    return createdAt >= start.getTime() && createdAt < end.getTime();
  };

  const windowReports = db.reports.filter(inWindow);

  const byCategory = {};
  const byOpd = {};
  const byIssue = {};

  const byStatus = {
    open: 0,
    investigating: 0,
    in_progress: 0,
    user_issue: 0,
    resolved: 0
  };

  const perOfficer = {};

  let resolvedCount = 0;
  let resDurSum = 0;
  let resDurN = 0;
  let overdue = 0;

  // isi angka created/resolved per tanggal buat tabel ringkasan
  db.reports.forEach(r => {
  const cKey = localDateKey(r.createdAt);

  if (byKey[cKey]) {
    byKey[cKey].created += 1;
  }

  const rAt = resolvedAtOf(r);

  if (rAt) {
    const rKey = localDateKey(rAt);

    if (byKey[rKey]) {
      byKey[rKey].resolved += 1;
    }
  }
});

  // loop utama analitik -- semua aggregate (kategori, opd, top5, status, per-officer, durasi) dihitung sekalian disini biar cuma sekali iterasi
  windowReports.forEach(r => {
    // Jenis gangguan
    const category = r.category || 'Lainnya';
    byCategory[category] = (byCategory[category] || 0) + 1;

    // Lokasi / OPD
    const area = r.area || r.roomCategory || 'Tanpa lokasi';
    byOpd[area] = (byOpd[area] || 0) + 1;

    // key top5 = kombinasi kategori+lokasi, bukan teks bebas (lihat catatan di atas)
    const issueKey = `${category}||${area}`;

    if (!byIssue[issueKey]) {
      byIssue[issueKey] = {
        category,
        area,
        count: 0,
        latestAt: r.createdAt
      };
    }

    byIssue[issueKey].count += 1;

    if (
      new Date(r.createdAt).getTime() >
      new Date(byIssue[issueKey].latestAt).getTime()
    ) {
      byIssue[issueKey].latestAt = r.createdAt;
    }

    // hitung per status juga (buat kartu ringkasan + overdue)
    const statusKey =
      r.status === 'deferred'
        ? 'user_issue'
        : r.status;

    if (byStatus[statusKey] != null) {
      byStatus[statusKey] += 1;
    }

    if (isOverdue(r)) {
      overdue += 1;
    }

    // beban kerja tiap petugas, buat nanti kalo mau ditampilin
    if (r.assignedName) {
      const officer =
        perOfficer[r.assignedName] || {
          name: r.assignedName,
          assigned: 0,
          resolved: 0
        };

      officer.assigned += 1;

      if (r.status === 'resolved') {
        officer.resolved += 1;
      }

      perOfficer[r.assignedName] = officer;
    }

    // durasi penyelesaian, dipake buat hitung rata-rata jam di kartu ringkasan
    const resolvedAt = resolvedAtOf(r);

    if (resolvedAt) {
      resolvedCount += 1;

      resDurSum +=
        new Date(resolvedAt).getTime() -
        new Date(r.createdAt).getTime();

      resDurN += 1;
    }
  });

  // urutin byIssue berdasarkan count, ambil 5 teratas -- ini yang dikirim ke frontend sebagai Top 5
  const topIssues = Object.values(byIssue)
    .sort((a, b) =>
      b.count - a.count ||
      new Date(b.latestAt).getTime() -
      new Date(a.latestAt).getTime()
    )
    .slice(0, 5)
    .map((issue, index) => ({
      rank: index + 1,
      category: issue.category || 'Lainnya',
      area: issue.area || 'Tanpa lokasi',
      count: issue.count,
      latestAt: issue.latestAt
    }));

  return {
    period,
    days,

    month: period === 'monthly' ? start.getMonth() + 1 : null,
    year: period === 'monthly' ? start.getFullYear() : null,

    from: start.toISOString(),
    to: end.toISOString(),

    totals: {
      total: windowReports.length,
      open: byStatus.open,
      investigating: byStatus.investigating,
      in_progress: byStatus.in_progress,
      user_issue: byStatus.user_issue,
      resolved: byStatus.resolved,

      active:
        byStatus.open +
        byStatus.investigating +
        byStatus.in_progress +
        byStatus.user_issue,

      overdue,

      avgResolutionHours:
        resDurN
          ? +(resDurSum / resDurN / 3600000).toFixed(1)
          : null
    },

    timeline: buckets,

    byCategory: Object.entries(byCategory)
      .map(([category, count]) => ({
        category,
        count
      }))
      .sort((a, b) => b.count - a.count),

    byOpd: Object.entries(byOpd)
      .map(([opd, count]) => ({
        opd,
        count
      }))
      .sort((a, b) => b.count - a.count),

    topIssues,

    byStatus,

    perOfficer: Object.values(perOfficer)
      .sort((a, b) => b.assigned - a.assigned)
  };
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: USE_MYSQL
      ? 'Terjadi kesalahan database. Pastikan MySQL XAMPP aktif dan database sudah di-import.'
      : 'Terjadi kesalahan server.'
  });
});

// entry point server -- siapin skema mysql, seed staf default, terus listen
async function start() {
  await ensureMysqlSchema();
  await seed();
  const server = app.listen(PORT, HOST);
  server.on('listening', () => {
    console.log(`APPAU berjalan di http://localhost:${PORT}`);
    getLanUrls(PORT).forEach(url => console.log(`Akses HP satu WiFi: ${url}`));
    console.log(`Storage: ${USE_MYSQL ? 'MySQL / XAMPP' : 'JSON file'}`);
    console.log(`Database: ${process.env.DB_NAME || 'db-sppd'}`);
    console.log(`Kunci admin APPAU: ${ADMIN_KEY}`);
  });
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} sudah dipakai. Kemungkinan aplikasi sudah berjalan.`);
      console.error(`Buka http://localhost:${PORT}, atau hentikan proses Node lama sebelum menjalankan npm start lagi.`);
      process.exit(1);
    }
    throw err;
  });
}

function getLanUrls(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(item => item && item.family === 'IPv4' && !item.internal)
    .map(item => `http://${item.address}:${port}`);
}

start().catch(err => {
  console.error('Gagal menjalankan aplikasi:', err.message);
  if (USE_MYSQL) {
    console.error('Pastikan XAMPP MySQL sudah Start dan database sudah dibuat dari database/setup_xampp.sql.');
  }
  process.exit(1);
});