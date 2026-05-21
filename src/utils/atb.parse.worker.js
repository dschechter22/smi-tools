import * as XLSX from 'xlsx';

function post(type, payload) { self.postMessage({ type, ...payload }); }

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    post('progress', { pct: 10, status: 'Reading file…' });
    if (!['xlsx', 'xls', 'xlsb'].includes(ext)) throw new Error('ATB files must be Excel (.xlsb, .xlsx, or .xls).');

    const wb = XLSX.read(file, { type: 'array' });
    post('progress', { pct: 40, status: `Found sheets: ${wb.SheetNames.join(', ')}` });

    // Case-insensitive match for "Debit"
    const debitName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'debit');
    let selectedName = debitName;

    if (!selectedName) {
      // Fall back to whichever sheet has the most raw rows
      let maxRows = 0;
      for (const name of wb.SheetNames) {
        const arrs = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
        if (arrs.length > maxRows) { maxRows = arrs.length; selectedName = name; }
      }
    }

    if (!selectedName) throw new Error(`No usable sheet found. Sheets: ${wb.SheetNames.join(', ')}`);

    const sheet = wb.Sheets[selectedName];
    const ref = sheet['!ref'] || 'none';
    post('progress', { pct: 60, status: `Sheet "${selectedName}" — range: ${ref}` });

    // Use header:1 (raw arrays) so merged/blank header cells don't break the parse
    const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    post('progress', { pct: 75, status: `Raw rows: ${rawArrays.length}, cols in row 1: ${rawArrays[0]?.length ?? 0}` });

    if (rawArrays.length < 2) {
      throw new Error(
        `Sheet "${selectedName}" returned ${rawArrays.length} raw rows (range=${ref}). ` +
        `All sheets: ${wb.SheetNames.join(', ')}`
      );
    }

    // First row = headers; remaining rows = data
    const headers = rawArrays[0].map(h => String(h == null ? '' : h).trim());
    const rawRows = rawArrays.slice(1)
      .filter(arr => arr.some(v => v !== ''))   // skip fully-blank rows
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
