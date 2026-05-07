export interface PyodideRuntime {
  runPythonAsync: (code: string) => Promise<unknown>;
}

let runtimePromise: Promise<PyodideRuntime> | null = null;

function ensureScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pyodide-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.dataset.pyodideSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Không tải được Pyodide từ ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadPyodideRuntime(version = '0.26.2'): Promise<PyodideRuntime> {
  if (typeof window === 'undefined') {
    throw new Error('Pyodide chỉ có thể load trong browser');
  }

  if (runtimePromise) {
    return runtimePromise;
  }

  const baseUrl = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
  runtimePromise = ensureScript(`${baseUrl}pyodide.js`).then(async () => {
    const loadPyodide = (window as typeof window & {
      loadPyodide?: (options: { indexURL: string }) => Promise<{
        runPythonAsync: (code: string) => Promise<unknown>;
      }>;
    }).loadPyodide;

    if (!loadPyodide) {
      throw new Error('Pyodide loader không sẵn sàng');
    }

    return loadPyodide({ indexURL: baseUrl });
  });

  return runtimePromise;
}
