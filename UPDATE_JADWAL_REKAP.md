# Update Jadwal Pertemuan & Rekap

Perubahan UI/JS:
- Tombol Jadwalkan Pertemuan di dashboard pengelola; menyimpan ke tabel `Pertemuan` memakai kolom `tanggal` dan `dibuat_oleh`.
- Scan QR dan absensi manual diblokir jika tidak ada jadwal pada hari ini; pencatatan absensi juga mengecek ulang jadwal.
- Pengajuan izin/sakit hanya diterima untuk tanggal pertemuan yang akan datang.
- Tanggal rekap berupa pilihan tanggal yang memiliki data absensi/pengajuan. Tombol menjadi `Rekap Pertemuan Terakhir`.
- Tombol `Rekap Keseluruhan` merangkum hadir, izin, sakit, dan alpa per anggota.

## Supabase
Tabel `Pertemuan` yang terlihat pada screenshot sudah digunakan; tidak dibuat tabel baru. Jalankan `supabase/migration_jadwal_pertemuan.sql` di SQL Editor jika tabel `Pertemuan` belum memiliki policies. Pastikan nilai `Petugas.role` untuk pengelola adalah `petugas`, dan `Petugas.id` sama dengan `auth.uid()` seperti yang diasumsikan oleh kode login aplikasi. Jika nilai role berbeda, sesuaikan policy SQL.

Setelah mengganti file di Android Studio, lakukan Gradle Sync lalu build ulang APK. Uji dulu di project/test data sebelum mengganti APK yang digunakan anggota.
