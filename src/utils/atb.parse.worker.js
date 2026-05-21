import * as XLSX from 'xlsx';

function post(type, payload) { self.postMessage({ type, ...payload }); }

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    post('progress', { pct: 5, status: 'Reading sheet names…' });
    if (!['xlsx', 'xls', 'xlsb'].includes(ext)) throw new Error('ATB files must be Excel (.xlsb, .xlsx, or .xls).');

    // Pass 1: read only sheet names — very cheap, no cell data loaded
    const wbMeta = XLSX.read(file, { type: 'array', bookSheets: true });
    const sheetNames = wbMeta.SheetNames;
    post('progress', { pct: 20, status: `Found sheets: ${sheetNames.join(', ')}` });

    // Find "Debit" (case-insensitive)
    const targetName = sheetNames.find(n => n.trim().toLowerCase() === 'debit')
      ?? sheetNames[0];

    post('progress', { pct: 30, status: `Loading sheet "${targetName}" only…` });

    // Pass 2: load ONLY the target sheet — skips parsing the other sheets entirely
    const wb = XLSX.read(file, {
      type: 'array',
      dense: true,
      sheets: targetName,
    });

    const sheet = wb.Sheets[targetName];
    if (!sheet) throw new Error(`Sheet "${targetName}" could not be loaded. Available: ${sheetNames.join(', ')}`);

    const ref = sheet['!ref'] || (sheet['!data'] ? `dense(${sheet['!data'].length}r)` : 'none');
    post('progress', { pct: 60, status: `Parsing "${targetName}" — range: ${ref}` });

    const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    post('progress', { pct: 80, status: `Raw rows: ${rawArrays.length}, cols: ${rawArrays[0]?.length ?? 0}` });

    if (rawArrays.length < 2) {
      throw new Error(`Sheet "${targetName}" returned ${rawArrays.length} rows (range=${ref}).`);
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
      throw new Error(`Sheet "${targetName}" has headers but no data rows. Headers: ${headers.slice(0, 6).join(', ')}`);
    }

    const sampleKeys = headers.slice(0, 8).join(', ');
    post('progress', { pct: 95, status: `Loaded ${rawRows.length.toLocaleString()} rows — cols: ${sampleKeys}` });
    post('complete', { rows: rawRows, sheetName: targetName, sampleKeys });
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
