'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadPyodideRuntime } from '@/lib/pyodide';

const examples = [
  {
    id: 'overview',
    label: 'Lấy dữ liệu VNM',
    code: `import json\nfrom pyodide.http import pyfetch\n\nresponse = await pyfetch('/api/public/vnstock-data?symbol=VNM&data_type=ohlcv&period=1M')\ndata = await response.json()\njson.dumps({\n    'symbol': data['symbol'],\n    'rows': len(data['rows']),\n    'period': data['period']\n}, ensure_ascii=False, indent=2)`
  },
  {
    id: 'summary',
    label: 'Tổng hợp nhanh',
    code: `from pyodide.http import pyfetch\n\nresponse = await pyfetch('/api/public/vnstock-data?symbol=FPT&data_type=summary&period=1M')\nprint(await response.text())`
  }
];

export function PlaygroundPanel() {
  const t = useTranslations('playground');
  const [selectedExample, setSelectedExample] = useState(examples[0]);
  const [code, setCode] = useState(examples[0].code);
  const [output, setOutput] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const exampleLabel = useMemo(() => selectedExample.label, [selectedExample]);

  useEffect(() => {
    let cancelled = false;
    void loadPyodideRuntime()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOutput(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function runCode() {
    setLoading(true);
    setOutput('');

    try {
      const pyodide = await loadPyodideRuntime();
      const result = await pyodide.runPythonAsync(code);
      setOutput(typeof result === 'string' ? result : String(result ?? 'OK'));
    } catch (runError) {
      setOutput(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setLoading(false);
    }
  }

  function resetExample(nextExample = selectedExample) {
    setCode(nextExample.code);
    setOutput('');
  }

  return (
    <section id="vnstock" className="container pb-16 md:pb-20">
      <div className="mb-6 space-y-3">
        <div className="badge">{t('badge')}</div>
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{t('title')}</h2>
        <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{t('lead')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card rounded-[1.75rem] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('example')}</label>
              <select
                className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none"
                value={selectedExample.id}
                onChange={(event) => {
                  const nextExample = examples.find((entry) => entry.id === event.target.value) ?? examples[0];
                  setSelectedExample(nextExample);
                  resetExample(nextExample);
                }}
              >
                {examples.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={runCode}
                disabled={!ready || loading}
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t('loading') : t('run')}
              </button>
              <button
                type="button"
                onClick={() => resetExample()}
                className="rounded-full border border-slate-700/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-300/70"
              >
                {t('reset')}
              </button>
            </div>
          </div>

          <textarea
            className="mt-4 min-h-[420px] w-full rounded-[1.5rem] border border-slate-700/80 bg-slate-950/85 p-4 font-mono text-sm text-slate-100 outline-none"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="grid gap-4 content-start">
          <div className="card rounded-[1.75rem] p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('output')}</div>
            <pre className="mt-4 min-h-[280px] whitespace-pre-wrap break-words rounded-[1.35rem] border border-white/8 bg-slate-950/70 p-4 text-sm leading-7 text-slate-200">
              {output || (ready ? `${exampleLabel} → ${t('loading')}` : t('loading'))}
            </pre>
          </div>
          <div className="card rounded-[1.75rem] p-5 text-sm leading-7 text-slate-300">
            Pyodide chạy trong trình duyệt, và các ví dụ chỉ gọi relay same-origin. Không có server-side execution trong surface này.
          </div>
        </div>
      </div>
    </section>
  );
}
