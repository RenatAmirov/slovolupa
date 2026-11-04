export function createDjvuReader(buffer) {
  const worker = new Worker(new URL('./djvu-worker.js', import.meta.url));
  const pending = new Map();
  let nextId = 0;
  let workerError;

  function rejectPending(error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  worker.addEventListener('message', ({ data: { id, result, error } }) => {
    const request = pending.get(id);
    pending.delete(id);
    if (!request) result?.close?.();
    else if (error) request.reject(new Error(error));
    else request.resolve(result);
  });
  worker.addEventListener('error', () => {
    workerError = new Error('Не удалось запустить обработчик DjVu.');
    rejectPending(workerError);
  });

  function request(operation, data, transfer = []) {
    const id = ++nextId;
    const promise = new Promise((resolve, reject) => {
      if (workerError) {
        reject(workerError);
        return;
      }
      pending.set(id, { resolve, reject });
      try {
        worker.postMessage({ id, operation, data }, transfer);
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
    return {
      promise,
      cancel() {
        const entry = pending.get(id);
        pending.delete(id);
        entry?.reject(new DOMException('Просмотр отменён.', 'AbortError'));
      },
    };
  }

  return {
    promise: request('open', buffer, [buffer]).promise.then((numPages) => ({
      numPages,
      async getPage(number) {
        const { width, height, blocks } = await request('page', { number }).promise;
        return {
          width, height, blocks,
          render(canvas) {
            const job = request('render', { number, width: canvas.width, height: canvas.height });
            return {
              cancel: job.cancel,
              promise: job.promise.then((image) => {
                try { canvas.getContext('2d').drawImage(image, 0, 0); }
                finally { image.close(); }
              }),
            };
          },
        };
      },
    })),
    async destroy() {
      worker.terminate();
      rejectPending(new DOMException('Документ закрыт.', 'AbortError'));
    },
  };
}
