import AtbParseWorker from './atb.parse.worker.js?worker';

export function parseAtbFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'xlsb', 'csv'].includes(ext)) {
      reject(new Error('ATB files must be .csv, .xlsb, .xlsx, or .xls.'));
      return;
    }

    const worker = new AtbParseWorker();
    const allRows = [];

    worker.onmessage = (e) => {
      const { type, ...payload } = e.data;
      if (type === 'progress') {
        onProgress?.(payload.pct, payload.status);
      } else if (type === 'chunk') {
        allRows.push(...payload.rows);
        onProgress?.(null, `Received ${allRows.length.toLocaleString()} rows…`);
      } else if (type === 'complete') {
        worker.terminate();
        resolve({ rows: allRows, sheetName: payload.sheetName, sampleKeys: payload.sampleKeys });
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(payload.message));
      }
    };
    worker.onerror = (err) => { worker.terminate(); reject(new Error(err.message || 'Worker error')); };

    if (ext === 'csv') {
      // Pass File object directly — PapaParse uses chunked FileReader for true streaming
      worker.postMessage({ file, ext });
    } else {
      file.arrayBuffer().then(buffer => {
        worker.postMessage({ file: new Uint8Array(buffer), ext }, [buffer]);
      }).catch(reject);
    }
  });
}
