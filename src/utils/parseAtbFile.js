import AtbParseWorker from './atb.parse.worker.js?worker';

export function parseAtbFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      reject(new Error('ATB files must be Excel (.xlsx or .xls).'));
      return;
    }
    const worker = new AtbParseWorker();
    worker.onmessage = (e) => {
      const { type, ...payload } = e.data;
      if (type === 'progress') onProgress?.(payload.pct, payload.status);
      else if (type === 'complete') { worker.terminate(); resolve(payload.rows); }
      else if (type === 'error') { worker.terminate(); reject(new Error(payload.message)); }
    };
    worker.onerror = (err) => { worker.terminate(); reject(new Error(err.message || 'Worker error')); };
    file.arrayBuffer().then(buffer => {
      worker.postMessage({ file: new Uint8Array(buffer), ext }, [buffer]);
    }).catch(reject);
  });
}
