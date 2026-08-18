// ── Service category deep-dive content (FAQ + price guide) ──
// Bilingual (id/en). Kept here (not in EJS) to satisfy lint:hardcode.
// Values are realistic Indonesian market estimates (Jakarta/Bali), not quotes.

export interface ServiceFaq {
  qId: string;
  qEn: string;
  aId: string;
  aEn: string;
}

export interface ServicePriceItem {
  labelId: string;
  labelEn: string;
  rangeId: string;
  rangeEn: string;
}

export interface ServiceContent {
  faqs: ServiceFaq[];
  priceGuide: ServicePriceItem[];
  priceNoteId: string;
  priceNoteEn: string;
}

const apartmentRenovation: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya renovasi apartemen 2 kamar di Jakarta?',
      qEn: 'How much does it cost to renovate a 2-bedroom apartment in Jakarta?',
      aId: 'Estimasi renovasi apartemen 2 kamar di Jakarta berkisar Rp 80 juta–Rp 250 juta, tergantung luas unit, kualitas material, dan tingkat perubahan tata ruang. Renovasi ringan (cat, lantai, lighting) biasanya di bawah Rp 100 juta, sementara renovasi struktural dengan perombakan kamar mandi dan dapur menyentuh Rp 200 juta ke atas.',
      aEn: 'A 2-bedroom apartment renovation in Jakarta typically runs Rp 80M–Rp 250M depending on unit size, material quality, and layout changes. Light work (paint, flooring, lighting) stays under Rp 100M, while structural changes with bathroom and kitchen remodels reach Rp 200M and above.',
    },
    {
      qId: 'Apakah saya perlu izin untuk renovasi apartemen?',
      qEn: 'Do I need a permit to renovate an apartment?',
      aId: 'Sebagian besar apartemen mewajibkan surat permohonan renovasi ke pengelola gedung (PPPSRS) dan deposit kerusakan. Izin bangunan (PBG/IMB) umumnya tidak diperlukan untuk renovasi internal tanpa mengubah struktur, namun selalu konfirmasi ke manajemen gedung sebelum memulai.',
      aEn: 'Most apartments require a renovation application to building management (PPPSRS) plus a damage deposit. A building permit (PBG/IMB) is generally not needed for internal renovations that do not alter structure, but always confirm with management before starting.',
    },
    {
      qId: 'Berapa lama waktu renovasi apartemen?',
      qEn: 'How long does an apartment renovation take?',
      aId: 'Renovasi ringan selesai dalam 2–4 minggu. Renovasi menyeluruh dengan perombakan kamar mandi dan dapur biasanya 6–10 minggu, termasuk waktu pengeringan material dan pemeriksaan akhir manajemen gedung.',
      aEn: 'Light renovations finish in 2–4 weeks. A full remodel with bathroom and kitchen rebuilds usually takes 6–10 weeks, including material curing time and final building-management inspection.',
    },
    {
      qId: 'Bagaimana memilih kontraktor apartemen yang tepat?',
      qEn: 'How do I choose the right apartment contractor?',
      aId: 'Pilih kontraktor dengan portofolio proyek serupa di gedung sejenis, surat kontrak tertulis, dan jadwal pembayaran bertahap (bukan lunas di awal). Pastikan ada garansi pekerjaan minimal 3–6 bulan untuk kebocoran dan retak.',
      aEn: 'Choose a contractor with a portfolio of similar projects in comparable buildings, a written contract, and staged payments (not full upfront). Insist on at least a 3–6 month workmanship warranty covering leaks and cracks.',
    },
  ],
  priceGuide: [
    { labelId: 'Cat dinding & plafon (per m²)', labelEn: 'Wall & ceiling paint (per m²)', rangeId: 'Rp 25.000–Rp 45.000', rangeEn: 'Rp 25,000–Rp 45,000' },
    { labelId: 'Pasang keramik lantai (per m²)', labelEn: 'Floor tile installation (per m²)', rangeId: 'Rp 80.000–Rp 150.000', rangeEn: 'Rp 80,000–Rp 150,000' },
    { labelId: 'Renovasi kamar mandi lengkap', labelEn: 'Full bathroom remodel', rangeId: 'Rp 15 juta–Rp 45 juta', rangeEn: 'Rp 15M–Rp 45M' },
    { labelId: 'Renovasi dapur (kabinet + countertop)', labelEn: 'Kitchen remodel (cabinet + countertop)', rangeId: 'Rp 12 juta–Rp 40 juta', rangeEn: 'Rp 12M–Rp 40M' },
  ],
  priceNoteId: 'Harga di atas adalah estimasi pasar Jabodetabek per 2026 dan dapat berbeda tergantung merek material dan aksesibilitas unit.',
  priceNoteEn: 'The prices above are 2026 Jabodetabek market estimates and may vary by material brand and unit accessibility.',
};

const roofing: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya pasang atap rumah tingkat?',
      qEn: 'How much does it cost to install a roof on a house?',
      aId: 'Pemasangan atap rumah 1 lantai berkisar Rp 150.000–Rp 400.000 per m² termasuk rangka baja ringan dan genteng. Total untuk rumah tipe 36–45 umumnya Rp 25 juta–Rp 60 juta. Atap metal deck atau sirap lebih mahal namun lebih awet.',
      aEn: 'Roofing a single-story house runs Rp 150,000–Rp 400,000 per m² including lightweight steel framing and tiles. A 36–45 type house typically totals Rp 25M–Rp 60M. Metal deck or shingle roofs cost more but last longer.',
    },
    {
      qId: 'Genteng atau metal roof mana yang lebih baik untuk iklim tropis?',
      qEn: 'Are tiles or metal roofs better for tropical climate?',
      aId: 'Genteng tanah liat tetap populer karena teduh dan estetis, namun butuh rangka kuat. Atap metal (zincalume) lebih ringan, tahan karat, dan cepat dipasang, cocok untuk area rawan bocor. Pilih berdasarkan anggaran dan desain rumah.',
      aEn: 'Clay tiles remain popular for their cool feel and look but need a strong frame. Metal roofs (zincalume) are lighter, rust-resistant, and fast to install — good for leak-prone areas. Choose based on budget and home design.',
    },
    {
      qId: 'Bagaimana cara mendeteksi kebocoran atap?',
      qEn: 'How do I detect a roof leak?',
      aId: 'Tanda umum: noda basah di plafon saat hujan, cat mengelupas, dan lumut di area tertentu. Periksa sambungan genteng, talang, dan seal ventilasi. Penanganan cepat mencegah kerusakan struktur dan jamur.',
      aEn: 'Common signs: damp ceiling stains during rain, peeling paint, and moss in patches. Check tile joints, gutters, and vent seals. Prompt repair prevents structural damage and mold.',
    },
    {
      qId: 'Berapa umur atap rumah?',
      qEn: 'What is the lifespan of a roof?',
      aId: 'Genteng tanah liat bertahan 20–30 tahun dengan perawatan. Atap metal zincalume 15–25 tahun. Rangka baja ringan hingga 30 tahun. Inspeksi tahunan membantu mendeteksi kerusakan sebelum meluas.',
      aEn: 'Clay tiles last 20–30 years with care. Zincalume metal roofs 15–25 years. Lightweight steel framing up to 30 years. Annual inspection catches damage before it spreads.',
    },
  ],
  priceGuide: [
    { labelId: 'Rangka baja ringan (per m²)', labelEn: 'Light steel framing (per m²)', rangeId: 'Rp 120.000–Rp 200.000', rangeEn: 'Rp 120,000–Rp 200,000' },
    { labelId: 'Genteng tanah liat (per m²)', labelEn: 'Clay tile (per m²)', rangeId: 'Rp 45.000–Rp 90.000', rangeEn: 'Rp 45,000–Rp 90,000' },
    { labelId: 'Atap metal zincalume (per m²)', labelEn: 'Zincalume metal roof (per m²)', rangeId: 'Rp 90.000–Rp 180.000', rangeEn: 'Rp 90,000–Rp 180,000' },
    { labelId: 'Talang & sistem drainase', labelEn: 'Gutters & drainage', rangeId: 'Rp 3 juta–Rp 12 juta', rangeEn: 'Rp 3M–Rp 12M' },
  ],
  priceNoteId: 'Estimasi berlaku untuk rumah standar di Jabodetabek; atap dengan kemiringan ekstrem atau akses sulit membutuhkan biaya tambahan.',
  priceNoteEn: 'Estimates apply to standard Jabodetabek homes; steep slopes or difficult access add extra cost.',
};

const electricalWork: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa tarif tukang listrik per titik?',
      qEn: 'What is the electrician rate per point?',
      aId: 'Pemasangan titik listrik baru umumnya Rp 150.000–Rp 350.000 per titik, tergantung jenis kabel dan kerumitan. Instalasi panel listrik (MCB) dan grounding dibanderol terpisah, biasanya Rp 2 juta–Rp 6 juta.',
      aEn: 'New electrical points typically cost Rp 150,000–Rp 350,000 each, depending on cable type and complexity. Panel (MCB) and grounding installation are quoted separately, usually Rp 2M–Rp 6M.',
    },
    {
      qId: 'Kapan harus menambah daya listrik (VA)?',
      qEn: 'When should I upgrade my power capacity (VA)?',
      aId: 'Jika MCB sering turun (trip) saat menyalakan AC atau kompor listrik bersamaan, waktunya naik daya. Rumah tangga dengan 2–3 AC biasanya butuh 4.400 VA ke atas. Ajukan ke PLN melalui aplikasi atau mitra resmi.',
      aEn: 'If the MCB trips when running AC or an electric stove together, it is time to upgrade. Homes with 2–3 AC units usually need 4,400 VA or more. Apply via the PLN app or an authorized partner.',
    },
    {
      qId: 'Apakah instalasi listrik butuh Sertifikat Laik Operasi (SLO)?',
      qEn: 'Does electrical installation need a Certificate of Operational Worthiness (SLO)?',
      aId: 'Ya, untuk instalasi baru atau perubahan daya di atas 4.400 VA, SLO wajib dikeluarkan oleh lembaga inspeksi PLN. Ini penting untuk keamanan dan klaim asuransi. Tukang listrik profesional akan mengurus prosesnya.',
      aEn: 'Yes — for new installations or capacity changes above 4,400 VA, an SLO from a PLN inspection body is mandatory. It matters for safety and insurance claims. A professional electrician will handle the process.',
    },
    {
      qId: 'Bagaimana mendeteksi kabel rusak berbahaya?',
      qEn: 'How do I spot dangerous faulty wiring?',
      aId: 'Tanda bahaya: kabel panas saat disentuh, bau terbakar, lampu berkedip, dan MCB sering trip. Jangan tunda — hubungi tukang listrik bersertifikat untuk inspeksi guna mencegah kebakaran.',
      aEn: 'Warning signs: wires warm to the touch, burnt smell, flickering lights, and frequent MCB trips. Do not delay — call a certified electrician for inspection to prevent fire.',
    },
  ],
  priceGuide: [
    { labelId: 'Titik stop kontak baru', labelEn: 'New outlet point', rangeId: 'Rp 150.000–Rp 300.000', rangeEn: 'Rp 150,000–Rp 300,000' },
    { labelId: 'Titik lampu (inkl. kabel)', labelEn: 'Light point (incl. cable)', rangeId: 'Rp 120.000–Rp 250.000', rangeEn: 'Rp 120,000–Rp 250,000' },
    { labelId: 'Panel MCB + grounding', labelEn: 'MCB panel + grounding', rangeId: 'Rp 2 juta–Rp 6 juta', rangeEn: 'Rp 2M–Rp 6M' },
    { labelId: 'Naik daya ke PLN (4.400 VA)', labelEn: 'PLN capacity upgrade (4,400 VA)', rangeId: 'Rp 3 juta–Rp 8 juta', rangeEn: 'Rp 3M–Rp 8M' },
  ],
  priceNoteId: 'Harga belum termasuk material premium (kabel tahan api, MCB merek ternama) yang disarankan untuk keamanan jangka panjang.',
  priceNoteEn: 'Prices exclude premium materials (fire-rated cable, branded MCB) recommended for long-term safety.',
};

const construction: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya membangun rumah 1 lantai per m²?',
      qEn: 'How much does it cost to build a single-story house per m²?',
      aId: 'Biaya konstruksi rumah tinggal standar di Jabodetabek berkisar Rp 4 juta–Rp 7 juta per m² (material + upah). Rumah mewah dengan finishing tinggi mencapai Rp 10 juta–Rp 15 juta per m². Harga belum termasuk desain arsitek dan izin.',
      aEn: 'Standard residential construction in Jabodetabek runs Rp 4M–Rp 7M per m² (materials + labor). Premium homes with high-end finishing reach Rp 10M–Rp 15M per m². Excludes architectural design and permits.',
    },
    {
      qId: 'Apakah kontraktor atau borongan lebih murah?',
      qEn: 'Is a contractor or a daily-labor team cheaper?',
      aId: 'Kontraktor (borongan) memberikan harga paket dengan jaminan waktu dan kualitas, cocok untuk pemilik yang sibuk. Sistem harian (tukang harian) bisa lebih murah untuk proyek kecil, namun Anda yang mengurus material dan koordinasi — risiko molornya jadwal lebih tinggi.',
      aEn: 'A contractor (lump-sum) gives a packaged price with time and quality guarantees — ideal for busy owners. Daily labor can be cheaper for small jobs, but you handle materials and coordination, with higher risk of delays.',
    },
    {
      qId: 'Berapa lama waktu bangun rumah 1 lantai?',
      qEn: 'How long does it take to build a single-story house?',
      aId: 'Rumah tipe 36–70 umumnya selesai dalam 3–5 bulan untuk rangka dan finishing standar. Faktor cuaca, kelancaran pasokan material, dan perizinan dapat menambah waktu.',
      aEn: 'A 36–70 type house typically finishes in 3–5 months for structural and standard finishing. Weather, material supply, and permits can add time.',
    },
    {
      qId: 'Dokumen apa yang diperlukan sebelum membangun?',
      qEn: 'What documents are needed before building?',
      aId: 'Anda membutuhkan IMB/PBG (Izin Mendirikan Bangunan), sertifikat tanah, dan gambar kerja arsitek. Untuk lahan di perumahan, ikuti juga ketentuan pengembang setempat.',
      aEn: 'You need a PBG/IMB (Building Permit), land certificate, and architect drawings. In planned communities, follow the developer’s local rules too.',
    },
  ],
  priceGuide: [
    { labelId: 'Konstruksi standar (per m²)', labelEn: 'Standard construction (per m²)', rangeId: 'Rp 4 juta–Rp 7 juta', rangeEn: 'Rp 4M–Rp 7M' },
    { labelId: 'Konstruksi menengah (per m²)', labelEn: 'Mid-range construction (per m²)', rangeId: 'Rp 7 juta–Rp 10 juta', rangeEn: 'Rp 7M–Rp 10M' },
    { labelId: 'Finishing mewah (per m²)', labelEn: 'Luxury finishing (per m²)', rangeId: 'Rp 10 juta–Rp 15 juta', rangeEn: 'Rp 10M–Rp 15M' },
    { labelId: 'Desain arsitek (per m² lantai)', labelEn: 'Architect design (per floor m²)', rangeId: 'Rp 150.000–Rp 500.000', rangeEn: 'Rp 150,000–Rp 500,000' },
  ],
  priceNoteId: 'Estimasi berlaku untuk konstruksi residensial Jabodetabek per 2026; lahan dengan kontur sulit atau akses terbatas membutuhkan biaya tambahan.',
  priceNoteEn: 'Estimates apply to 2026 Jabodetabek residential construction; difficult terrain or limited access adds cost.',
};

const plumbing: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya pasang instalasi pipa air bersih?',
      qEn: 'How much does clean water pipe installation cost?',
      aId: 'Pemasangan pipa air bersih untuk rumah standar berkisar Rp 8 juta–Rp 20 juta, tergantung jumlah titik dan merek pipa (PVC vs PPR). Penggantian pipa bocor per titik sekitar Rp 300.000–Rp 800.000.',
      aEn: 'Clean water piping for a standard house runs Rp 8M–Rp 20M depending on points and pipe brand (PVC vs PPR). Replacing a leaking pipe per point is about Rp 300,000–Rp 800,000.',
    },
    {
      qId: 'Kenapa air sering macet atau tekanan rendah?',
      qEn: 'Why is water often blocked or low pressure?',
      aId: 'Penyebab umum: pipa terlalu kecil, endapan karat, atau tangki terlalu rendah. Solusinya bisa menaikkan tangki, menambah pompa, atau mengganti pipa ke diameter lebih besar.',
      aEn: 'Common causes: undersized pipe, rust buildup, or a low tank. Fixes include raising the tank, adding a pump, or upsizing the pipe diameter.',
    },
    {
      qId: 'Kapan harus memasang water heater?',
      qEn: 'When should I install a water heater?',
      aId: 'Pasang water heater saat renovasi kamar mandi agar instalasi listrik dan pipa tersusun rapi. Pilih model tankless (hemat ruang) atau tangki, sesuaikan daya listrik rumah.',
      aEn: 'Install the water heater during bathroom renovation so electrical and piping layout stays neat. Choose tankless (space-saving) or tank models matched to your power capacity.',
    },
    {
      qId: 'Bagaimana mencegah kebocoran pipa tersembunyi?',
      qEn: 'How do I prevent leaks in concealed pipes?',
      aId: 'Gunakan pipa berkualitas dengan garansi, hindari sambungan di dalam dinding bila memungkinkan, dan lakukan tes tekanan sebelum penutupan dinding. Deteksi dini dengan alat pendingin (thermal) mencegah kerusakan luas.',
      aEn: 'Use warranted quality pipe, avoid joints inside walls where possible, and pressure-test before closing walls. Early detection with thermal tools prevents major damage.',
    },
  ],
  priceGuide: [
    { labelId: 'Instalasi pipa air bersih (rumah)', labelEn: 'Clean water piping (house)', rangeId: 'Rp 8 juta–Rp 20 juta', rangeEn: 'Rp 8M–Rp 20M' },
    { labelId: 'Ganti pipa bocor (per titik)', labelEn: 'Leak repair (per point)', rangeId: 'Rp 300.000–Rp 800.000', rangeEn: 'Rp 300,000–Rp 800,000' },
    { labelId: 'Pasang water heater', labelEn: 'Water heater install', rangeId: 'Rp 1,5 juta–Rp 5 juta', rangeEn: 'Rp 1.5M–Rp 5M' },
    { labelId: 'Instalasi saluran air kotor', labelEn: 'Drainage/waste line', rangeId: 'Rp 5 juta–Rp 15 juta', rangeEn: 'Rp 5M–Rp 15M' },
  ],
  priceNoteId: 'Harga tergantung merek pipa dan aksesibilitas area kamar mandi atau dapur.',
  priceNoteEn: 'Prices depend on pipe brand and accessibility of bathroom or kitchen areas.',
};

const finishing: ServiceContent = {
  faqs: [
    {
      qId: 'Apa saja tahapan finishing rumah?',
      qEn: 'What are the stages of home finishing?',
      aId: 'Tahapan umum: plesteran & aci, pengecatan, pemasangan lantai (keramik/kayu), plafon, keramik dinding kamar mandi/dapur, dan instalasi pintu serta lemari bawaan. Urutan penting agar hasil rapi.',
      aEn: 'Common stages: plastering and skim coat, painting, flooring (tile/wood), ceiling, bathroom/kitchen wall tiles, then doors and built-in cabinets. Order matters for a clean result.',
    },
    {
      qId: 'Cat apa yang bagus untuk iklim tropis lembap?',
      qEn: 'What paint suits humid tropical climate?',
      aId: 'Gunakan cat dinding anti-lembap (waterproof) untuk area kamar mandi dan dapur, serta cat eksterior tahan jamur dan UV. Warna terang membantu ruangan terasa lebih sejuk dan luas.',
      aEn: 'Use moisture-resistant (waterproof) paint for bathrooms and kitchens, plus exterior paint that resists mold and UV. Light colors make rooms feel cooler and larger.',
    },
    {
      qId: 'Berapa biaya pasang keramik dinding?',
      qEn: 'How much does wall tile installation cost?',
      aId: 'Pemasangan keramik dinding umumnya Rp 80.000–Rp 150.000 per m² termasuk semen dan tenaga. Motif atau ukuran besar (grand tile) membutuhkan keahlian lebih dan biaya tambahan.',
      aEn: 'Wall tile installation is generally Rp 80,000–Rp 150,000 per m² including adhesive and labor. Patterns or large-format tiles need more skill and cost more.',
    },
    {
      qId: 'Bagaimana memilih lantai yang awet?',
      qEn: 'How do I choose a durable floor?',
      aId: 'Untuk area basah pilih keramik anti-selip. Untuk ruang tamu, keramik homogeneous atau vinyl tahan gores. Kayu solid estetis namun butuh perawatan rutin di iklim lembap.',
      aEn: 'For wet areas choose slip-resistant tile. For living rooms, homogeneous tile or scratch-resistant vinyl. Solid wood looks great but needs regular care in humid climates.',
    },
  ],
  priceGuide: [
    { labelId: 'Pengecatan dinding (per m²)', labelEn: 'Wall painting (per m²)', rangeId: 'Rp 25.000–Rp 45.000', rangeEn: 'Rp 25,000–Rp 45,000' },
    { labelId: 'Pasang keramik dinding (per m²)', labelEn: 'Wall tile (per m²)', rangeId: 'Rp 80.000–Rp 150.000', rangeEn: 'Rp 80,000–Rp 150,000' },
    { labelId: 'Plafon gypsum (per m²)', labelEn: 'Gypsum ceiling (per m²)', rangeId: 'Rp 120.000–Rp 250.000', rangeEn: 'Rp 120,000–Rp 250,000' },
    { labelId: 'Lantai vinyl (per m²)', labelEn: 'Vinyl flooring (per m²)', rangeId: 'Rp 150.000–Rp 400.000', rangeEn: 'Rp 150,000–Rp 400,000' },
  ],
  priceNoteId: 'Harga finishing sangat variatif tergantung merek material dan tingkat kerumitan pola.',
  priceNoteEn: 'Finishing prices vary widely by material brand and pattern complexity.',
};

const facade: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya pasang batu alam atau wall cladding?',
      qEn: 'How much does natural stone or wall cladding cost?',
      aId: 'Pemasangan batu alam (andesit, palimanan) sekitar Rp 250.000–Rp 500.000 per m² termasuk pemasangan. Wall cladding semen/bata ekspos lebih murah, Rp 120.000–Rp 250.000 per m².',
      aEn: 'Natural stone (andesite, palimanan) installation is about Rp 250,000–Rp 500,000 per m² installed. Exposed cement/brick cladding is cheaper at Rp 120,000–Rp 250,000 per m².',
    },
    {
      qId: 'Apakah fasad butuh perawatan khusus?',
      qEn: 'Does a facade need special maintenance?',
      aId: 'Batu alam butuh coating anti-noda dan pembersihan berkala agar tidak berlumut di iklim lembap. Cat fasad eksterior perlu diulang tiap 4–6 tahun.',
      aEn: 'Natural stone needs stain-proof coating and periodic cleaning to avoid moss in humid climates. Exterior paint should be refreshed every 4–6 years.',
    },
    {
      qId: 'Bagaimana membuat fasad tahan cuaca?',
      qEn: 'How do I make a weather-resistant facade?',
      aId: 'Pilih material dengan daya serap air rendah, beri water repellent, dan pastikan talang serta drainage membuang air dengan baik. Desain atap menjorok (overhang) melindungi dinding dari hujan langsung.',
      aEn: 'Choose low-water-absorption materials, apply water repellent, and ensure gutters and drainage work. A roof overhang protects walls from direct rain.',
    },
    {
      qId: 'Bolehkah mengubah tampilan fasad rumah di perumahan?',
      qEn: 'Can I change my facade look in a housing estate?',
      aId: 'Di perumahan tertentu ada aturan estetika (color bond, tinggi pagar, bentuk atap). Konsultasikan ke pengembang atau RT sebelum mengubah fasad agar tidak melanggar ketentuan.',
      aEn: 'Some estates enforce aesthetics rules (color bond, fence height, roof shape). Check with the developer or neighborhood association before changing the facade.',
    },
  ],
  priceGuide: [
    { labelId: 'Batu alam andesit (per m²)', labelEn: 'Andesite natural stone (per m²)', rangeId: 'Rp 250.000–Rp 500.000', rangeEn: 'Rp 250,000–Rp 500,000' },
    { labelId: 'Cladding ekspos (per m²)', labelEn: 'Exposed cladding (per m²)', rangeId: 'Rp 120.000–Rp 250.000', rangeEn: 'Rp 120,000–Rp 250,000' },
    { labelId: 'Cat fasad anti-cuaca (per m²)', labelEn: 'Weatherproof facade paint (per m²)', rangeId: 'Rp 35.000–Rp 70.000', rangeEn: 'Rp 35,000–Rp 70,000' },
    { labelId: 'Coating anti-noda (per m²)', labelEn: 'Stain-proof coating (per m²)', rangeId: 'Rp 40.000–Rp 90.000', rangeEn: 'Rp 40,000–Rp 90,000' },
  ],
  priceNoteId: 'Harga fasad sangat tergantung jenis batu dan kerumitan pola pemasangan.',
  priceNoteEn: 'Facade prices depend heavily on stone type and installation pattern complexity.',
};

const landscaping: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya taman rumah minimalis?',
      qEn: 'How much does a minimalist home garden cost?',
      aId: 'Taman minimalis depan rumah umumnya Rp 5 juta–Rp 20 juta, tergantung luas, jenis tanaman, dan elemen seperti kolam kecil atau gazebo. Taman vertikal atau rooftop butuh desain khusus.',
      aEn: 'A front minimalist garden typically runs Rp 5M–Rp 20M depending on area, plant types, and features like a small pond or gazebo. Vertical or rooftop gardens need special design.',
    },
    {
      qId: 'Tanaman apa yang cocok untuk iklim tropis?',
      qEn: 'Which plants suit the tropical climate?',
      aId: 'Pilih tanaman keras seperti sansevieria, pisang hias, dan palm mini yang tahan panas dan minim perawatan. Tambahkan rumput jepang atau moss untuk kesan sejuk.',
      aEn: 'Choose hardy plants like sansevieria, ornamental banana, and mini palms that tolerate heat and need little care. Add Japanese grass or moss for a cooler feel.',
    },
    {
      qId: 'Perlukah sistem irigasi otomatis?',
      qEn: 'Do I need an automatic irrigation system?',
      aId: 'Untuk taman luas, irigasi otomatis (drip/timer) menghemat waktu dan menjaga tanaman tetap sehat saat Anda beraktivitas. Untuk taman kecil, penyiraman manual cukup.',
      aEn: 'For large gardens, automatic irrigation (drip/timer) saves time and keeps plants healthy. Small gardens are fine with manual watering.',
    },
    {
      qId: 'Bagaimana mencegah genangan air di taman?',
      qEn: 'How do I prevent water pooling in the garden?',
      aId: 'Buat kemiringan tanah ke arah drainase, gunakan tanah porus, dan pasang saluran air (drainase) tertutup. Hindari menutup seluruh area dengan beton agar air meresap.',
      aEn: 'Slope soil toward drainage, use porous soil, and install covered drains. Avoid fully concrete coverage so water can absorb.',
    },
  ],
  priceGuide: [
    { labelId: 'Taman minimalis (per m²)', labelEn: 'Minimalist garden (per m²)', rangeId: 'Rp 150.000–Rp 500.000', rangeEn: 'Rp 150,000–Rp 500,000' },
    { labelId: 'Kolam kecil + filter', labelEn: 'Small pond + filter', rangeId: 'Rp 3 juta–Rp 12 juta', rangeEn: 'Rp 3M–Rp 12M' },
    { labelId: 'Irigasi otomatis (per zona)', labelEn: 'Auto irrigation (per zone)', rangeId: 'Rp 2 juta–Rp 6 juta', rangeEn: 'Rp 2M–Rp 6M' },
    { labelId: 'Gazebo kayu', labelEn: 'Wooden gazebo', rangeId: 'Rp 8 juta–Rp 25 juta', rangeEn: 'Rp 8M–Rp 25M' },
  ],
  priceNoteId: 'Harga taman tergantung jenis tanaman dan elemen tambahan seperti lighting atau kolam.',
  priceNoteEn: 'Garden prices depend on plant types and extras like lighting or ponds.',
};

const demolition: ServiceContent = {
  faqs: [
    {
      qId: 'Berapa biaya pembongkaran rumah?',
      qEn: 'How much does house demolition cost?',
      aId: 'Pembongkaran rumah tinggal standar berkisar Rp 50.000–Rp 150.000 per m², tergantung struktur (bata vs beton bertulang) dan cara pembongkaran. Pembongkaran selektif (material daur ulang) bisa lebih mahal.',
      aEn: 'Standard residential demolition runs Rp 50,000–Rp 150,000 per m² depending on structure (brick vs reinforced concrete) and method. Selective demolition (material reuse) can cost more.',
    },
    {
      qId: 'Apakah perlu izin untuk bongkar rumah?',
      qEn: 'Do I need a permit to demolish a house?',
      aId: 'Ya, pengajuan pembongkaran ke kelurahan/kecamatan dan pengelola lingkungan umumnya wajib, terutama di area padat. Siapkan surat kepemilikan dan rencana pembongkaran.',
      aEn: 'Yes — demolition usually requires filing with the local sub-district office and neighborhood, especially in dense areas. Prepare ownership documents and a demolition plan.',
    },
    {
      qId: 'Bagaimana amankan rumah tetangga saat bongkar?',
      qEn: 'How do I protect neighboring houses during demolition?',
      aId: 'Gunakan metode manual di area berdekatan, pasang scaffolding pelindung, dan koordinasi jadwal dengan tetangga. Asuransi kerja sangat disarankan untuk menghindari sengketa.',
      aEn: 'Use manual methods near boundaries, install protective scaffolding, and coordinate schedules with neighbors. Work insurance is strongly advised to avoid disputes.',
    },
    {
      qId: 'Apakah material bongkaran bisa dipakai ulang?',
      qEn: 'Can demolition material be reused?',
      aId: 'Bata dan kayu berkualitas masih bisa dipakai ulang setelah dibersihkan. Besi beton (reinforcement) biasanya dijual ke tempat daur ulang. Pastikan pemisahan material saat pembongkaran.',
      aEn: 'Quality brick and wood can be reused after cleaning. Rebar is usually sold to recyclers. Separate materials during demolition for best recovery.',
    },
  ],
  priceGuide: [
    { labelId: 'Bongkar dinding bata (per m²)', labelEn: 'Brick wall demolition (per m²)', rangeId: 'Rp 50.000–Rp 100.000', rangeEn: 'Rp 50,000–Rp 100,000' },
    { labelId: 'Bongkar struktur beton (per m²)', labelEn: 'Concrete structure demolition (per m²)', rangeId: 'Rp 100.000–Rp 200.000', rangeEn: 'Rp 100,000–Rp 200,000' },
    { labelId: 'Angkut puing (per truk)', labelEn: 'Debris hauling (per truck)', rangeId: 'Rp 1,5 juta–Rp 4 juta', rangeEn: 'Rp 1.5M–Rp 4M' },
    { labelId: 'Pekerjaan selektif (per m²)', labelEn: 'Selective demolition (per m²)', rangeId: 'Rp 120.000–Rp 250.000', rangeEn: 'Rp 120,000–Rp 250,000' },
  ],
  priceNoteId: 'Biaya bongkar dipengaruhi akses alat berat dan jarak tempat pembuangan puing.',
  priceNoteEn: 'Demolition cost depends on heavy-equipment access and distance to the debris dump.',
};

const civilEngineering: ServiceContent = {
  faqs: [
    {
      qId: 'Apa itu pekerjaan sipil (civil engineering)?',
      qEn: 'What is civil engineering work?',
      aId: 'Pekerjaan sipil mencakup infrastruktur seperti jalan, jembatan, drainase, dan fondasi tanah. Berbeda dengan bangunan hunian, fokusnya pada struktur publik dan utilitas.',
      aEn: 'Civil engineering covers infrastructure such as roads, bridges, drainage, and ground foundations. Unlike residential building, it focuses on public structures and utilities.',
    },
    {
      qId: 'Berapa biaya proyek drainase per meter?',
      qEn: 'How much does drainage work cost per meter?',
      aId: 'Drainase lingkungan berkisar Rp 300.000–Rp 800.000 per meter tergantung dimensi saluran dan material (beton vs u-ditch precast).',
      aEn: 'Neighborhood drainage runs Rp 300,000–Rp 800,000 per meter depending on channel size and material (cast concrete vs precast U-ditch).',
    },
    {
      qId: 'Apakah butuh konsultan perencana?',
      qEn: 'Do I need a planning consultant?',
      aId: 'Untuk proyek di atas Rp 500 juta atau bersinggungan dengan fasilitas umum, konsultan perencana dan pengawas (MK) sangat disarankan demi keamanan dan perizinan.',
      aEn: 'For projects above Rp 500M or touching public facilities, a planning and supervisory consultant (MK) is strongly advised for safety and permits.',
    },
    {
      qId: 'Bagaimana uji kelayakan tanah?',
      qEn: 'How is soil feasibility tested?',
      aId: 'Dilakukan bor log (soil test) untuk mengetahui jenis tanah dan daya dukung. Hasilnya menentukan kedalaman fondasi dan jenis pondasi (batu kali, bore pile, dll).',
      aEn: 'A bore log (soil test) reveals soil type and bearing capacity. The result determines foundation depth and type (stone, bored pile, etc.).',
    },
  ],
  priceGuide: [
    { labelId: 'Drainase u-ditch (per m)', labelEn: 'U-ditch drainage (per m)', rangeId: 'Rp 300.000–Rp 800.000', rangeEn: 'Rp 300,000–Rp 800,000' },
    { labelId: 'Perkerasan jalan (per m²)', labelEn: 'Road pavement (per m²)', rangeId: 'Rp 200.000–Rp 500.000', rangeEn: 'Rp 200,000–Rp 500,000' },
    { labelId: 'Uji tanah (bor log)', labelEn: 'Soil test (bore log)', rangeId: 'Rp 5 juta–Rp 15 juta', rangeEn: 'Rp 5M–Rp 15M' },
    { labelId: 'Fondasi bore pile (per titik)', labelEn: 'Bored pile foundation (per point)', rangeId: 'Rp 2 juta–Rp 8 juta', rangeEn: 'Rp 2M–Rp 8M' },
  ],
  priceNoteId: 'Harga proyek sipil sangat tergantung skala dan spesifikasi teknis.',
  priceNoteEn: 'Civil project prices depend heavily on scale and technical specs.',
};

const constructionCompany: ServiceContent = {
  faqs: [
    {
      qId: 'Apa bedanya perusahaan konstruksi dan kontraktor perorangan?',
      qEn: 'What is the difference between a construction company and an individual contractor?',
      aId: 'Perusahaan konstruksi punya badan hukum, tenaga terlatih, dan biasanya sertifikat SIUJK/SBU. Cocok untuk proyek besar (di atas Rp 1 miliar) yang butuh manajemen tim.',
      aEn: 'A construction company has legal entity, trained crews, and usually SIUJK/SBU certificates. Best for large projects (above Rp 1B) needing team management.',
    },
    {
      qId: 'Kapan harus pakai perusahaan konstruksi?',
      qEn: 'When should I hire a construction company?',
      aId: 'Gedung komersial, pabrik, atau perumahan skala besar lebih baik ditangani perusahaan karena kapasitas alat berat dan koordinasi sub-kontraktor.',
      aEn: 'Commercial buildings, factories, or large housing are better handled by a company due to heavy-equipment capacity and subcontractor coordination.',
    },
    {
      qId: 'Bagaimana cek legalitas perusahaan?',
      qEn: 'How do I verify a company’s legality?',
      aId: 'Minta NIB, SIUJK, dan SBU melalui OSS. Cek juga portofolio proyek serupa dan ketersediaan asuransi kerja (JKK/JKm).',
      aEn: 'Request NIB, SIUJK, and SBU via OSS. Also check a portfolio of similar projects and work insurance (JKK/JKm).',
    },
    {
      qId: 'Apakah perusahaan bisa kerja borongan turnkey?',
      qEn: 'Can a company do turnkey lump-sum?',
      aId: 'Ya, banyak perusahaan menawarkan skema turnkey (kunci tangan) — desain hingga serah terima, dengan garansi pemeliharaan tertentu.',
      aEn: 'Yes, many offer turnkey (kunci tangan) — design through handover, with a maintenance warranty period.',
    },
  ],
  priceGuide: [
    { labelId: 'Manajemen proyek (per bulan)', labelEn: 'Project management (per month)', rangeId: 'Rp 10 juta–Rp 50 juta', rangeEn: 'Rp 10M–Rp 50M' },
    { labelId: 'Fee konstruksi (persen)', labelEn: 'Construction fee (percentage)', rangeId: '5%–15% dari nilai', rangeEn: '5%–15% of value' },
    { labelId: 'Turnkey rumah (per m²)', labelEn: 'Turnkey house (per m²)', rangeId: 'Rp 6 juta–Rp 12 juta', rangeEn: 'Rp 6M–Rp 12M' },
    { labelId: 'Konsultasi awal', labelEn: 'Initial consultation', rangeId: 'Rp 1 juta–Rp 5 juta', rangeEn: 'Rp 1M–Rp 5M' },
  ],
  priceNoteId: 'Fee perusahaan biasanya mencakup koordinasi, pengawasan, dan admin yang tidak ada di kontraktor perorangan.',
  priceNoteEn: 'Company fees typically cover coordination, supervision, and admin absent in individual contracts.',
};

const generalContractor: ServiceContent = {
  faqs: [
    {
      qId: 'Apa tugas kontraktor umum?',
      qEn: 'What does a general contractor do?',
      aId: 'Kontraktor umum mengelola seluruh proyek: perencanaan, pengadaan material, tenaga kerja, dan koordinasi sub-kontraktor (listrik, plumbing, finishing).',
      aEn: 'A general contractor manages the whole project: planning, material procurement, labor, and subcontractor coordination (electrical, plumbing, finishing).',
    },
    {
      qId: 'Kontraktor umum vs mandor, mana?',
      qEn: 'General contractor vs site supervisor — which?',
      aId: 'Mandor hanya mengawasi harian di lokasi. Kontraktor umum bertanggung jawab penuh atas hasil, jadwal, dan anggaran — cocok bila Anda tidak bisa hadir tiap hari.',
      aEn: 'A supervisor only watches daily site work. A general contractor is fully responsible for outcome, schedule, and budget — ideal if you cannot be on-site daily.',
    },
    {
      qId: 'Apakah kontraktor umum sediakan desain?',
      qEn: 'Does a general contractor provide design?',
      aId: 'Sebagian menawarkan desain internal atau bekerja sama dengan arsitek. Pastikan gambar kerja final disepakati sebelum kontrak agar harga tidak melonjak.',
      aEn: 'Some offer in-house design or partner with architects. Ensure final drawings are agreed before contract to avoid price spikes.',
    },
    {
      qId: 'Bagaimana sistem termin pembayaran?',
      qEn: 'How does stage payment work?',
      aId: 'Biasanya 3–5 termin: tanda jadi, struktur, finishing, dan retensi (5–10%) setelah masa pemeliharaan. Hindari bayar lunas di awal.',
      aEn: 'Usually 3–5 stages: down payment, structure, finishing, and retention (5–10%) after maintenance. Avoid full upfront payment.',
    },
  ],
  priceGuide: [
    { labelId: 'Fee manajemen (persen)', labelEn: 'Management fee (percentage)', rangeId: '8%–15% dari proyek', rangeEn: '8%–15% of project' },
    { labelId: 'Paket rumah 1 lantai (per m²)', labelEn: '1-story house package (per m²)', rangeId: 'Rp 5 juta–Rp 9 juta', rangeEn: 'Rp 5M–Rp 9M' },
    { labelId: 'Paket rumah 2 lantai (per m²)', labelEn: '2-story house package (per m²)', rangeId: 'Rp 6 juta–Rp 11 juta', rangeEn: 'Rp 6M–Rp 11M' },
    { labelId: 'Koordinasi sub-kontraktor', labelEn: 'Subcontractor coordination', rangeId: 'Rp 3 juta–Rp 10 juta', rangeEn: 'Rp 3M–Rp 10M' },
  ],
  priceNoteId: 'Harga paket umumnya sudah termasuk pengawasan, namun cek detail material yang digunakan.',
  priceNoteEn: 'Package prices usually include supervision, but verify the materials specified.',
};

const interiorRenovation: ServiceContent = {
  faqs: [
    {
      qId: 'Apa itu renovasi interior?',
      qEn: 'What is interior renovation?',
      aId: 'Renovasi interior fokus pada ruang dalam: tata letak, furniture bawaan (kitchen set, lemari), pencahayaan, dan penyesuaian gaya tanpa ubah struktur bangunan.',
      aEn: 'Interior renovation focuses on indoor space: layout, built-ins (kitchen set, wardrobe), lighting, and style — without altering the building structure.',
    },
    {
      qId: 'Berapa biaya kitchen set?',
      qEn: 'How much does a kitchen set cost?',
      aId: 'Kitchen set dasar Rp 3 juta–Rp 8 juta per meter lari (linear meter). Premium dengan HPL/quarzt top mencapai Rp 10 juta–Rp 20 juta per linear meter.',
      aEn: 'A basic kitchen set is Rp 3M–Rp 8M per linear meter. Premium with HPL/quartz tops reaches Rp 10M–Rp 20M per linear meter.',
    },
    {
      qId: 'Apakah ubah tata ruang butuh izin?',
      qEn: 'Does changing layout need a permit?',
      aId: 'Jika tidak membongkar dinding pemikul (kolom/balok struktur), umumnya tidak perlu izin. Partisi ringan bisa dipindah bebas asal tidak ganggu instalasi.',
      aEn: 'If you do not remove load-bearing walls (structural columns/beams), no permit is usually needed. Light partitions can move freely if utilities are clear.',
    },
    {
      qId: 'Bagaimana pilih material furniture?',
      qEn: 'How do I choose furniture materials?',
      aId: 'Untuk lembap pilih HPL atau PVC tahan air. Kayu solid estetis tapi rawan rayap — butuh coating rutin. Sesuaikan dengan budget dan gaya ruangan.',
      aEn: 'For humidity choose water-resistant HPL or PVC. Solid wood looks great but is termite-prone — needs routine coating. Match budget and room style.',
    },
  ],
  priceGuide: [
    { labelId: 'Kitchen set (per m lari)', labelEn: 'Kitchen set (per linear m)', rangeId: 'Rp 3 juta–Rp 20 juta', rangeEn: 'Rp 3M–Rp 20M' },
    { labelId: 'Lemari pakaian bawaan (per m²)', labelEn: 'Built-in wardrobe (per m²)', rangeId: 'Rp 1,5 juta–Rp 5 juta', rangeEn: 'Rp 1.5M–Rp 5M' },
    { labelId: 'Partisi gypsum (per m²)', labelEn: 'Gypsum partition (per m²)', rangeId: 'Rp 200.000–Rp 450.000', rangeEn: 'Rp 200,000–Rp 450,000' },
    { labelId: 'Pencahayaan & aksesori', labelEn: 'Lighting & accessories', rangeId: 'Rp 2 juta–Rp 10 juta', rangeEn: 'Rp 2M–Rp 10M' },
  ],
  priceNoteId: 'Harga interior sangat variatif tergantung material finishing dan merek hardware.',
  priceNoteEn: 'Interior prices vary widely by finishing material and hardware brand.',
};

const mepSystems: ServiceContent = {
  faqs: [
    {
      qId: 'Apa itu sistem MEP?',
      qEn: 'What are MEP systems?',
      aId: 'MEP = Mechanical, Electrical, Plumbing. Mencakup AC, ventilasi, instalasi listrik, air bersih, dan air kotor — sistem utilitas yang membuat bangunan layak huni.',
      aEn: 'MEP = Mechanical, Electrical, Plumbing. Covers AC, ventilation, electrical, clean water, and waste — utility systems that make a building habitable.',
    },
    {
      qId: 'Berapa biaya instalasi AC sentral?',
      qEn: 'How much does central AC installation cost?',
      aId: 'AC sentral (ducted/VRF) untuk rumah 2 lantai umumnya Rp 60 juta–Rp 150 juta tergantung jumlah indoor unit dan merek. Lebih hemat listrik dari AC split banyak.',
      aEn: 'Central (ducted/VRF) AC for a 2-story house typically runs Rp 60M–Rp 150M depending on indoor units and brand. More power-efficient than many split units.',
    },
    {
      qId: 'Perlukah desain MEP terintegrasi?',
      qEn: 'Do I need integrated MEP design?',
      aId: 'Ya, desain MEP sejak awal mencegah tabrakan instalasi (pipa vs kabel) dan memudahkan perawatan. Koordinasi BIM sangat disarankan untuk bangunan besar.',
      aEn: 'Yes — early MEP design prevents clashes (pipe vs cable) and eases maintenance. BIM coordination is strongly advised for large buildings.',
    },
    {
      qId: 'Bagaimana维护 sistem MEP?',
      qEn: 'How do I maintain MEP systems?',
      aId: 'Lakukan servis AC tiap 3–6 bulan, cek tekanan pompa air, dan inspeksi panel listrik tahunan. Pemeliharaan rutin mencegah kerusakan mahal.',
      aEn: 'Service AC every 3–6 months, check water pump pressure, and inspect the electrical panel yearly. Routine care prevents costly breakdowns.',
    },
  ],
  priceGuide: [
    { labelId: 'AC sentral VRF (per HP)', labelEn: 'VRF central AC (per HP)', rangeId: 'Rp 8 juta–Rp 15 juta', rangeEn: 'Rp 8M–Rp 15M' },
    { labelId: 'Ventilasi exhaust (per titik)', labelEn: 'Exhaust ventilation (per point)', rangeId: 'Rp 1 juta–Rp 3 juta', rangeEn: 'Rp 1M–Rp 3M' },
    { labelId: 'Sistem plumbing lengkap (rumah)', labelEn: 'Full plumbing system (house)', rangeId: 'Rp 15 juta–Rp 35 juta', rangeEn: 'Rp 15M–Rp 35M' },
    { labelId: 'Panel listrik MEP', labelEn: 'MEP electrical panel', rangeId: 'Rp 5 juta–Rp 12 juta', rangeEn: 'Rp 5M–Rp 12M' },
  ],
  priceNoteId: 'MEP adalah investasi jangka panjang; pilih merek berenergi efisien untuk hemat operasional.',
  priceNoteEn: 'MEP is a long-term investment; choose energy-efficient brands to cut operating costs.',
};

const steelStructure: ServiceContent = {
  faqs: [
    {
      qId: 'Kapan pakai struktur baja?',
      qEn: 'When should I use a steel structure?',
      aId: 'Struktur baja cocok untuk bentang lebar (gudang, pabrik, atap kanopi) dan lantai tambahan cepat. Lebih ringan dari beton dan cepat dipasang.',
      aEn: 'Steel suits wide spans (warehouses, factories, canopies) and fast-added floors. Lighter than concrete and quick to install.',
    },
    {
      qId: 'Berapa biaya rangka baja per m²?',
      qEn: 'How much does a steel frame cost per m²?',
      aId: 'Rangka baja untuk bangunan industri berkisar Rp 1,5 juta–Rp 3,5 juta per m² termasuk fabrikasi dan pemasangan. Harga naik untuk beban berat.',
      aEn: 'Steel framing for industrial buildings runs Rp 1.5M–Rp 3.5M per m² including fabrication and erection. Heavier loads cost more.',
    },
    {
      qId: 'Apakah baja tahan karat di iklim lembap?',
      qEn: 'Does steel rust in humid climate?',
      aId: 'Baja butuh pelindung: galvanis, cat epoxy, atau weatherproofing. Perawatan berkala mencegah korosi, terutama di area pantai.',
      aEn: 'Steel needs protection: galvanizing, epoxy paint, or weatherproofing. Periodic care prevents corrosion, especially coastal areas.',
    },
    {
      qId: 'Butuh izin khusus?',
      qEn: 'Any special permit needed?',
      aId: 'Struktur baja wajib hitungan engineers bersertifikat dan biasanya masuk dalam dokumen PBG. Pastikan fabrikator punya sertifikat pengelasan.',
      aEn: 'Steel needs certified engineer calculations, usually within the PBG documents. Ensure the fabricator holds welding certification.',
    },
  ],
  priceGuide: [
    { labelId: 'Rangka baja (per m²)', labelEn: 'Steel frame (per m²)', rangeId: 'Rp 1,5 juta–Rp 3,5 juta', rangeEn: 'Rp 1.5M–Rp 3.5M' },
    { labelId: 'Kanopi baja (per m²)', labelEn: 'Steel canopy (per m²)', rangeId: 'Rp 800.000–Rp 2 juta', rangeEn: 'Rp 800,000–Rp 2M' },
    { labelId: 'Coating anti-karat', labelEn: 'Anti-corrosion coating', rangeId: 'Rp 50.000–Rp 150.000/m²', rangeEn: 'Rp 50,000–Rp 150,000/m²' },
    { labelId: 'Fabrikasi & pasang', labelEn: 'Fabrication & erection', rangeId: 'Rp 500.000–Rp 1,5 juta/m²', rangeEn: 'Rp 500,000–Rp 1.5M/m²' },
  ],
  priceNoteId: 'Harga baja fluktuatif mengikuti harga komoditas global; konfirmasi sebelum kontrak.',
  priceNoteEn: 'Steel prices fluctuate with global commodities; confirm before contract.',
};

const waterproofing: ServiceContent = {
  faqs: [
    {
      qId: 'Mengapa waterproofing penting?',
      qEn: 'Why is waterproofing important?',
      aId: 'Tanpa waterproofing, kebocoran merusak struktur, memicu jamur, dan turunkan nilai bangunan. Area kritis: atap, kamar mandi, basement, dan kolam.',
      aEn: 'Without waterproofing, leaks damage structure, trigger mold, and lower property value. Critical areas: roof, bathroom, basement, and pools.',
    },
    {
      qId: 'Berapa biaya coating waterproofing?',
      qEn: 'How much does waterproofing coating cost?',
      aId: 'Coating membran cair berkisar Rp 60.000–Rp 150.000 per m². Sistem sheet membrane lebih mahal namun tahan lama untuk atap ekstensif.',
      aEn: 'Liquid membrane coating runs Rp 60,000–Rp 150,000 per m². Sheet membrane systems cost more but last longer for extensive roofs.',
    },
    {
      qId: 'Kapan waktu terbaik coating?',
      qEn: 'When is the best time to coat?',
      aId: 'Saat konstruksi selesai sebelum finishing, atau saat renovasi kamar mandi/atap. Pastikan permukaan kering dan bersih agar rekat maksimal.',
      aEn: 'Right after construction before finishing, or during bathroom/roof renovation. Ensure surfaces are dry and clean for maximum adhesion.',
    },
    {
      qId: 'Berapa umur waterproofing?',
      qEn: 'What is the lifespan of waterproofing?',
      aId: 'Membran berkualitas tahan 5–10 tahun. Periksa ulang tiap 3 tahun, terutama di area hujan lebat, untuk mencegah rembes lambat.',
      aEn: 'Quality membranes last 5–10 years. Re-inspect every 3 years, especially in heavy-rain areas, to catch slow seepage early.',
    },
  ],
  priceGuide: [
    { labelId: 'Coating cair (per m²)', labelEn: 'Liquid coating (per m²)', rangeId: 'Rp 60.000–Rp 150.000', rangeEn: 'Rp 60,000–Rp 150,000' },
    { labelId: 'Sheet membrane (per m²)', labelEn: 'Sheet membrane (per m²)', rangeId: 'Rp 120.000–Rp 300.000', rangeEn: 'Rp 120,000–Rp 300,000' },
    { labelId: 'Waterproofing kamar mandi', labelEn: 'Bathroom waterproofing', rangeId: 'Rp 2 juta–Rp 6 juta', rangeEn: 'Rp 2M–Rp 6M' },
    { labelId: 'Waterproofing atap', labelEn: 'Roof waterproofing', rangeId: 'Rp 5 juta–Rp 20 juta', rangeEn: 'Rp 5M–Rp 20M' },
  ],
  priceNoteId: 'Harga tergantung sistem dan luas area; jangan tunda perbaikan kebocoran kecil.',
  priceNoteEn: 'Price depends on system and area; do not delay fixing small leaks.',
};

export const serviceContent: Record<string, ServiceContent> = {
  'apartment-renovation': apartmentRenovation,
  roofing,
  'electrical-work': electricalWork,
  construction,
  plumbing,
  finishing,
  facade,
  landscaping,
  demolition,
  'civil-engineering': civilEngineering,
  'construction-company': constructionCompany,
  'general-contractor': generalContractor,
  'interior-renovation': interiorRenovation,
  'mep-systems': mepSystems,
  'steel-structure': steelStructure,
  waterproofing,
};

export function getServiceContent(slug: string): ServiceContent | undefined {
  return serviceContent[slug];
}
