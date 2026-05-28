#!/usr/bin/env python3
"""Seed dev database with realistic Indonesian demo data."""
import sqlite3
import random
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'kontraktor.dev.db')
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# ── Clear existing test data (keep admin) ──
admin_email = 'pulauberapi@gmail.com'
c.execute("DELETE FROM projects")
c.execute("DELETE FROM contractors")
c.execute("DELETE FROM users WHERE email != ?", (admin_email,))
conn.commit()

# ── Clients ──
clients = [
    ('Budi Hartono', 'budi.hartono@gmail.com', '081234567890', 'Jakarta'),
    ('Siti Rahayu', 'siti.rahayu@yahoo.com', '081345678901', 'Surabaya'),
    ('Agus Wibowo', 'agus.wibowo@outlook.com', '081567890123', 'Bandung'),
    ('Dewi Sari', 'dewi.sari@gmail.com', '081678901234', 'Yogyakarta'),
    ('Rizky Pratama', 'rizky.p@gmail.com', '081789012345', 'Semarang'),
    ('Maya Putri', 'maya.putri@gmail.com', '081890123456', 'Medan'),
    ('Hendra Kusuma', 'hendra.k@yahoo.com', '081901234567', 'Makassar'),
    ('Lestari Wulan', 'lestari.w@outlook.com', '081123456789', 'Denpasar'),
    ('Fajar Nugroho', 'fajar.n@gmail.com', '081223344556', 'Palembang'),
    ('Ratna Dewi', 'ratna.dewi@gmail.com', '081334455667', 'Malang'),
]

for name, email, phone, city in clients:
    c.execute("""INSERT INTO users (email, name, phone, role, is_verified)
                 VALUES (?, ?, ?, 'client', 1)""", (email, name, phone))

# ── Contractors ──
contractors = [
    ('Ahmad Fauzi', 'ahmad.fauzi@kontraktor.id', '082123456789', 8, 'Spesialis renovasi rumah tinggal. 8 tahun pengalaman di Jakarta dan sekitarnya.', 'apartment-renovation', 4.8, 23, 45, 1, 1),
    ('Bambang Sutejo', 'bambang.s@kontraktor.id', '082234567890', 12, 'Kontraktor umum dengan fokus bangunan komersial. Bersertifikat ISO.', 'construction', 4.6, 15, 32, 1, 1),
    ('Dewi Lestari', 'dewi.l@kontraktor.id', '082345678901', 5, 'Desain interior dan finishing. Portofolio lebih dari 50 proyek.', 'finishing', 4.9, 31, 58, 1, 1),
    ('Eko Purnomo', 'eko.p@kontraktor.id', '082456789012', 10, 'Spesialis instalasi listrik gedung bertingkat. Bersertifikat K3.', 'electrical-work', 4.7, 19, 37, 1, 1),
    ('Fitri Handayani', 'fitri.h@kontraktor.id', '082567890123', 3, 'Plumbing dan sanitasi. Melayani perumahan dan komersial.', 'plumbing', 4.5, 8, 15, 1, 1),
    ('Gilang Ramadhan', 'gilang.r@kontraktor.id', '082678901234', 6, 'Spesialis atap dan waterproofing. Garansi 5 tahun.', 'roofing', 4.4, 12, 22, 1, 1),
    ('Hesti Nurjanah', 'hesti.n@kontraktor.id', '082789012345', 4, 'Landscape dan taman. Desain tropis untuk villa dan resort.', 'landscaping', 4.8, 17, 28, 1, 1),
    ('Indra Wijaya', 'indra.w@kontraktor.id', '082890123456', 15, 'Kontraktor sipil. Jalan, jembatan, drainase. Pengalaman pemerintah.', 'construction', 4.3, 9, 18, 1, 1),
    ('Joko Susilo', 'joko.s@kontraktor.id', '082901234567', 7, 'Pembongkaran dan demolisi. Peralatan berat lengkap.', 'demolition', 4.2, 6, 12, 1, 1),
    ('Kartika Putri', 'kartika.p@kontraktor.id', '082112233445', 9, 'Fasad dan cladding. ACP, curtain wall, kaca tempered.', 'facade', 4.6, 14, 26, 1, 1),
]

for name, email, phone, exp, bio, spec, rating, revs, comp, verified, approved in contractors:
    c.execute("""INSERT INTO contractors
                 (email, name, phone, experience, bio, specialty, rating, reviews_count,
                  completed_projects, is_verified, is_approved, is_active, credits)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 10)""",
              (email, name, phone, exp, bio, spec, rating, revs, comp, verified, approved))

# ── Projects ──
projects = [
    # title, desc, category, client_email, contractor_idx (None=unassigned), status, budget, district, contact_name, phone
    ('Renovasi Rumah Menteng', 'Renovasi total rumah tua 2 lantai di Menteng. Ganti keramik, cat ulang, perbaiki atap bocor.', 'apartment-renovation', 'budi.hartono@gmail.com', 0, 'completed', '185000000', 'Jakarta Pusat', 'Budi Hartono', '081234567890'),
    ('Pasang Listrik Ruko Baru', 'Instalasi listrik 3 lantai ruko di Glodok. 2200VA per lantai, MCB, grounding.', 'electrical-work', 'budi.hartono@gmail.com', 3, 'in_progress', '42000000', 'Jakarta Barat', 'Budi Hartono', '081234567890'),
    ('Desain Interior Apartemen', 'Desain dan renovasi interior apartemen 2BR di Surabaya. Minimalis modern.', 'finishing', 'siti.rahayu@yahoo.com', 2, 'in_progress', '95000000', 'Surabaya', 'Siti Rahayu', '081345678901'),
    ('Bangun Rumah Baru Cimahi', 'Pembangunan rumah tinggal 1.5 lantai di Cimahi. Luas tanah 150m2, bangunan 120m2.', 'construction', 'agus.wibowo@outlook.com', 1, 'in_progress', '450000000', 'Bandung', 'Agus Wibowo', '081567890123'),
    ('Perbaikan Atap Bocor', 'Atap rumah bocor di 3 titik. Ganti genteng, tambah waterproofing.', 'roofing', 'dewi.sari@gmail.com', 5, 'completed', '28000000', 'Yogyakarta', 'Dewi Sari', '081678901234'),
    ('Taman Minimalis Bali Style', 'Buat taman depan dan belakang rumah. Kolam ikan, batu alam, tanaman tropis.', 'landscaping', 'dewi.sari@gmail.com', 6, 'completed', '65000000', 'Yogyakarta', 'Dewi Sari', '081678901234'),
    ('Gudang Logistik Semarang', 'Pembangunan gudang 500m2. Struktur baja, lantai hardener, loading dock.', 'construction', 'rizky.p@gmail.com', 1, 'pending', '380000000', 'Semarang', 'Rizky Pratama', '081789012345'),
    ('Renovasi Kamar Mandi', 'Renovasi 2 kamar mandi. Ganti closet, shower, keramik dinding dan lantai.', 'plumbing', 'rizky.p@gmail.com', 4, 'in_progress', '35000000', 'Semarang', 'Rizky Pratama', '081789012345'),
    ('Fasad Ruko 2 Lantai', 'Pasang ACP panel untuk ruko 2 lantai. Warna silver dan biru dongker.', 'facade', 'maya.putri@gmail.com', 9, 'pending', '120000000', 'Medan', 'Maya Putri', '081890123456'),
    ('Perbaikan Jalan Desa', 'Perbaikan jalan desa sepanjang 500m. Cor beton tebal 15cm, drainase kiri-kanan.', 'construction', 'maya.putri@gmail.com', 7, 'completed', '275000000', 'Medan', 'Maya Putri', '081890123456'),
    ('Demolisi Bangunan Tua', 'Bongkar bangunan eks pabrik seluas 800m2. Termasuk buang puing.', 'demolition', 'hendra.k@yahoo.com', 8, 'completed', '95000000', 'Makassar', 'Hendra Kusuma', '081901234567'),
    ('Renovasi Villa Sanur', 'Renovasi villa 3 kamar tidur di Sanur. Tambah kolam renang, upgrade AC.', 'apartment-renovation', 'lestari.w@outlook.com', 0, 'in_progress', '320000000', 'Denpasar', 'Lestari Wulan', '081123456789'),
    ('Instalasi Listrik Hotel', 'Upgrade instalasi listrik hotel 4 lantai. Ganti kabel, MCB, genset backup.', 'electrical-work', 'lestari.w@outlook.com', 3, 'pending', '180000000', 'Denpasar', 'Lestari Wulan', '081123456789'),
    ('Kolam Renang Palembang', 'Bangun kolam renang 8x4m di belakang rumah. Sistem filter, lampu underwater.', 'construction', 'fajar.n@gmail.com', 1, 'pending', '150000000', 'Palembang', 'Fajar Nugroho', '081223344556'),
    ('Cat Eksterior Rumah', 'Cat ulang seluruh eksterior rumah 2 lantai. Primer + 2 lapis cat Dulux.', 'apartment-renovation', 'fajar.n@gmail.com', None, 'pending', '18000000', 'Palembang', 'Fajar Nugroho', '081223344556'),
    ('Renovasi Dapur Modern', 'Renovasi dapur lengkap. Kitchen set, granit tabletop, instalasi gas dan air.', 'finishing', 'ratna.dewi@gmail.com', 2, 'in_progress', '78000000', 'Malang', 'Ratna Dewi', '081334455667'),
    ('Ganti Pipa Air Bersih', 'Ganti seluruh pipa air bersih rumah. Pipa PPR, termasuk toren dan pompa.', 'plumbing', 'ratna.dewi@gmail.com', 4, 'completed', '22000000', 'Malang', 'Ratna Dewi', '081334455667'),
    ('Pagar dan Kanopi', 'Buat pagar besi tempa + kanopi carport 2 mobil. Cat anti karat.', 'construction', 'budi.hartono@gmail.com', 1, 'pending', '55000000', 'Jakarta Selatan', 'Budi Hartono', '081234567890'),
    ('Waterproofing Dak Beton', 'Waterproofing dak beton atap 200m2. Sistem membrane torching.', 'roofing', 'siti.rahayu@yahoo.com', 5, 'completed', '48000000', 'Surabaya', 'Siti Rahayu', '081345678901'),
    ('Taman Rooftop Kantor', 'Desain dan buat taman rooftop 100m2. Sistem drainase, tanaman pot, decking kayu.', 'landscaping', 'agus.wibowo@outlook.com', 6, 'in_progress', '110000000', 'Bandung', 'Agus Wibowo', '081567890123'),
    ('Bongkar Pasang Keramik', 'Bongkar keramik lama, pasang keramik baru granit tile 60x60 seluruh rumah.', 'demolition', 'rizky.p@gmail.com', 8, 'pending', '45000000', 'Semarang', 'Rizky Pratama', '081789012345'),
    ('Curtain Wall Kantor', 'Pasang curtain wall kaca untuk gedung kantor 3 lantai. Kaca Low-E 10mm.', 'facade', 'maya.putri@gmail.com', 9, 'in_progress', '290000000', 'Medan', 'Maya Putri', '081890123456'),
    ('Jalan Perumahan Cluster', 'Buat jalan perumahan cluster 300m. Beton ready mix, saluran air.', 'construction', 'hendra.k@yahoo.com', 7, 'pending', '420000000', 'Makassar', 'Hendra Kusuma', '081901234567'),
    ('Renovasi Kost 10 Kamar', 'Renovasi kost 10 kamar. AC, water heater, keramik, cat. Tipe premium.', 'apartment-renovation', 'lestari.w@outlook.com', 0, 'pending', '280000000', 'Denpasar', 'Lestari Wulan', '081123456789'),
    ('Upgrade Panel Listrik', 'Upgrade panel listrik dari 2200VA ke 5500VA. Ganti kabel utama, MCB.', 'electrical-work', 'fajar.n@gmail.com', 3, 'completed', '15000000', 'Palembang', 'Fajar Nugroho', '081223344556'),
]

for title, desc, cat, client_email, contr_idx, status, budget, district, contact, phone in projects:
    contr_id = None
    if contr_idx is not None:
        # Get contractor ID by email
        contr_email = contractors[contr_idx][1]
        c.execute("SELECT id FROM contractors WHERE email = ?", (contr_email,))
        row = c.fetchone()
        if row:
            contr_id = row[0]

    c.execute("""INSERT INTO projects
                 (title, description, category, client_email, assigned_contractor_id,
                  status, budget, district, contact_name, contact_phone)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
              (title, desc, cat, client_email, contr_id, status, budget, district, contact, phone))

conn.commit()

# ── Summary ──
c.execute("SELECT COUNT(*) FROM users WHERE role='client'")
n_clients = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM contractors")
n_contractors = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM projects")
n_projects = c.fetchone()[0]
c.execute("SELECT status, COUNT(*) FROM projects GROUP BY status ORDER BY status")
status_counts = c.fetchall()
c.execute("SELECT COUNT(*) FROM projects WHERE assigned_contractor_id IS NULL")
n_unassigned = c.fetchone()[0]

print(f"✅ Demo data seeded!")
print(f"   Clients: {n_clients}")
print(f"   Contractors: {n_contractors}")
print(f"   Projects: {n_projects}")
for s, cnt in status_counts:
    print(f"     - {s}: {cnt}")
print(f"   Unassigned: {n_unassigned}")

conn.close()
