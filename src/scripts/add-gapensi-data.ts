#!/usr/bin/env node
/**
 * Add GAPENSI template and mailing list to the database.
 * Run: node dist/scripts/add-gapensi-data.js
 * Or directly: npx tsx src/scripts/add-gapensi-data.ts
 */
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(__dirname, '../../data/kontraktor.dev.db');
// For prod: path.join(__dirname, '../../data/kontraktor.prod.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🔌 Connected to database');

// ── 1. Create the GAPENSI Partnership email template ──

const templateName = 'GAPENSI Partnership Proposal';
const templateSubject = 'Proposal Kerjasama Platform Digital untuk Anggota GAPENSI';
const templateHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; }
    .header { background: #1a5276; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .body { padding: 30px; background: #fff; }
    .signature { margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef9e7; padding: 15px; border-left: 4px solid #f39c12; margin: 15px 0; }
    table { width: 100%%; border-collapse: collapse; margin: 15px 0; }
    td, th { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
    th { background: #f2f2f2; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Proposal Kerjasama Strategis</h1>
    <p>Kontraktor.app × GAPENSI</p>
  </div>

  <div class="body">
    <p>Kepada Yth.<br>
    <strong>Badan Pengurus Pusat (BPP) GAPENSI</strong><br>
    di Jakarta</p>

    <p><em>Assalamu'alaikum Warahmatullahi Wabarakatuh,</em></p>

    <p>Salam sejahtera untuk kita semua,</p>

    <p>Saya <strong>{{name}}</strong>, pendiri <strong>Kontraktor.app</strong> — platform marketplace jasa konstruksi yang menghubungkan pemilik proyek dengan kontraktor terpercaya di seluruh Indonesia.</p>

    <p>Kami mengajukan proposal kerjasama strategis dengan <strong>GAPENSI</strong>, sebagai asosiasi jasa konstruksi tertua dan terbesar di Indonesia (didirikan 1959, 26.472 anggota di 34 provinsi).</p>

    <h3>Tentang Kontraktor.app</h3>
    <p>Kontraktor.app adalah platform digital yang memungkinkan pemilik proyek (rumah tinggal, renovasi, bangunan komersial, infrastruktur sipil) untuk mendapatkan penawaran harga dari kontraktor terverifikasi. Kami telah mengidentifikasi ribuan kontraktor aktif di ekosistem konstruksi Indonesia dan terus mengembangkan platform untuk memenuhi kebutuhan industri.</p>

    <h3>Manfaat kerjasama bagi anggota GAPENSI</h3>
    <ol>
      <li><strong>Akses proyek baru</strong> — Anggota GAPENSI mendapatkan prioritas sebagai kontraktor terverifikasi di platform, menerima permintaan penawaran dari pemilik proyek di seluruh Indonesia</li>
      <li><strong>Gratis untuk anggota</strong> — Profil perusahaan tanpa biaya pendaftaran, termasuk informasi kontak, portofolio, dan sertifikasi SBU</li>
      <li><strong>Eksposur digital</strong> — Setiap anggota GAPENSI mendapat halaman profil profesional dengan tautan ke website GAPENSI</li>
      <li><strong>Data pasar</strong> — Laporan berkala tren permintaan jasa konstruksi per daerah (gratis untuk GAPENSI)</li>
      <li><strong>Pengembangan usaha</strong> — Anggota dengan SBU aktif mendapat label "Tersertifikasi PUPR" di profil mereka</li>
    </ol>

    <h3>Kerjasama yang kami usulkan</h3>
    <ul>
      <li>GAPENSI merekomendasikan Kontraktor.app kepada anggota sebagai platform mitra</li>
      <li>GAPENSI menyediakan direktori anggota (nama perusahaan, kontak, bidang usaha, sertifikasi) untuk <em>onboarding</em> massal</li>
      <li>Kontraktor.app memberikan dashboard pantauan untuk pengurus GAPENSI (statistik anggota aktif, proyek per daerah)</li>
      <li><em>Co-branding</em> pada materi promosi kedua belah pihak</li>
    </ul>

    <h3>Komitmen kami</h3>
    <ul>
      <li>Integrasi data anggota secara bertahap dan aman</li>
      <li>Prioritas layanan untuk anggota GAPENSI di semua fitur platform</li>
      <li>Transparansi penuh dalam pengelolaan data</li>
      <li>Pelaporan berkala ke pengurus GAPENSI</li>
    </ul>

    <p>Kami sangat antusias untuk mendiskusikan proposal ini lebih lanjut. Tim kami siap bertemu atau melakukan panggilan video untuk menjelaskan platform dan menjawab pertanyaan Bapak/Ibu.</p>

    <p>Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.</p>

    <p><em>Wassalamu'alaikum Warahmatullahi Wabarakatuh,</em></p>

    <div class="signature">
      <p>Hormat kami,</p>
      <p><strong>{{name}}</strong><br>
      Founder, Kontraktor.app<br>
      {{email}}<br>
      {{phone}}</p>
    </div>
  </div>

  <div class="footer">
    <p>Kontraktor.app — Platform marketplace jasa konstruksi No. 1 di Indonesia</p>
    <p>https://kontraktor.app</p>
  </div>
</body>
</html>`;

const existingTemplate = db.prepare('SELECT id FROM email_templates WHERE name = ? AND deleted_at IS NULL').get(templateName) as { id: number } | undefined;

let templateId: number;
if (existingTemplate) {
  templateId = existingTemplate.id;
  db.prepare('UPDATE email_templates SET subject = ?, body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(templateSubject, templateHtml, templateId);
  console.log(`✅ Updated existing template: "${templateName}" (ID: ${templateId})`);
} else {
  const result = db.prepare('INSERT INTO email_templates (name, subject, body_html) VALUES (?, ?, ?)').run(templateName, templateSubject, templateHtml);
  templateId = result.lastInsertRowid as number;
  console.log(`✅ Created template: "${templateName}" (ID: ${templateId})`);
}

// ── 2. Create the GAPENSI Contacts mailing list ──

const listName = 'GAPENSI Construction Contacts';
const listDescription = 'Contact list from GAPENSI (Gabungan Pelaksana Konstruksi Nasional Indonesia) member directory. Includes verified construction companies across all Indonesian provinces.';

const existingList = db.prepare('SELECT id FROM mailing_lists WHERE name = ? AND deleted_at IS NULL').get(listName) as { id: number } | undefined;

let listId: number;
if (existingList) {
  listId = existingList.id;
  console.log(`✅ Mailing list already exists: "${listName}" (ID: ${listId})`);
} else {
  const result = db.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(listName, listDescription);
  listId = result.lastInsertRowid as number;
  console.log(`✅ Created mailing list: "${listName}" (ID: ${listId})`);
}

// ── 3. Import contacts ──
// These emails were extracted from the GAPENSI member directory page
// Company names are derived from email addresses where possible

const contacts: Array<{ email: string; name: string; company: string }> = [
  // CV-type companies (from email patterns)
  { email: 'cv.diansuryabangun@gmail.com', name: 'CV. Dian Surya Bangun', company: 'CV. Dian Surya Bangun' },
  { email: 'cv.kaharingangroup@gmail.com', name: 'CV. Kaharingan Group', company: 'CV. Kaharingan Group' },
  { email: 'cv.megacopilasmc@yahoo.com', name: 'CV. Mega Copilas', company: 'CV. Mega Copilas' },
  { email: 'cv.mudlikimah25@gmail.com', name: 'CV. Mudlikimah', company: 'CV. Mudlikimah' },
  { email: 'cv.petrajaya.007@gmail.com', name: 'CV. Petra Jaya', company: 'CV. Petra Jaya' },
  { email: 'cv.wellindo2022@gmail.com', name: 'CV. Wellindo', company: 'CV. Wellindo' },
  { email: 'cvalfathkaromah@gmail.com', name: 'CV. Alfath Karomah', company: 'CV. Alfath Karomah' },
  { email: 'cvdarmaga@gmail.com', name: 'CV. Darmaga', company: 'CV. Darmaga' },
  { email: 'cvgunungraya@gmail.com', name: 'CV. Gunung Raya', company: 'CV. Gunung Raya' },
  { email: 'cvkakamajubersama@gmail.com', name: 'CV. Kaka Maju Bersama', company: 'CV. Kaka Maju Bersama' },
  { email: 'cvmuaraindah@yahoo.com', name: 'CV. Muara Indah', company: 'CV. Muara Indah' },
  { email: 'cvtakababima@gmail.com', name: 'CV. Takaba Bima', company: 'CV. Takaba Bima' },
  { email: 'Cv.multikarya123@gmail.com', name: 'CV. Multi Karya', company: 'CV. Multi Karya' },
  { email: 'Luklokkentajaya.cv@gmail.com', name: 'CV. Luklok Kenta Jaya', company: 'CV. Luklok Kenta Jaya' },
  { email: 'yogautamakarya.cv@gmail.com', name: 'CV. Yoga Utama Karya', company: 'CV. Yoga Utama Karya' },
  { email: 'rccenter.cv@gmail.com', name: 'CV. RC Center', company: 'CV. RC Center' },
  
  // Other CVs (plain names)
  { email: 'abadigrouptunas@gmail.com', name: 'CV. Abadi Group Tunas', company: 'CV. Abadi Group Tunas' },
  { email: 'alifputerapratama@gmail.com', name: 'CV. Alif Putera Pratama', company: 'CV. Alif Putera Pratama' },
  { email: 'arbanrijaya@gmail.com', name: 'CV. Arban Rijaya', company: 'CV. Arban Rijaya' },
  { email: 'berkahmakmur_cvsubang@yahoo.com', name: 'CV. Berkah Makmur Subang', company: 'CV. Berkah Makmur Subang' },
  { email: 'ciptamakaryasukses@yahoo.com', name: 'CV. Cipta Makarya Sukses', company: 'CV. Cipta Makarya Sukses' },
  { email: 'daenghaji2020@gmail.com', name: 'CV. Daeng Haji', company: 'CV. Daeng Haji' },
  { email: 'hanjayabuana@gmail.com', name: 'CV. Hanjaya Buana', company: 'CV. Hanjaya Buana' },
  { email: 'heksasinergiberkah@yahoo.com', name: 'CV. Heksa Sinergi Berkah', company: 'CV. Heksa Sinergi Berkah' },
  { email: 'jowinsaranaoptima@gmail.com', name: 'CV. Jowin Sarana Optima', company: 'CV. Jowin Sarana Optima' },
  { email: 'laoda.mandiri@gmail.com', name: 'CV. Laoda Mandiri', company: 'CV. Laoda Mandiri' },
  { email: 'pangestujayajogja@gmail.com', name: 'CV. Pangestu Jaya Jogja', company: 'CV. Pangestu Jaya Jogja' },
  { email: 'pratamakaryamandiri89@gmail.com', name: 'CV. Pratama Karya Mandiri', company: 'CV. Pratama Karya Mandiri' },
  { email: 'putraanas_cv@yahoo.com', name: 'CV. Putra Anas', company: 'CV. Putra Anas' },
  { email: 'sambungrasasejati@gmail.com', name: 'CV. Sambung Rasa Sejati', company: 'CV. Sambung Rasa Sejati' },
  { email: 'zuldesril@yahoo.com', name: 'CV. Zuldesril', company: 'CV. Zuldesril' },
  { email: 'audmasud@gmail.com', name: 'CV. Aud Mas'ud', company: 'CV. Aud Mas'ud' },
  { email: 'kubang81@yahoo.com', name: 'CV. Kubang', company: 'CV. Kubang' },
  { email: 'jabubolon@yahoo.com', name: 'CV. Jabu Bolon', company: 'CV. Jabu Bolon' },
  { email: 'rich.tieglobal805@gmail.com', name: 'CV. Richtie Global', company: 'CV. Richtie Global' },
  
  // PT (Limited Liability) companies
  { email: 'ptadhibuanasejahtera@gmail.com', name: 'PT. Adhi Buana Sejahtera', company: 'PT. Adhi Buana Sejahtera' },
  { email: 'ptbaliintigroup@gmail.com', name: 'PT. Bali Inti Group', company: 'PT. Bali Inti Group' },
  { email: 'ptsuryasmd@gmail.com', name: 'PT. Surya SMD', company: 'PT. Surya SMD' },
  { email: 'pt.grahamustikamulya@ymail.com', name: 'PT. Graha Mustika Mulya', company: 'PT. Graha Mustika Mulya' },
  { email: 'marketing@ptremacon.com', name: 'PT. Remacon', company: 'PT. Remacon' },
  { email: 'mitratel@mitratel.co.id', name: 'PT. Mitratel', company: 'PT. Mitratel' },
  
  // Others / unspecified
  { email: 'borneokonstruksi@yahoo.com', name: 'Borneo Konstruksi', company: 'Borneo Konstruksi' },
  { email: 'info@navie.co.id', name: 'Navie Indonesia', company: 'Navie Indonesia' },
  { email: 'Putrapowerenergi1@gmail.com', name: 'Putra Power Energi', company: 'Putra Power Energi' },
  { email: 'yudhaadifura@gmail.com', name: 'Yudha Adifura', company: 'Yudha Adifura' },
  { email: 'saka.ms86@gmail.com', name: 'Saka MS', company: 'Saka MS' },
  { email: 'bukit.mas98@gmail.com', name: 'Bukit Mas', company: 'Bukit Mas' },
  { email: 'jojornapitupulu91@gmail.com', name: 'Jojo R. Napitupulu', company: 'Jojo R. Napitupulu' },
];

// Insert contacts
const checkDuplicate = db.prepare('SELECT id FROM mailing_list_contacts WHERE list_id = ? AND email = ? AND deleted_at IS NULL');
const insertContact = db.prepare('INSERT INTO mailing_list_contacts (list_id, email, name, company, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))');

let imported = 0;
let skipped = 0;

for (const c of contacts) {
  const dup = checkDuplicate.get(listId, c.email.toLowerCase().trim()) as { id: number } | undefined;
  if (dup) {
    console.log(`  ⏭️  Duplicate: ${c.email}`);
    skipped++;
    continue;
  }
  try {
    insertContact.run(listId, c.email.toLowerCase().trim(), c.name, c.company);
    imported++;
    console.log(`  ✅ ${c.email} → ${c.name}`);
  } catch (err: unknown) {
    console.log(`  ❌ Error: ${c.email} - ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Template: "${templateName}" (ID: ${templateId})`);
console.log(`   Mailing list: "${listName}" (ID: ${listId})`);
console.log(`   Contacts imported: ${imported}`);
console.log(`   Skipped: ${skipped}`);
console.log(`   Total in list: ${imported + db.prepare('SELECT COUNT(*) as c FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL').get(listId) as { c: number }).c}`);

db.close();
console.log('\n✅ Done!');
