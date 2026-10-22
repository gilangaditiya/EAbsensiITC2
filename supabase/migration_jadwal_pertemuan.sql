-- Jalankan di Supabase SQL Editor setelah memeriksa nama kolom tabel Pertemuan.
-- Tabel Pertemuan yang terlihat pada screenshot memiliki: id, tanggal, dibuat_oleh, dibuat_pada.
ALTER TABLE public."Pertemuan" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pertemuan dapat dibaca pengguna login" ON public."Pertemuan";
CREATE POLICY "Pertemuan dapat dibaca pengguna login"
ON public."Pertemuan" FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Petugas dapat membuat jadwal pertemuan" ON public."Pertemuan";
CREATE POLICY "Petugas dapat membuat jadwal pertemuan"
ON public."Pertemuan" FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."Petugas" p
    WHERE p.id = auth.uid() AND lower(coalesce(p.role, '')) = 'petugas'
  )
);

DROP POLICY IF EXISTS "Petugas dapat menghapus jadwal pertemuan" ON public."Pertemuan";
CREATE POLICY "Petugas dapat menghapus jadwal pertemuan"
ON public."Pertemuan" FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Petugas" p
    WHERE p.id = auth.uid() AND lower(coalesce(p.role, '')) = 'petugas'
  )
);
