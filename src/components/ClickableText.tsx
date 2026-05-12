// ClickableText — three independent ways to pick a word or phrase:
//
//   1. Click a word           → look up that single word.
//   2. Press, drag across      → look up the joined phrase (window-level
//      words, release          mouse listeners + hit-test against word boxes).
//   3. Shift+click             → first Shift+click marks an anchor; second
//                                Shift+click closes the range and looks up
//                                the phrase between them.
//
// The Shift+click path needs no drag tracking and is the most reliable
// fallback for environments where pointer-drag is unreliable.

import { useMemo, useRef, useState } from "react";

interface Token {
  text: string;
  isWord: boolean;
}

function tokenize(text: string): Token[] {
  const re = /([A-Za-z][A-Za-z'’-]*)/g;
  const tokens: Token[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ text: text.slice(lastIdx, m.index), isWord: false });
    }
    tokens.push({ text: m[0], isWord: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    tokens.push({ text: text.slice(lastIdx), isWord: false });
  }
  return tokens;
}

function positionOfToken(tokens: Token[], targetIdx: number): number {
  let pos = 0;
  for (let i = 0; i < targetIdx; i++) {
    pos += tokens[i].text.length;
  }
  return pos;
}

interface ClickableTextProps {
  text: string;
  onSelectToken: (selectedText: string, fullSentence: string) => void;
}

export default function ClickableText({ text, onSelectToken }: ClickableTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);

  const wordIdxToToken = useMemo(() => {
    const m: Record<number, number> = {};
    let w = 0;
    tokens.forEach((t, i) => {
      if (t.isWord) m[w++] = i;
    });
    return m;
  }, [tokens]);

  const totalWords = useMemo(() => tokens.filter((t) => t.isWord).length, [tokens]);

  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [shiftAnchor, setShiftAnchor] = useState<number | null>(null);

  const emit = (a: number, b: number) => {
    if (a === b) {
      onSelectToken(tokens[wordIdxToToken[a]].text, text);
      return;
    }
    const firstT = wordIdxToToken[a];
    const lastT = wordIdxToToken[b];
    const startChar = positionOfToken(tokens, firstT);
    const endChar = positionOfToken(tokens, lastT) + tokens[lastT].text.length;
    onSelectToken(text.slice(startChar, endChar), text);
  };

  const wordIndexAt = (clientX: number, clientY: number): number | null => {
    for (let i = 0; i < totalWords; i++) {
      const el = wordRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return i;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent, wordIdx: number) => {
    if (e.button !== 0) return;

    // Shift+click: range select mode.
    if (e.shiftKey) {
      e.preventDefault();
      if (shiftAnchor === null) {
        setShiftAnchor(wordIdx);
      } else {
        const a = Math.min(shiftAnchor, wordIdx);
        const b = Math.max(shiftAnchor, wordIdx);
        setShiftAnchor(null);
        emit(a, b);
      }
      return;
    }

    // Plain click / press-drag-release: start a drag.
    e.preventDefault();
    // Cancel any pending shift anchor when starting a fresh drag.
    setShiftAnchor(null);

    setDragStart(wordIdx);
    setDragEnd(wordIdx);

    // Local mirrors to avoid React's async state in the window handlers.
    let curStart = wordIdx;
    let curEnd = wordIdx;
    let dragged = false;

    const onMove = (ev: MouseEvent) => {
      const idx = wordIndexAt(ev.clientX, ev.clientY);
      if (idx !== null && idx !== curEnd) {
        if (idx !== curStart) dragged = true;
        curEnd = idx;
        setDragEnd(idx);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      setDragStart(null);
      setDragEnd(null);

      const a = Math.min(curStart, curEnd);
      const b = Math.max(curStart, curEnd);
      if (!dragged) {
        // Treat as plain click → single word.
        emit(curStart, curStart);
      } else {
        emit(a, b);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const inDragRange = (wordIdx: number): boolean => {
    if (dragStart === null || dragEnd === null) return false;
    const a = Math.min(dragStart, dragEnd);
    const b = Math.max(dragStart, dragEnd);
    return wordIdx >= a && wordIdx <= b;
  };

  let wordCounter = 0;

  return (
    <span>
      {tokens.map((token, idx) => {
        if (!token.isWord) {
          return <span key={idx}>{token.text}</span>;
        }
        const wIdx = wordCounter++;
        const highlighted = inDragRange(wIdx);
        const isAnchor = shiftAnchor === wIdx;
        return (
          <span
            key={idx}
            ref={(el) => {
              wordRefs.current[wIdx] = el;
            }}
            onMouseDown={(e) => handleMouseDown(e, wIdx)}
            className={`cursor-pointer rounded px-0.5 transition-colors ${
              highlighted
                ? "bg-yellow-500/40 text-white"
                : isAnchor
                ? "bg-purple-500/30 text-white outline outline-1 outline-purple-400"
                : "hover:bg-blue-500/20 hover:underline"
            }`}
            title={
              shiftAnchor !== null
                ? "Shift+tıkla: ikinci uç (ifade tamamla)"
                : "Tıkla · Tutup sürükle · Shift+tıkla (sonra Shift+tıkla)"
            }
          >
            {token.text}
          </span>
        );
      })}
      {shiftAnchor !== null && (
        <span className="ml-2 inline-block rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
          ⇧ Shift ile ikinci kelimeye tıkla
        </span>
      )}
    </span>
  );
}
