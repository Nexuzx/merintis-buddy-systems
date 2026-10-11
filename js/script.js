/* ═══════════════════════════════════════════════════════════
   Merintis — Onboarding Buddy System  |  script.js  v3

   Model Data (SCHEMA_VERSION = 3):
   ┌─ users[]        { id, nama, email, divisi, jabatan, minat[], ketersediaan[], peran, bio, createdAt }
   ├─ pairings[]     { id, newcomerId, buddyId, tanggalMulai, status: 'aktif'|'selesai'|'diputus' }
   ├─ checklists{}   { [newcomerId]: CheckItem[] }   — per-newcomer
   ├─ schedules{}    { [newcomerId]: Schedule[] }    — per-newcomer
   ├─ notes{}        { [newcomerId]: Note[] }        — per-newcomer
   ├─ meetingNotes{} { [pairingId]: MeetingNote[] }  — per-pairing
   ├─ activeUserId   string
   └─ faqs[]         { id, kategori, pertanyaan, jawaban }

   Kuota buddy: maks 2 pairing aktif (dihitung dinamis dari pairings[]).

   Modul:
   1.  Konstanta & Konfigurasi
   2.  Storage Wrapper
   3.  Data Awal (seed)
   4.  Model Queries (baca/tulis model data)
   5.  State Aplikasi
   6.  Routing (hash-based SPA)
   7.  Sidebar, Dark Mode, Role
   8.  Toast & Confirm Modal
   9.  Helper & Komponen Reusable
   10. Halaman: Beranda
   11. Halaman: Pendaftaran
   12. Halaman: Cari Buddy
   13. Halaman: Dashboard Newcomer
   14. Halaman: Dashboard Buddy
   15. Halaman: FAQ
   16. Footer
   17. Inisialisasi
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   1. KONSTANTA & KONFIGURASI
───────────────────────────────────────────── */
const SCHEMA_VERSION = 3;
const BUDDY_QUOTA    = 2;   // max newcomer aktif per buddy

const PAGES = {
  'beranda':             { title: 'Beranda',           render: renderBeranda },
  'daftar':              { title: 'Pendaftaran',        render: renderDaftar },
  'cari-buddy':          { title: 'Cari Buddy',         render: renderCariBuddy },
  'dashboard-newcomer':  { title: 'Dashboard Newcomer', render: renderDashboardNewcomer },
  'dashboard-buddy':     { title: 'Dashboard Buddy',    render: renderDashboardBuddy },
  'faq':                 { title: 'FAQ',                render: renderFAQ },
};
const DEFAULT_PAGE = 'beranda';

/* Halaman yang dibatasi per peran — redirect jika akses salah */
const ROLE_GATES = {
  'dashboard-newcomer': 'newcomer',
  'dashboard-buddy':    'buddy',
};

/* ─────────────────────────────────────────────
   2. STORAGE WRAPPER
───────────────────────────────────────────── */
const Store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem('merintis_' + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('merintis_' + key, JSON.stringify(value)); } catch {}
  },
  remove(key) { localStorage.removeItem('merintis_' + key); }
};

/* ─────────────────────────────────────────────
   3. DATA AWAL (seed)
   Dipanggil saat SCHEMA_VERSION berubah atau data belum ada.
   Semua tanggal disimpan sebagai ISO string (zona lokal).
───────────────────────────────────────────── */
function getISODate(offsetDays = 0) {
  /* Tanggal dalam zona WIB (UTC+7) — diformat sebagai YYYY-MM-DD */
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Sesuaikan ke UTC+7
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split('T')[0];
}

function seedData() {
  const storedVersion = Store.get('schemaVersion', 0);
  if (storedVersion >= SCHEMA_VERSION) return;   // sudah up-to-date

  console.log('[Merintis] Menginisialisasi data demo (skema v' + SCHEMA_VERSION + ')…');

  /* ── USERS ── */
  Store.set('users', [
    {
      id: 'u1', nama: "Adi Firmansyah", email: 'adi@merintis.id',
      divisi: 'Engineering', jabatan: 'Senior Software Engineer',
      minat: ['Backend', 'System Design', 'Mentoring'],
      ketersediaan: ['Senin pagi', 'Rabu sore'],
      peran: 'buddy',
      bio: "Suka ngobrol soal arsitektur sistem dan cara debug yang efektif. Pernah onboard 5 newcomer, semuanya betah!",
      createdAt: getISODate(-60)
    },
    {
      id: 'u2', nama: "Sari Widiastuti", email: 'sari@merintis.id',
      divisi: 'Product', jabatan: 'Senior Product Manager',
      minat: ['Product Discovery', 'User Research', 'Kolaborasi Lintas Tim'],
      ketersediaan: ['Selasa sore', 'Kamis pagi'],
      peran: 'buddy',
      bio: "Percaya bahwa pertanyaan 'naif' itu sering kali yang paling kritis. Tidak ada pertanyaan yang terlalu sepele!",
      createdAt: getISODate(-90)
    },
    {
      id: 'u3', nama: 'Bagas Nugroho', email: 'bagas@merintis.id',
      divisi: 'Design', jabatan: 'Lead UI/UX Designer',
      minat: ['UI Design', 'Design System', 'Figma'],
      ketersediaan: ['Senin sore', 'Jumat pagi'],
      peran: 'buddy',
      bio: 'Kalau bingung soal alur kerja desain di Merintis atau mau minta review, langsung ping saja, santai!',
      createdAt: getISODate(-45)
    },
    {
      id: 'u4', nama: 'Rena Kusuma', email: 'rena@merintis.id',
      divisi: 'Marketing', jabatan: 'Growth Marketing Lead',
      minat: ['Konten Kreatif', 'Analytics', 'SEO'],
      ketersediaan: ['Rabu pagi', 'Jumat sore'],
      peran: 'buddy',
      bio: 'Kalau kamu di tim marketing atau comms, ayo berkenalan! Saya senang bantu navigasi ekosistem Merintis.',
      createdAt: getISODate(-120)
    },
    {
      id: 'u5', nama: 'Dimas Prasetyo', email: 'dimas@merintis.id',
      divisi: 'Engineering', jabatan: 'DevOps Engineer',
      minat: ['Cloud Infrastructure', 'CI/CD', 'Kubernetes'],
      ketersediaan: ['Kamis sore', 'Sabtu pagi'],
      peran: 'buddy',
      bio: 'Buat kamu yang baru tiba dan langsung pusing sama pipeline deployment, mari duduk bareng dan urai pelan-pelan.',
      createdAt: getISODate(-30)
    },
    {
      id: 'u6', nama: 'Laila Andriani', email: 'laila@merintis.id',
      divisi: 'Data', jabatan: 'Data Analyst',
      minat: ['SQL', 'Data Storytelling', 'Looker'],
      ketersediaan: ['Selasa pagi', 'Kamis pagi'],
      peran: 'buddy',
      bio: 'Saya percaya data bisa menceritakan kisah yang menarik. Kalau kamu di bidang data, yuk ngobrol!',
      createdAt: getISODate(-15)
    },
    /* Newcomer contoh */
    {
      id: 'u7', nama: 'Mira Rahayu', email: 'mira@merintis.id',
      divisi: 'Product', jabatan: 'Junior Product Manager',
      minat: ['User Research', 'Product Discovery', 'Riset Pasar'],
      ketersediaan: ['Selasa sore', 'Kamis pagi', 'Jumat sore'],
      peran: 'newcomer',
      bio: 'Baru bergabung di Merintis. Sangat antusias belajar tentang product development!',
      createdAt: getISODate(-7)
    },
    {
      id: 'u8', nama: "Budi Santoso", email: 'budi@merintis.id',
      divisi: 'Engineering', jabatan: 'Junior Frontend Developer',
      minat: ['React', 'UI Design', 'Testing'],
      ketersediaan: ['Senin pagi', 'Rabu sore'],
      peran: 'newcomer',
      bio: "Lulusan bootcamp yang antusias. Siap belajar cara kerja tim Engineering Merintis!",
      createdAt: getISODate(-3)
    },
  ]);

  /* ── PAIRINGS ── */
  Store.set('pairings', [
    {
      id: 'p1',
      newcomerId: 'u7', buddyId: 'u2',
      tanggalMulai: getISODate(-7),
      status: 'aktif'
    },
    {
      id: 'p2',
      newcomerId: 'u8', buddyId: 'u1',
      tanggalMulai: getISODate(-3),
      status: 'aktif'
    },
  ]);

  /* ── CHECKLISTS (per newcomer) ── */
  const defaultChecklist = [
    { id: 'c1', minggu: 1, label: 'Perkenalan dengan Tim Inti',    desc: 'Hadiri sesi welcome meeting dan kenalan dengan minimal 5 rekan kerja', done: true,  custom: false },
    { id: 'c2', minggu: 1, label: 'Setup Akun & Tools',            desc: 'Aktifkan akun Slack, Notion, Jira, dan Google Workspace kamu', done: true,  custom: false },
    { id: 'c3', minggu: 1, label: 'Baca Company Handbook',         desc: 'Baca panduan budaya kerja, nilai-nilai Merintis, dan kebijakan utama', done: true,  custom: false },
    { id: 'c4', minggu: 1, label: 'Pertemuan Pertama dengan Buddy',desc: 'Jadwalkan sesi 1:1 pertama dengan buddy kamu selama 30–60 menit', done: false, custom: false },
    { id: 'c5', minggu: 1, label: 'Tur Kantor (Virtual/Fisik)',    desc: 'Kenali layout ruang kerja dan fasilitas yang tersedia', done: false, custom: false },
    { id: 'c6', minggu: 2, label: 'Pahami Alur Kerja Tim',         desc: 'Pelajari cara tim kamu bekerja: standar, ritual, dan ritme sprint/project', done: false, custom: false },
    { id: 'c7', minggu: 2, label: 'Ikuti 1 Meeting Tim Rutin',     desc: 'Amati bagaimana diskusi dan keputusan dibuat di tim kamu', done: false, custom: false },
    { id: 'c8', minggu: 2, label: 'Kenali Stakeholder Utama',      desc: 'Identifikasi siapa yang relevan dengan pekerjaanmu dan cara terbaik berkomunikasi', done: false, custom: false },
    { id: 'c9', minggu: 2, label: 'Review Proyek Terkini',         desc: 'Pelajari proyek atau inisiatif yang sedang berjalan di tim kamu', done: false, custom: false },
    { id: 'c10',minggu: 3, label: 'Kontribusi Kecil Pertama',      desc: 'Selesaikan satu task kecil yang nyata dan berdampak langsung', done: false, custom: false },
    { id: 'c11',minggu: 3, label: 'Diskusi Ekspektasi dengan Manager', desc: 'Klarifikasi target 30/60/90 hari bersama manajermu', done: false, custom: false },
    { id: 'c12',minggu: 3, label: 'Check-in Progres dengan Buddy', desc: 'Ceritakan perkembanganmu, tantangan, dan rencana ke depan ke buddy', done: false, custom: false },
    { id: 'c13',minggu: 3, label: 'Ikuti Sesi Knowledge Sharing',  desc: 'Hadiri sesi internal sharing (tech talk, product demo, dll.)', done: false, custom: false },
    { id: 'c14',minggu: 4, label: 'Selesaikan Proyek Onboarding',  desc: 'Presentasikan hasil belajarmu selama 30 hari ke tim kecil', done: false, custom: false },
    { id: 'c15',minggu: 4, label: 'Tulis Retrospektif Pertama',    desc: 'Catat apa yang berjalan baik, apa yang sulit, dan rencana ke depan', done: false, custom: false },
    { id: 'c16',minggu: 4, label: 'Evaluasi Buddy Program',        desc: 'Isi survei feedback tentang program buddy untuk bantu kami berkembang', done: false, custom: false },
  ];
  Store.set('checklists', {
    'u7': defaultChecklist.map(i => ({ ...i })),
    'u8': defaultChecklist.map(i => ({ ...i, done: false })),
  });

  /* ── SCHEDULES (per newcomer) ── */
  Store.set('schedules', {
    'u7': [
      { id: 'sched1', newcomerId: 'u7', tanggal: getISODate(2), waktu: '10:00', judul: 'Check-in Minggu 1 dengan Sari', tempat: 'Google Meet' },
      { id: 'sched2', newcomerId: 'u7', tanggal: getISODate(9), waktu: '14:00', judul: 'Review Progres Onboarding Minggu 2', tempat: 'Ruang Meeting Lantai 3' },
    ],
    'u8': [
      { id: 'sched3', newcomerId: 'u8', tanggal: getISODate(1), waktu: '09:00', judul: 'Perkenalan dengan Adi', tempat: 'Google Meet' },
    ],
  });

  /* ── NOTES (per newcomer) ── */
  Store.set('notes', {
    'u7': [
      { id: 'note1', tanggal: formatDateWIB(new Date()), teks: 'Hari pertama seru banget! Semua orang ramah. Perlu ingat untuk setup Jira project sebelum besok.' },
    ],
    'u8': [],
  });

  /* ── MEETING NOTES (per pairing) ── */
  Store.set('meetingNotes', {
    'p1': [
      { id: 'mn1', tanggal: formatDateWIB(new Date()), catatan: "Mira sudah berhasil setup semua tools. Perlu diarahkan lebih ke alur product discovery tim." },
    ],
    'p2': [],
  });

  /* ── ACTIVE USER ── */
  Store.set('activeUserId', 'u7');  // default: newcomer

  /* ── FAQS ── */
  Store.set('faqs', [
    { id: 'f1', kategori: 'Kehidupan di Kantor', pertanyaan: 'Apakah normal kalau saya masih sering bingung di minggu pertama?', jawaban: 'Sangat normal! Bahkan karyawan berpengalaman pun perlu waktu untuk menyesuaikan diri di lingkungan baru. Program buddy Merintis justru dirancang untuk situasi ini. Jangan ragu untuk bertanya ke buddy kamu, sebanyak apa pun pertanyaannya.' },
    { id: 'f2', kategori: 'Kehidupan di Kantor', pertanyaan: 'Bagaimana cara bertanya ke atasan tanpa terlihat tidak kompeten?', jawaban: '<strong>Tips singkat:</strong><ul><li>Coba cari jawaban sendiri selama 15 menit terlebih dahulu</li><li>Kumpulkan beberapa pertanyaan sekaligus, bukan satu per satu</li><li>Sebutkan konteks masalah dan apa yang sudah kamu coba</li><li>Ajukan pertanyaan open-ended: "Menurutmu, apakah cara ini masuk akal?"</li></ul>Bertanya adalah tanda kamu serius belajar, bukan tanda kelemahan.' },
    { id: 'f3', kategori: 'Komunikasi', pertanyaan: 'Apa etika komunikasi di Slack Merintis?', jawaban: 'Kami memiliki beberapa kesepakatan:<ul><li>Gunakan thread untuk diskusi panjang agar channel tidak penuh</li><li>Hindari tag @channel atau @everyone kecuali benar-benar darurat</li><li>Response time di jam kerja adalah 2–4 jam, bukan real-time</li><li>Gunakan emoji reaction untuk konfirmasi sederhana</li><li>Kalau diskusi lebih dari 3 pesan bolak-balik, lebih baik langsung video call</li></ul>' },
    { id: 'f4', kategori: 'Komunikasi', pertanyaan: 'Bolehkah saya langsung Slack ke Director atau VP?', jawaban: 'Tentu boleh! Merintis menganut budaya komunikasi yang terbuka (open-door). Tapi ada baiknya kamu mencoba menyelesaikan masalah di level tim dulu. Kalau sudah stuck dan butuh eskalasi, tidak ada salahnya langsung ping ke atas.' },
    { id: 'f5', kategori: 'Adaptasi & Mental', pertanyaan: 'Apa yang harus saya lakukan saat merasa sangat tersesat?', jawaban: 'Langkah pertama: tarik napas. Ini normal dan dialami hampir semua orang.<ul><li><strong>Hubungi buddy kamu</strong> — itulah fungsinya. Ceritakan spesifik apa yang membingungkan</li><li><strong>Tulis di catatan</strong> apa yang tidak kamu mengerti, lalu bahas bersama</li><li><strong>Cek FAQ &amp; Notion company</strong> — sering kali jawabannya sudah ada</li><li><strong>Hubungi HR</strong> Merintis jika masalahnya lebih bersifat personal atau administratif</li></ul>' },
    { id: 'f6', kategori: 'Adaptasi & Mental', pertanyaan: 'Bagaimana kalau saya merasa kurang cocok dengan buddy saya?', jawaban: 'Kejujuran adalah kuncinya. Kamu bisa menyampaikan ke HR Merintis bahwa kamu ingin mencoba pasangan buddy yang berbeda — tidak ada yang akan tersinggung karena kecocokan bersifat dua arah.' },
    { id: 'f7', kategori: 'Tools & Akses', pertanyaan: 'Saya tidak bisa mengakses suatu tool atau sistem. Harus ke mana?', jawaban: 'Urutan yang direkomendasikan:<ul><li>Cek email onboarding dari IT — biasanya sudah ada panduan akses awal</li><li>Tanyakan ke buddy apakah kamu memang seharusnya punya akses tersebut</li><li>Hubungi IT Support via Slack di channel #it-help</li><li>Kalau urgent, langsung ping manajermu</li></ul>' },
    { id: 'f8', kategori: 'Tools & Akses', pertanyaan: 'Apakah ada panduan penggunaan tools yang dipakai Merintis?', jawaban: 'Ada! Semua panduan tools tersedia di Notion di folder "Merintis Starter Kit". Kamu bisa menemukan panduan Slack, Jira, Figma, Google Workspace, dan tools teknis lainnya di sana.' },
    { id: 'f9', kategori: 'Program Buddy', pertanyaan: 'Seberapa sering saya harus bertemu dengan buddy?', jawaban: 'Rekomendasi kami: minimal <strong>satu kali per minggu</strong> di bulan pertama. Tapi ini fleksibel — yang penting adalah konsistensi dan kejujuran dalam sesi tersebut.' },
    { id: 'f10',kategori: 'Program Buddy', pertanyaan: 'Apa saja yang biasanya dibahas saat sesi dengan buddy?', jawaban: 'Agenda bebas, tapi biasanya mencakup:<ul><li>Update progres checklist onboarding</li><li>Tantangan atau kebingungan minggu ini</li><li>Pertanyaan spesifik tentang pekerjaan atau kultur</li><li>Refleksi singkat tentang perasaan kamu di lingkungan baru</li><li>Rencana fokus untuk minggu depan</li></ul>' },
  ]);

  Store.set('schemaVersion', SCHEMA_VERSION);
  console.log('[Merintis] Seed selesai.');
}

/* ─────────────────────────────────────────────
   4. MODEL QUERIES
───────────────────────────────────────────── */
const DB = {
  /* ── Users ── */
  getUsers()          { return Store.get('users', []); },
  getUserById(id)     { return this.getUsers().find(u => u.id === id) || null; },
  getBuddies()        { return this.getUsers().filter(u => u.peran === 'buddy'); },
  getNewcomers()      { return this.getUsers().filter(u => u.peran === 'newcomer'); },

  saveUser(user) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    Store.set('users', users);
  },

  /* ── Pairings ── */
  getPairings()       { return Store.get('pairings', []); },
  getActivePairings() { return this.getPairings().filter(p => p.status === 'aktif'); },

  getPairingForNewcomer(newcomerId) {
    return this.getActivePairings().find(p => p.newcomerId === newcomerId) || null;
  },
  getPairingsForBuddy(buddyId) {
    return this.getActivePairings().filter(p => p.buddyId === buddyId);
  },
  getBuddyQuotaUsed(buddyId) {
    return this.getPairingsForBuddy(buddyId).length;
  },
  isBuddyFull(buddyId) {
    return this.getBuddyQuotaUsed(buddyId) >= BUDDY_QUOTA;
  },

  savePairing(pairing) {
    const all = this.getPairings();
    const idx = all.findIndex(p => p.id === pairing.id);
    if (idx >= 0) all[idx] = pairing; else all.push(pairing);
    Store.set('pairings', all);
  },

  /**
   * Pasangkan newcomer dengan buddy baru.
   * Melepas pairing lama jika ada, lalu membuat yang baru.
   */
  pairNewcomerWithBuddy(newcomerId, buddyId) {
    const pairings = this.getPairings();
    // Lepas pairing lama newcomer (set diputus)
    pairings.forEach(p => {
      if (p.newcomerId === newcomerId && p.status === 'aktif') {
        p.status = 'diputus';
      }
    });
    // Buat pairing baru
    const newPairing = {
      id: 'p_' + Date.now(),
      newcomerId, buddyId,
      tanggalMulai: getISODate(0),
      status: 'aktif',
    };
    pairings.push(newPairing);
    Store.set('pairings', pairings);
    return newPairing;
  },

  /* ── Checklists ── */
  getChecklistFor(newcomerId) {
    const all = Store.get('checklists', {});
    return all[newcomerId] || [];
  },
  saveChecklistFor(newcomerId, list) {
    const all = Store.get('checklists', {});
    all[newcomerId] = list;
    Store.set('checklists', all);
  },
  calcProgress(newcomerId) {
    const list = this.getChecklistFor(newcomerId);
    if (!list.length) return 0;
    return Math.round((list.filter(i => i.done).length / list.length) * 100);
  },

  /* ── Schedules ── */
  getSchedulesFor(newcomerId) {
    const all = Store.get('schedules', {});
    return (all[newcomerId] || []).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  },
  saveScheduleFor(newcomerId, sched) {
    const all = Store.get('schedules', {});
    if (!all[newcomerId]) all[newcomerId] = [];
    const idx = all[newcomerId].findIndex(s => s.id === sched.id);
    if (idx >= 0) all[newcomerId][idx] = sched; else all[newcomerId].push(sched);
    Store.set('schedules', all);
  },
  deleteSchedule(newcomerId, schedId) {
    const all = Store.get('schedules', {});
    if (!all[newcomerId]) return;
    all[newcomerId] = all[newcomerId].filter(s => s.id !== schedId);
    Store.set('schedules', all);
  },

  /* ── Notes ── */
  getNotesFor(newcomerId) {
    const all = Store.get('notes', {});
    return all[newcomerId] || [];
  },
  saveNoteFor(newcomerId, note) {
    const all = Store.get('notes', {});
    if (!all[newcomerId]) all[newcomerId] = [];
    const idx = all[newcomerId].findIndex(n => n.id === note.id);
    if (idx >= 0) all[newcomerId][idx] = note; else all[newcomerId].push(note);
    Store.set('notes', all);
  },
  deleteNote(newcomerId, noteId) {
    const all = Store.get('notes', {});
    if (!all[newcomerId]) return;
    all[newcomerId] = all[newcomerId].filter(n => n.id !== noteId);
    Store.set('notes', all);
  },

  /* ── Meeting Notes ── */
  getMeetingNotesFor(pairingId) {
    const all = Store.get('meetingNotes', {});
    return all[pairingId] || [];
  },
  saveMeetingNote(pairingId, note) {
    const all = Store.get('meetingNotes', {});
    if (!all[pairingId]) all[pairingId] = [];
    const idx = all[pairingId].findIndex(n => n.id === note.id);
    if (idx >= 0) all[pairingId][idx] = note; else all[pairingId].push(note);
    Store.set('meetingNotes', all);
  },
  deleteMeetingNote(pairingId, noteId) {
    const all = Store.get('meetingNotes', {});
    if (!all[pairingId]) return;
    all[pairingId] = all[pairingId].filter(n => n.id !== noteId);
    Store.set('meetingNotes', all);
  },

  /* ── Active User ── */
  getActiveUser() {
    const id = Store.get('activeUserId', 'u7');
    return this.getUserById(id) || this.getUsers()[0];
  },
  setActiveUserId(id) { Store.set('activeUserId', id); },
};

/* ─────────────────────────────────────────────
   5. STATE APLIKASI
───────────────────────────────────────────── */
const AppState = {
  currentPage:        DEFAULT_PAGE,
  isSidebarCollapsed: Store.get('sidebarCollapsed', false),
  isDarkMode:         Store.get('darkMode', false),

  get activeUser() { return DB.getActiveUser(); },
};

/* ─────────────────────────────────────────────
   6. ROUTING (hash-based SPA)
───────────────────────────────────────────── */
function getPageFromHash() {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') return DEFAULT_PAGE;
  const page = hash.replace(/^#\//, '').toLowerCase();
  return PAGES[page] ? page : DEFAULT_PAGE;
}

let _isTransitioning = false;

async function handleRoute() {
  if (_isTransitioning) return;
  const page       = getPageFromHash();
  const user       = AppState.activeUser;
  const requiredRole = ROLE_GATES[page];

  /* Hak akses: redirect ke beranda jika peran tidak sesuai */
  if (requiredRole && user?.peran !== requiredRole) {
    showToast('Akses dibatasi',
      `Halaman ini hanya untuk <strong>${requiredRole === 'buddy' ? 'Buddy' : 'Newcomer'}</strong>.`, 'warning');
    window.location.hash = '#/beranda';
    return;
  }

  AppState.currentPage = page;
  const pageConfig     = PAGES[page];
  const content        = document.getElementById('app-content');
  const topbarTitle    = document.getElementById('topbarTitle');
  if (!content || !pageConfig) return;

  document.title = `${pageConfig.title} — Merintis`;
  if (topbarTitle) topbarTitle.textContent = pageConfig.title;

  /* Update nav links */
  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });

  /* Transisi */
  _isTransitioning = true;
  content.classList.add('page-exit');
  await sleep(140);
  content.innerHTML = '';
  content.classList.remove('page-exit');

  pageConfig.render(content);

  content.classList.add('page-enter');
  await sleep(280);
  content.classList.remove('page-enter');
  _isTransitioning = false;

  content.focus();
  closeMobileSidebar();
  reInitIcons();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function reInitIcons() { if (window.lucide) window.lucide.createIcons(); }

/* ─────────────────────────────────────────────
   7. SIDEBAR, DARK MODE, ROLE
───────────────────────────────────────────── */
function initSidebar() {
  const sidebar    = document.getElementById('sidebar');
  const overlay    = document.getElementById('sidebarOverlay');
  const hamburger  = document.getElementById('hamburgerBtn');
  const closeBtn   = document.getElementById('sidebarCloseBtn');
  const collapseBtn= document.getElementById('sidebarCollapseBtn');
  const roleBtn    = document.getElementById('roleSwitcherBtn');
  const resetBtn   = document.getElementById('resetDemoBtn');
  const wrapper    = document.getElementById('mainWrapper');

  /* Versi skema */
  const vBadge = document.getElementById('schemaVersionBadge');
  if (vBadge) vBadge.textContent = 'v' + SCHEMA_VERSION;

  /* Terapkan collapse (desktop only) */
  if (AppState.isSidebarCollapsed && window.innerWidth > 768) {
    sidebar.classList.add('collapsed');
    wrapper.classList.add('sidebar-collapsed');
    applyCollapseBtn(true);
  }

  hamburger?.addEventListener('click', openMobileSidebar);
  closeBtn?.addEventListener('click', closeMobileSidebar);
  overlay?.addEventListener('click', closeMobileSidebar);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobileSidebar();
  });

  collapseBtn?.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    wrapper.classList.toggle('sidebar-collapsed', isCollapsed);
    AppState.isSidebarCollapsed = isCollapsed;
    Store.set('sidebarCollapsed', isCollapsed);
    applyCollapseBtn(isCollapsed);
    setTimeout(reInitIcons, 360);
  });

  roleBtn?.addEventListener('click', () => {
    const user     = AppState.activeUser;
    const opposite = DB.getUsers().find(u => u.id !== user.id && u.peran !== user.peran);
    if (!opposite) {
      showToast('Tidak ada pengguna lain', 'Hanya ada satu peran yang tersedia saat ini.', 'info');
      return;
    }
    DB.setActiveUserId(opposite.id);
    renderSidebarProfile();
    applyRoleToBody();
    showToast('Peran diganti',
      `Sekarang masuk sebagai <strong>${escH(opposite.nama)}</strong> (${opposite.peran === 'buddy' ? 'Buddy' : 'Newcomer'})`, 'success');
    /* Jika sedang di halaman yang tidak boleh, redirect */
    const rg = ROLE_GATES[AppState.currentPage];
    if (rg && rg !== opposite.peran) {
      window.location.hash = '#/beranda';
    } else {
      handleRoute();
    }
  });

  resetBtn?.addEventListener('click', () => {
    showConfirm('Reset semua data ke data demo awal? Semua perubahan akan hilang.', () => {
      /* Hapus semua key merintis_* */
      Object.keys(localStorage)
        .filter(k => k.startsWith('merintis_'))
        .forEach(k => localStorage.removeItem(k));
      seedData();
      showToast('Data direset', 'Data demo awal berhasil dipulihkan.', 'success');
      handleRoute();
      renderSidebarProfile();
      applyRoleToBody();
    });
  });

  renderSidebarProfile();
  applyRoleToBody();
}

function openMobileSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburgerBtn');
  sidebar?.classList.add('mobile-open');
  sidebar?.removeAttribute('inert');
  sidebar?.setAttribute('aria-hidden', 'false');
  overlay?.classList.add('visible');
  hamburger?.setAttribute('aria-expanded', 'true');
  /* Fokus ke tombol tutup */
  document.getElementById('sidebarCloseBtn')?.focus();
}

function closeMobileSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburgerBtn');
  if (!sidebar?.classList.contains('mobile-open')) return;
  sidebar.classList.remove('mobile-open');
  sidebar.setAttribute('inert', '');          /* sembunyikan dari fokus keyboard */
  sidebar.setAttribute('aria-hidden', 'true');
  overlay?.classList.remove('visible');
  hamburger?.setAttribute('aria-expanded', 'false');
  hamburger?.focus();
}

function applyCollapseBtn(isCollapsed) {
  const btn = document.getElementById('sidebarCollapseBtn');
  if (!btn) return;
  btn.setAttribute('aria-expanded', String(!isCollapsed));
  btn.setAttribute('aria-label', isCollapsed ? 'Buka sidebar' : 'Lipat sidebar');
  const icon = btn.querySelector('[data-lucide]');
  if (icon) icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
}

function applyRoleToBody() {
  const user = AppState.activeUser;
  document.body.classList.remove('role-newcomer', 'role-buddy');
  document.body.classList.add('role-' + (user?.peran || 'newcomer'));
}

function renderSidebarProfile() {
  const user = AppState.activeUser;
  if (!user) return;
  const avatar   = document.getElementById('profileAvatar');
  const nameEl   = document.getElementById('profileName');
  const roleEl   = document.getElementById('profileRole');
  const switchLbl= document.getElementById('roleSwitcherLabel');

  const initials = getInitials(user.nama);
  if (avatar)    avatar.textContent = initials;
  if (nameEl)    nameEl.textContent = user.nama;
  if (roleEl)    roleEl.textContent = user.peran === 'buddy' ? 'Buddy' : 'Newcomer';

  /* Label tombol switch = user lain yang tersedia */
  const other = DB.getUsers().find(u => u.id !== user.id && u.peran !== user.peran);
  if (switchLbl) switchLbl.textContent = other
    ? `Ganti ke: ${other.nama.split(' ')[0]} (${other.peran === 'buddy' ? 'Buddy' : 'Newcomer'})`
    : 'Ganti Peran';
}

/* ── Dark Mode ── */
function initDarkMode() {
  const apply = (isDark) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    ['darkModeBtn', 'darkModeBtnMobile'].forEach(id => {
      const btn  = document.getElementById(id);
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(isDark));
      const icon = btn.querySelector('[data-lucide]');
      if (icon) icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      const lbl  = btn.querySelector('.nav-label');
      if (lbl)  lbl.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
      btn.setAttribute('aria-label', isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
    });
    setTimeout(reInitIcons, 50);
  };

  apply(AppState.isDarkMode);

  const toggle = () => {
    AppState.isDarkMode = !AppState.isDarkMode;
    Store.set('darkMode', AppState.isDarkMode);
    apply(AppState.isDarkMode);
  };
  document.getElementById('darkModeBtn')?.addEventListener('click', toggle);
  document.getElementById('darkModeBtnMobile')?.addEventListener('click', toggle);
}

/* ─────────────────────────────────────────────
   8. TOAST & CONFIRM MODAL
───────────────────────────────────────────── */
function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true"><i data-lucide="${icons[type] || 'info'}"></i></span>
    <div class="toast-body">
      <p class="toast-title">${escH(title)}</p>
      ${message ? `<p class="toast-msg">${message}</p>` : ''}
    </div>
    <button class="toast-close" aria-label="Tutup notifikasi"><i data-lucide="x" aria-hidden="true"></i></button>
  `;
  container.appendChild(el);
  reInitIcons();
  const remove = () => { el.classList.add('removing'); setTimeout(() => el.remove(), 240); };
  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, duration);
}

function showConfirm(msg, onConfirm, confirmLabel = 'Ya, Lanjutkan') {
  const modal    = document.getElementById('confirmModal');
  const msgEl    = document.getElementById('confirmModalMsg');
  const okBtn    = document.getElementById('confirmOkBtn');
  const cancelBtn= document.getElementById('confirmCancelBtn');
  if (!modal) return;
  msgEl.textContent = msg;
  okBtn.textContent = confirmLabel;
  modal.hidden = false;
  okBtn.focus();

  const close   = () => { modal.hidden = true; cleanup(); };
  const confirm = () => { close(); onConfirm(); };
  const cleanup = () => {
    okBtn.removeEventListener('click', confirm);
    cancelBtn.removeEventListener('click', close);
    modal.removeEventListener('click', backdropClose);
  };
  const backdropClose = e => { if (e.target === modal) close(); };

  okBtn.addEventListener('click', confirm);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', backdropClose);
}

/* Modal edit profil (generik) */
function showEditModal(title, bodyHtml, onSubmit) {
  const modal   = document.getElementById('editProfileModal');
  const titleEl = document.getElementById('editProfileModalTitle');
  const bodyEl  = document.getElementById('editProfileModalBody');
  if (!modal) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  modal.hidden = false;
  reInitIcons();
  bodyEl.querySelector('#editModalSubmitBtn')?.addEventListener('click', () => {
    onSubmit(bodyEl, () => { modal.hidden = true; });
  });
  bodyEl.querySelector('#editModalCancelBtn')?.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; }, { once: true });
}

/* ─────────────────────────────────────────────
   9. HELPER & KOMPONEN REUSABLE
───────────────────────────────────────────── */
function getInitials(nama) {
  if (!nama) return '??';
  const parts = nama.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

/* escH: escape HTML untuk output ke innerHTML — handles quotes & special chars */
function escH(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Format tanggal dalam WIB */
function formatDateWIB(dateInput) {
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  /* Offset WIB = UTC+7 */
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return wib.toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

/* Format tanggal pendek untuk display jadwal */
function parseDateDisplay(isoStr) {
  /* isoStr = 'YYYY-MM-DD', parse sebagai lokal agar tidak off-by-one */
  const [y, m, d] = isoStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    day: dt.getDate(),
    mon: dt.toLocaleDateString('id-ID', { month: 'short' }),
    full: dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function genId(prefix = 'id') { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

/* Avatar gradient pool */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#1a6b3c,#2d8a52)',
  'linear-gradient(135deg,#0369a1,#0ea5e9)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#c2410c,#f97316)',
  'linear-gradient(135deg,#0f766e,#2dd4bf)',
  'linear-gradient(135deg,#be185d,#f472b6)',
];
function avatarGradient(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/* Progress Circle SVG */
function progressCircleSVG(pct) {
  const r = 38; const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `
    <div class="progress-circle-wrap">
      <div class="progress-circle">
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle class="progress-circle-track" cx="48" cy="48" r="${r}" stroke-width="7" fill="none"/>
          <circle class="progress-circle-fill" cx="48" cy="48" r="${r}" stroke-width="7" fill="none"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
        </svg>
        <div class="progress-circle-label">
          <span class="progress-circle-pct">${pct}%</span>
          <span class="progress-circle-sublabel">selesai</span>
        </div>
      </div>
    </div>`;
}

function updateProgressUI(newcomerId) {
  const pct       = DB.calcProgress(newcomerId);
  const list      = DB.getChecklistFor(newcomerId);
  const doneCount = list.filter(i => i.done).length;
  const total     = list.length;

  /* Bar */
  const fill = document.querySelector('.progress-bar-fill');
  const pctEl= document.querySelector('.progress-pct');
  if (fill)  fill.style.width  = pct + '%';
  if (fill)  fill.setAttribute('aria-valuenow', pct);
  if (pctEl) pctEl.textContent = pct + '%';

  /* Circle */
  const r = 38; const circ = 2 * Math.PI * r;
  const cfill = document.querySelector('.progress-circle-fill');
  const cpct  = document.querySelector('.progress-circle-pct');
  if (cfill) cfill.style.strokeDashoffset = circ - (pct / 100) * circ;
  if (cpct)  cpct.textContent = pct + '%';

  /* Stat boxes */
  const boxes = document.querySelectorAll('.stat-num');
  if (boxes[0]) boxes[0].textContent = doneCount;
  if (boxes[1]) boxes[1].textContent = total - doneCount;
  if (boxes[2]) boxes[2].textContent = pct + '%';
}

/* ─────────────────────────────────────────────
   SKOR KECOCOKAN BUDDY
   Komponen:
   - Divisi sama              : 40 poin
   - Tiap minat yang beririsan: 15 poin (maks 45)
   - Tiap slot waktu yang sama: 5 poin  (maks 15)
   Total maks: 100
───────────────────────────────────────────── */
function calcMatchScore(newcomer, buddy) {
  let score = 0;
  const reasons = [];

  /* Divisi */
  if (newcomer.divisi === buddy.divisi) {
    score += 40;
    reasons.push({ icon: 'building-2', text: `Divisi sama: <strong>${escH(buddy.divisi)}</strong>` });
  }

  /* Irisan minat */
  const nc_minat = (newcomer.minat || []).map(m => m.toLowerCase().trim());
  const bd_minat = (buddy.minat   || []).map(m => m.toLowerCase().trim());
  const shared   = nc_minat.filter(m => bd_minat.includes(m));
  if (shared.length) {
    const pts = Math.min(shared.length * 15, 45);
    score += pts;
    reasons.push({ icon: 'heart', text: `Minat sama: <strong>${escH(shared.join(', '))}</strong>` });
  }

  /* Irisan ketersediaan */
  const nc_slot = (newcomer.ketersediaan || []).map(s => s.toLowerCase().trim());
  const bd_slot = (buddy.ketersediaan   || []).map(s => s.toLowerCase().trim());
  const sharedSlot = nc_slot.filter(s => bd_slot.includes(s));
  if (sharedSlot.length) {
    const pts = Math.min(sharedSlot.length * 5, 15);
    score += pts;
    reasons.push({ icon: 'calendar-check', text: `Waktu cocok: <strong>${escH(sharedSlot.join(', '))}</strong>` });
  }

  if (!reasons.length) {
    reasons.push({ icon: 'user-check', text: 'Buddy berpengalaman siap membantu kamu memulai' });
  }

  return { score: Math.min(score, 100), reasons };
}

/* Bangun HTML kartu buddy */
function buildBuddyCardHTML(buddy, newcomer, pairing) {
  const { score, reasons } = calcMatchScore(newcomer, buddy);
  const initials = getInitials(buddy.nama);
  const grad     = avatarGradient(buddy.id);
  const quotaUsed= DB.getBuddyQuotaUsed(buddy.id);
  const isFull   = quotaUsed >= BUDDY_QUOTA;
  const isSelected = pairing?.buddyId === buddy.id;
  const tags = (buddy.minat || []).slice(0, 4)
    .map(m => `<span class="badge badge-primary">${escH(m)}</span>`).join('');
  const reasonsHTML = reasons
    .map(r => `<div class="match-reason-item"><i data-lucide="${r.icon}" aria-hidden="true"></i><span>${r.text}</span></div>`)
    .join('');
  return `
    <div class="card buddy-card" data-buddy-id="${buddy.id}">
      <div class="buddy-avatar-row">
        <div class="buddy-avatar" style="background:${grad}" aria-hidden="true">${escH(initials)}</div>
        <div class="buddy-meta">
          <h4>${escH(buddy.nama)}</h4>
          <p>${escH(buddy.jabatan)} · ${escH(buddy.divisi)}</p>
        </div>
        ${isFull
          ? `<span class="badge badge-neutral">Penuh (${quotaUsed}/${BUDDY_QUOTA})</span>`
          : `<span class="badge badge-success">Tersedia (${quotaUsed}/${BUDDY_QUOTA})</span>`}
      </div>
      <p style="font-size:var(--fs-xs);color:var(--clr-text-secondary);line-height:1.65">${escH(buddy.bio)}</p>
      <div class="buddy-tags">${tags}</div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem">
        <span class="match-score">Skor Cocok: ${score}/100</span>
      </div>
      <div class="buddy-match">${reasonsHTML}</div>
      ${isSelected
        ? `<button class="btn btn-sm btn-outline" disabled aria-disabled="true" aria-label="Ini adalah buddy aktifmu"><i data-lucide="check" aria-hidden="true"></i> Buddy Aktifmu</button>`
        : isFull
          ? `<button class="btn btn-sm btn-ghost" disabled aria-disabled="true">Tidak tersedia (kuota penuh)</button>`
          : `<button class="btn btn-sm btn-primary pick-buddy-btn"
              data-buddy-id="${buddy.id}" data-buddy-nama="${escH(buddy.nama)}"
              aria-label="Pilih ${escH(buddy.nama)} sebagai buddy">
              <i data-lucide="user-check" aria-hidden="true"></i> Pilih sebagai Buddy
             </button>`
      }
    </div>`;
}

/* ─────────────────────────────────────────────
   10. HALAMAN: BERANDA
───────────────────────────────────────────── */
function renderBeranda(container) {
  container.innerHTML = `
    <section class="hero-section" aria-labelledby="heroTitle">
      <div class="hero-eyebrow"><i data-lucide="sprout" aria-hidden="true"></i> Program Onboarding Merintis</div>
      <h1 class="hero-title" id="heroTitle">Mulai perjalananmu<br>dengan <span class="highlight">percaya diri</span></h1>
      <p class="hero-desc">Di Merintis, kamu tidak perlu menebak-nebak sendirian. Setiap karyawan baru dipasangkan dengan seorang <strong>buddy</strong> — rekan berpengalaman yang siap jadi teman belajar, navigator kantor, dan sumber semangat di minggu-minggu pertamamu.</p>
      <div class="hero-actions">
        <a href="#/daftar" class="btn btn-primary btn-lg"><i data-lucide="user-plus" aria-hidden="true"></i> Gabung sebagai Newcomer</a>
        <a href="#/daftar" class="btn btn-outline btn-lg" id="heroBuddyBtn"><i data-lucide="heart-handshake" aria-hidden="true"></i> Jadi Buddy</a>
      </div>
      <div class="hero-illustration" aria-hidden="true">
        <svg viewBox="0 0 480 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="480" height="220" rx="16" fill="var(--clr-primary-xlight)"/>
          <path d="M40 200 Q120 170 240 188 Q360 205 440 170" stroke="var(--clr-border)" stroke-width="3" stroke-dasharray="8 4" fill="none"/>
          <circle cx="140" cy="120" r="22" fill="var(--clr-accent-bright)" opacity=".85"/>
          <text x="140" y="126" text-anchor="middle" font-size="14" fill="white" font-family="system-ui">🧑</text>
          <circle cx="224" cy="100" r="22" fill="var(--clr-primary)" opacity=".9"/>
          <text x="224" y="106" text-anchor="middle" font-size="14" fill="white" font-family="system-ui">🤝</text>
          <line x1="162" y1="120" x2="203" y2="106" stroke="var(--clr-primary)" stroke-width="2" stroke-dasharray="4 3" opacity=".6"/>
          <rect x="112" y="147" width="56" height="18" rx="9" fill="var(--clr-accent-bright)" opacity=".18"/>
          <text x="140" y="160" text-anchor="middle" font-size="9" fill="var(--clr-accent)" font-family="system-ui" font-weight="700">Newcomer</text>
          <rect x="196" y="127" width="56" height="18" rx="9" fill="var(--clr-primary)" opacity=".18"/>
          <text x="224" y="140" text-anchor="middle" font-size="9" fill="var(--clr-primary)" font-family="system-ui" font-weight="700">Buddy</text>
          <circle cx="320" cy="88" r="16" fill="var(--clr-primary)" opacity=".75"/>
          <text x="320" y="93" text-anchor="middle" font-size="10" fill="white" font-family="system-ui" font-weight="700">30h</text>
          <text x="390" y="78" font-size="14" opacity=".35">✨</text>
          <text x="56" y="70" font-size="10" opacity=".25">🌱</text>
        </svg>
      </div>
    </section>
    <hr class="divider">
    <section aria-labelledby="benefitsTitle">
      <h2 id="benefitsTitle" class="section-title">Kenapa Buddy System Merintis?</h2>
      <p class="section-subtitle">Tiga alasan sederhana yang membuat perbedaan besar</p>
      <div class="benefits-grid">
        <div class="benefit-card">
          <div class="benefit-icon green"><i data-lucide="compass" aria-hidden="true"></i></div>
          <h4>Panduan yang Personal</h4>
          <p>Kamu punya satu orang yang paham konteks kerja kamu dan siap menjawab pertanyaan yang terasa terlalu "kecil" untuk ditanyakan ke atasan.</p>
        </div>
        <div class="benefit-card">
          <div class="benefit-icon orange"><i data-lucide="zap" aria-hidden="true"></i></div>
          <h4>Adaptasi Lebih Cepat</h4>
          <p>Karyawan dengan buddy beradaptasi lebih cepat. Kamu fokus berkontribusi, bukan bingung mencari tahu cara kerjanya.</p>
        </div>
        <div class="benefit-card">
          <div class="benefit-icon blue"><i data-lucide="shield-check" aria-hidden="true"></i></div>
          <h4>Percaya Diri Sejak Hari Pertama</h4>
          <p>Tidak ada lagi rasa segan bertanya atau takut salah langkah. Buddy-mu hadir tepat di sana untuk memastikan kamu aman dan nyaman.</p>
        </div>
        <div class="benefit-card">
          <div class="benefit-icon yellow"><i data-lucide="trending-up" aria-hidden="true"></i></div>
          <h4>Progres Terukur &amp; Terpantau</h4>
          <p>Dashboard 30-hari dengan checklist dan visualisasi progres agar kamu selalu tahu sudah sejauh mana dan apa yang harus dilakukan selanjutnya.</p>
        </div>
      </div>
    </section>
    <section class="steps-section" aria-labelledby="stepsTitle" style="padding:2rem 0">
      <h2 id="stepsTitle" class="section-title">Alur Program Buddy</h2>
      <p class="section-subtitle">Sederhana, jelas, dan tidak bikin pusing</p>
      <div class="steps-timeline">
        <div class="step-item"><div class="step-num" aria-hidden="true">1</div><div class="step-content"><h4>Daftar sebagai Newcomer atau Buddy</h4><p>Isi formulir singkat tentang dirimu: divisi, minat, dan ketersediaan waktu.</p></div></div>
        <div class="step-item"><div class="step-num" aria-hidden="true">2</div><div class="step-content"><h4>Temukan Kecocokan Terbaik</h4><p>Sistem mencocokkan berdasarkan divisi, irisan minat, dan ketersediaan waktu dengan skor kecocokan yang transparan.</p></div></div>
        <div class="step-item"><div class="step-num" aria-hidden="true">3</div><div class="step-content"><h4>Sesi Perkenalan Pertama</h4><p>Jadwalkan sesi 1:1 pertama dalam seminggu pertama. Tidak perlu agenda formal!</p></div></div>
        <div class="step-item"><div class="step-num" aria-hidden="true">4</div><div class="step-content"><h4>Jalankan Checklist 30 Hari</h4><p>Selesaikan milestone mingguan bersama buddy-mu dan pantau progres lewat dashboard.</p></div></div>
        <div class="step-item"><div class="step-num" aria-hidden="true">5</div><div class="step-content"><h4>Evaluasi &amp; Lanjutkan</h4><p>Di akhir 30 hari, bagikan pengalamanmu. Hubungan buddy tidak harus berhenti di sini!</p></div></div>
      </div>
    </section>
    <section aria-labelledby="testimonialTitle" style="margin-top:1rem">
      <h2 id="testimonialTitle" class="section-title">Kata Mereka tentang Merintis</h2>
      <p class="section-subtitle"><span class="demo-label">Data Contoh</span> Pengalaman ilustratif dari program buddy</p>
      <div class="testimonials-grid">
        <div class="testimonial-card">
          <p class="testimonial-text">"Minggu pertama saya di Merintis terasa sangat tenang. Setiap kali bingung, saya langsung tahu harus tanya ke siapa."</p>
          <div class="testimonial-author"><div class="testimonial-avatar" style="background:linear-gradient(135deg,#c2410c,#f97316)" aria-hidden="true">DW</div><div><p class="testimonial-name">Dewi Wulandari</p><p class="testimonial-role">Frontend Engineer · Bergabung Jan 2025</p></div></div>
        </div>
        <div class="testimonial-card">
          <p class="testimonial-text">"Sebagai buddy, saya belajar banyak dari melihat perspektif segar orang baru. Ini bukan hubungan satu arah."</p>
          <div class="testimonial-author"><div class="testimonial-avatar" style="background:linear-gradient(135deg,#1a6b3c,#2d8a52)" aria-hidden="true">AF</div><div><p class="testimonial-name">Adi Firmansyah</p><p class="testimonial-role">Senior Engineer · Buddy sejak 2023</p></div></div>
        </div>
        <div class="testimonial-card">
          <p class="testimonial-text">"Checklist 30 hari itu game changer. Saya jadi punya target jelas setiap minggu dan tidak merasa overwhelmed."</p>
          <div class="testimonial-author"><div class="testimonial-avatar" style="background:linear-gradient(135deg,#7c3aed,#a78bfa)" aria-hidden="true">RK</div><div><p class="testimonial-name">Ryan Kusuma</p><p class="testimonial-role">Data Analyst · Bergabung Mar 2025</p></div></div>
        </div>
      </div>
    </section>
    <section class="cta-section" aria-label="Ajakan bergabung">
      <h2>Siap memulai perjalananmu?</h2>
      <p>Bergabunglah dalam program buddy Merintis. Hari ini adalah langkah pertamamu.</p>
      <div class="cta-actions">
        <a href="#/daftar" class="btn btn-white btn-lg"><i data-lucide="user-plus" aria-hidden="true"></i> Daftar Sekarang</a>
        <a href="#/faq" class="btn btn-lg" style="background:rgba(255,255,255,.15);color:white;border:2px solid rgba(255,255,255,.3)"><i data-lucide="help-circle" aria-hidden="true"></i> Punya Pertanyaan?</a>
      </div>
    </section>
    ${renderFooterHTML()}
  `;
  container.querySelector('#heroBuddyBtn')?.addEventListener('click', () => { Store.set('regRolePreset', 'buddy'); });
}

/* ─────────────────────────────────────────────
   11. HALAMAN: PENDAFTARAN
───────────────────────────────────────────── */
function renderDaftar(container) {
  const preset  = Store.get('regRolePreset', 'newcomer');
  Store.remove('regRolePreset');
  const divisis = ['Engineering','Product','Design','Marketing','Data','Operations','Finance','HR','Sales'];
  const optStr  = divisis.map(d => `<option value="${d}">${d}</option>`).join('');

  container.innerHTML = `
    <div class="page-header">
      <h1>Pendaftaran</h1>
      <p>Lengkapi formulir untuk bergabung dalam program buddy Merintis.</p>
    </div>
    <div class="registration-layout">
      <div class="form-card">
        <div style="margin-bottom:1.5rem">
          <h2 style="font-size:var(--fs-2xl)">Informasi Dirimu</h2>
          <p style="font-size:var(--fs-sm);margin-top:.25rem">Kolom bertanda <span style="color:var(--clr-danger)">*</span> wajib diisi.</p>
        </div>
        <form id="regForm" novalidate aria-label="Formulir pendaftaran Merintis">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="regNama">Nama Lengkap <span class="req" aria-hidden="true">*</span></label>
              <input type="text" id="regNama" class="form-input" placeholder="contoh: Budi Santoso" required autocomplete="name" />
              <span class="form-error" id="errNama" role="alert" aria-live="assertive"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="regEmail">Email Kerja <span class="req" aria-hidden="true">*</span></label>
              <input type="email" id="regEmail" class="form-input" placeholder="nama@merintis.id" required autocomplete="email" />
              <span class="form-error" id="errEmail" role="alert" aria-live="assertive"></span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="regDivisi">Divisi <span class="req" aria-hidden="true">*</span></label>
              <select id="regDivisi" class="form-select form-input" required>
                <option value="">— Pilih divisi —</option>${optStr}
              </select>
              <span class="form-error" id="errDivisi" role="alert" aria-live="assertive"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="regJabatan">Jabatan</label>
              <input type="text" id="regJabatan" class="form-input" placeholder="contoh: Junior Product Manager" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="regPeran">Bergabung sebagai <span class="req" aria-hidden="true">*</span></label>
            <select id="regPeran" class="form-select form-input" required>
              <option value="newcomer" ${preset==='newcomer'?'selected':''}>Newcomer — Karyawan baru yang butuh panduan</option>
              <option value="buddy"    ${preset==='buddy'?'selected':''}>Buddy — Karyawan berpengalaman siap membimbing</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="regMinatInput">Minat &amp; Keahlian</label>
            <div class="tag-input-container" id="tagContainer" role="group" aria-label="Tag minat">
              <input type="text" id="regMinatInput" placeholder="Ketik lalu tekan Enter atau koma…" aria-label="Tambah minat" />
            </div>
            <span class="form-hint">Contoh: Frontend, Mentoring, Data Analysis</span>
            <input type="hidden" id="regMinat" />
          </div>
          <div class="form-group">
            <fieldset>
              <legend class="form-label">Ketersediaan Waktu <span class="req" aria-hidden="true">*</span></legend>
              <div class="checkbox-group" style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">
                ${['Senin pagi','Senin sore','Selasa pagi','Selasa sore','Rabu pagi','Rabu sore','Kamis pagi','Kamis sore','Jumat pagi','Jumat sore']
                  .map(s => `<label class="checkbox-item"><input type="checkbox" name="ketersediaan" value="${s}"> ${s}</label>`).join('')}
              </div>
              <span class="form-error" id="errKetersediaan" role="alert" aria-live="assertive"></span>
            </fieldset>
          </div>
          <div class="form-group">
            <label class="form-label" for="regBio">Perkenalan Singkat</label>
            <textarea id="regBio" class="form-textarea" rows="3" placeholder="Ceritakan sedikit tentang dirimu…" maxlength="280"></textarea>
            <span class="form-hint" id="bioCount">0 / 280 karakter</span>
          </div>
          <div class="form-actions">
            <button type="reset" class="btn btn-ghost">Reset</button>
            <button type="submit" class="btn btn-primary" id="regSubmitBtn"><i data-lucide="check-circle" aria-hidden="true"></i> Daftar Sekarang</button>
          </div>
        </form>
        <div id="regSuccess" hidden aria-live="polite" style="margin-top:1.5rem"></div>
      </div>
      <aside class="reg-info-card" aria-label="Informasi program buddy">
        <h3><i data-lucide="info" aria-hidden="true" style="width:17px;height:17px;vertical-align:-3px"></i> Tentang Program Ini</h3>
        <div class="reg-info-list">
          <div class="reg-info-item"><div class="reg-info-icon"><i data-lucide="clock" aria-hidden="true"></i></div><div class="reg-info-text"><strong>Durasi 30 Hari</strong><span>Program terstruktur dengan checklist per minggu</span></div></div>
          <div class="reg-info-item"><div class="reg-info-icon"><i data-lucide="user-check" aria-hidden="true"></i></div><div class="reg-info-text"><strong>1 Buddy, Maks 2 Newcomer</strong><span>Setiap buddy menangani maksimal 2 newcomer aktif</span></div></div>
          <div class="reg-info-item"><div class="reg-info-icon"><i data-lucide="calendar" aria-hidden="true"></i></div><div class="reg-info-text"><strong>Fleksibel</strong><span>Jadwal sesi disesuaikan ketersediaan kalian berdua</span></div></div>
          <div class="reg-info-item"><div class="reg-info-icon"><i data-lucide="lock" aria-hidden="true"></i></div><div class="reg-info-text"><strong>Privat &amp; Aman</strong><span>Catatan dan diskusi bersifat konfidensial</span></div></div>
          <div class="reg-info-item"><div class="reg-info-icon"><i data-lucide="award" aria-hidden="true"></i></div><div class="reg-info-text"><strong>Diakui Perusahaan</strong><span>Menjadi buddy bagian dari program pengembangan karier</span></div></div>
        </div>
      </aside>
    </div>
    ${renderFooterHTML()}
  `;
  initRegForm(container);
}

function initRegForm(container) {
  /* Tag input */
  let tags = [];
  const tagContainer = container.querySelector('#tagContainer');
  const tagInput     = container.querySelector('#regMinatInput');
  const hiddenMinat  = container.querySelector('#regMinat');

  const renderTags = () => {
    tagContainer.querySelectorAll('.tag-chip').forEach(t => t.remove());
    tags.forEach((tag, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${escH(tag)}<button type="button" aria-label="Hapus minat ${escH(tag)}">×</button>`;
      chip.querySelector('button').onclick = () => { tags.splice(idx, 1); renderTags(); };
      tagContainer.insertBefore(chip, tagInput);
    });
    hiddenMinat.value = tags.join(',');
  };

  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.trim().replace(/,$/, '');
      if (val && !tags.includes(val) && tags.length < 10) { tags.push(val); renderTags(); tagInput.value = ''; }
    }
    if (e.key === 'Backspace' && !tagInput.value && tags.length) { tags.pop(); renderTags(); }
  });
  tagContainer.addEventListener('click', () => tagInput.focus());

  /* Bio counter */
  container.querySelector('#regBio').addEventListener('input', function() {
    container.querySelector('#bioCount').textContent = `${this.value.length} / 280 karakter`;
  });

  /* Validasi field */
  const validate = (fieldEl, errId, rules) => {
    const errEl = document.getElementById(errId);
    for (const { test, msg } of rules) {
      if (!test(fieldEl.value.trim())) {
        fieldEl.classList.add('error'); fieldEl.classList.remove('valid');
        if (errEl) errEl.textContent = msg; return false;
      }
    }
    fieldEl.classList.remove('error'); fieldEl.classList.add('valid');
    if (errEl) errEl.textContent = ''; return true;
  };

  const namaEl   = container.querySelector('#regNama');
  const emailEl  = container.querySelector('#regEmail');
  const divisiEl = container.querySelector('#regDivisi');
  namaEl.addEventListener('input',   () => validate(namaEl,  'errNama',  [{ test: v => v.length >= 2, msg: 'Nama minimal 2 karakter.' }]));
  emailEl.addEventListener('input',  () => validate(emailEl, 'errEmail', [{ test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Format email tidak valid.' }]));
  divisiEl.addEventListener('change',() => validate(divisiEl,'errDivisi',[{ test: v => v !== '', msg: 'Pilih divisimu.' }]));

  /* Submit */
  container.querySelector('#regForm').addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    ok = validate(namaEl,   'errNama',   [{ test: v => v.length >= 2, msg: 'Nama minimal 2 karakter.' }]) && ok;
    ok = validate(emailEl,  'errEmail',  [{ test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Format email tidak valid.' }]) && ok;
    ok = validate(divisiEl, 'errDivisi', [{ test: v => v !== '', msg: 'Pilih divisimu.' }]) && ok;
    const checked = [...container.querySelectorAll('[name="ketersediaan"]:checked')];
    const errK = document.getElementById('errKetersediaan');
    if (!checked.length) { if (errK) errK.textContent = 'Pilih minimal satu slot waktu.'; ok = false; }
    else { if (errK) errK.textContent = ''; }
    if (!ok) { container.querySelector('.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

    const btn = container.querySelector('#regSubmitBtn');
    btn.classList.add('loading'); btn.disabled = true;

    setTimeout(() => {
      btn.classList.remove('loading'); btn.disabled = false;

      const nama        = namaEl.value.trim();
      const email       = emailEl.value.trim();
      const peran       = container.querySelector('#regPeran').value;
      const divisi      = divisiEl.value;
      const jabatan     = container.querySelector('#regJabatan').value.trim();
      const ketersediaan= checked.map(cb => cb.value);
      const bio         = container.querySelector('#regBio').value.trim();

      /* Cek email duplikat */
      const existing = DB.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        /* Update user yang ada */
        existing.nama = nama; existing.divisi = divisi; existing.jabatan = jabatan;
        existing.minat = tags; existing.ketersediaan = ketersediaan; existing.bio = bio;
        existing.peran = peran;
        DB.saveUser(existing);
        DB.setActiveUserId(existing.id);
        renderSidebarProfile(); applyRoleToBody();
        showToast('Profil diperbarui!', `Data <strong>${escH(nama)}</strong> berhasil diperbarui.`, 'success');
      } else {
        /* Tambah user baru */
        const newUser = {
          id: genId('u'), nama, email, divisi, jabatan, minat: tags,
          ketersediaan, peran, bio, createdAt: getISODate(0),
        };
        DB.saveUser(newUser);
        /* Jika newcomer, beri checklist default */
        if (peran === 'newcomer') {
          const defList = Store.get('checklists', {});
          const tmpl = DB.getChecklistFor('u7'); // template dari u7
          defList[newUser.id] = tmpl.map(i => ({ ...i, done: false, id: genId('ci') }));
          Store.set('checklists', defList);
          const defNotes = Store.get('notes', {}); defNotes[newUser.id] = []; Store.set('notes', defNotes);
          const defScheds = Store.get('schedules', {}); defScheds[newUser.id] = []; Store.set('schedules', defScheds);
        }
        DB.setActiveUserId(newUser.id);
        renderSidebarProfile(); applyRoleToBody();
        showToast('Pendaftaran berhasil! 🎉', `Selamat datang, <strong>${escH(nama)}</strong>!`, 'success', 5000);
        if (peran === 'buddy') {
          showToast('Profil buddy dibuat', 'Kartu profilmu kini tersedia di halaman Cari Buddy.', 'info', 4000);
        }
      }

      /* Tampilkan kartu sukses */
      const successEl = document.getElementById('regSuccess');
      successEl.hidden = false;
      successEl.innerHTML = `
        <div class="card" style="border-color:var(--clr-success);background:var(--clr-success-light)">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
            <i data-lucide="party-popper" style="color:var(--clr-success);width:22px;height:22px" aria-hidden="true"></i>
            <h3 style="font-size:var(--fs-xl);color:var(--clr-success)">Yeay, berhasil!</h3>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.65rem">
            <div><p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">Nama</p><p style="font-size:var(--fs-sm);font-weight:600">${escH(nama)}</p></div>
            <div><p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">Peran</p><p style="font-size:var(--fs-sm);font-weight:600">${peran === 'buddy' ? 'Buddy' : 'Newcomer'}</p></div>
            <div><p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">Divisi</p><p style="font-size:var(--fs-sm);font-weight:600">${escH(divisi)}</p></div>
          </div>
          <div style="margin-top:1rem;display:flex;gap:.65rem;flex-wrap:wrap">
            ${peran === 'newcomer' ? `<a href="#/cari-buddy" class="btn btn-primary btn-sm">Cari Buddy Sekarang</a>` : ''}
            <a href="${peran === 'newcomer' ? '#/dashboard-newcomer' : '#/dashboard-buddy'}" class="btn btn-outline btn-sm">Buka Dashboard</a>
          </div>
        </div>`;
      reInitIcons();
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 800);
  });

  /* Reset */
  container.querySelector('#regForm').addEventListener('reset', () => {
    tags = []; renderTags();
    container.querySelectorAll('.error,.valid').forEach(el => el.classList.remove('error','valid'));
    container.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    container.querySelector('#bioCount').textContent = '0 / 280 karakter';
  });
}

/* ─────────────────────────────────────────────
   12. HALAMAN: CARI BUDDY
───────────────────────────────────────────── */
function renderCariBuddy(container) {
  const user   = AppState.activeUser;
  const pairing= DB.getPairingForNewcomer(user?.id);

  container.innerHTML = `
    <div class="page-header">
      <h1>Cari Buddy</h1>
      <p>Temukan rekan berpengalaman yang paling cocok. Skor kecocokan dihitung dari irisan minat, divisi, dan ketersediaan waktu.</p>
    </div>
    <div class="search-filter-bar" role="search" aria-label="Cari dan filter buddy">
      <div class="search-input-wrap">
        <i data-lucide="search" aria-hidden="true"></i>
        <input type="search" id="buddySearch" class="form-input" placeholder="Cari nama, divisi, atau minat…" aria-label="Cari buddy" autocomplete="off" />
      </div>
      <select id="filterDivisi" class="form-select form-input" style="min-width:140px" aria-label="Filter divisi">
        <option value="">Semua Divisi</option>
        ${['Engineering','Product','Design','Marketing','Data','Operations'].map(d => `<option>${d}</option>`).join('')}
      </select>
      <select id="filterStatus" class="form-select form-input" style="min-width:140px" aria-label="Filter ketersediaan">
        <option value="">Semua Status</option>
        <option value="available">Tersedia</option>
        <option value="penuh">Penuh</option>
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <p style="font-size:var(--fs-sm);color:var(--clr-text-muted)">Menampilkan <strong id="buddyCount" style="color:var(--clr-text)">0</strong> buddy, diurutkan dari skor cocok tertinggi</p>
      ${pairing ? `<span class="badge badge-primary"><i data-lucide="check-circle" style="width:11px;height:11px" aria-hidden="true"></i> Buddy aktif dipilih</span>` : ''}
    </div>
    <div class="buddy-grid" id="buddyGrid" role="list" aria-label="Daftar buddy" aria-live="polite"></div>
    ${renderFooterHTML()}
  `;

  const renderGrid = () => {
    const q       = container.querySelector('#buddySearch').value.toLowerCase();
    const divFilt = container.querySelector('#filterDivisi').value;
    const stFilt  = container.querySelector('#filterStatus').value;
    const buddies = DB.getBuddies();
    const me      = AppState.activeUser;

    /* Filter */
    let filtered = buddies.filter(b => {
      const matchQ = !q
        || b.nama.toLowerCase().includes(q)
        || b.divisi.toLowerCase().includes(q)
        || b.jabatan.toLowerCase().includes(q)
        || (b.minat || []).some(m => m.toLowerCase().includes(q));
      const matchDiv = !divFilt || b.divisi === divFilt;
      const isFull   = DB.isBuddyFull(b.id);
      const matchSt  = !stFilt
        || (stFilt === 'available' && !isFull)
        || (stFilt === 'penuh'     && isFull);
      return matchQ && matchDiv && matchSt;
    });

    /* Urutkan berdasarkan skor kecocokan (tertinggi dulu) */
    filtered = filtered
      .map(b => ({ buddy: b, ...calcMatchScore(me, b) }))
      .sort((a, b_) => b_.score - a.score)
      .map(x => x.buddy);

    const countEl = document.getElementById('buddyCount');
    if (countEl) countEl.textContent = filtered.length;

    const grid = document.getElementById('buddyGrid');
    if (!grid) return;

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state"><i data-lucide="user-x" aria-hidden="true" style="display:block;width:44px;height:44px;margin:0 auto 1rem;opacity:.3"></i><p><strong>Tidak ada buddy yang cocok dengan filter ini.</strong></p><p>Coba ubah kata kunci atau hapus filter.</p></div>`;
      reInitIcons(); return;
    }

    const activePairing = DB.getPairingForNewcomer(me?.id);
    grid.innerHTML = filtered.map(b => `<div role="listitem">${buildBuddyCardHTML(b, me, activePairing)}</div>`).join('');
    reInitIcons();

    grid.querySelectorAll('.pick-buddy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const buddyId   = btn.dataset.buddyId;
        const buddyNama = btn.dataset.buddyNama;
        const buddy     = DB.getUserById(buddyId);
        if (!buddy) return;
        if (DB.isBuddyFull(buddyId)) {
          showToast('Kuota penuh', `${escH(buddyNama)} sudah membimbing ${BUDDY_QUOTA} newcomer.`, 'warning'); return;
        }
        const me2 = AppState.activeUser;
        if (me2?.peran !== 'newcomer') {
          showToast('Hanya untuk newcomer', 'Kamu perlu masuk sebagai newcomer untuk memilih buddy.', 'warning'); return;
        }
        /* Pair */
        DB.pairNewcomerWithBuddy(me2.id, buddyId);
        showToast('Buddy dipilih! 🎉',
          `<strong>${escH(buddyNama)}</strong> sekarang menjadi buddy-mu. Segera jadwalkan sesi pertama!`, 'success', 5000);
        renderGrid(); // refresh kartu tanpa reload
      });
    });
  };

  container.querySelector('#buddySearch').addEventListener('input', renderGrid);
  container.querySelector('#filterDivisi').addEventListener('change', renderGrid);
  container.querySelector('#filterStatus').addEventListener('change', renderGrid);
  renderGrid();
}

/* ─────────────────────────────────────────────
   13. HALAMAN: DASHBOARD NEWCOMER
───────────────────────────────────────────── */
function renderDashboardNewcomer(container) {
  const user      = AppState.activeUser;
  const ncId      = user?.id;
  const pairing   = DB.getPairingForNewcomer(ncId);
  const buddy     = pairing ? DB.getUserById(pairing.buddyId) : null;
  const checklist = DB.getChecklistFor(ncId);
  const schedules = DB.getSchedulesFor(ncId);
  const notes     = DB.getNotesFor(ncId);
  const pct       = DB.calcProgress(ncId);
  const doneCount = checklist.filter(i => i.done).length;

  /* Hitung hari onboarding & hari tersisa */
  let hariOnboarding = 0, hariTersisa = 30, mingguSaatIni = 1;
  if (pairing?.tanggalMulai) {
    const [y, m, d] = pairing.tanggalMulai.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    hariOnboarding = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000)) + 1;
    hariTersisa    = Math.max(0, 30 - hariOnboarding);
    mingguSaatIni  = Math.min(4, Math.max(1, Math.ceil(hariOnboarding / 7)));
  }

  /* Jadwal hari ini */
  const today = getISODate(0);
  const todaySchedules = schedules.filter(s => s.tanggal === today);
  const todayBannerHTML = todaySchedules.length
    ? `<div class="today-banner" role="status" aria-label="Jadwal hari ini">
        <i data-lucide="calendar-check" aria-hidden="true"></i>
        <div>
          <strong>Hari ini ada ${todaySchedules.length} jadwal:</strong>
          ${todaySchedules.map(s => `<span>${escH(s.judul)} pukul ${escH(s.waktu)} WIB di ${escH(s.tempat)}</span>`).join('<span class="sep">·</span>')}
        </div>
       </div>` : '';

  const weeks    = [1,2,3,4];
  const wkLabels = ['Minggu 1: Kenalan & Akses Tools','Minggu 2: Pahami Alur Kerja','Minggu 3: Mulai Berkontribusi','Minggu 4: Selesaikan & Refleksi'];

  const checklistHTML = weeks.map((w, wi) => {
    const items = checklist.filter(i => i.minggu === w);
    const done  = items.filter(i => i.done).length;
    /* Tandai minggu aktif */
    const isActive = w === mingguSaatIni;
    return `<div class="checklist-week${isActive ? ' checklist-week-active' : ''}" data-week="${w}">
      <div class="checklist-week-title">
        ${escH(wkLabels[wi])}
        ${isActive ? '<span class="badge badge-primary week-now-badge">Minggu ini</span>' : ''}
        <span class="badge badge-${done===items.length && items.length?'success':'neutral'} week-badge">${done}/${items.length}</span>
      </div>
      ${items.map(item => checklistItemHTML(item)).join('')}
    </div>`;
  }).join('');

  const schedHTML = schedules.length
    ? schedules.map(s => scheduleItemHTML(s, today)).join('')
    : '<p style="font-size:var(--fs-sm);color:var(--clr-text-muted);text-align:center;padding:.875rem 0">Belum ada jadwal. Tambahkan di bawah!</p>';

  const notesHTML = notes.length
    ? [...notes].reverse().map(n => noteItemHTML(n)).join('')
    : '<p style="font-size:var(--fs-sm);color:var(--clr-text-muted);text-align:center;padding:.875rem 0">Belum ada catatan.</p>';

  container.innerHTML = `
    ${todayBannerHTML}
    <div class="page-header">
      <h1>Dashboard Newcomer</h1>
      <p>Halo, <strong>${escH(user?.nama || 'Kamu')}</strong>! Ini adalah panduan perjalananmu 30 hari pertama di Merintis. 🌱</p>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-main">
        <!-- Progres + Countdown -->
        <div class="card">
          <div class="card-header">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
              <h3>Progres Onboarding 30 Hari</h3>
              <div class="day-countdown" aria-label="Hari ke-${hariOnboarding} dari 30">
                <span class="day-num">${hariOnboarding > 30 ? '30+' : 'Hari ' + hariOnboarding}</span>
                <span class="day-sub">${hariTersisa > 0 ? hariTersisa + ' hari lagi' : 'Program selesai 🎉'}</span>
              </div>
            </div>
          </div>
          <div class="progress-summary-card">
            ${progressCircleSVG(pct)}
            <div style="flex:1">
              <div class="progress-stats">
                <div class="stat-box"><div class="stat-num">${doneCount}</div><div class="stat-label">Selesai</div></div>
                <div class="stat-box"><div class="stat-num">${checklist.length - doneCount}</div><div class="stat-label">Tersisa</div></div>
                <div class="stat-box"><div class="stat-num">${pct}%</div><div class="stat-label">Progress</div></div>
              </div>
              <div class="progress-wrap" style="margin-top:1rem"
                role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
                aria-label="Progres onboarding ${pct}%">
                <div class="progress-bar-track">
                  <div class="progress-bar-fill" style="width:${pct}%"></div>
                </div>
                <span class="progress-pct">${pct}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Checklist -->
        <div class="card">
          <div class="card-header">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
              <h3>Checklist Onboarding</h3>
              <button class="btn btn-sm btn-outline" id="addCustomChecklistBtn">
                <i data-lucide="plus" aria-hidden="true"></i> Tambah Task
              </button>
            </div>
            <p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">Klik item untuk menandai selesai. Progres tersimpan otomatis.</p>
          </div>
          <div id="checklistContainer" aria-label="Daftar tugas onboarding">
            ${checklistHTML}
          </div>
        </div>
      </div>

      <div class="dashboard-side">
        <!-- Buddy aktif -->
        <div class="card card-sm">
          <h3 style="font-size:var(--fs-base);margin-bottom:.75rem">Buddy Aktifmu</h3>
          ${buddy
            ? `<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
                 <div class="buddy-avatar" style="width:42px;height:42px;font-size:var(--fs-sm);background:${avatarGradient(buddy.id)}" aria-hidden="true">${escH(getInitials(buddy.nama))}</div>
                 <div><p style="font-size:var(--fs-sm);font-weight:600">${escH(buddy.nama)}</p><p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">${escH(buddy.jabatan)} · ${escH(buddy.divisi)}</p></div>
               </div>
               <div style="margin-top:.625rem;display:flex;flex-wrap:wrap;gap:.3rem">${(buddy.ketersediaan||[]).map(k=>`<span class="badge badge-primary">${escH(k)}</span>`).join('')}</div>
               <a href="#/cari-buddy" class="btn btn-ghost btn-sm" style="margin-top:.625rem;width:100%">Ganti Buddy</a>`
            : `<p style="font-size:var(--fs-xs);color:var(--clr-text-muted);margin-bottom:.75rem">Belum ada buddy yang dipilih.</p><a href="#/cari-buddy" class="btn btn-primary btn-sm">Cari Buddy Sekarang</a>`
          }
        </div>

        <!-- Jadwal -->
        <div class="card">
          <div class="card-header">
            <h3 style="font-size:var(--fs-base)">Jadwal Pertemuan</h3>
          </div>
          <div id="scheduleList" class="schedule-list" aria-label="Jadwal pertemuan" aria-live="polite">
            ${schedHTML}
          </div>
          <details style="margin-top:.875rem">
            <summary class="btn btn-outline btn-sm" style="list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:.375rem" aria-label="Tambah jadwal baru">
              <i data-lucide="plus" aria-hidden="true"></i> Tambah Jadwal
            </summary>
            <form id="addSchedForm" style="margin-top:.75rem;display:flex;flex-direction:column;gap:.625rem" novalidate aria-label="Form tambah jadwal">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" for="schedJudul">Judul Pertemuan</label>
                <input type="text" id="schedJudul" class="form-input" placeholder="mis. Sesi Check-in Minggu 2" />
                <span class="form-error" id="errSchedJudul" role="alert"></span>
              </div>
              <div class="form-row">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label" for="schedTanggal">Tanggal</label>
                  <input type="date" id="schedTanggal" class="form-input" />
                  <span class="form-error" id="errSchedTanggal" role="alert"></span>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label" for="schedWaktu">Waktu (WIB)</label>
                  <input type="time" id="schedWaktu" class="form-input" value="10:00" />
                </div>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label" for="schedTempat">Lokasi / Platform</label>
                <input type="text" id="schedTempat" class="form-input" placeholder="mis. Google Meet" />
              </div>
              <button type="submit" class="btn btn-primary btn-sm w-full">
                <i data-lucide="calendar-plus" aria-hidden="true"></i> Simpan Jadwal
              </button>
            </form>
          </details>
        </div>

        <!-- Catatan -->
        <div class="card">
          <div class="card-header"><h3 style="font-size:var(--fs-base)">Catatan Pribadi</h3></div>
          <div id="notesList" class="notes-list" aria-label="Catatan pribadi" aria-live="polite">${notesHTML}</div>
          <form id="addNoteForm" style="margin-top:.75rem;display:flex;flex-direction:column;gap:.5rem" novalidate>
            <textarea id="noteTeks" class="form-textarea" rows="2" placeholder="Tulis catatan, refleksi, atau reminder…" style="resize:none"></textarea>
            <span class="form-error" id="errNote" role="alert"></span>
            <button type="submit" class="btn btn-primary btn-sm w-full"><i data-lucide="plus" aria-hidden="true"></i> Tambah Catatan</button>
          </form>
        </div>
      </div>
    </div>
    ${renderFooterHTML()}
  `;

  initDashboardNC(container, ncId);
}

function checklistItemHTML(item) {
  return `
    <div class="checklist-item ${item.done ? 'done' : ''}"
      role="checkbox" aria-checked="${item.done}" tabindex="0"
      data-id="${item.id}" aria-label="${escH(item.label)}${item.done ? ' — selesai' : ''}">
      <div class="checklist-checkbox" aria-hidden="true">
        ${item.done ? '<i data-lucide="check" aria-hidden="true"></i>' : ''}
      </div>
      <div class="checklist-text">
        <strong>${escH(item.label)}</strong>
        <span>${escH(item.desc)}</span>
      </div>
      ${item.custom ? `<button class="checklist-item-delete" data-id="${item.id}" aria-label="Hapus task ${escH(item.label)}" title="Hapus task ini"><i data-lucide="trash-2" aria-hidden="true"></i></button>` : ''}
    </div>`;
}

function scheduleItemHTML(s, today = '') {
  const { day, mon } = parseDateDisplay(s.tanggal);
  const isToday = today && s.tanggal === today;
  const isPast  = today && s.tanggal < today;
  return `
    <div class="schedule-item${isToday ? ' schedule-today' : ''}${isPast ? ' schedule-past' : ''}" data-sched-id="${s.id}">
      <div class="schedule-date" aria-hidden="true">
        <div class="date-day">${day}</div>
        <div class="date-mon">${mon}</div>
        ${isToday ? '<div class="date-today-dot" aria-hidden="true"></div>' : ''}
      </div>
      <div class="schedule-info">
        <h5>${escH(s.judul)}${isToday ? ' <span class="badge badge-primary" style="font-size:9px;padding:.15rem .4rem">Hari ini</span>' : ''}</h5>
        <p>${escH(s.waktu)} WIB · ${escH(s.tempat)}</p>
      </div>
      <div class="schedule-actions">
        <button class="schedule-btn edit-btn" data-sched-id="${s.id}" aria-label="Edit jadwal ${escH(s.judul)}" title="Edit">
          <i data-lucide="pencil" aria-hidden="true"></i>
        </button>
        <button class="schedule-btn delete-btn" data-sched-id="${s.id}" aria-label="Hapus jadwal ${escH(s.judul)}" title="Hapus">
          <i data-lucide="trash-2" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}

function noteItemHTML(n) {
  return `
    <div class="note-item" data-note-id="${n.id}">
      <div class="note-item-header">
        <span class="note-item-date">${escH(n.tanggal)}</span>
        <div class="note-actions">
          <button class="note-btn edit-note-btn" data-note-id="${n.id}" aria-label="Edit catatan" title="Edit">
            <i data-lucide="pencil" aria-hidden="true"></i>
          </button>
          <button class="note-btn" data-note-id="${n.id}" aria-label="Hapus catatan" title="Hapus">
            <i data-lucide="trash-2" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <p class="note-item-text">${escH(n.teks)}</p>
    </div>`;
}

function initDashboardNC(container, ncId) {
  /* ── Checklist: klik / keyboard ── */
  const clContainer = container.querySelector('#checklistContainer');
  const toggleItem = (itemEl) => {
    const id = itemEl.dataset.id;
    const list = DB.getChecklistFor(ncId);
    const idx  = list.findIndex(c => c.id === id);
    if (idx < 0) return;
    list[idx].done = !list[idx].done;
    DB.saveChecklistFor(ncId, list);

    /* Update DOM */
    itemEl.classList.toggle('done', list[idx].done);
    itemEl.setAttribute('aria-checked', String(list[idx].done));
    itemEl.setAttribute('aria-label', escH(list[idx].label) + (list[idx].done ? ' — selesai' : ''));
    const box = itemEl.querySelector('.checklist-checkbox');
    box.innerHTML = list[idx].done ? '<i data-lucide="check" aria-hidden="true"></i>' : '';

    /* Badge minggu */
    const weekDiv = itemEl.closest('.checklist-week');
    if (weekDiv) {
      const items  = weekDiv.querySelectorAll('.checklist-item');
      const done   = Array.from(items).filter(i => i.classList.contains('done')).length;
      const badge  = weekDiv.querySelector('.week-badge');
      if (badge) { badge.textContent = `${done}/${items.length}`; badge.className = `badge badge-${done===items.length?'success':'neutral'} week-badge`; }
    }

    updateProgressUI(ncId);
    reInitIcons();
    if (list[idx].done) showToast('Task selesai ✅', escH(list[idx].label), 'success', 2200);
  };

  clContainer?.addEventListener('click', e => {
    const item = e.target.closest('.checklist-item');
    if (e.target.closest('.checklist-item-delete')) return; // biarkan delete handler
    if (item) toggleItem(item);
  });
  clContainer?.addEventListener('keydown', e => {
    const item = e.target.closest('.checklist-item');
    if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleItem(item); }
  });

  /* Delete custom task */
  clContainer?.addEventListener('click', e => {
    const delBtn = e.target.closest('.checklist-item-delete');
    if (!delBtn) return;
    e.stopPropagation();
    const id = delBtn.dataset.id;
    const list = DB.getChecklistFor(ncId);
    const item = list.find(c => c.id === id);
    showConfirm(`Hapus task "${item?.label || 'ini'}"?`, () => {
      DB.saveChecklistFor(ncId, list.filter(c => c.id !== id));
      delBtn.closest('.checklist-item').remove();
      updateProgressUI(ncId);
      showToast('Task dihapus', '', 'info', 1800);
    }, 'Ya, Hapus');
  });

  /* Tambah custom task */
  container.querySelector('#addCustomChecklistBtn')?.addEventListener('click', () => {
    showEditModal('Tambah Task Baru', `
      <div class="form-group">
        <label class="form-label" for="customLabel">Nama Task <span class="req">*</span></label>
        <input type="text" id="customLabel" class="form-input" placeholder="mis. Ikuti sesi onboarding HR" maxlength="80" />
        <span class="form-error" id="errCustomLabel" role="alert"></span>
      </div>
      <div class="form-group">
        <label class="form-label" for="customDesc">Deskripsi</label>
        <input type="text" id="customDesc" class="form-input" placeholder="Penjelasan singkat" maxlength="120" />
      </div>
      <div class="form-group">
        <label class="form-label" for="customMinggu">Minggu</label>
        <select id="customMinggu" class="form-select form-input">
          <option value="1">Minggu 1</option><option value="2">Minggu 2</option>
          <option value="3">Minggu 3</option><option value="4" selected>Minggu 4</option>
        </select>
      </div>
      <div style="display:flex;gap:.625rem;justify-content:flex-end;margin-top:.875rem">
        <button class="btn btn-ghost btn-sm" id="editModalCancelBtn" type="button">Batal</button>
        <button class="btn btn-primary btn-sm" id="editModalSubmitBtn" type="button"><i data-lucide="plus" aria-hidden="true"></i> Tambah</button>
      </div>`, (bodyEl, closeModal) => {
        const label = bodyEl.querySelector('#customLabel').value.trim();
        const errEl = bodyEl.querySelector('#errCustomLabel');
        if (!label) { if (errEl) errEl.textContent = 'Nama task tidak boleh kosong.'; return; }
        const desc  = bodyEl.querySelector('#customDesc').value.trim();
        const minggu= parseInt(bodyEl.querySelector('#customMinggu').value);
        const newItem = { id: genId('ci'), minggu, label, desc, done: false, custom: true };
        const list    = DB.getChecklistFor(ncId);
        list.push(newItem);
        DB.saveChecklistFor(ncId, list);

        /* Tambah ke DOM */
        const weekDiv = clContainer.querySelector(`[data-week="${minggu}"]`);
        if (weekDiv) {
          weekDiv.insertAdjacentHTML('beforeend', checklistItemHTML(newItem));
          reInitIcons();
          const items = weekDiv.querySelectorAll('.checklist-item');
          const done  = Array.from(items).filter(i => i.classList.contains('done')).length;
          const badge = weekDiv.querySelector('.week-badge');
          if (badge) { badge.textContent = `${done}/${items.length}`; badge.className = `badge badge-neutral week-badge`; }
        }
        updateProgressUI(ncId);
        closeModal();
        showToast('Task ditambahkan', escH(label), 'success', 2000);
    });
    reInitIcons();
  });

  /* ── Jadwal ── */
  const schedList = container.querySelector('#scheduleList');
  const todayForSched = getISODate(0);
  const attachSchedHandlers = () => {
    /* Gunakan class .delete-btn agar tidak bentrok dengan edit-btn */
    schedList?.querySelectorAll('.schedule-btn.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.dataset.schedId;
        const item = schedList.querySelector(`[data-sched-id="${id}"]`);
        /* Ambil judul teks saja (strip html) */
        const titleRaw = item?.querySelector('h5')?.textContent.trim() || 'jadwal ini';
        showConfirm(`Hapus "${titleRaw}"?`, () => {
          DB.deleteSchedule(ncId, id);
          item?.remove();
          if (!schedList.querySelector('.schedule-item')) {
            schedList.innerHTML = '<p style="font-size:var(--fs-sm);color:var(--clr-text-muted);text-align:center;padding:.875rem 0">Belum ada jadwal.</p>';
          }
          showToast('Jadwal dihapus', '', 'info', 1800);
        }, 'Ya, Hapus');
      });
    });
    schedList?.querySelectorAll('.schedule-btn.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.schedId;
        const all = DB.getSchedulesFor(ncId);
        const s   = all.find(x => x.id === id);
        if (!s) return;
        showEditModal('Edit Jadwal', `
          <div class="form-group"><label class="form-label" for="eSchedJudul">Judul</label><input type="text" id="eSchedJudul" class="form-input" value="${escH(s.judul)}" /></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="eSchedTanggal">Tanggal</label><input type="date" id="eSchedTanggal" class="form-input" value="${s.tanggal}" /></div>
            <div class="form-group"><label class="form-label" for="eSchedWaktu">Waktu (WIB)</label><input type="time" id="eSchedWaktu" class="form-input" value="${s.waktu}" /></div>
          </div>
          <div class="form-group"><label class="form-label" for="eSchedTempat">Lokasi</label><input type="text" id="eSchedTempat" class="form-input" value="${escH(s.tempat)}" /></div>
          <div style="display:flex;gap:.625rem;justify-content:flex-end;margin-top:.875rem">
            <button class="btn btn-ghost btn-sm" id="editModalCancelBtn" type="button">Batal</button>
            <button class="btn btn-primary btn-sm" id="editModalSubmitBtn" type="button"><i data-lucide="save" aria-hidden="true"></i> Simpan</button>
          </div>`, (bodyEl, closeModal) => {
            s.judul   = bodyEl.querySelector('#eSchedJudul').value.trim();
            s.tanggal = bodyEl.querySelector('#eSchedTanggal').value;
            s.waktu   = bodyEl.querySelector('#eSchedWaktu').value;
            s.tempat  = bodyEl.querySelector('#eSchedTempat').value.trim();
            DB.saveScheduleFor(ncId, s);
            const itemEl = schedList.querySelector(`[data-sched-id="${id}"]`);
            if (itemEl) { itemEl.outerHTML = scheduleItemHTML(s, todayForSched); attachSchedHandlers(); reInitIcons(); }
            closeModal();
            showToast('Jadwal diperbarui', escH(s.judul), 'success', 2000);
          });
        reInitIcons();
      });
    });
  };
  attachSchedHandlers();

  container.querySelector('#addSchedForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const judulEl   = container.querySelector('#schedJudul');
    const tanggalEl = container.querySelector('#schedTanggal');
    let ok = true;
    const errJ = document.getElementById('errSchedJudul'); const errT = document.getElementById('errSchedTanggal');
    if (!judulEl.value.trim())   { if (errJ) errJ.textContent = 'Judul tidak boleh kosong.'; ok = false; } else { if (errJ) errJ.textContent = ''; }
    if (!tanggalEl.value)        { if (errT) errT.textContent = 'Pilih tanggal.'; ok = false; }            else { if (errT) errT.textContent = ''; }
    if (!ok) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.classList.add('loading'); btn.disabled = true;
    setTimeout(() => {
      btn.classList.remove('loading'); btn.disabled = false;
      const newS = {
        id: genId('sched'), newcomerId: ncId,
        tanggal: tanggalEl.value,
        waktu:   container.querySelector('#schedWaktu').value || '09:00',
        judul:   judulEl.value.trim(),
        tempat:  container.querySelector('#schedTempat').value.trim() || 'Online',
      };
      DB.saveScheduleFor(ncId, newS);
      /* Remove "belum ada" message */
      schedList.querySelector('p')?.remove();
      /* Insert dengan today context */
      schedList.insertAdjacentHTML('beforeend', scheduleItemHTML(newS, todayForSched));
      attachSchedHandlers();
      reInitIcons();
      e.target.reset();
      showToast('Jadwal ditambahkan!', escH(newS.judul), 'success', 2500);
    }, 500);
  });

  /* ── Catatan ── */
  const notesList = container.querySelector('#notesList');
  const attachNoteHandlers = () => {
    notesList?.querySelectorAll('.note-btn:not(.edit-note-btn)').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.noteId;
        showConfirm('Hapus catatan ini?', () => {
          DB.deleteNote(ncId, id);
          btn.closest('.note-item')?.remove();
          if (!notesList.querySelector('.note-item')) {
            notesList.innerHTML = '<p style="font-size:var(--fs-sm);color:var(--clr-text-muted);text-align:center;padding:.875rem 0">Belum ada catatan.</p>';
          }
          showToast('Catatan dihapus', '', 'info', 1800);
        }, 'Ya, Hapus');
      });
    });
    notesList?.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.noteId;
        const all = DB.getNotesFor(ncId);
        const n   = all.find(x => x.id === id);
        if (!n) return;
        showEditModal('Edit Catatan', `
          <div class="form-group"><label class="form-label" for="eNoteTeks">Catatan</label><textarea id="eNoteTeks" class="form-textarea" rows="4" maxlength="500">${escH(n.teks)}</textarea></div>
          <div style="display:flex;gap:.625rem;justify-content:flex-end;margin-top:.875rem">
            <button class="btn btn-ghost btn-sm" id="editModalCancelBtn" type="button">Batal</button>
            <button class="btn btn-primary btn-sm" id="editModalSubmitBtn" type="button"><i data-lucide="save" aria-hidden="true"></i> Simpan</button>
          </div>`, (bodyEl, closeModal) => {
            n.teks = bodyEl.querySelector('#eNoteTeks').value.trim();
            DB.saveNoteFor(ncId, n);
            const noteEl = notesList.querySelector(`[data-note-id="${id}"]`);
            if (noteEl) { noteEl.outerHTML = noteItemHTML(n); attachNoteHandlers(); reInitIcons(); }
            closeModal();
            showToast('Catatan diperbarui', '', 'success', 2000);
          });
        reInitIcons();
      });
    });
  };
  attachNoteHandlers();

  container.querySelector('#addNoteForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const teks  = container.querySelector('#noteTeks').value.trim();
    const errEl = document.getElementById('errNote');
    if (!teks) { if (errEl) errEl.textContent = 'Catatan tidak boleh kosong.'; return; }
    if (errEl) errEl.textContent = '';
    const newN = { id: genId('note'), tanggal: formatDateWIB(new Date()), teks };
    DB.saveNoteFor(ncId, newN);
    /* Remove "belum ada" if present */
    notesList.querySelector('p')?.remove();
    notesList.insertAdjacentHTML('afterbegin', noteItemHTML(newN));
    attachNoteHandlers();
    reInitIcons();
    container.querySelector('#noteTeks').value = '';
    showToast('Catatan ditambahkan', '', 'success', 1800);
  });
}

/* ─────────────────────────────────────────────
   14. HALAMAN: DASHBOARD BUDDY
───────────────────────────────────────────── */
function renderDashboardBuddy(container) {
  const user     = AppState.activeUser;
  const pairings = DB.getPairingsForBuddy(user?.id);
  const newcomers= pairings.map(p => ({ pairing: p, user: DB.getUserById(p.newcomerId) })).filter(x => x.user);

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
        <div>
          <h1>Dashboard Buddy</h1>
          <p>Halo, <strong>${escH(user?.nama || 'Buddy')}</strong>! Berikut status newcomer yang kamu bimbing. 🤝</p>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <span class="badge badge-${pairings.length >= BUDDY_QUOTA ? 'warning' : 'success'}">
            ${pairings.length}/${BUDDY_QUOTA} slot terisi
          </span>
          <button class="btn btn-outline btn-sm" id="editMyProfileBtn">
            <i data-lucide="user-cog" aria-hidden="true"></i> Edit Profil
          </button>
        </div>
      </div>
    </div>

    <!-- Statistik (beri label "Data Aktual") -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem">
      <div class="card card-sm" style="text-align:center">
        <div class="stat-num" style="font-size:var(--fs-3xl)">${newcomers.length}</div>
        <div class="stat-label">Newcomer Aktif</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div class="stat-num" style="font-size:var(--fs-3xl)">${BUDDY_QUOTA - pairings.length}</div>
        <div class="stat-label">Slot Tersedia</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div class="stat-num" style="font-size:var(--fs-3xl)">${Object.values(Store.get('meetingNotes',{})).flat().length}</div>
        <div class="stat-label">Total Catatan Sesi</div>
      </div>
    </div>

    <section aria-labelledby="newcomerListTitle">
      <h2 id="newcomerListTitle" style="font-size:var(--fs-xl);margin-bottom:1rem">Newcomer yang Kamu Bimbing</h2>
      ${newcomers.length
        ? `<div style="display:flex;flex-direction:column;gap:1.25rem" id="newcomerBuddyList">
             ${newcomers.map(({ pairing, user: nc }) => newcomerBuddyCardHTML(pairing, nc)).join('')}
           </div>`
        : `<div class="card card-sm" style="text-align:center;color:var(--clr-text-muted)">
             <p style="font-size:var(--fs-sm)">Belum ada newcomer yang dipasangkan denganmu.</p>
             <p style="font-size:var(--fs-xs);margin-top:.35rem">Newcomer bisa memilihmu di halaman <a href="#/cari-buddy">Cari Buddy</a>.</p>
           </div>`
      }
    </section>

    <hr class="divider">
    <section aria-labelledby="buddyTipsTitle">
      <h2 id="buddyTipsTitle" style="font-size:var(--fs-xl);margin-bottom:1rem">Tips Menjadi Buddy yang Efektif</h2>
      <div class="benefits-grid">
        <div class="benefit-card"><div class="benefit-icon green"><i data-lucide="ear" aria-hidden="true"></i></div><h4>Dengarkan Aktif</h4><p>Beri ruang bagi newcomer untuk bercerita. Jangan langsung memberi solusi sebelum memahami konteksnya.</p></div>
        <div class="benefit-card"><div class="benefit-icon orange"><i data-lucide="calendar" aria-hidden="true"></i></div><h4>Konsisten Bertemu</h4><p>Jadwalkan sesi rutin, sekali seminggu minimal. Konsistensi menunjukkan komitmenmu.</p></div>
        <div class="benefit-card"><div class="benefit-icon blue"><i data-lucide="message-circle" aria-hidden="true"></i></div><h4>Buka Saluran Komunikasi</h4><p>Informasikan cara terbaik untuk menghubungimu dan kapan kamu bisa direspons.</p></div>
      </div>
    </section>
    ${renderFooterHTML()}
  `;

  /* Edit profil buddy */
  container.querySelector('#editMyProfileBtn')?.addEventListener('click', () => {
    const u = AppState.activeUser;
    const divisis = ['Engineering','Product','Design','Marketing','Data','Operations','Finance','HR','Sales'];
    showEditModal('Edit Profil Buddy', `
      <div class="form-group"><label class="form-label" for="ePNama">Nama</label><input type="text" id="ePNama" class="form-input" value="${escH(u.nama)}" /></div>
      <div class="form-group"><label class="form-label" for="ePJabatan">Jabatan</label><input type="text" id="ePJabatan" class="form-input" value="${escH(u.jabatan||'')}" /></div>
      <div class="form-group"><label class="form-label" for="ePDivisi">Divisi</label>
        <select id="ePDivisi" class="form-select form-input">${divisis.map(d=>`<option ${u.divisi===d?'selected':''}>${d}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label" for="ePBio">Perkenalan Singkat</label><textarea id="ePBio" class="form-textarea" rows="3" maxlength="280">${escH(u.bio||'')}</textarea></div>
      <div style="display:flex;gap:.625rem;justify-content:flex-end;margin-top:.875rem">
        <button class="btn btn-ghost btn-sm" id="editModalCancelBtn" type="button">Batal</button>
        <button class="btn btn-primary btn-sm" id="editModalSubmitBtn" type="button"><i data-lucide="save" aria-hidden="true"></i> Simpan</button>
      </div>`, (bodyEl, closeModal) => {
        u.nama    = bodyEl.querySelector('#ePNama').value.trim() || u.nama;
        u.jabatan = bodyEl.querySelector('#ePJabatan').value.trim();
        u.divisi  = bodyEl.querySelector('#ePDivisi').value;
        u.bio     = bodyEl.querySelector('#ePBio').value.trim();
        DB.saveUser(u);
        renderSidebarProfile();
        closeModal();
        showToast('Profil diperbarui', escH(u.nama), 'success', 2500);
        handleRoute(); // refresh halaman
      });
    reInitIcons();
  });

  initDashboardBuddy(container, newcomers);
}

function newcomerBuddyCardHTML(pairing, nc) {
  const pct  = DB.calcProgress(nc.id);
  const notes = DB.getMeetingNotesFor(pairing.id);
  const notesHTML = notes.length
    ? [...notes].reverse().map(n => `<div class="meeting-note-item"><strong>${escH(n.tanggal)}</strong> ${escH(n.catatan)}</div>`).join('')
    : '<p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">Belum ada catatan pertemuan.</p>';

  return `
    <div class="card" data-pairing-id="${pairing.id}" data-nc-id="${nc.id}">
      <div class="newcomer-row" style="border:none;padding:0;margin-bottom:.875rem">
        <div class="newcomer-avatar" style="background:${avatarGradient(nc.id)}">${escH(getInitials(nc.nama))}</div>
        <div class="newcomer-row-info">
          <h4>${escH(nc.nama)}</h4>
          <p>${escH(nc.divisi)} · Mulai ${escH(pairing.tanggalMulai)}</p>
        </div>
        <span class="badge badge-${pct>=100?'success':pct>0?'warning':'neutral'}">
          ${pct>=100?'Selesai':pct>0?'Berjalan':'Baru Mulai'}
        </span>
      </div>
      <div class="progress-wrap" style="margin-bottom:.875rem"
        role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
        aria-label="Progres onboarding ${escH(nc.nama)}: ${pct}%">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <span class="progress-pct">${pct}%</span>
      </div>
      <details>
        <summary class="btn btn-ghost btn-sm" style="list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:.375rem">
          <i data-lucide="notebook-pen" aria-hidden="true"></i>
          Catatan Pertemuan (<span class="note-count">${notes.length}</span>)
        </summary>
        <div style="margin-top:.75rem">
          <div class="meeting-notes-list" id="mnList-${pairing.id}">${notesHTML}</div>
          <form class="mn-form" data-pairing-id="${pairing.id}" style="margin-top:.625rem;display:flex;flex-direction:column;gap:.45rem" novalidate>
            <textarea class="form-textarea mn-input" rows="2"
              placeholder="Catatan dari sesi hari ini…"
              aria-label="Tulis catatan pertemuan untuk ${escH(nc.nama)}"></textarea>
            <span class="form-error mn-err" role="alert"></span>
            <button type="submit" class="btn btn-primary btn-sm">
              <i data-lucide="save" aria-hidden="true"></i> Simpan Catatan
            </button>
          </form>
        </div>
      </details>
    </div>`;
}

function initDashboardBuddy(container, newcomers) {
  newcomers.forEach(({ pairing }) => {
    const form = container.querySelector(`.mn-form[data-pairing-id="${pairing.id}"]`);
    form?.addEventListener('submit', e => {
      e.preventDefault();
      const textarea = form.querySelector('.mn-input');
      const errEl    = form.querySelector('.mn-err');
      const catatan  = textarea.value.trim();
      if (!catatan) { if (errEl) errEl.textContent = 'Catatan tidak boleh kosong.'; return; }
      if (errEl) errEl.textContent = '';

      const btn = form.querySelector('button[type="submit"]');
      btn.classList.add('loading'); btn.disabled = true;
      setTimeout(() => {
        btn.classList.remove('loading'); btn.disabled = false;
        const newNote = { id: genId('mn'), tanggal: formatDateWIB(new Date()), catatan };
        DB.saveMeetingNote(pairing.id, newNote);

        const listEl = document.getElementById(`mnList-${pairing.id}`);
        if (listEl) {
          listEl.querySelector('p')?.remove();
          listEl.insertAdjacentHTML('afterbegin',
              `<div class="meeting-note-item"><strong>${escH(newNote.tanggal)}</strong> ${escH(newNote.catatan)}</div>`);
        }
        /* Perbarui count di summary */
        const countEl = form.closest('details')?.querySelector('.note-count');
        if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;

        textarea.value = '';
        showToast('Catatan disimpan', 'Catatan pertemuan berhasil ditambahkan.', 'success', 2200);
      }, 380);
    });
  });
}

/* ─────────────────────────────────────────────
   15. HALAMAN: FAQ
───────────────────────────────────────────── */
function renderFAQ(container) {
  const faqs = Store.get('faqs', []);
  const cats = [...new Set(faqs.map(f => f.kategori))];

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem">
        <div>
          <h1>FAQ — Pertanyaan yang Sering Muncul</h1>
          <p>Tidak ada pertanyaan yang terlalu "sepele" di Merintis. Jika kamu bingung, kemungkinan besar jawabannya ada di sini!</p>
        </div>
        <div class="kbd-hint" aria-label="Tekan tanda tanya untuk membuka FAQ">
          <kbd>?</kbd> <span>buka FAQ</span>
          <kbd>/</kbd> <span>fokus cari</span>
        </div>
      </div>
    </div>
    <div class="search-input-wrap" style="max-width:480px;margin-bottom:1.875rem" role="search" aria-label="Cari pertanyaan FAQ">
      <i data-lucide="search" aria-hidden="true"></i>
      <input type="search" id="faqSearch" class="form-input" placeholder="Cari pertanyaan… (tekan / untuk fokus)" aria-label="Cari FAQ" autocomplete="off" />
    </div>
    <div id="faqList" aria-label="Daftar pertanyaan">
      ${cats.map(cat => `
        <p class="faq-category-title" data-category="${escH(cat)}">${escH(cat)}</p>
        ${faqs.filter(f => f.kategori === cat).map(faq => `
          <div class="accordion-item" data-category="${escH(cat)}" data-question="${escH(faq.pertanyaan.toLowerCase())}">
            <button class="accordion-header" aria-expanded="false"
              aria-controls="faq-body-${faq.id}" id="faq-btn-${faq.id}">
              ${escH(faq.pertanyaan)}
              <i data-lucide="chevron-down" aria-hidden="true"></i>
            </button>
            <div class="accordion-body" id="faq-body-${faq.id}" role="region" aria-labelledby="faq-btn-${faq.id}">
              <div class="accordion-content">${faq.jawaban}</div>
            </div>
          </div>
        `).join('')}
      `).join('')}
    </div>
    <div id="faqEmpty" hidden style="text-align:center;padding:3rem 1rem;color:var(--clr-text-muted)">
      <p><strong>Tidak ada pertanyaan yang cocok.</strong></p>
      <p style="font-size:var(--fs-sm);margin-top:.35rem">Coba kata kunci lain, atau hubungi HR Merintis di <strong>#hr-help</strong> di Slack.</p>
    </div>
    <div class="cta-section" style="margin-top:2.5rem">
      <h2 style="font-size:var(--fs-2xl)">Masih ada yang mengganjal?</h2>
      <p>Tanyakan langsung ke buddy-mu, atau kunjungi channel <strong>#onboarding-help</strong> di Slack Merintis.</p>
      <div class="cta-actions">
        <a href="#/cari-buddy" class="btn btn-white">Temukan Buddy-ku</a>
        <a href="#/dashboard-newcomer" class="btn" style="background:rgba(255,255,255,.15);color:white;border:2px solid rgba(255,255,255,.3)">Lihat Dashboard</a>
      </div>
    </div>
    ${renderFooterHTML()}
  `;

  /* Accordion */
  container.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      /* Tutup semua */
      container.querySelectorAll('.accordion-header').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        document.getElementById(b.getAttribute('aria-controls'))?.classList.remove('open');
      });
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        document.getElementById(btn.getAttribute('aria-controls'))?.classList.add('open');
      }
    });
  });

  /* Real-time search */
  container.querySelector('#faqSearch')?.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    let visible = 0;
    container.querySelectorAll('.accordion-item').forEach(item => {
      const match = !q
        || item.dataset.question?.includes(q)
        || item.querySelector('.accordion-content')?.textContent.toLowerCase().includes(q);
      item.classList.toggle('faq-hidden', !match);
      if (match) visible++;
    });
    /* Sembunyikan kategori tanpa item visible */
    container.querySelectorAll('.faq-category-title').forEach(cat => {
      const catName = cat.dataset.category;
      const catItems = container.querySelectorAll(`.accordion-item[data-category="${CSS.escape(catName)}"]`);
      const hasVisible = Array.from(catItems).some(i => !i.classList.contains('faq-hidden'));
      cat.classList.toggle('faq-hidden', !hasVisible);
    });
    const empty = document.getElementById('faqEmpty');
    if (empty) empty.hidden = visible > 0;
  });
}

/* ─────────────────────────────────────────────
   16. FOOTER
───────────────────────────────────────────── */
function renderFooterHTML() {
  return `
    <footer class="site-footer" role="contentinfo">
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-brand">
            <h3>
              <svg width="20" height="20" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="20" fill="var(--clr-primary)"/>
                <path d="M20 30 L20 18" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M20 22 Q14 18 15 13 Q20 15 20 22" fill="white" opacity=".9"/>
                <path d="M20 19 Q26 15 25 10 Q20 13 20 19" fill="white"/>
                <path d="M13 31 Q20 29 27 31" stroke="white" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>
              </svg>
              Merintis
            </h3>
            <p>Platform onboarding buddy system untuk membantu karyawan baru beradaptasi dengan cepat, percaya diri, dan bahagia.</p>
          </div>
          <div class="footer-col">
            <h4>Program</h4>
            <nav class="footer-links" aria-label="Link program">
              <a href="#/beranda">Beranda</a>
              <a href="#/daftar">Daftar Sekarang</a>
              <a href="#/cari-buddy">Cari Buddy</a>
              <a href="#/faq">FAQ</a>
            </nav>
          </div>
          <div class="footer-col">
            <h4>Dashboard</h4>
            <nav class="footer-links" aria-label="Link dashboard">
              <a href="#/dashboard-newcomer">Newcomer</a>
              <a href="#/dashboard-buddy">Buddy</a>
            </nav>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${new Date().getFullYear()} Merintis · Skema data v${SCHEMA_VERSION} · Tumbuh bersama, melangkah lebih jauh. 🌱</p>
          <span class="footer-tagline">Membangun ekosistem kerja yang hangat dan inklusif</span>
        </div>
      </div>
    </footer>`;
}

/* ═══════════════════════════════════════════════════════════
   18. SPROUT — ASISTEN ADAPTASI NEWCOMER
   ─────────────────────────────────────────────────────────
   Arsitektur:
   • buildSproutContext()  — kumpulkan konteks pengguna aktif
   • getReply(msg, ctx)    — engine aturan (tanpa backend/API key)
                             Siap diganti dengan fetch() ke API.
   • initSprout()          — inisialisasi UI, event, riwayat
   • Riwayat tersimpan di localStorage key "sprout_history"
   ─────────────────────────────────────────────────────────
   TIDAK ADA API KEY di file ini.
═══════════════════════════════════════════════════════════ */

/* ── Chip saran cepat (konten statis + kontekstual) ── */
const SPROUT_CHIPS_DEFAULT = [
  { label: '📋 Apa yang harus kulakukan hari ini?',  msg: 'Apa yang harus kulakukan hari ini?' },
  { label: '🤝 Bantu aku menyusun pertanyaan untuk buddy', msg: 'Bantu aku menyusun pertanyaan untuk buddy' },
  { label: '😓 Aku merasa kewalahan', msg: 'Aku merasa kewalahan' },
  { label: '📝 Rangkumkan catatanku jadi agenda sesi', msg: 'Tolong rangkumkan catatanku jadi agenda sesi dengan buddy' },
  { label: '🗓️ Jadwal pertemuan terdekat?', msg: 'Kapan jadwal pertemuan terdekat saya?' },
];

/* ── Bangun konteks pengguna untuk dikirim ke getReply ── */
function buildSproutContext() {
  const user      = AppState.activeUser;
  if (!user) return null;

  const ncId      = user.id;
  const pairing   = DB.getPairingForNewcomer(ncId);
  const buddy     = pairing ? DB.getUserById(pairing.buddyId) : null;
  const checklist = DB.getChecklistFor(ncId);
  const schedules = DB.getSchedulesFor(ncId);
  const notes     = DB.getNotesFor(ncId);
  const faqs      = Store.get('faqs', []);
  const pct       = DB.calcProgress(ncId);

  /* Hitung minggu onboarding dari tanggal mulai pairing */
  let mingguOnboarding = 1;
  if (pairing?.tanggalMulai) {
    const [y, m, d]  = pairing.tanggalMulai.split('-').map(Number);
    const start      = new Date(y, m - 1, d);
    const diffDays   = Math.floor((Date.now() - start.getTime()) / 86400000);
    mingguOnboarding = Math.min(4, Math.max(1, Math.ceil((diffDays + 1) / 7)));
  }

  /* Jadwal terdekat (yang belum lewat) */
  const today = getISODate(0);
  const nextSched = schedules.find(s => s.tanggal >= today) || null;

  /* Task belum selesai */
  const pending = checklist.filter(i => !i.done);

  return {
    user,
    buddy,
    pairing,
    pct,
    mingguOnboarding,
    checklist,
    pending,
    nextSched,
    notes,
    faqs,
  };
}

/* ──────────────────────────────────────────────────────────
   getReply(pesan, konteks)
   ─────────────────────────────────────────────────────────
   Engine berbasis aturan tanpa backend.
   Return: { teks: string, sumber?: string }

   Untuk mengganti dengan panggilan API:
     async function getReply(pesan, konteks) {
       const res = await fetch('/api/sprout', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ pesan, konteks }),
       });
       const data = await res.json();
       return { teks: data.reply, sumber: data.sumber };
     }
   Pastikan API key TIDAK pernah ada di front-end.
────────────────────────────────────────────────────────── */
function getReply(pesan, ctx) {
  if (!ctx) {
    return { teks: 'Maaf, saya belum bisa membaca konteksmu saat ini. Coba muat ulang halaman ya! 🌱' };
  }

  const msg   = pesan.toLowerCase().trim();
  const nama  = ctx.user?.nama?.split(' ')[0] || 'Kamu';

  /* ── 1. Ungkapan kewalahan / emosi negatif ── */
  const overwhelmKw = ['kewalahan','overwhelmed','stress','pusing','lelah','bingung banget',
    'tidak tahu','nggak tahu','takut','cemas','anxious','panik','menyerah','minta tolong'];
  if (overwhelmKw.some(kw => msg.includes(kw))) {
    const buddyNama = ctx.buddy?.nama?.split(' ')[0] || 'buddymu';
    return {
      teks: `Wajar banget merasa seperti itu, ${nama}. Semua orang pernah ada di posisi ini. 💚\n\nCoba ceritakan ke **${buddyNama}** di sesi kalian berikutnya — itulah gunanya buddy-mu ada. Kalau butuh bicara lebih dalam soal kondisi kamu, HR Merintis juga siap di channel **#hr-help** di Slack.`,
    };
  }

  /* ── 2. Pertanyaan tentang hari ini / langkah selanjutnya ── */
  const todayKw = ['hari ini','langkah','selanjutnya','harus kulakukan','harus aku lakukan',
    'mulai dari mana','prioritas','what to do','next step'];
  if (todayKw.some(kw => msg.includes(kw))) {
    return buildNextStepsReply(ctx, nama);
  }

  /* ── 3. Bantu menyusun pertanyaan untuk buddy ── */
  const questionKw = ['menyusun pertanyaan','pertanyaan untuk buddy','tanya ke buddy',
    'pertanyaan buddy','bantu pertanyaan','cara bertanya'];
  if (questionKw.some(kw => msg.includes(kw))) {
    return buildQuestionFrameReply(ctx, nama);
  }

  /* ── 4. Rangkum catatan jadi agenda ── */
  const agendaKw = ['rangkum','agenda sesi','rangkumkan','catatan jadi agenda',
    'resume catatan','summarize','agenda pertemuan'];
  if (agendaKw.some(kw => msg.includes(kw))) {
    return buildAgendaReply(ctx, nama);
  }

  /* ── 5. Jadwal pertemuan ── */
  const schedKw = ['jadwal','pertemuan','meeting','sesi','kapan','schedule'];
  if (schedKw.some(kw => msg.includes(kw))) {
    return buildScheduleReply(ctx, nama);
  }

  /* ── 6. Pertanyaan tentang buddy ── */
  const buddyKw = ['siapa buddy','buddy saya','buddy ku','buddy aku','nama buddy'];
  if (buddyKw.some(kw => msg.includes(kw))) {
    if (ctx.buddy) {
      return {
        teks: `Buddy aktifmu adalah **${ctx.buddy.nama}** dari divisi ${ctx.buddy.divisi} (${ctx.buddy.jabatan}). Ketersediaannya: ${(ctx.buddy.ketersediaan || []).join(', ')}. 😊`,
      };
    }
    return {
      teks: `Kamu belum memilih buddy. Kunjungi halaman **Cari Buddy** untuk menemukan rekan yang cocok denganmu!`,
    };
  }

  /* ── 7. Pertanyaan tentang progres ── */
  const progressKw = ['progres','progress','sudah berapa','selesai berapa','persentase','checklist'];
  if (progressKw.some(kw => msg.includes(kw))) {
    return buildProgressReply(ctx, nama);
  }

  /* ── 8. Topik gaji / cuti / evaluasi — arahkan ke HR ── */
  const hrOnlyKw = ['gaji','salary','cuti','leave','evaluasi kinerja','penilaian','promosi','resign','phk'];
  if (hrOnlyKw.some(kw => msg.includes(kw))) {
    return {
      teks: `Saya tidak bisa memberi informasi tentang topik itu, ${nama}. Untuk hal-hal seperti gaji, cuti, atau evaluasi, silakan hubungi HR Merintis langsung di Slack channel **#hr-help** atau email **hr@merintis.id**. 🙏`,
    };
  }

  /* ── 9. Cari di FAQ ── */
  const faqMatch = findFaqMatch(msg, ctx.faqs);
  if (faqMatch) {
    /* Bersihkan HTML tag dari jawaban FAQ untuk tampilan plain */
    const cleanAnswer = faqMatch.jawaban
      .replace(/<strong>/g, '**').replace(/<\/strong>/g, '**')
      .replace(/<ul>/g, '').replace(/<\/ul>/g, '')
      .replace(/<li>/g, '\n• ').replace(/<\/li>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    return {
      teks: cleanAnswer,
      sumber: `Sumber: FAQ — "${faqMatch.kategori}"`,
    };
  }

  /* ── 10. Sapaan / halo ── */
  const greetKw = ['halo','hai','hei','hi','hello','selamat','pagi','siang','sore','malam'];
  if (greetKw.some(kw => msg.includes(kw))) {
    const buddyNama = ctx.buddy?.nama?.split(' ')[0] || null;
    return {
      teks: `Halo, ${nama}! 🌱 Saya Sprout, pendampingmu di Merintis.\n\nKamu sudah menyelesaikan **${ctx.pct}%** onboarding dan ini minggu ke-**${ctx.mingguOnboarding}**-mu.${buddyNama ? ` Buddy-mu ${buddyNama} siap membantumu.` : ''} Ada yang ingin kamu tanyakan?`,
    };
  }

  /* ── Fallback: tidak tahu ── */
  return {
    teks: `Hmm, saya belum bisa menjawab itu dengan pasti, ${nama}. Untuk pertanyaan spesifik, coba tanyakan langsung ke **buddy-mu** atau cek halaman **FAQ** — banyak jawaban berguna di sana. 🌿`,
  };
}

/* ── Sub-fungsi reply ── */

function buildNextStepsReply(ctx, nama) {
  const pending = ctx.pending.slice(0, 3);
  if (!pending.length) {
    return { teks: `Luar biasa, ${nama}! Semua checklist sudah selesai. 🎉 Minta feedback dari buddy dan managermu untuk langkah selanjutnya ya.` };
  }
  const steps = pending.map((t, i) => `${i + 1}. **${t.label}** — ${t.desc}`).join('\n');
  const schedInfo = ctx.nextSched
    ? `\n\n🗓️ Jangan lupa, ada sesi dengan buddy pada **${parseDateDisplay(ctx.nextSched.tanggal).full}** pukul **${ctx.nextSched.waktu} WIB**.`
    : '';
  return {
    teks: `Ini 3 tugas berikutnya yang perlu kamu selesaikan, ${nama}:\n\n${steps}${schedInfo}`,
  };
}

function buildQuestionFrameReply(ctx, nama) {
  const pending = ctx.pending[0];
  const topik   = pending ? pending.label : 'tugas onboardingmu';
  return {
    teks: `Tentu! Coba gunakan kerangka ini saat bertanya ke buddy:\n\n**1. Konteks:** "Saya sedang mengerjakan _${topik}_…"\n**2. Yang sudah dicoba:** "Saya sudah mencoba… tapi hasilnya…"\n**3. Pertanyaan:** "Menurutmu, apakah cara ini sudah tepat atau ada pendekatan yang lebih baik?"\n\nKerangka ini membantu buddy langsung memahami situasimu tanpa harus menebak-nebak. 💬`,
  };
}

function buildAgendaReply(ctx, nama) {
  const notes = ctx.notes.slice(-5); // 5 catatan terakhir
  if (!notes.length) {
    return { teks: `Kamu belum punya catatan, ${nama}. Tambahkan catatan di Dashboard Newcomermu dulu ya, nanti saya bantu rangkum jadi agenda! 📝` };
  }
  const buddyNama = ctx.buddy?.nama?.split(' ')[0] || 'buddy';
  const items     = notes.map((n, i) => `${i + 1}. ${n.teks.slice(0, 80)}${n.teks.length > 80 ? '…' : ''}`).join('\n');
  return {
    teks: `Berdasarkan catatanmu, ini agenda yang bisa kamu bawa ke sesi dengan ${buddyNama}:\n\n${items}\n\n💡 Pilih 2–3 poin yang paling mendesak untuk dibahas duluan.`,
  };
}

function buildScheduleReply(ctx, nama) {
  if (!ctx.nextSched) {
    return {
      teks: `Belum ada jadwal pertemuan yang tercatat, ${nama}. Yuk tambahkan di halaman **Dashboard Newcomer** bagian Jadwal Pertemuan!`,
    };
  }
  const { full } = parseDateDisplay(ctx.nextSched.tanggal);
  return {
    teks: `Jadwal pertemuan terdekatmu:\n📅 **${ctx.nextSched.judul}**\n🕐 ${full}, pukul **${ctx.nextSched.waktu} WIB**\n📍 ${ctx.nextSched.tempat}`,
  };
}

function buildProgressReply(ctx, nama) {
  const done  = ctx.checklist.filter(i => i.done).length;
  const total = ctx.checklist.length;
  const nxt   = ctx.pending[0];
  return {
    teks: `Progres onboardingmu saat ini: **${ctx.pct}%** (${done} dari ${total} tugas selesai) 🌱\n\nKamu ada di minggu ke-**${ctx.mingguOnboarding}**.${nxt ? `\n\nTugas berikutnya: **${nxt.label}**.` : '\n\nSemua tugas sudah selesai, keren!'}`,
  };
}

function findFaqMatch(msg, faqs) {
  /* Cari FAQ dengan kata kunci yang beririsan terbanyak */
  let best = null; let bestScore = 0;
  for (const faq of faqs) {
    const haystack = (faq.pertanyaan + ' ' + faq.jawaban).toLowerCase();
    /* Pecah pesan jadi kata-kata bermakna (>2 char) */
    const words = msg.split(/\s+/).filter(w => w.length > 2);
    const score  = words.filter(w => haystack.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = faq; }
  }
  return bestScore >= 2 ? best : null;
}

/* ── Format teks reply: **bold** → <strong>, \n → <br> ── */
function sproutFormatText(text) {
  return escH(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

/* ── Waktu singkat WIB ── */
function sproutTimeNow() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(11, 16);  /* "HH:MM" */
}

/* ════════════════════════════════════════
   initSprout() — inisialisasi UI & event
════════════════════════════════════════ */
function initSprout() {
  const fab        = document.getElementById('sproutFab');
  const panel      = document.getElementById('sproutPanel');
  const closeBtn   = document.getElementById('sproutCloseBtn');
  const clearBtn   = document.getElementById('sproutClearBtn');
  const form       = document.getElementById('sproutForm');
  const input      = document.getElementById('sproutInput');
  const msgArea    = document.getElementById('sproutMessages');
  const typingEl   = document.getElementById('sproutTyping');
  const chipsEl    = document.getElementById('sproutChips');
  const badge      = document.getElementById('sproutBadge');

  if (!fab || !panel) return;

  /* ── Muat riwayat dari localStorage ── */
  let history = Store.get('sprout_history', []);
  /* history: Array<{ role:'bot'|'user', text:string, time:string, sumber?:string }> */

  /* ── Render riwayat ── */
  const renderHistory = () => {
    msgArea.innerHTML = '';
    if (!history.length) {
      appendBotMsg(sproutWelcomeText(), null, false);
    } else {
      history.forEach(msg => {
        if (msg.role === 'user') appendUserMsg(msg.text, msg.time, false);
        else appendBotMsg(msg.text, msg.sumber || null, false, msg.time);
      });
    }
    scrollToBottom();
  };

  /* ── Teks selamat datang ── */
  function sproutWelcomeText() {
    const ctx = buildSproutContext();
    if (!ctx) return 'Halo! Saya Sprout, asisten adaptasimu. Ada yang bisa saya bantu? 🌱';
    const nama  = ctx.user?.nama?.split(' ')[0] || 'Kamu';
    const buddy = ctx.buddy?.nama?.split(' ')[0];
    return `Halo, **${nama}**! 🌱 Saya Sprout.\n\nKamu sedang di minggu ke-**${ctx.mingguOnboarding}** onboarding dengan progres **${ctx.pct}%**.${buddy ? ` Buddy-mu adalah **${buddy}**.` : ''}\n\nSilakan tanya apa saja — saya akan bantu semampu saya!`;
  }

  /* ── Append bubble bot ── */
  function appendBotMsg(text, sumber, save = true, time = null) {
    const t    = time || sproutTimeNow();
    const wrap = document.createElement('div');
    wrap.className = 'sprout-bubble sprout-from-bot';
    wrap.innerHTML = `
      <div class="sprout-avatar-xs" aria-hidden="true">🌱</div>
      <div class="sprout-bubble-inner">
        <div class="sprout-bubble-text">
          ${sproutFormatText(text)}
          ${sumber ? `<span class="sprout-source">${escH(sumber)}</span>` : ''}
        </div>
        <span class="sprout-bubble-time" aria-label="Dikirim pukul ${t} WIB">${t} WIB</span>
      </div>`;
    msgArea.appendChild(wrap);
    if (save) {
      history.push({ role: 'bot', text, sumber: sumber || null, time: t });
      Store.set('sprout_history', history);
    }
    scrollToBottom();
  }

  /* ── Append bubble user ── */
  function appendUserMsg(text, savedTime = null, save = true) {
    const t    = savedTime || sproutTimeNow();
    const initials = getInitials(AppState.activeUser?.nama || 'U');
    const wrap = document.createElement('div');
    wrap.className = 'sprout-bubble sprout-from-user';
    wrap.setAttribute('aria-label', `Kamu mengatakan: ${text}`);
    wrap.innerHTML = `
      <div class="sprout-avatar-xs" style="background:var(--clr-primary);color:#fff;font-family:var(--font-brand);font-weight:700;font-size:10px" aria-hidden="true">${escH(initials)}</div>
      <div class="sprout-bubble-inner">
        <div class="sprout-bubble-text">${escH(text)}</div>
        <span class="sprout-bubble-time" aria-label="Dikirim pukul ${t} WIB">${t} WIB</span>
      </div>`;
    msgArea.appendChild(wrap);
    if (save) {
      history.push({ role: 'user', text, time: t });
      Store.set('sprout_history', history);
    }
    scrollToBottom();
  }

  /* ── Pesan sistem ── */
  function appendSystemMsg(text) {
    const el = document.createElement('div');
    el.className = 'sprout-system-msg';
    el.textContent = text;
    msgArea.appendChild(el);
    scrollToBottom();
  }

  function scrollToBottom() {
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  /* ── Kirim pesan ── */
  async function sendMessage(text) {
    if (!text.trim()) return;

    /* Nonaktifkan input sementara */
    input.disabled = true;
    const sendBtn  = form.querySelector('.sprout-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    appendUserMsg(text);
    input.value = '';
    autoResizeInput();

    /* Tampilkan indikator mengetik */
    typingEl.hidden = false;
    scrollToBottom();

    /* Delay simulasi "mengetik" (800–1400ms) */
    const delay = 800 + Math.random() * 600;
    await sleep(delay);

    typingEl.hidden = true;

    /* Dapatkan reply */
    const ctx   = buildSproutContext();
    const reply = getReply(text, ctx);
    appendBotMsg(reply.teks, reply.sumber || null);

    /* Re-aktifkan input */
    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }

  /* ── Auto-resize textarea ── */
  function autoResizeInput() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }
  input.addEventListener('input', autoResizeInput);

  /* ── Render chip saran ── */
  const renderChips = () => {
    chipsEl.innerHTML = '';
    SPROUT_CHIPS_DEFAULT.forEach(chip => {
      const btn = document.createElement('button');
      btn.type        = 'button';
      btn.className   = 'sprout-chip';
      btn.textContent = chip.label;
      btn.setAttribute('aria-label', chip.label);
      btn.addEventListener('click', () => { sendMessage(chip.msg); });
      chipsEl.appendChild(btn);
    });
  };
  renderChips();

  /* ── Buka panel ── */
  const openPanel = () => {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    badge.hidden = true;
    renderHistory();
    reInitIcons();
    /* Fokus ke input setelah animasi */
    setTimeout(() => {
      input.focus();
    }, 240);
  };

  /* ── Tutup panel ── */
  const closePanel = () => {
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  };

  /* ── Toggle ── */
  fab.addEventListener('click', () => {
    if (panel.hidden) openPanel(); else closePanel();
  });

  closeBtn.addEventListener('click', closePanel);

  /* Escape: tutup panel */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.stopPropagation();
      closePanel();
    }
  });

  /* ── Hapus riwayat ── */
  clearBtn.addEventListener('click', () => {
    showConfirm('Hapus seluruh riwayat percakapan dengan Sprout?', () => {
      history = [];
      Store.remove('sprout_history');
      msgArea.innerHTML = '';
      appendBotMsg(sproutWelcomeText(), null, false);
      appendSystemMsg('Riwayat dihapus');
      showToast('Riwayat dihapus', 'Percakapan dengan Sprout telah dikosongkan.', 'info', 2500);
    }, 'Ya, Hapus');
  });

  /* ── Submit form ── */
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) sendMessage(text);
  });

  /* ── Enter tanpa Shift untuk kirim ── */
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (text) sendMessage(text);
    }
  });

  /* ── Badge: tandai ada pesan baru saat panel tertutup ── */
  /* Tidak digunakan proaktif di versi ini — siap untuk notif push */
}

/* ─────────────────────────────────────────────
   17. INISIALISASI
───────────────────────────────────────────── */
function init() {
  /* 1. Seed data (hanya jika skema lama atau belum ada) */
  seedData();

  /* 2. Lucide icons */
  reInitIcons();

  /* 3. Sidebar (termasuk inert pada mobile saat tertutup) */
  const sidebar = document.getElementById('sidebar');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.setAttribute('inert', '');
    sidebar.setAttribute('aria-hidden', 'true');
  }
  initSidebar();
  initDarkMode();

  /* 4. Routing */
  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  /* 5. Sprout — hanya tampil untuk newcomer */
  initSprout();
  /* Sembunyikan FAB saat peran buddy — Sprout untuk newcomer */
  const updateSproutVisibility = () => {
    const fab  = document.getElementById('sproutFab');
    const pnl  = document.getElementById('sproutPanel');
    const role = AppState.activeUser?.peran;
    if (fab) fab.style.display = role === 'buddy' ? 'none' : '';
    if (pnl && role === 'buddy') pnl.hidden = true;
  };
  updateSproutVisibility();
  /* Re-check saat role berganti */
  document.getElementById('roleSwitcherBtn')?.addEventListener('click', () => {
    setTimeout(updateSproutVisibility, 50);
  });

  /* 6. Keyboard shortcuts global
     ?  → pergi ke FAQ
     /  → fokus ke search bar di halaman aktif (jika ada)
     Diabaikan saat fokus di input/textarea/select
  */
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const isTyping = ['INPUT','TEXTAREA','SELECT'].includes(tag) || document.activeElement?.isContentEditable;
    if (isTyping) return;

    if (e.key === '?') {
      e.preventDefault();
      window.location.hash = '#/faq';
      showToast('Keyboard shortcut', 'Tekan <strong>?</strong> kapan saja untuk membuka FAQ.', 'info', 2500);
    }

    if (e.key === '/') {
      e.preventDefault();
      /* Cari input search yang visible di halaman aktif */
      const searchEl = document.querySelector('#buddySearch, #faqSearch');
      if (searchEl) {
        searchEl.focus();
        searchEl.select();
        showToast('Pencarian aktif', 'Mulai mengetik untuk menyaring hasil.', 'info', 1800);
      }
    }
  });
}

/* Jalankan setelah DOM siap */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
