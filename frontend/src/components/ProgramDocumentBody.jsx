import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import {
  prepareFaithfulDocumentBody,
  isImportedBoldLine,
  parseHeadingPrefix,
  headingStyleForLevel,
} from '../lib/faithfulDocument';
import { HEADING, BODY, CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

function renderHeading(content, level, key) {
  const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
  const mt = level === 1 ? 'mt-12 first:mt-0' : level === 2 ? 'mt-8' : 'mt-6';
  return (
    <Tag
      key={key}
      className={`${mt} mb-3 text-left font-bold`}
      style={headingStyleForLevel(level, HEADING)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

/**
 * Render imported program document copy faithfully — Word order, heading levels, bold, italic, bullets.
 */
export default function ProgramDocumentBody({ body, accent }) {
  const prepared = prepareFaithfulDocumentBody(body);
  if (!prepared) return null;

  const paragraphs = prepared.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const nodes = [];

  paragraphs.forEach((para, pi) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    const prefixed = parseHeadingPrefix(trimmed);
    if (prefixed) {
      nodes.push(renderHeading(prefixed.content, prefixed.level, `hd-${pi}`));
      return;
    }

    if (isImportedBoldLine(trimmed)) {
      const inner = trimmed.match(/^\*\*(.+)\*\*$/s)?.[1] || trimmed;
      nodes.push(renderHeading(inner, 4, `bh-${pi}`));
      return;
    }

    const italicFull = trimmed.match(/^\*([^*].+[^*])\*$/s);
    if (italicFull) {
      nodes.push(
        <p
          key={`it-${pi}`}
          className="my-3 italic text-center md:text-left"
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
        <ul key={`bul-${lineNodes.length}`} className="my-3 space-y-2.5 pl-1">
          {bulletRun.map((content, bi) => (
            <li key={bi} className="flex items-start gap-3">
              <span className="mt-1 flex-shrink-0 text-sm font-semibold" style={{ color: accent }}>
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

      const linePrefixed = parseHeadingPrefix(t);
      if (linePrefixed) {
        flushBullets();
        lineNodes.push(renderHeading(linePrefixed.content, linePrefixed.level, `lh-${pi}-${li}`));
        return;
      }

      if (isImportedBoldLine(t)) {
        flushBullets();
        const inner = t.match(/^\*\*(.+)\*\*$/s)?.[1] || t;
        lineNodes.push(renderHeading(inner, 4, `bl-${li}`));
        return;
      }

      if (/^[✦•\-]/.test(t)) {
        bulletRun.push(t.replace(/^✦\s*/, ''));
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
