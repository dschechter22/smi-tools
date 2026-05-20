import ParseWorker from './parse.worker.js?worker';

export function parseFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (!['csv', 'txt', 'tsv', 'xlsx', 'xls'].includes(ext)) {
      reject(new Error(`Unsupported file type: .${ext}. Please upload a .csv, .xlsx, .xls, or .txt file.`));
      return;
    }

    const worker = new ParseWorker();

    worker.onmessage = (e) => {
      const { type, ...payload } = e.data;
      if (type === 'progress') {
        onProgress?.(payload.pct, payload.status);
      } else if (type === 'complete') {
        worker.terminate();
        resolve({ rows: payload.rows, columnMeta: payload.columnMeta });
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(payload.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Worker error'));
    };

    if (ext === 'xlsx' || ext === 'xls') {
      // Transfer the ArrayBuffer to the worker (zero-copy)
      file.arrayBuffer().then((buffer) => {
        worker.postMessage({ file: new Uint8Array(buffer), fileSize: file.size, ext }, [buffer]);
      }).catch(reject);
    } else {
      // File is structured-cloneable, post directly
      worker.postMessage({ file, fileSize: file.size, ext });
    }
  });
}
