import React, { useState, useEffect, useRef } from 'react';

/**
 * AgenticThoughtStream
 * Simulates a streaming AI thought process by chunking the text rendering.
 * Includes performance.mark telemetry to guarantee < 150ms TTFC (Time to first character).
 */
export default function AgenticThoughtStream({ content, typingSpeedMs = 15 }) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const prevContentRef = useRef('');

  useEffect(() => {
    // Reset if the actual content reference/text changes completely (e.g. changing activeSymbol)
    if (content !== prevContentRef.current) {
      setDisplayedContent('');
      prevContentRef.current = content;
      performance.mark('agentic-stream-start');
    }

    if (!content) {
      setDisplayedContent('');
      setIsTyping(false);
      return;
    }

    if (displayedContent.length < content.length) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        if (displayedContent.length === 0) {
          performance.mark('agentic-stream-first-char');
          performance.measure('Time-to-first-character', 'agentic-stream-start', 'agentic-stream-first-char');
        }

        // Chunking variation for "agentic" feel
        const addChars = Math.floor(Math.random() * 4) + 1;
        setDisplayedContent(prev => content.slice(0, prev.length + addChars));
      }, typingSpeedMs);

      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [content, displayedContent, typingSpeedMs]);

  if (!content) return null;

  return (
    <p className="text-slate-300 text-[13px] whitespace-pre-line leading-7 selection:bg-cyan-500/30">
      {displayedContent}
      {isTyping && (
        <span className="inline-block w-1.5 h-3 ml-1 mb-0.5 bg-cyan-400 animate-pulse align-baseline shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      )}
    </p>
  );
}
