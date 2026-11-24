var PTX = function() {
  const enc = new TextEncoder;
  const xml = s => String(s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const colName = i => {
    let s = "";
    i++;
    while (i) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/;
  function serial(m) {
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    return ms / 864e5 + 25569;
  }
  const BANDS = [ "FCE8E6", "E6F4EA", "E8F0FE", "FEF7E0", "F3E8FD", "E0F2F1", "FDE7F3", "ECEFF1" ];
  function stylesXml() {
    const fills = [ '<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>' ].concat(BANDS.map(c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`));
    const xfs = [ '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>', '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' ].concat(BANDS.map((_, i) => `<xf numFmtId="0" fontId="1" fillId="${i + 2}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>`)).concat(BANDS.map((_, i) => `<xf numFmtId="0" fontId="2" fillId="${i + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` + `<numFmts count="2"><numFmt numFmtId="164" formatCode="d mmm yyyy"/><numFmt numFmtId="165" formatCode="d mmm yyyy, h:mm AM/PM"/></numFmts>` + `<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts>` + `<fills count="${fills.length}">${fills.join("")}</fills>` + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>` + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
  function sheetXml(sh, strings) {
    const S = v => {
      let i = strings.map.get(v);
      if (i === undefined) {
        i = strings.list.length;
        strings.list.push(v);
        strings.map.set(v, i);
      }
      return i;
    };
    const cell = (r, c, v, style) => {
      const ref = colName(c) + r;
      if (v === null || v === undefined || v === "") return style ? `<c r="${ref}" s="${style}"/>` : "";
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${v}</v></c>`;
      const m = typeof v === "string" && DATE_RE.exec(v);
      if (m && !style) return `<c r="${ref}" s="${m[4] ? 2 : 1}"><v>${serial(m)}</v></c>`;
      return `<c r="${ref}" t="s"${style ? ` s="${style}"` : ""}><v>${S(String(v).slice(0, 32e3))}</v></c>`;
    };
    const out = [];
    let r = 1;
    const merges = [];
    const bandOf = [];
    (sh.groups || [ [ "", sh.header ] ]).forEach(([, cols], gi) => cols.forEach(() => bandOf.push(gi % BANDS.length)));
    if (sh.groups) {
      let c = 0, cells = "";
      sh.groups.forEach(([title, cols], gi) => {
        cols.forEach((_, k) => {
          cells += cell(r, c + k, k === 0 ? title : "", 3 + BANDS.length + gi % BANDS.length);
        });
        c += cols.length;
      });
      out.push(`<row r="${r}">${cells}</row>`);
      r++;
    }
    out.push(`<row r="${r}" ht="30" customHeight="1">${sh.header.map((h, c) => cell(r, c, h, 3 + bandOf[c])).join("")}</row>`);
    const headRow = r;
    r++;
    for (const row of sh.rows) {
      out.push(`<row r="${r}">${row.map((v, c) => cell(r, c, v)).join("")}</row>`);
      r++;
    }
    const last = colName(sh.header.length - 1);
    const cols = (sh.widths || sh.header.map(h => Math.max(12, Math.min(40, String(h).length + 4)))).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` + `<sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="${headRow}" topLeftCell="C${headRow + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${out.join("")}</sheetData>` + `<autoFilter ref="A${headRow}:${last}${Math.max(headRow, r - 1, sh.filterRows || 0)}"/>${merges.length ? "" : ""}</worksheet>`;
  }
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = b => {
    let c = 4294967295;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ c >>> 8;
    return (c ^ 4294967295) >>> 0;
  };
  function zip(files) {
    const parts = [], central = [];
    let off = 0;
    for (const [name, text] of files) {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 67324752, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 2048, true);
      h.setUint16(8, 0, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, 33, true);
      h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true);
      h.setUint32(22, data.length, true);
      h.setUint16(26, nb.length, true);
      h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 33639248, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 2048, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, 0, true);
      c.setUint16(14, 33, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true);
      c.setUint16(28, nb.length, true);
      c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 101010256, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true);
    e.setUint32(16, off, true);
    const all = parts.concat(central, [ new Uint8Array(e.buffer) ]), total = all.reduce((n, p) => n + p.length, 0), out = new Uint8Array(total);
    let at = 0;
    for (const p of all) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
  function workbook(sheets) {
    const strings = {
      list: [],
      map: new Map
    };
    const ws = sheets.map(sh => sheetXml(sh, strings));
    const name = s => xml(String(s).replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    return zip([ [ "[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>` ], [ "_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` ], [ "xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${name(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${sheets.map((s, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${name(s.name).replace(/'/g, "''")}'!$A$${s.groups ? 2 : 1}:$${colName(s.header.length - 1)}$${Math.max((s.groups ? 2 : 1) + Math.max(1, s.rows.length), s.filterRows || 0)}</definedName>`).join("")}</definedNames></workbook>` ], [ "xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` ], [ "xl/styles.xml", stylesXml() ], ...ws.map((w, i) => [ `xl/worksheets/sheet${i + 1}.xml`, w ]), [ "xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.list.length}" uniqueCount="${strings.list.length}">${strings.list.map(s => `<si><t xml:space="preserve">${xml(s)}</t></si>`).join("")}</sst>` ] ]);
  }
  return {
    workbook: workbook,
    crc32: crc32,
    colName: colName
  };
}();

if (typeof module !== "undefined") module.exports = PTX;