import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import { prepareFaithfulDocumentBody, isImportedBoldLine } from '../lib/faithfulDocument';
import { HEADING, BODY, CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/**
 * Render imported program document copy faithfully — order and markup from Word/import preserved.
 * Only **bold**, *italic*, and ✦ bullets from the source are styled; no headline guessing.
 */
export default function ProgramDocumentBody({ body, accent }) {
  const prepared = prepareFaithfulDocumentBody(body);
  if (!prepared) return null;

  const paragraphs = prepared.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const nodes = [];

  paragraphs.forEach((para, pi) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    if (isImportedBoldLine(trimmed)) {
      const inner = trimmed.match(/^\*\*(.+)\*\*$/s)?.[1] || trimmed;
      nodes.push(
        <h2
          key={`bh-${pi}`}
          className="mb-3 mt-10 text-left font-bold first:mt-0"
          style={{
            ...HEADING,
            color: '#1a1a1a',
            fontSize: '1.25rem',
            letterSpacing: '0.02em',
            lineHeight: 1.4,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(inner) }}
        />
      );
      return;
    }

    const italicFull = trimmed.match(/^\*([^*].+[^*])\*$/s);
    if (italicFull) {
      nodes.push(
        <p
          key={`it-${pi}`}
          className="my-4 italic"
          style={{ ...BODY, lineHeight: 1.85 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(trimmed) }}
        />
      );
      return;
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      nodes.push(
        <blockquote
          key={`qt-${pi}`}
          className="my-6 border-l-4 pl-5 italic"
          style={{ ...BODY, borderColor: accent, lineHeight: 1.85 }}
        >
          {trimmed}
        </blockquote>
      );
      return;
    }

    const lines = trimmed.split('\n');
    const lineNodes = [];
    let bulletRun = [];

    const flushBullets = () => {
      if (!bulletRun.length) return;
      lineNodes.push(
        <ul key={`bul-${lineNodes.length}`} className="my-4 space-y-2 pl-1">
          {bulletRun.map((content, bi) => (
            <li key={bi} className="flex items-start gap-3">
              <span className="mt-1 flex-shrink-0 text-sm" style={{ color: accent }}>
                ✦
              </span>
              <span
                className="flex-1 leading-relaxed"
                style={{ ...BODY }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </li>
          ))}
        </ul>
      );
      bulletRun = [];
    };

    lines.forEach((line, li) => {
      const t = line.trim();
      if (!t) return;

      if (isImportedBoldLine(t)) {
        flushBullets();
        const inner = t.match(/^\*\*(.+)\*\*$/s)?.[1] || t;
        lineNodes.push(
          <h3
            key={`bl-${li}`}
            className="mb-2 mt-6 font-bold"
            style={{ ...HEADING, fontSize: '1.05rem', color: '#1a1a1a' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(inner) }}
          />
        );
        return;
      }

      if (/^[✦•\-]/.test(t)) {
        bulletRun.push(t.replace(/^[✦•\-]\s*/, ''));
        return;
      }

      flushBullets();
      lineNodes.push(
        <p
          key={`pl-${li}`}
          className="leading-relaxed text-justify"
          style={{ ...BODY, lineHeight: 1.78 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(t) }}
        />
      );
    });

    flushBullets();
    nodes.push(
      <div key={`p-${pi}`} className="space-y-1">
        {lineNodes}
      </div>
    );
  });

  return (
    <section data-testid="program-document-body" className={`${SECTION_PY} bg-white`}>
      <div className={CONTAINER}>
        <div className={NARROW}>{nodes}</div>
      </div>
    </section>
  );
}
