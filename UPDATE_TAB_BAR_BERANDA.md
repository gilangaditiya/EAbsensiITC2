# Update v3.1.0 — Tab Bar & Beranda

## Tab bar (mode Anggota)
Beranda · Identitas · Rekap · Izin/Sakit · Pengumuman
(Identitas kini halaman penuh, bukan popup.)

## Tab bar (mode Pengelola)
Beranda · Anggota · Scan QR · Rekap · Lainnya
"Lainnya" membuka lembar menu: Absensi Manual, Pengajuan Izin/Sakit, Jadwalkan Pertemuan,
Pengajuan Reset Password, Pengumuman. Titik merah muncul di "Lainnya" jika ada pengajuan menunggu.

## Isi Beranda
Anggota : pertemuan berikutnya (hitung mundur) / hari ini + status kehadiran hari ini, pertemuan terakhir
          + status saya, kehadiran saya (% hadir, hadir/izin/sakit/alpa), pengajuan terakhir, pengumuman terbaru.
Pengelola: pertemuan berikutnya / hari ini (berapa yang sudah hadir), pertemuan terakhir (rincian status),
          ringkasan keseluruhan (anggota, pertemuan, rata-rata hadir), perlu diproses, pengumuman terbaru.

## Catatan
- Tidak ada perubahan database; memakai tabel Pertemuan, Absensi, Pengajuan, Pengumuman yang sudah ada.
- Di Beranda anggota, pertemuan terjadwal yang sudah lewat tanpa catatan dihitung Alpa
  (sama seperti Rekap per tanggal di mode pengelola).
- Tab bar otomatis tersembunyi saat keyboard terbuka.
- File berubah: index.html, app.js, style.css (folder app/src/main/assets).
