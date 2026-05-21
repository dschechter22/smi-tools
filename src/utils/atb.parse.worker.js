import * as XLSX from 'xlsx';

function post(type, payload) { self.postMessage({ type, ...payload }); }

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    post('progress', { pct: 10, status: 'Reading file…' });
    if (!['xlsx', 'xls'].includes(ext)) throw new Error('ATB files must be Excel (.xlsx or .xls).');
    const wb = XLSX.read(file, { type: 'array', cellDates: true });
    post('progress', { pct: 50, status: 'Converting…' });
    let sheet = null;
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
      if (rows.length > 0) { sheet = wb.Sheets[name]; break; }
    }
    if (!sheet) throw new Error('No data found in Excel file.');
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    post('progress', { pct: 90, status: `Loaded ${rawRows.length.toLocaleString()} rows…` });
    post('complete', { rows: rawRows });
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
