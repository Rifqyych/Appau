'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Label status disimpan di satu tempat supaya teks yang tampil di user dan admin selalu sama.
const STATUS_LABEL = {
  open: 'Pending',
  investigating: 'Dalam Pengecekan',
  in_progress: 'Diproses',
  user_issue: 'Sisi Pengguna Bermasalah',
  resolved: 'Selesai'
};

let adminKey = sessionStorage.getItem('appauAdminKey') || '';
let adminStaff = [];
let analyticsPeriod = 'weekly';
let analyticsMonth = new Date().getMonth() + 1; // 1-12
let analyticsYear = new Date().getFullYear();
let staffToken = sessionStorage.getItem('appauStaffToken') || '';
let currentStaff = null;
let rooms = [];
let activeRoomOptions = [];
let roomListOpen = false; // true hanya setelah user KLIK field Lokasi/OSPD

// Mengatur komunikasi frontend ke backend Express. Semua panggilan API lewat helper ini
// agar error dari server tampil konsisten di form, dashboard, dan panel admin.
async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

function tick() {
  const clock = $('#clock');
  if (!clock) return;
  clock.textContent = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ambil data ruangan dari DB buat isi dropdown kategori + autocomplete
async function loadRooms() {
  const categorySelect = $('#roomCategory');
  if (!categorySelect) return;
  try {
    const data = await api('/api/rooms');
    rooms = data.rooms || [];
    const categories = [...new Set(rooms.map(room => room.category || room.building).filter(Boolean))];
    categorySelect.innerHTML = '<option value="" disabled selected>Semua Kategori</option>' + categories.map(category => (
      `<option value="${esc(category)}">${esc(category)}</option>`
    )).join('');
    hideRoomOptions();
  } catch (err) {
    hideRoomOptions();
  }
}

// autocomplete ruangan. boleh ketik bebas, kalau namanya cocok sama data SKPD
// kategorinya keisi otomatis. list cuma nongol kalau roomListOpen true (klik field),
// biar gak muncul sendiri pas halaman baru kebuka
function paintRoomOptions() {
  if (!roomListOpen || document.activeElement !== $('#area')) {
    hideRoomOptions();
    return;
  }

  const selectedCategory = $('#roomCategory').value;
  const keyword = $('#area').value.trim().toLowerCase();
  activeRoomOptions = (selectedCategory
    ? rooms.filter(room => (room.category || room.building) === selectedCategory)
    : rooms)
    .filter(room => {
      if (!keyword) return true;
      return [room.name, room.category, room.code, room.leader]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(keyword));
    })
    .slice(0, 30);

  renderRoomOptions(activeRoomOptions);
}

function renderRoomOptions(options) {
  const list = $('#roomList');
  if (!options.length) {
    hideRoomOptions();
    return;
  }

  list.innerHTML = options.map((room, index) => `
    <button class="autocomplete-option" type="button" data-index="${index}">
      <strong>${esc(room.name)}</strong>
      <span>${esc([room.category || room.building, room.code].filter(Boolean).join(' - '))}</span>
    </button>
  `).join('');
  list.hidden = false;
}

function hideRoomOptions() {
  roomListOpen = false;
  const list = $('#roomList');
  if (!list) return;
  list.hidden = true;
  list.innerHTML = '';
}

function chooseRoom(index) {
  const room = activeRoomOptions[index];
  if (!room) return;
  $('#area').value = room.name;
  if (!$('#roomCategory').value && (room.category || room.building)) {
    $('#roomCategory').value = room.category || room.building;
  }
  hideRoomOptions();
}

// kategori instansi diambil dari dropdown, kalau kosong dicocokin dari nama ruangan yang diketik
function selectedRoomCategory() {
  const explicit = $('#roomCategory').value.trim();
  if (explicit) return explicit;
  const typed = $('#area').value.trim().toLowerCase();
  const match = rooms.find(room => room.name.toLowerCase() === typed);
  return match ? (match.category || match.building || '') : '';
}

// Mengirim laporan baru dari form user ke backend, lalu menampilkan nomor tiket penerimaan.
async function submitReport(event) {
  event.preventDefault();
  const msg = $('#formMsg');
  const btn = $('#submitBtn');
  msg.className = 'form-msg';
  msg.textContent = '';

  const payload = {
    area: $('#area').value.trim(),
    roomCategory: selectedRoomCategory(),
    detail: $('#detail').value.trim(),
    contact: $('#contact').value.trim(),
    reporter: $('#reporter').value.trim(),
    category: $('#category').value.trim()
  };

  if (!payload.area || !payload.detail || !payload.contact || !payload.reporter) {
    msg.classList.add('error');
    msg.textContent = 'Lokasi, detail masalah, nomor WhatsApp, dan nama pelapor wajib diisi.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mengirim...';
  try {
    const data = await api('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    $('#reportForm').hidden = true;
    $('#receipt').hidden = false;
    $('#receiptTicket').textContent = data.ticket;
    $('#trackInput').value = data.ticket;
    await loadBoard();
  } catch (err) {
    msg.classList.add('error');
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kirim laporan';
  }
}

// Menampilkan ringkasan tiket aktif di halaman utama. Data diperbarui berkala
// supaya admin/user dapat melihat perubahan tanpa refresh manual.
async function loadBoard() {
  const board = $('#board');
  if (!board && !$$('[data-stat]').length) return;
  try {
    const data = await api('/api/board');
    paintStats(data.stats || {});
    if (board) {
  const active = (data.reports || [])
    .filter(r => r.status !== 'resolved')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  board.innerHTML = active.length
    ? active.map(ticketSummary).join('')
    : '<p class="empty">Belum ada gangguan aktif.</p>';
}
  } catch (err) {
    if (board) board.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
  }
}

function paintStats(stats) {
  $$('[data-stat]').forEach(el => {
    const key = el.dataset.stat;
    el.textContent = stats[key] == null ? '0' : stats[key];
  });
}

// Template kartu tiket ringkas yang dipakai pada board status publik.
function ticketSummary(ticket) {
  return `
    <article class="ticket-card">
      <div class="ticket-top">
        <span class="ticket-id">${esc(ticket.id)}</span>
        ${statusBadge(ticket.status)}
      </div>
      <p class="ticket-title">${esc(ticket.area)}</p>
      <p class="ticket-meta">${esc([ticket.roomCategory, ticket.category].filter(Boolean).join(' - '))} - ${ago(ticket.createdAt)}</p>
      ${ticket.assignedName ? `<p class="ticket-meta">Petugas: ${esc(ticket.assignedName)}</p>` : ''}
    </article>
  `;
}

// Mengelola pencarian tiket oleh pelapor berdasarkan nomor tiket yang diterima
// setelah laporan berhasil dikirim.
async function trackTicket(event) {
  event.preventDefault();
  const id = $('#trackInput').value.trim();
  const result = $('#trackResult');
  if (!id) return;
  result.innerHTML = '<p class="empty">Mencari tiket...</p>';
  try {
    const ticket = await api(`/api/reports/track/${encodeURIComponent(id)}`);
    result.innerHTML = ticketDetail(ticket);
  } catch (err) {
    result.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
  }
}

function ticketDetail(ticket) {
  return `
    <article class="ticket-card ticket-detail-card">
      <div class="ticket-top">
        <span class="ticket-id">${esc(ticket.id)}</span>
        ${statusBadge(ticket.status)}
      </div>

      <div class="ticket-summary">
        <h3 class="ticket-title">${esc(ticket.area)}</h3>
        <p class="ticket-meta">
          ${esc(ticket.roomCategory || 'Tanpa kategori instansi')}
          ${ticket.category ? ` • ${esc(ticket.category)}` : ''}
        </p>
        <p class="ticket-meta">Dibuat ${fmt(ticket.createdAt)}</p>
        ${ticket.assignedName ? `<p class="ticket-meta"><strong>Petugas:</strong> ${esc(ticket.assignedName)}</p>` : ''}
      </div>

      <div class="ticket-problem">
        <h4>Masalah yang dilaporkan</h4>
        <p>${esc(ticket.detail)}</p>
      </div>
    </article>
  `;
}

// Riwayat/timeline update tiket (waktu, status, catatan). Dipakai di dashboard admin
// dan workspace staf, supaya setiap update dari staf langsung terlihat.
// PENTING: setiap tag dan isinya ditulis dalam SATU baris tanpa indentasi ekstra,
// karena .timeline-note pakai white-space: pre-wrap -- kalau ada baris baru/spasi
// nganggur di dalam template literal, itu ikut kerender jadi ruang kosong beneran
// di halaman (ini penyebab kotak jadi kebesaran sebelumnya).
function logTimeline(ticket) {
  return renderTimeline(ticket, true);
}

// render riwayat log jadi kartu, terbaru di atas. param adminView belum kepake
// bedain tampilan, disiapin aja buat nanti
function renderTimeline(ticket, adminView = false) {
  const logs = (ticket.log || []).slice().reverse();
  if (!logs.length) {
    return `<div class="timeline-empty">Belum ada pembaruan pada tiket ini.</div>`;
  }

  return `
    <div class="timeline-modern">
      ${logs.map(log => {
        const isStaff =
          (log.note || '').includes('NOC') ||
          (log.note || '').includes('Petugas') ||
          (log.note || '').includes('Didisposisikan') ||
          (log.note || '').includes('Foto bukti');

        return `<div class="timeline-card ${isStaff ? 'timeline-staff' : 'timeline-user'}"><div class="timeline-card-head"><span class="timeline-role">${isStaff ? 'Update Tim Teknis / Admin' : 'Laporan Pengguna'}</span>${statusBadge(log.status)}</div><div class="timeline-time">${fmt(log.at)}</div><div class="timeline-note">${esc((log.note || '-').trim())}</div>${renderTimelinePhotos(ticket, log)}</div>`;
      }).join('')}
    </div>
  `;
}

// cocokin foto bukti sama log berdasarkan waktu upload (selisih <1 detik = sepasang)
function renderTimelinePhotos(ticket, log) {
  const photos = (ticket.photos || []).filter(photo => {
    const photoTime = new Date(photo.at).getTime();
    const logTime = new Date(log.at).getTime();
    return Math.abs(photoTime - logTime) <= 1000;
  });

  if (!photos.length) return '';

  return photos.map(photo => `<div class="evidence-box"><div class="evidence-desc"><h5>Bukti Dokumentasi</h5><p><strong>Teknisi:</strong> ${esc(photo.by || 'Tim Teknis')}</p><p><strong>Waktu:</strong> ${fmt(photo.at)}</p><p>Dokumentasi hasil penanganan di lokasi telah berhasil diunggah sebagai bukti.</p></div><div class="evidence-image"><a href="${esc(photo.url)}" target="_blank" rel="noopener"><img src="${esc(photo.url)}" alt="Bukti penanganan" /></a></div></div>`).join('');
}

// bagian admin: login, list laporan, ubah status, kirim WA manual, hapus tiket
async function adminLogin(event) {
  event.preventDefault();
  const msg = $('#adminMsg');
  msg.className = 'form-msg';
  msg.textContent = 'Memeriksa akses...';
  const key = $('#adminKey').value.trim();

  try {
  await api('/api/reports', {
    headers: { 'X-Admin-Key': key }
  });

  adminKey = key;
  sessionStorage.setItem('appauAdminKey', adminKey);

  // hide judul+form login sekalian biar gak nongol lagi abis berhasil login
  const loginSection = $('#adminLoginSection');
  const adminPanel = $('#adminPanel');

  if (loginSection) {
    loginSection.hidden = true;
  }

  // Tampilkan panel admin
  if (adminPanel) {
    adminPanel.hidden = false;
    adminPanel.style.display = '';
  }

  if ($('#adminLogout')) {
    $('#adminLogout').hidden = false;
    $('#adminLogout').style.display = '';
  }

  msg.textContent = '';

  await Promise.all([
    loadAdminReports(),
    loadStaffList(),
    loadAnalytics()
  ]);
  
  } catch (err) {
    msg.classList.add('error');
    msg.textContent = err.message;
  }
}

async function loadOfficers() {
  const data = await api('/api/officers', { headers: { 'X-Admin-Key': adminKey } });
  adminStaff = data.officers || [];
  return adminStaff;
}

// ringkasan tugas aktif tiap staf, buat panel Lapor Teknis di admin
async function loadStaffList() {
  const list = $('#staffList');
  if (!list || !adminKey) return;
  try {
    const [staff, reportData] = await Promise.all([
      loadOfficers(),
      api('/api/reports', { headers: { 'X-Admin-Key': adminKey } })
    ]);
    const reports = reportData.reports || [];
    list.innerHTML = staff.length ? staff.map(officer => {
      const officerReports = reports.filter(report => report.assignedTo === officer.id);
      // Laporan Aktif: baru didisposisi, statusnya masih pending / belum disentuh teknisi.
      // Belum Selesai: teknisi sudah lihat & sedang menangani (dalam pengecekan / diproses).
      // Selesai: hasil akhir, baik selesai normal maupun kendala di sisi pengguna.
      const activeCount = officerReports.filter(report => report.status === 'open').length;
      const inProgressCount = officerReports.filter(report => (
        report.status === 'investigating' || report.status === 'in_progress'
      )).length;
      const resolvedCount = officerReports.filter(report => (
        report.status === 'resolved' || report.status === 'user_issue'
      )).length;
      const totalCount = officerReports.length;
      return `
        <article class="staff-card">
          <div>
            <p class="ticket-title">${esc(officer.name)}</p>
            <p class="ticket-meta">${esc(officer.username)} - ${esc(officer.phone || 'Nomor belum diisi')}</p>
          </div>
          <div class="staff-stats">
            <div class="staff-stat stat-active">
              <strong>${activeCount}</strong>
              <span>laporan aktif</span>
            </div>
            <div class="staff-stat stat-resolved">
              <strong>${resolvedCount}</strong>
              <span>selesai</span>
            </div>
            <div class="staff-stat stat-progress">
              <strong>${inProgressCount}</strong>
              <span>belum selesai</span>
            </div>
            <div class="staff-stat stat-total">
              <strong>${totalCount}</strong>
              <span>total diterima</span>
            </div>
          </div>
        </article>
      `;
    }).join('') : '<p class="empty">Belum ada staf.</p>';
  } catch (err) {
    list.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
  }
}

// ambil semua laporan, render ke antrean admin
async function loadAdminReports() {
  const list = $('#adminList');
  if (!adminKey) return;
  try {
    const [data] = await Promise.all([
      api('/api/reports', { headers: { 'X-Admin-Key': adminKey } }),
      adminStaff.length ? Promise.resolve(adminStaff) : loadOfficers()
    ]);
    const reports = data.reports || [];
    list.innerHTML = reports.length ? reports.map(adminTicket).join('') : '<p class="empty">Belum ada laporan.</p>';
    bindAdminControls();
  } catch (err) {
    list.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
  }
}

async function loadAnalytics() {
  if (!adminKey || !$('#summaryTotal')) return;
  try {
    const params = new URLSearchParams({ period: analyticsPeriod });
    if (analyticsPeriod === 'monthly') {
      params.set('month', String(analyticsMonth));
      params.set('year', String(analyticsYear));
    }
    const summary = await api(`/api/report/summary?${params.toString()}`, {
      headers: { 'X-Admin-Key': adminKey }
    });
    renderAnalytics(summary);
  } catch (err) {
    $('#summaryTable').innerHTML = `<p class="empty">${esc(err.message)}</p>`;
  }
}

// isi dropdown bulan & tahun buat mode Bulanan -- biar bisa pilih bulan kalender
// spesifik, bukan rolling 30 hari yang bisa nyampur 2 bulan kayak dulu
function populateMonthYearSelectors() {
  const monthSelect = $('#summaryMonth');
  const yearSelect = $('#summaryYear');
  if (!monthSelect || !yearSelect) return;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  monthSelect.innerHTML = monthNames.map((name, index) => (
    `<option value="${index + 1}"${index + 1 === analyticsMonth ? ' selected' : ''}>${name}</option>`
  )).join('');

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) years.push(y);
  yearSelect.innerHTML = years.map(y => (
    `<option value="${y}"${y === analyticsYear ? ' selected' : ''}>${y}</option>`
  )).join('');
}

// ini yang manggil semua render analitik (pie, bar OPD, tabel, top 5)
function renderAnalytics(summary) {
  const totals = summary.totals || {};
  $('#summaryTotal').textContent = totals.total || 0;
  $('#summaryActive').textContent = totals.active || 0;
  $('#summaryResolved').textContent = totals.resolved || 0;
  $('#summaryAvg').textContent = totals.avgResolutionHours == null ? '-' : `${totals.avgResolutionHours} jam`;
  renderPie(summary.byCategory || []);
  renderBarChart(summary.byOpd || []);
  renderSummaryTable(summary);
  renderTopTexts(summary.topIssues || []);
}

// pie chart pake conic-gradient css doang, gak pake library chart apapun
function renderPie(rows) {
  const pie = $('#categoryPie');
  const legend = $('#categoryLegend');
  if (!pie || !legend) return;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const colors = ['#0f4c81', '#129eb3', '#14865b', '#a76614', '#b42318', '#6d5bd0'];
  if (!total) {
    pie.style.background = '#eef3f9';
    pie.innerHTML = '<span>0</span>';
    legend.innerHTML = '<p class="empty">Belum ada data jenis gangguan.</p>';
    return;
  }

  let cursor = 0;
  const slices = rows.map((row, index) => {
    const start = cursor;
    const end = cursor + (row.count / total) * 100;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  pie.style.background = `conic-gradient(${slices.join(', ')})`;
  pie.innerHTML = `<span>${total}</span>`;
  legend.innerHTML = rows.map((row, index) => `
    <div class="legend-item">
      <i style="background:${colors[index % colors.length]}"></i>
      <span>${esc(row.category || 'Tanpa kategori')}</span>
      <strong>${row.count}</strong>
    </div>
  `).join('');
}

// bar chart OPD, sengaja gak di-slice/limit -- kalau OPD-nya banyak biar aja,
// scrollable dari CSS-nya (#opdChart), jangan sampai kepotong data
function renderBarChart(rows) {
  const chart = $('#opdChart');
  if (!chart) return;

   const top = rows;
  const max = Math.max(1, ...top.map(row => row.count));
  chart.innerHTML = top.length ? top.map(row => `
    <div class="bar-row">
      <span>${esc(row.opd || 'Tanpa OPD')}</span>
      <div class="bar-track"><i style="width:${Math.max(8, (row.count / max) * 100)}%"></i></div>
      <strong>${row.count}</strong>
    </div>
  `).join('') : '<p class="empty">Belum ada OPD yang tercatat.</p>';
}

// tabel ringkasan per tanggal, ngikutin filter mingguan/bulanan + bulan-tahun yg dipilih
function renderSummaryTable(summary) {
  const table = $('#summaryTable');

  if (!table) return;

  const rows = summary.timeline || [];

  if (!rows.length) {
    table.innerHTML = `
      <div class="summary-empty">
        Belum ada data laporan.
      </div>
    `;
    return;
  }

  table.innerHTML = `
    <div class="summary-table-wrap">
      <table class="analytics-table">

        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Laporan masuk</th>
            <th>Selesai</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(row => `
            <tr>

              <td>
                <strong>${esc(formatDateOnly(row.date))}</strong>
              </td>

              <td>
                <span class="table-number created">
                  ${row.created}
                </span>
              </td>

              <td>
                <span class="table-number resolved">
                  ${row.resolved}
                </span>
              </td>

            </tr>
          `).join('')}
        </tbody>

      </table>
    </div>
  `;
}

// Top 5 sekarang berupa list teks bernomor sederhana: jenis gangguan apa dan
// tempatnya dimana, langsung dari data terstruktur (category + area) — bukan
// kartu ala tiket dengan badge/contoh nomor tiket seperti sebelumnya.
function renderTopTexts(rows) {
  const list = $('#topTexts');

  if (!list) return;

  if (!rows.length) {
    list.innerHTML = `
      <div class="top-empty">
        <span>Belum ada data</span>
        <p>Belum ada jenis gangguan yang tercatat pada periode ini.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map(row => `
    <article class="top-issue-card">

      <div class="top-issue-rank">
        ${String(row.rank).padStart(2, '0')}
      </div>

      <div class="top-issue-content">

        <div class="top-issue-main">
          <h4>${esc(row.category || 'Lainnya')}</h4>

          <span class="top-issue-count">
            ${row.count} laporan
          </span>
        </div>

        <div class="top-issue-location">
          <span class="location-icon">📍</span>
          <span>${esc(row.area || 'Tanpa lokasi')}</span>
        </div>

      </div>

    </article>
  `).join('');
}

// kartu tiket admin -- lengkap: detail, riwayat, ubah status, disposisi ke staf, tombol WA/hapus
function adminTicket(ticket) {
  const whatsapp = whatsappLink(ticket);
  const assignedOfficer = adminStaff.find(officer => officer.id === ticket.assignedTo);
  const staffWhatsapp = assignedOfficer ? staffWhatsappLink(assignedOfficer, ticket) : '';
  return `
    <article class="admin-ticket">
      <div class="ticket-top">
        <span class="ticket-id">${esc(ticket.id)}</span>
        ${statusBadge(ticket.status)}
      </div>
      <p class="ticket-title">${esc(ticket.area)}</p>
      <p class="ticket-meta">${esc(ticket.roomCategory || 'Tanpa kategori instansi')} - ${esc(ticket.reporter)} - ${esc(ticket.contact)} - ${fmt(ticket.createdAt)}</p>
      <p class="ticket-meta"><strong>Jenis gangguan:</strong> ${esc(ticket.category || 'Tidak dikategorikan')}</p>
      <p class="ticket-detail">${esc(ticket.detail)}</p>
      <div class="admin-timeline-section">
        <h4>Riwayat penanganan</h4>
        ${renderTimeline(ticket, true)}
      </div>
      <div class="controls status-controls" data-id="${esc(ticket.id)}">
        <select class="status-input">
          ${Object.entries(STATUS_LABEL).map(([value, label]) => `
            <option value="${value}"${ticket.status === value ? ' selected' : ''}>${label}</option>
          `).join('')}
        </select>
        <button class="primary-btn save-status" type="button">Simpan</button>
      </div>
      <div class="controls assign-controls" data-id="${esc(ticket.id)}">
        <select class="staff-input">
          <option value="">Pilih staf</option>
          ${adminStaff.map(officer => `
            <option value="${esc(officer.id)}"${ticket.assignedTo === officer.id ? ' selected' : ''}>${esc(officer.name)}</option>
          `).join('')}
        </select>
        <input class="instruction-input" placeholder="Instruksi untuk teknis, contoh: tangani laporan ${esc(ticket.id)}" />
        <button class="secondary-btn assign-ticket" type="button">Kirim ke teknis</button>
      </div>
      <div class="inline-actions admin-actions">
        ${whatsapp ? `<a class="secondary-btn wa-btn" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp pelapor</a>` : '<span class="form-msg">Nomor WhatsApp tidak valid.</span>'}
        ${staffWhatsapp ? `<a class="secondary-btn wa-btn" href="${staffWhatsapp}" target="_blank" rel="noopener">WhatsApp ${esc(assignedOfficer.name)}</a>` : ''}
        <button class="secondary-btn danger-btn delete-ticket" data-id="${esc(ticket.id)}" type="button">Hapus tiket</button>
      </div>
    </article>
  `;
}

// Mengikat tombol-tombol dinamis di dashboard admin setelah daftar tiket dirender ulang.
function bindAdminControls() {
  $$('.save-status').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest('.controls');
      const payload = {
        status: $('.status-input', row).value,
        note: ''
      };
      button.disabled = true;
      button.textContent = 'Menyimpan...';
      try {
        await api(`/api/reports/${encodeURIComponent(row.dataset.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKey
          },
          body: JSON.stringify(payload)
        });
        await Promise.all([loadAdminReports(), loadBoard()]);
      } catch (err) {
        alert(err.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Simpan';
      }
    });
  });
  $$('.delete-ticket').forEach(button => {
    button.addEventListener('click', async () => {
      const ticketId = button.dataset.id;
      const ok = confirm(`Hapus tiket ${ticketId}? Data tiket ini akan hilang dari dashboard admin.`);
      if (!ok) return;

      button.disabled = true;
      button.textContent = 'Menghapus...';
      try {
        await api(`/api/reports/${encodeURIComponent(ticketId)}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Key': adminKey }
        });
        await Promise.all([loadAdminReports(), loadBoard()]);
      } catch (err) {
        alert(err.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Hapus tiket';
      }
    });
  });
  $$('.assign-ticket').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest('.assign-controls');
      const payload = {
        officerId: $('.staff-input', row).value,
        instruction: $('.instruction-input', row).value.trim()
      };
      if (!payload.officerId) {
        alert('Pilih staf terlebih dahulu.');
        return;
      }
      button.disabled = true;
      button.textContent = 'Mengirim...';
      try {
        await api(`/api/reports/${encodeURIComponent(row.dataset.id)}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKey
          },
          body: JSON.stringify(payload)
        });
        await Promise.all([loadAdminReports(), loadStaffList(), loadBoard()]);
      } catch (err) {
        alert(err.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Kirim ke staf';
      }
    });
  });
}

// login staf -> simpan token -> tampilin panel tugas
async function staffLogin(event) {
  event.preventDefault();
  const msg = $('#staffMsg');
  msg.className = 'form-msg';
  msg.textContent = 'Memeriksa akses...';
  try {
    const data = await api('/api/officer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('#staffUsername').value.trim(),
        password: $('#staffPassword').value
      })
    });
    staffToken = data.token;
    currentStaff = data.officer;
    sessionStorage.setItem('appauStaffToken', staffToken);
    if ($('#staffLoginSection')) $('#staffLoginSection').hidden = true;
    $('#staffPanel').hidden = false;
    $('#staffLogout').hidden = false;
    msg.textContent = '';
    await loadStaffTasks();
  } catch (err) {
    msg.classList.add('error');
    msg.textContent = err.message;
  }
}

// ambil tugas staf yang lagi login, render ke #staffTaskList
async function loadStaffTasks() {
  const list = $('#staffTaskList');
  if (!list || !staffToken) return;
  try {
    const data = await api('/api/officer/reports', { headers: { 'X-Officer-Token': staffToken } });
    currentStaff = data.officer;
    $('#staffName').textContent = currentStaff ? `Daftar laporan ${currentStaff.name}` : 'Daftar laporan';
    const reports = data.reports || [];
    list.innerHTML = reports.length ? reports.map(staffTicket).join('') : '<p class="empty">Belum ada tugas dari admin.</p>';
    bindStaffControls();
  } catch (err) {
    sessionStorage.removeItem('appauStaffToken');
    staffToken = '';
    list.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    if ($('#staffLoginSection')) $('#staffLoginSection').hidden = false;
    if ($('#staffPanel')) $('#staffPanel').hidden = true;
    if ($('#staffLogout')) $('#staffLogout').hidden = true;
  }
}

// kartu tugas staf, ada form update status + komentar + upload foto bukti
function staffTicket(ticket) {
  return `
    <article class="admin-ticket">
      <div class="ticket-top">
        <span class="ticket-id">${esc(ticket.id)}</span>
        ${statusBadge(ticket.status)}
      </div>
      <p class="ticket-title">${esc(ticket.area)}</p>
      <p class="ticket-meta">${esc(ticket.roomCategory || 'Tanpa kategori instansi')} - ${esc(ticket.reporter)} - ${fmt(ticket.createdAt)}</p>
      <p class="ticket-meta"><strong>Jenis gangguan:</strong> ${esc(ticket.category || 'Tidak dikategorikan')}</p>
      <p class="ticket-detail">${esc(ticket.detail)}</p>
      <div class="admin-timeline-section">
        <h4>Riwayat penanganan</h4>
        ${renderTimeline(ticket, false)}
      </div>
      <div class="staff-work" data-id="${esc(ticket.id)}">
        <label class="field">
          <span>Status hasil pengecekan</span>
          <select class="staff-status-input">
            ${Object.entries(STATUS_LABEL).map(([value, label]) => `
              <option value="${value}"${ticket.status === value ? ' selected' : ''}>${label}</option>
            `).join('')}
          </select>
        </label>
        <label class="field">
          <span>Komentar penanganan</span>
          <textarea class="staff-note-input" rows="4" placeholder="Tulis apa yang akan/sudah dilakukan, dan apakah kendala dari jaringan atau sisi pengguna."></textarea>
        </label>
        <label class="field">
          <span>Foto bukti JPG/PNG</span>
          <input class="staff-photo-input" type="file" accept="image/png,image/jpeg" />
        </label>
        <button class="primary-btn staff-save-ticket" type="button">Kirim update ke admin</button>
      </div>
    </article>
  `;
}

// pasang listener tombol kirim update, harus dipanggil ulang tiap render ulang daftar
function bindStaffControls() {
  $$('.staff-save-ticket').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest('.staff-work');
      const fileInput = $('.staff-photo-input', row);
      const payload = {
        status: $('.staff-status-input', row).value,
        note: $('.staff-note-input', row).value.trim()
      };
      button.disabled = true;
      button.textContent = 'Mengirim...';
      try {
        await api(`/api/reports/${encodeURIComponent(row.dataset.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Officer-Token': staffToken
          },
          body: JSON.stringify(payload)
        });
        if (fileInput.files[0]) {
          const formData = new FormData();
          formData.set('photo', fileInput.files[0]);
          await api(`/api/reports/${encodeURIComponent(row.dataset.id)}/photo`, {
            method: 'POST',
            headers: { 'X-Officer-Token': staffToken },
            body: formData
          });
        }
        alert('Update berhasil dikirim ke admin.');
        await loadStaffTasks();
      } catch (err) {
        alert(err.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Kirim update ke admin';
      }
    });
  });
}

// logout staf -- cabut token di server, balik ke form login
async function staffLogout() {
  if (staffToken) {
    await api('/api/officer/logout', {
      method: 'POST',
      headers: { 'X-Officer-Token': staffToken }
    }).catch(() => {});
  }
  staffToken = '';
  currentStaff = null;
  sessionStorage.removeItem('appauStaffToken');
  if ($('#staffLoginSection')) $('#staffLoginSection').hidden = false;
  $('#staffPanel').hidden = true;
  $('#staffLogout').hidden = true;
}

// logout admin -- hapus key dari sessionStorage, balik ke form login
function adminLogout() {
  adminKey = '';
  sessionStorage.removeItem('appauAdminKey');
  if ($('#adminLoginSection')) $('#adminLoginSection').hidden = false;
  if ($('#adminPanel')) $('#adminPanel').hidden = true;
  if ($('#adminLogout')) $('#adminLogout').hidden = true;
}

// cek ulang admin key yang ke-save di sessionStorage pas halaman di-refresh,
// biar gak perlu login lagi tiap refresh
async function initAdminSession() {
  if (!adminKey || !$('#adminPanel')) return;
  try {
    await api('/api/reports', { headers: { 'X-Admin-Key': adminKey } });
    if ($('#adminLoginSection')) $('#adminLoginSection').hidden = true;
    $('#adminPanel').hidden = false;
    if ($('#adminLogout')) $('#adminLogout').hidden = false;
    await Promise.all([loadAdminReports(), loadStaffList(), loadAnalytics()]);
  } catch (err) {
    adminLogout();
  }
}

// import ruangan dari CSV/JSON -- ini REPLACE semua data lama, bukan nambah!
async function importRooms(event) {
  event.preventDefault();
  const file = $('#roomFile').files[0];
  const msg = $('#roomImportMsg');
  msg.className = 'hint';
  if (!file) {
    msg.textContent = 'Pilih file CSV atau JSON terlebih dahulu.';
    return;
  }

  const formData = new FormData();
  formData.set('rooms', file);
  try {
    const data = await api('/api/rooms/import', {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey },
      body: formData
    });
    msg.className = 'form-msg ok';
    msg.textContent = `${data.count} ruangan berhasil diimpor.`;
    $('#roomImportForm').reset();
    await loadRooms();
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  }
}

// helper2 kecil di bawah ini dipake bolak-balik di banyak tempat
function statusBadge(status) {
  return `<span class="badge ${esc(status)}">${esc(STATUS_LABEL[status] || status)}</span>`;
}

function whatsappLink(ticket) {
  const phone = normalizePhone(ticket.contact);
  if (!phone) return '';
  const message = whatsappStatusMessage(ticket);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// link wa.me buat notif ke staf yang kena disposisi
function staffWhatsappLink(officer, ticket) {
  const phone = normalizePhone(officer.phone);
  if (!phone) return '';
  const message = [
    `Halo ${officer.name}, mohon tangani laporan ${ticket.id}.`,
    `Lokasi: ${ticket.area}`,
    `Kategori: ${ticket.category}`,
    `Pelapor: ${ticket.reporter}`,
    `Detail: ${ticket.detail}`,
    '',
    'Silakan login ke halaman teknis APPAU untuk memberi komentar penanganan, status hasil pengecekan, dan foto bukti.'
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// teks pesan WA ke pelapor, isinya beda-beda tergantung status tiket
function whatsappStatusMessage(ticket) {
  const status = STATUS_LABEL[ticket.status] || ticket.status;
  const header = [
    'Halo, kami dari Tim IT Diskominfo.',
    `Terkait laporan jaringan ${ticket.id}.`,
    `Lokasi: ${ticket.area}`,
    `Status: ${status}`,
    ''
  ];

  const messages = {
    open: 'Laporan Anda sudah kami terima dan masuk antrean. Tim kami akan melakukan pengecekan awal. Mohon menunggu konfirmasi berikutnya.',
    investigating: 'Tim APPAU sedang melakukan pengecekan awal pada jaringan dan lokasi terkait. Kami akan menginformasikan hasil pemeriksaan berikutnya.',
    in_progress: 'Laporan sedang diproses oleh Tim APPAU. Kami sedang melakukan penanganan atau perbaikan agar layanan jaringan kembali normal.',
    user_issue: 'Hasil pengecekan sementara menunjukkan jaringan utama dalam kondisi stabil. Kendala kemungkinan berasal dari sisi perangkat atau koneksi pengguna. Mohon coba restart perangkat, lupakan jaringan WiFi lalu sambungkan ulang, atau hubungi admin jika masih terkendala.',
    resolved: 'Laporan sudah selesai ditangani. Silakan cek kembali koneksi jaringan di lokasi Anda. Jika masih mengalami kendala, silakan balas pesan ini atau buat laporan baru.'
  };

  return header.concat(messages[ticket.status] || 'Mohon menunggu, laporan sedang kami tindak lanjuti.').join('\n');
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return digits.length >= 9 ? digits : '';
}

function fmt(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateOnly(value) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short'
  });
}

function ago(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

// escape HTML biar aman -- jangan dihapus, ini nahan XSS dari isi laporan user
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function on(selector, eventName, handler) {
  const el = $(selector);
  if (el) el.addEventListener(eventName, handler);
}

// semua event listener dipasang di sini, numpuk jadi satu biar gampang dicari kalo mau revisi
on('#reportForm', 'submit', submitReport);

// Dropdown Lokasi/OSPD HANYA boleh terbuka lewat klik eksplisit pada field-nya.
// Tidak ada lagi listener 'focus' otomatis, supaya tidak muncul sendiri saat halaman baru dibuka
// atau saat browser mengembalikan fokus lama dari cache/back-forward.
on('#roomCategory', 'change', () => {
  if (roomListOpen) paintRoomOptions();
});
on('#area', 'click', () => {
  roomListOpen = true;
  paintRoomOptions();
});
on('#area', 'input', () => {
  if (roomListOpen) paintRoomOptions();
});
on('#roomList', 'mousedown', event => {
  const option = event.target.closest('.autocomplete-option');
  if (!option) return;
  event.preventDefault();
  chooseRoom(Number(option.dataset.index));
});
document.addEventListener('click', event => {
  if (!event.target.closest('.autocomplete')) hideRoomOptions();
});
window.addEventListener('pageshow', hideRoomOptions); // jaga-jaga saat halaman direstore dari cache browser

on('#trackForm', 'submit', trackTicket);
on('#refreshBoard', 'click', loadBoard);
on('#adminLogin', 'submit', adminLogin);
on('#adminRefresh', 'click', loadAdminReports);
on('#staffRefresh', 'click', loadStaffList);
on('#analyticsRefresh', 'click', loadAnalytics);
$$('[data-period]').forEach(button => {
  button.addEventListener('click', () => {
    analyticsPeriod = button.dataset.period || 'weekly';
    $$('[data-period]').forEach(item => item.classList.toggle('active', item === button));
    const picker = $('#monthYearPicker');
    if (picker) picker.hidden = analyticsPeriod !== 'monthly';
    loadAnalytics();
  });
});
on('#summaryMonth', 'change', () => {
  analyticsMonth = parseInt($('#summaryMonth').value, 10) || analyticsMonth;
  loadAnalytics();
});
on('#summaryYear', 'change', () => {
  analyticsYear = parseInt($('#summaryYear').value, 10) || analyticsYear;
  loadAnalytics();
});
on('#staffLogin', 'submit', staffLogin);
on('#staffTaskRefresh', 'click', loadStaffTasks);
on('#staffLogout', 'click', staffLogout);
on('#adminLogout', 'click', adminLogout);
const roomImportForm = $('#roomImportForm');
if (roomImportForm) roomImportForm.addEventListener('submit', importRooms);
on('#newReport', 'click', () => {
  $('#receipt').hidden = true;
  $('#reportForm').hidden = false;
  $('#reportForm').reset();
});
on('#copyTicket', 'click', async () => {
  await navigator.clipboard.writeText($('#receiptTicket').textContent);
});

if ($('#clock')) setInterval(tick, 1000);
if ($('#board') || $$('[data-stat]').length) setInterval(loadBoard, 15000);
tick();
loadRooms();
loadBoard();
populateMonthYearSelectors();
if ($('#staffTaskList') && staffToken) {
  if ($('#staffLoginSection')) $('#staffLoginSection').hidden = true;
  if ($('#staffPanel')) $('#staffPanel').hidden = false;
  if ($('#staffLogout')) $('#staffLogout').hidden = false;
  loadStaffTasks();
}
initAdminSession();