# Dokumentasi Aplikasi

Panduan lengkap anda untuk menggunakan Mataresit.

## Di halaman ini

*   [Gambaran Keseluruhan](#1-gambaran-keseluruhan)
*   [Bermula](#2-bermula)
*   [Ciri Teras](#3-ciri-teras)
*   [Penyelesaian Masalah & Soalan Lazim](#4-penyelesaian-masalah)
*   [Glosari](#5-glosari)

---

## 1. Gambaran Keseluruhan

### Apakah itu Mataresit?

Mataresit ialah aplikasi pintar yang direka untuk menghapuskan kemasukan data manual yang berkaitan dengan pengurusan resit dan perbelanjaan. Dengan memanfaatkan Pengecaman Aksara Optik (OCR) dan model AI termaju seperti Gemini Google, ia secara automatik mengekstrak, mengkategorikan dan menormalkan data resit anda, menjimatkan masa kerja anda berjam-jam dan memastikan rekod kewangan anda tepat dan teratur.

### Ciri-ciri Utama

*   **Pengekstrakan Data Automatik**: Muat naik imej resit (JPEG, PNG, PDF), dan sistem kami secara automatik menarik maklumat penting seperti pedagang, tarikh, jumlah dan item baris.
*   **Peningkatan Dikuasakan AI**: Melangkaui OCR mudah. AI kami menormalkan nama pedagang, menyeragamkan kaedah pembayaran, meramalkan kategori perbelanjaan, dan juga mencadangkan pembetulan untuk kemungkinan ralat OCR.
*   **Pemarkahan Keyakinan**: Setiap medan yang diekstrak diberikan skor keyakinan, jadi anda boleh melihat sepintas lalu data mana yang sangat tepat dan yang mungkin memerlukan semakan pantas.
*   **Maklum Balas Pemprosesan Masa Nyata**: Tonton resit anda diproses dalam masa nyata dengan garis masa status terperinci, dari muat naik hingga selesai.
*   **Carian Semantik Pintar**: Cari mana-mana resit atau item baris dengan bertanya soalan dalam bahasa semula jadi, seperti "perbelanjaan kopi dari bulan lepas" atau "apa yang saya beli di Walmart?".
*   **Pemprosesan Kelompok**: Muat naik berbilang resit serentak dan biarkan sistem memprosesnya secara selari, dengan kawalan penuh ke atas baris gilir.
*   **Analisis & Pelaporan**: Visualisasikan tabiat perbelanjaan anda dengan papan pemuka analisis kami dan jana laporan PDF terperinci yang diringkaskan mengikut kategori atau pembayar.
*   **Pemilihan Model AI yang Fleksibel**: Pilih antara kaedah pemprosesan AI yang berbeza (AI Vision lwn. OCR + AI) dan model untuk mengimbangi kelajuan, kos dan ketepatan.

---

## 2. Bermula

### Muat Naik Pertama Anda

1.  **Navigasi ke Papan Pemuka**: Selepas log masuk, anda akan mendarat di papan pemuka utama anda.
2.  **Buka Modal Muat Naik**: Klik butang "Muat Naik". Ini akan membuka modal dengan dua tab: "Muat Naik Tunggal" dan "Muat Naik Kelompok".
3.  **Pilih Fail**: Dalam tab "Muat Naik Tunggal", anda boleh sama ada seret dan lepas fail resit (JPG, PNG atau PDF) ke dalam kawasan yang ditetapkan atau klik untuk menyemak imbas komputer anda.
4.  **Pemprosesan Bermula**: Sebaik sahaja fail dipilih, muat naik dan pemprosesan bermula secara automatik. Anda boleh memantau kemajuan dalam masa nyata melalui Garis Masa Pemprosesan.
5.  **Semak dan Simpan**: Selepas pemprosesan selesai, anda akan dihalakan secara automatik ke halaman Pemapar Resit untuk menyemak, mengedit dan menyimpan resit anda.

### Memahami Papan Pemuka

Papan pemuka anda ialah hab pusat anda untuk mengurus resit.

*   **Kad Resit**: Setiap kad mewakili resit, menunjukkan pedagang, tarikh, jumlah dan imej kecil imej.
*   **Penunjuk Status**: "Belum Disemak" (Kuning) bermakna resit memerlukan kelulusan anda; "Disemak" (Biru) bermakna ia disahkan.
*   **Penapisan & Isih**: Gunakan kawalan di bahagian atas untuk mencari, menapis dan mengisih resit anda.
*   **Mod Paparan**: Tukar antara paparan Grid, Senarai dan Jadual.

---

## 3. Ciri Teras secara Terperinci

### Memuat Naik Resit (Tunggal & Kelompok)

Mataresit menyokong kedua-dua muat naik fail tunggal dan berbilang. Ciri **Muat Naik Kelompok** membolehkan anda memproses berbilang resit secara selari, dengan kawalan untuk memulakan, menjeda dan mencuba semula muat naik yang gagal, menjadikannya sesuai untuk mengendalikan jumlah resit yang besar dengan cekap.

### Cadangan AI & Skor Keyakinan

AI kami memberikan cerapan untuk memastikan ketepatan. Jika ia mengesan kemungkinan ralat OCR, ia akan menawarkan cadangan yang boleh anda terima dengan satu klik. Setiap medan utama juga mempunyai skor keyakinan, yang diwakili secara visual oleh bar berwarna:

*   ■ Hijau (80-100%): Keyakinan tinggi.
*   ■ Kuning (60-79%): Keyakinan sederhana, mungkin perlu dilihat sekilas.
*   ■ Merah (<60%): Keyakinan rendah, perlu disemak.

Mengedit medan secara manual menetapkan keyakinannya kepada 100%.

### Pemprosesan AI: Vision lwn. OCR

Dalam **Tetapan → Pemprosesan**, anda boleh memilih kaedah pilihan anda:

*   **AI Vision (Lalai)**: Model AI secara langsung menganalisis imej resit, menawarkan ketepatan yang unggul untuk resit yang kompleks atau tulisan tangan.
*   **Bandingkan dengan Alternatif**: Untuk ketepatan maksimum, sistem menjalankan kedua-dua AI Vision dan kaedah OCR + AI tradisional, menonjolkan sebarang perbezaan untuk semakan anda.

### Carian AI

Navigasi ke halaman **Carian AI** untuk mencari mana-mana resit atau item baris menggunakan bahasa semula jadi. Contohnya, anda boleh bertanya: "perbelanjaan kopi dari bulan lepas" atau "barangan runcit melebihi $20".

---

## 4. Penyelesaian Masalah & Soalan Lazim

### Mengapakah pemprosesan resit saya tersekat atau gagal?

`processing_status` pada kad resit atau dalam pemapar akan menunjukkan peringkat semasa. Jika ia `failed` atau `failed_ai`, ralat telah berlaku. Ini boleh berlaku dengan imej berkualiti rendah. Anda boleh sama ada cuba memproses semula resit atau memasukkan data secara manual.

### Mengapakah hasil carian saya tidak seperti yang saya jangkakan?

Carian semantik kami bergantung pada "embeddings". Jika anda telah memuat naik resit sebelum ciri ini didayakan, anda mungkin perlu menjana embeddings untuknya. Pentadbir boleh melakukan ini dari halaman **Pentadbir → Tetapan**.

### Bagaimanakah cara saya menukar langganan saya?

Anda boleh mengurus langganan anda, melihat invois dan mengemas kini kaedah pembayaran dari **Portal Pengebilan Stripe**. Aksesnya dari halaman **Ciri** atau halaman **Kejayaan Pembayaran** selepas transaksi.

---

## 5. Glosari

*   **Pemprosesan AI Vision:** Teknologi AI canggih yang menganalisis imej resit secara langsung untuk mengekstrak data dengan ketepatan tinggi.
*   **AI Vision:** Kaedah pemprosesan di mana model AI secara langsung menganalisis imej untuk memahami kandungannya.
*   **Embedding:** Perwakilan berangka teks yang menangkap makna semantiknya, menggerakkan Carian AI kami.
*   **Carian Semantik:** Teknik carian yang memahami niat pengguna dan makna kontekstual perkataan.
