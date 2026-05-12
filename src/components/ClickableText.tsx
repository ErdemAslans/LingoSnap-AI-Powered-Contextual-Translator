// ClickableText — robust click + drag-select for word/phrase capture.
//
// Approach: on mouse-down on a word, attach window-level mousemove/mouseup
// listeners that hit-test the cursor position against word bounding boxes.
// This is independent of setPointerCapture, browser text-selection policies,
// or Tauri's transparent-window quirks — pure coordinate math.
//
// UX:
//   - Click a word                → look up that word.
//   - Press, drag across words, release → look up the joined phrase.
//   - Words in the active drag range are highlighted (yellow).

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

  const beginDrag = (e: React.MouseEvent, wordIdx: number) => {
    if (e.button !== 0) return;
    e.preventDefault();

    setDragStart(wordIdx);
    setDragEnd(wordIdx);

    // Local mirrors so window handlers don't lose track if React batches state.
    let curStart = wordIdx;
    let curEnd = wordIdx;

    const onMove = (ev: MouseEvent) => {
      const idx = wordIndexAt(ev.clientX, ev.clientY);
      if (idx !== null && idx !== curEnd) {
        curEnd = idx;
        setDragEnd(idx);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      const a = Math.min(curStart, curEnd);
      const b = Math.max(curStart, curEnd);

      // Reset visual state immediately to clear highlight.
      setDragStart(null);
      setDragEnd(null);

      if (a === b) {
        const tIdx = wordIdxToToken[a];
        onSelectToken(tokens[tIdx].text, text);
        return;
      }

      const firstT = wordIdxToToken[a];
      const lastT = wordIdxToToken[b];
      const startChar = positionOfToken(tokens, firstT);
      const endChar = positionOfToken(tokens, lastT) + tokens[lastT].text.length;
      onSelectToken(text.slice(startChar, endChar), text);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const inRange = (wordIdx: number): boolean => {
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
        const highlighted = inRange(wIdx);
        return (
          <span
            key={idx}
            ref={(el) => {
              wordRefs.current[wIdx] = el;
            }}
            onMouseDown={(e) => beginDrag(e, wIdx)}
            className={`cursor-pointer rounded px-0.5 transition-colors ${
              highlighted
                ? "bg-yellow-500/30 text-white"
                : "hover:bg-blue-500/20 hover:underline"
            }`}
            title="Tıkla: kelimeyi ara · Tutup sürükle: ifade seç"
          >
            {token.text}
          </span>
        );
      })}
    </span>
  );
}

function positionOfToken(tokens: Token[], targetIdx: number): number {
  let pos = 0;
  for (let i = 0; i < targetIdx; i++) {
    pos += tokens[i].text.length;
  }
  return pos;
}
