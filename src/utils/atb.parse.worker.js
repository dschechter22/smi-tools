import * as XLSX from 'xlsx';

function post(type, payload) { self.postMessage({ type, ...payload }); }

function findSheet(wb, name) {
  // Direct lookup first
  if (wb.Sheets[name]) return { key: name, sheet: wb.Sheets[name] };
  // Fuzzy: iterate actual keys in case of encoding mismatch
  const actualKeys = Object.keys(wb.Sheets);
  const match = actualKeys.find(k => k.trim().toLowerCase() === name.trim().toLowerCase());
  if (match && wb.Sheets[match]) return { key: match, sheet: wb.Sheets[match] };
  return null;
}

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    post('progress', { pct: 10, status: 'Reading file…' });
    if (!['xlsx', 'xls', 'xlsb'].includes(ext)) throw new Error('ATB files must be Excel (.xlsb, .xlsx, or .xls).');

    // dense:true is more memory-efficient for large xlsb and avoids cell-map issues
    const wb = XLSX.read(file, { type: 'array', dense: true });

    const sheetNamesStr = wb.SheetNames.join(', ');
    const sheetsKeysStr = Object.keys(wb.Sheets).join(', ');
    post('progress', { pct: 40, status: `SheetNames: [${sheetNamesStr}] — Sheets keys: [${sheetsKeysStr}]` });

    // Find "Debit" sheet
    let found = null;
    const debitName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'debit');
    if (debitName) found = findSheet(wb, debitName);

    // Fallback: largest sheet by raw row count
    if (!found) {
      let maxRows = -1;
      for (const name of wb.SheetNames) {
        const r = findSheet(wb, name);
        if (!r) continue;
        const arrs = XLSX.utils.sheet_to_json(r.sheet, { header: 1, defval: '' });
        if (arrs.length > maxRows) { maxRows = arrs.length; found = r; }
      }
    }

    if (!found) {
      throw new Error(`Could not access any sheet. SheetNames=[${sheetNamesStr}] Sheets keys=[${sheetsKeysStr}]`);
    }

    const { key: selectedName, sheet } = found;
    const ref = sheet['!ref'] || (sheet['!data'] ? `dense(${sheet['!data'].length} rows)` : 'none');
    post('progress', { pct: 60, status: `Sheet "${selectedName}" — range: ${ref}` });

    const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    post('progress', { pct: 75, status: `Raw rows: ${rawArrays.length}, cols: ${rawArrays[0]?.length ?? 0}` });

    if (rawArrays.length < 2) {
      throw new Error(`Sheet "${selectedName}" has ${rawArrays.length} raw rows (${ref}). Available sheets: ${sheetNamesStr}`);
    }

    const headers = rawArrays[0].map(h => String(h == null ? '' : h).trim());
    const rawRows = rawArrays.slice(1)
      .filter(arr => arr.some(v => v !== ''))
      .map(arr => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = arr[i] ?? ''; });
        return obj;
      });

    if (rawRows.length === 0) {
      throw new Error(`Sheet "${selectedName}" has headers but no data rows. Headers: ${headers.slice(0, 6).join(', ')}`);
    }

    const sampleKeys = headers.slice(0, 8).join(', ');
    post('progress', { pct: 90, status: `Loaded ${rawRows.length.toLocaleString()} rows — cols: ${sampleKeys}` });
    post('complete', { rows: rawRows, sheetName: selectedName, sampleKeys });
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
