import * as XLSX from 'xlsx';

function post(type, payload) { self.postMessage({ type, ...payload }); }

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    post('progress', { pct: 10, status: 'Reading file…' });
    if (!['xlsx', 'xls', 'xlsb'].includes(ext)) throw new Error('ATB files must be Excel (.xlsb, .xlsx, or .xls).');

    const wb = XLSX.read(file, { type: 'array', cellDates: true });
    post('progress', { pct: 40, status: `Found sheets: ${wb.SheetNames.join(', ')}` });

    // Case-insensitive match for "Debit"
    const debitName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'debit');
    let selectedName = debitName;

    if (!selectedName) {
      // Fall back to whichever sheet has the most rows
      let maxRows = 0;
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
        if (rows.length > maxRows) { maxRows = rows.length; selectedName = name; }
      }
    }

    if (!selectedName) throw new Error(`No usable sheet found. Sheets in file: ${wb.SheetNames.join(', ')}`);

    post('progress', { pct: 60, status: `Reading sheet "${selectedName}"…` });
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[selectedName], { defval: '' });

    if (rawRows.length === 0) {
      throw new Error(`Sheet "${selectedName}" appears to be empty. Sheets available: ${wb.SheetNames.join(', ')}`);
    }

    // Send first-row keys as a diagnostic so we can verify column names
    const sampleKeys = Object.keys(rawRows[0]).slice(0, 8).join(', ');
    post('progress', { pct: 90, status: `Loaded ${rawRows.length.toLocaleString()} rows from "${selectedName}"` });
    post('complete', { rows: rawRows, sheetName: selectedName, sampleKeys });
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
