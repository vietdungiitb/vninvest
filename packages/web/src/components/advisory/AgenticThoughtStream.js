/**
 * AgenticThoughtStream — Animated thought stream for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement, useState, useEffect, useRef } from 'react';

const e = createElement;

export function AgenticThoughtStream({ content, typingSpeedMs = 15 }) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const prevContentRef = useRef('');

  const phases = [
    'Analyzing institution order flow...',
    'Correlating intraday dark pool momentum...',
    'Finalizing executive summary...',
  ];

  useEffect(() => {
    if (content !== prevContentRef.current) {
      setDisplayedContent('');
      prevContentRef.current = content;
      setThinkingPhase(content ? 1 : 0);
    }

    if (!content) {
      setDisplayedContent('');
      setIsTyping(false);
      setThinkingPhase(0);
      return;
    }

    if (thinkingPhase > 0 && thinkingPhase < 4) {
      const phaseTimer = setTimeout(() => {
        setThinkingPhase(prev => (prev < 3 ? prev + 1 : 4));
      }, 600 + Math.random() * 400);
      return () => clearTimeout(phaseTimer);
    }

    if (thinkingPhase === 4 && displayedContent.length < content.length) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        const addChars = Math.floor(Math.random() * 6) + 2;
        setDisplayedContent(prev => content.slice(0, prev.length + addChars));
      }, typingSpeedMs);

      return () => clearTimeout(timer);
    } else if (thinkingPhase === 4) {
      setIsTyping(false);
    }
  }, [content, displayedContent, typingSpeedMs, thinkingPhase]);

  if (!content) return null;

  return e(
    'div',
    { className: 'min-h-[100px] flex flex-col justify-start' },
    thinkingPhase > 0 && thinkingPhase < 4 && e(
      'div',
      { className: 'flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-300' },
      phases.slice(0, thinkingPhase).map((p, idx) => e(
        'div',
        { key: idx, className: 'flex items-center gap-3' },
        e('div', { className: `w-1.5 h-1.5 rounded-full ${idx === thinkingPhase - 1 ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}` }),
        e('span', { className: `text-[10px] font-black uppercase tracking-widest ${idx === thinkingPhase - 1 ? 'text-slate-200' : 'text-slate-600'}` }, p)
      ))
    ),
    thinkingPhase === 4 && e(
      'p',
      { className: 'text-slate-300 text-[13px] whitespace-pre-line leading-7 selection:bg-cyan-500/30 animate-in fade-in duration-700' },
      displayedContent,
      isTyping && e('span', { className: 'inline-block w-1.5 h-3 ml-1 mb-0.5 bg-cyan-400 animate-pulse align-baseline shadow-[0_0_8px_rgba(34,211,238,0.8)]' })
    )
  );
}

export default AgenticThoughtStream;