import * as XLSX from 'xlsx';

function post(type, payload) { self.postMessage({ type, ...payload }); }

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    post('progress', { pct: 10, status: 'Reading file…' });
    if (!['xlsx', 'xls', 'xlsb'].includes(ext)) throw new Error('ATB files must be Excel (.xlsx, .xls, or .xlsb).');
    const wb = XLSX.read(file, { type: 'array', cellDates: true });
    post('progress', { pct: 50, status: 'Converting…' });
    const DEBIT_SHEET = 'Debit';
    let sheet = wb.Sheets[DEBIT_SHEET];
    if (!sheet) {
      const fallback = wb.SheetNames.find(n => wb.Sheets[n] && XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' }).length > 0);
      if (!fallback) throw new Error('No "Debit" sheet found and no sheets with data.');
      sheet = wb.Sheets[fallback];
    }
    if (!sheet) throw new Error('No data found in Excel file.');
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    post('progress', { pct: 90, status: `Loaded ${rawRows.length.toLocaleString()} rows…` });
    post('complete', { rows: rawRows });
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
