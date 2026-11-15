/* laporan-excel.js
   Pembuat file Excel (.xlsx) tanpa library luar, jadi tetap jalan offline.
   Dipakai untuk laporan Rekap Keseluruhan dan Data Anggota. */
(function (global) {
  "use strict";

  /* ================= ZIP (tanpa kompresi) ================= */
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const te = new TextEncoder();
    const now = new Date();
    const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    const parts = [], central = [];
    let offset = 0;

    for (const f of files) {
      const name = te.encode(f.name), data = f.data, crc = crc32(data);

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true);
      lh.setUint16(12, dd, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true);
      ch.setUint16(14, dd, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);

      offset += 30 + name.length + data.length;
    }

    let cdSize = 0;
    for (const c of central) cdSize += c.length;

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);

    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    let total = 0;
    for (const p of all) total += p.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of all) { out.set(p, pos); pos += p.length; }
    return out;
  }

  /* ================= XML & gaya ================= */
  const esc = (s) => String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function colLetter(n) {
    let s = "";
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  const NAVY = "FF1F3864";

  const FONTS = [
    '<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>',            // 0 biasa
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',        // 1 header
    '<font><b/><sz val="18"/><color rgb="' + NAVY + '"/><name val="Calibri"/><family val="2"/></font>',    // 2 judul
    '<font><i/><sz val="10"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font>',        // 3 keterangan
    '<font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>',        // 4 tebal
    '<font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/><family val="2"/></font>',        // 5 merah
    '<font><b/><sz val="11"/><color rgb="FF375623"/><name val="Calibri"/><family val="2"/></font>',        // 6 hijau
    '<font><b/><sz val="11"/><color rgb="FF9C5700"/><name val="Calibri"/><family val="2"/></font>',        // 7 kuning
    '<font><b/><sz val="11"/><color rgb="FF1F4E79"/><name val="Calibri"/><family val="2"/></font>',        // 8 biru
    '<font><sz val="11"/><color rgb="FF7F7F7F"/><name val="Calibri"/><family val="2"/></font>'             // 9 abu
  ];

  const solid = (rgb) => '<fill><patternFill patternType="solid"><fgColor rgb="' + rgb + '"/><bgColor indexed="64"/></patternFill></fill>';
  const FILLS = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    solid(NAVY),        // 2 header
    solid("FFF2F6FA"),  // 3 baris selang-seling
    solid("FFD9E2F3"),  // 4 total
    solid("FFE2EFDA"),  // 5 hijau muda
    solid("FFFFF2CC"),  // 6 kuning muda
    solid("FFDDEBF7"),  // 7 biru muda
    solid("FFFCE4D6")   // 8 merah muda
  ];

  const side = (name, style, rgb) => '<' + name + ' style="' + style + '"><color rgb="' + rgb + '"/></' + name + '>';
  const BORDERS = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border>' + side("left", "thin", "FFBFBFBF") + side("right", "thin", "FFBFBFBF") + side("top", "thin", "FFBFBFBF") + side("bottom", "thin", "FFBFBFBF") + '<diagonal/></border>',
    '<border>' + side("left", "thin", "FFBFBFBF") + side("right", "thin", "FFBFBFBF") + side("top", "medium", NAVY) + side("bottom", "thin", "FFBFBFBF") + '<diagonal/></border>'
  ];

  const CEN = { h: "center", v: "center" };
  const LEFT = { h: "left", v: "center", indent: 1 };
  // [nama, font, fill, border, numFmt, alignment]
  const XF = [
    ["default", 0, 0, 0, 0, null],
    ["title", 2, 0, 0, 0, { h: "left", v: "center" }],
    ["subtitle", 3, 0, 0, 0, { h: "left", v: "center" }],
    ["info", 4, 0, 0, 0, { h: "left", v: "center" }],
    ["header", 1, 2, 1, 0, { h: "center", v: "center", wrap: 1 }],
    ["text", 0, 0, 1, 0, LEFT],
    ["textAlt", 0, 3, 1, 0, LEFT],
    ["center", 0, 0, 1, 0, CEN],
    ["centerAlt", 0, 3, 1, 0, CEN],
    ["pct", 0, 0, 1, 165, CEN],
    ["pctAlt", 0, 3, 1, 165, CEN],
    ["totalLabel", 4, 4, 2, 0, LEFT],
    ["totalNum", 4, 4, 2, 0, CEN],
    ["totalPct", 4, 4, 2, 165, CEN],
    ["codeH", 6, 5, 1, 0, CEN],
    ["codeI", 8, 7, 1, 0, CEN],
    ["codeS", 7, 6, 1, 0, CEN],
    ["codeA", 5, 8, 1, 0, CEN],
    ["codeNone", 9, 0, 1, 0, CEN],
    ["note", 3, 0, 0, 0, { h: "left", v: "center", wrap: 1 }]
  ];
  const STYLE = {};
  XF.forEach((x, i) => { STYLE[x[0]] = i; });

  function stylesXml() {
    const xfs = XF.map((x) => {
      const a = x[5];
      const align = a
        ? '<alignment horizontal="' + a.h + '" vertical="' + a.v + '"' + (a.wrap ? ' wrapText="1"' : "") + (a.indent ? ' indent="' + a.indent + '"' : "") + "/>"
        : "";
      return '<xf numFmtId="' + x[4] + '" fontId="' + x[1] + '" fillId="' + x[2] + '" borderId="' + x[3] + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (a ? ' applyAlignment="1">' + align + "</xf>" : "/>");
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>' +
      '<fonts count="' + FONTS.length + '">' + FONTS.join("") + "</fonts>" +
      '<fills count="' + FILLS.length + '">' + FILLS.join("") + "</fills>" +
      '<borders count="' + BORDERS.length + '">' + BORDERS.join("") + "</borders>" +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + XF.length + '">' + xfs + "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="1"><dxf><font><b/><color rgb="FFC00000"/></font><fill><patternFill><bgColor rgb="FFFCE4D6"/></patternFill></fill></dxf></dxfs>' +
      "</styleSheet>";
  }

  /* ================= Sel & lembar kerja ================= */
  const C = {
    s: (v, st) => ({ t: "s", v: v == null ? "" : String(v), st: STYLE[st] }),
    n: (v, st) => ({ t: "n", v: v, st: STYLE[st] }),
    f: (f, v, st) => ({ t: "f", f: f, v: v, st: STYLE[st] }),
    e: (st) => ({ t: "e", st: STYLE[st] })
  };

  function cellXml(c, ref) {
    const s = ' s="' + (c.st || 0) + '"';
    if (c.t === "s") return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + "</t></is></c>";
    if (c.t === "n") return '<c r="' + ref + '"' + s + "><v>" + c.v + "</v></c>";
    if (c.t === "f") return '<c r="' + ref + '"' + s + "><f>" + esc(c.f) + "</f><v>" + c.v + "</v></c>";
    return '<c r="' + ref + '"' + s + "/>";
  }

  function sheetXml(sh, selected) {
    let maxC = 0, rowsXml = "";
    sh.rows.forEach((row, i) => {
      const r = i + 1;
      let cx = "";
      (row.c || []).forEach((c, j) => {
        if (!c) return;
        if (j + 1 > maxC) maxC = j + 1;
        cx += cellXml(c, colLetter(j + 1) + r);
      });
      rowsXml += '<row r="' + r + '"' + (row.h ? ' ht="' + row.h + '" customHeight="1"' : "") + ">" + cx + "</row>";
    });

    let pane = "";
    if (sh.freeze) {
      const fr = sh.freeze.r || 0, fc = sh.freeze.c || 0;
      const tl = colLetter(fc + 1) + (fr + 1);
      const act = fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight";
      pane = "<pane" + (fc ? ' xSplit="' + fc + '"' : "") + (fr ? ' ySplit="' + fr + '"' : "") + ' topLeftCell="' + tl + '" activePane="' + act + '" state="frozen"/>' +
        '<selection pane="' + act + '" activeCell="' + tl + '" sqref="' + tl + '"/>';
    }

    const cols = '<cols>' + sh.widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("") + "</cols>";
    const merges = sh.merges && sh.merges.length
      ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map((m) => '<mergeCell ref="' + m + '"/>').join("") + "</mergeCells>" : "";
    const filter = sh.filter ? '<autoFilter ref="' + sh.filter + '"/>' : "";
    const cf = (sh.cf || []).map((x, i) =>
      '<conditionalFormatting sqref="' + x.sqref + '"><cfRule type="cellIs" dxfId="0" priority="' + (i + 1) + '" operator="' + x.op + '"><formula>' + x.val + "</formula></cfRule></conditionalFormatting>").join("");

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><tabColor rgb="' + NAVY + '"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<dimension ref="A1:' + colLetter(Math.max(maxC, 1)) + sh.rows.length + '"/>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0"' + (selected ? ' tabSelected="1"' : "") + ">" + pane + "</sheetView></sheetViews>" +
      '<sheetFormatPr defaultRowHeight="18"/>' + cols +
      "<sheetData>" + rowsXml + "</sheetData>" + filter + merges + cf +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="' + (sh.landscape ? "landscape" : "portrait") + '" fitToWidth="1" fitToHeight="0"/>' +
      '<headerFooter><oddFooter>&amp;LE-Absensi ITC&amp;RHalaman &amp;P dari &amp;N</oddFooter></headerFooter>' +
      "</worksheet>";
  }

  function build(sheets) {
    const te = new TextEncoder();
    const files = [];
    const add = (name, text) => files.push({ name: name, data: te.encode(text) });
    const NS = "http://schemas.openxmlformats.org/";

    add("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="' + NS + 'package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>");

    add("_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="' + NS + 'package/2006/relationships">' +
      '<Relationship Id="rId1" Type="' + NS + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>");

    const names = [];
    sheets.forEach((sh, i) => {
      if (sh.filter) {
        const [a, b] = sh.filter.split(":");
        const abs = (x) => x.replace(/([A-Z]+)(\d+)/, "$$$1$$$2");
        names.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(sh.name) + "'!" + abs(a) + ":" + abs(b) + "</definedName>");
      }
      if (sh.titleRow) {
        names.push('<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">\'' + esc(sh.name) + "'!$" + sh.titleRow + ":$" + sh.titleRow + "</definedName>");
      }
    });

    add("xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="' + NS + 'spreadsheetml/2006/main" xmlns:r="' + NS + 'officeDocument/2006/relationships">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>' +
      "<sheets>" + sheets.map((sh, i) => '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets>" +
      (names.length ? "<definedNames>" + names.join("") + "</definedNames>" : "") +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      "</workbook>");

    add("xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="' + NS + 'package/2006/relationships">' +
      sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="' + NS + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + NS + 'officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");

    add("xl/styles.xml", stylesXml());
    sheets.forEach((sh, i) => add("xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(sh, i === 0)));
    return zip(files);
  }

  /* ================= Format tanggal Indonesia ================= */
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const pad = (n) => String(n).padStart(2, "0");

  function waktuCetak(d) {
    d = d || new Date();
    return d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear() + " pukul " + pad(d.getHours()) + "." + pad(d.getMinutes());
  }
  function tanggalPendek(iso) {
    const p = String(iso).split("-");
    if (p.length !== 3) return String(iso);
    return p[2] + " " + BULAN[+p[1] - 1].slice(0, 3) + " " + p[0];
  }
  function stamp(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  /* ================= Hitung rekap keseluruhan ================= */
  // ms: Anggota, as: Absensi, ps: Pengajuan. Aturan hitung sama dengan tampilan di aplikasi.
  function hitungRekap(ms, as, ps) {
    const map = new Map((ms || []).map((m) => [m.id, { id: m.id, nama: m.nama, kelas: m.kelas, hadir: 0, izin: 0, sakit: 0, alpa: 0, kode: {} }]));
    const keys = new Set(), dates = new Set();

    for (const a of as || []) {
      const m = map.get(a.anggota_id);
      if (!m) continue;
      keys.add(a.anggota_id + "|" + a.tanggal);
      const st = String(a.status || "").toLowerCase();
      let k;
      if (st === "hadir") { m.hadir++; k = "H"; }
      else if (st === "izin") { m.izin++; k = "I"; }
      else if (st === "sakit") { m.sakit++; k = "S"; }
      else { m.alpa++; k = "A"; }
      m.kode[a.tanggal] = k;
      if (a.tanggal) dates.add(a.tanggal);
    }

    for (const r of ps || []) {
      const m = map.get(r.anggota_id);
      if (!m || keys.has(r.anggota_id + "|" + r.tanggal)) continue;
      let k = null;
      if (r.status === "diterima") {
        if (r.jenis === "izin") { m.izin++; k = "I"; }
        if (r.jenis === "sakit") { m.sakit++; k = "S"; }
      } else if (r.status === "ditolak") { m.alpa++; k = "A"; }
      if (k) {
        keys.add(r.anggota_id + "|" + r.tanggal);
        m.kode[r.tanggal] = k;
        if (r.tanggal) dates.add(r.tanggal);
      }
    }
    return { rows: Array.from(map.values()), dates: Array.from(dates).sort() };
  }

  /* ================= Laporan: Rekap Keseluruhan ================= */
  function buatRekap(data, waktu) {
    const rows = data.rows, dates = data.dates, n = rows.length;
    const HEAD = 5, first = HEAD + 1, last = HEAD + n, tot = last + 1;
    const when = waktu || waktuCetak();

    const sheet1 = {
      name: "Rekap Keseluruhan",
      widths: [6, 34, 14, 10, 10, 10, 10, 16, 16],
      rows: [
        { h: 34, c: [C.s("LAPORAN REKAP ABSENSI KESELURUHAN", "title")] },
        { h: 20, c: [C.s("E-Absensi ITC · SMK Ganesa", "info")] },
        { h: 20, c: [C.s("Dicetak: " + when + "  ·  " + n + " anggota  ·  " + dates.length + " pertemuan tercatat", "subtitle")] },
        { h: 10, c: [] },
        { h: 32, c: ["No", "Nama Anggota", "Kelas", "Hadir", "Izin", "Sakit", "Alpa", "Total Pertemuan", "Kehadiran (%)"].map((t) => C.s(t, "header")) }
      ],
      merges: ["A1:I1", "A2:I2", "A3:I3"],
      freeze: { r: HEAD, c: 0 },
      filter: "A" + HEAD + ":I" + last,
      titleRow: HEAD,
      cf: [{ sqref: "G" + first + ":G" + last, op: "greaterThan", val: "0" }]
    };

    const sum = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    rows.forEach((m, i) => {
      const r = first + i, alt = i % 2 === 1;
      const total = m.hadir + m.izin + m.sakit + m.alpa;
      sum.hadir += m.hadir; sum.izin += m.izin; sum.sakit += m.sakit; sum.alpa += m.alpa;
      sheet1.rows.push({
        h: 21,
        c: [
          C.n(i + 1, alt ? "centerAlt" : "center"),
          C.s(m.nama || "-", alt ? "textAlt" : "text"),
          C.s(m.kelas || "-", alt ? "centerAlt" : "center"),
          C.n(m.hadir, alt ? "centerAlt" : "center"),
          C.n(m.izin, alt ? "centerAlt" : "center"),
          C.n(m.sakit, alt ? "centerAlt" : "center"),
          C.n(m.alpa, alt ? "centerAlt" : "center"),
          C.f("SUM(D" + r + ":G" + r + ")", total, alt ? "centerAlt" : "center"),
          C.f("IF(H" + r + "=0,0,D" + r + "/H" + r + ")", total ? m.hadir / total : 0, alt ? "pctAlt" : "pct")
        ]
      });
    });

    const grand = sum.hadir + sum.izin + sum.sakit + sum.alpa;
    const colSum = (L, v) => C.f("SUM(" + L + first + ":" + L + last + ")", v, "totalNum");
    sheet1.rows.push({
      h: 24,
      c: [
        C.s("TOTAL KESELURUHAN", "totalLabel"), C.e("totalLabel"), C.e("totalLabel"),
        colSum("D", sum.hadir), colSum("E", sum.izin), colSum("F", sum.sakit), colSum("G", sum.alpa), colSum("H", grand),
        C.f("IF(H" + tot + "=0,0,D" + tot + "/H" + tot + ")", grand ? sum.hadir / grand : 0, "totalPct")
      ]
    });
    sheet1.merges.push("A" + tot + ":C" + tot);
    sheet1.rows.push({ h: 10, c: [] });
    sheet1.rows.push({ h: 20, c: [C.s("Keterangan: Kehadiran (%) = Hadir ÷ Total Pertemuan. Izin dan Sakit tidak dihitung sebagai hadir.", "note")] });
    sheet1.merges.push("A" + (tot + 2) + ":I" + (tot + 2));

    const sheets = [sheet1];

    if (dates.length) {
      const lastCol = colLetter(3 + dates.length);
      const sheet2 = {
        name: "Detail per Pertemuan",
        widths: [6, 34, 14].concat(dates.map(() => 13)),
        landscape: true,
        rows: [
          { h: 34, c: [C.s("DETAIL KEHADIRAN PER PERTEMUAN", "title")] },
          { h: 20, c: [C.s("Dicetak: " + when, "subtitle")] },
          { h: 20, c: [C.s("Keterangan:  H = Hadir   ·   I = Izin   ·   S = Sakit   ·   A = Alpa   ·   - = tidak tercatat", "subtitle")] },
          { h: 10, c: [] },
          { h: 32, c: ["No", "Nama Anggota", "Kelas"].concat(dates.map(tanggalPendek)).map((t) => C.s(t, "header")) }
        ],
        merges: ["A1:" + lastCol + "1", "A2:" + lastCol + "2", "A3:" + lastCol + "3"],
        freeze: { r: HEAD, c: 3 },
        titleRow: HEAD
      };
      const codeStyle = { H: "codeH", I: "codeI", S: "codeS", A: "codeA" };
      rows.forEach((m, i) => {
        const alt = i % 2 === 1;
        sheet2.rows.push({
          h: 21,
          c: [C.n(i + 1, alt ? "centerAlt" : "center"), C.s(m.nama || "-", alt ? "textAlt" : "text"), C.s(m.kelas || "-", alt ? "centerAlt" : "center")]
            .concat(dates.map((d) => {
              const k = m.kode[d];
              return k ? C.s(k, codeStyle[k]) : C.s("-", "codeNone");
            }))
        });
      });
      sheets.push(sheet2);
    }
    return build(sheets);
  }

  /* ================= Laporan: Data Anggota ================= */
  function buatAnggota(list, waktu) {
    const n = list.length, HEAD = 5, first = HEAD + 1, last = HEAD + n;
    const sheet = {
      name: "Data Anggota",
      widths: [6, 34, 14, 36, 20],
      rows: [
        { h: 34, c: [C.s("LAPORAN DATA ANGGOTA", "title")] },
        { h: 20, c: [C.s("E-Absensi ITC · SMK Ganesa", "info")] },
        { h: 20, c: [C.s("Dicetak: " + (waktu || waktuCetak()) + "  ·  " + n + " anggota", "subtitle")] },
        { h: 10, c: [] },
        { h: 30, c: ["No", "Nama Anggota", "Kelas", "Email", "No. Telepon"].map((t) => C.s(t, "header")) }
      ],
      merges: ["A1:E1", "A2:E2", "A3:E3"],
      freeze: { r: HEAD, c: 0 },
      filter: "A" + HEAD + ":E" + last,
      titleRow: HEAD
    };
    list.forEach((m, i) => {
      const alt = i % 2 === 1;
      sheet.rows.push({
        h: 21,
        c: [
          C.n(i + 1, alt ? "centerAlt" : "center"),
          C.s(m.nama || "-", alt ? "textAlt" : "text"),
          C.s(m.kelas || "-", alt ? "centerAlt" : "center"),
          C.s(m.email || "-", alt ? "textAlt" : "text"),
          C.s(m.no_hp || "-", alt ? "centerAlt" : "center")   // disimpan sebagai teks supaya angka 0 di depan tidak hilang
        ]
      });
    });
    return build([sheet]);
  }

  /* ================= Simpan file ================= */
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  function toBase64(bytes) {
    let s = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    return btoa(s);
  }

  // Di aplikasi Android: lewat jembatan AndroidBridge (simpan ke folder Download).
  // Di browser biasa: unduh langsung.
  function simpan(filename, bytes) {
    if (global.AndroidBridge && typeof global.AndroidBridge.saveFile === "function") {
      global.AndroidBridge.saveFile(filename, XLSX_MIME, toBase64(bytes));
      return "android";
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "browser";
  }

  global.XlsxLite = { build: build, STYLE: STYLE, cell: C };
  global.Laporan = { hitungRekap: hitungRekap, buatRekap: buatRekap, buatAnggota: buatAnggota, simpan: simpan, stamp: stamp };
})(typeof window !== "undefined" ? window : globalThis);
