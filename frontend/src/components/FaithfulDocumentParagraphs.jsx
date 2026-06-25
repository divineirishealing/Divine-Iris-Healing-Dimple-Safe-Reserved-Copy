import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import {
  prepareFaithfulDocumentBody,
  isImportedBoldLine,
  parseHeadingPrefix,
} from '../lib/faithfulDocument';
import { HEADING, BODY } from '../lib/designTokens';

/**
 * Shared faithful renderer for imported doc blocks (used by landing + flat body).
 */
export default function FaithfulDocumentParagraphs({ body, accent, leadAllowed = false, subheadStyle = 'default' }) {
  const prepared = prepareFaithfulDocumentBody(body);
  if (!prepared) return null;

  const paragraphs = prepared.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const nodes = [];
  let leadUsed = !leadAllowed;

  const renderSubhead = (content, key) => {
    if (subheadStyle === 'accent') {
      return (
        <h3
          key={key}
          className="mb-2 mt-7 border-l-4 pl-3 font-bold"
          style={{
            ...HEADING,
            fontSize: '1.05rem',
            color: '#1a1a1a',
            borderColor: accent,
            letterSpacing: '0.02em',
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      );
    }
    return (
      <h3
        key={key}
        className="mb-2 mt-6 font-bold"
        style={{ ...HEADING, fontSize: '1.05rem', color: '#1a1a1a' }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    );
  };

  paragraphs.forEach((para, pi) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    const prefixed = parseHeadingPrefix(trimmed);
    if (prefixed) {
      if (prefixed.level >= 2) {
        nodes.push(renderSubhead(prefixed.content, `hd-${pi}`));
      }
      return;
    }

    if (isImportedBoldLine(trimmed)) {
      const inner = trimmed.match(/^\*\*(.+)\*\*$/s)?.[1] || trimmed;
      nodes.push(renderSubhead(`**${inner}**`, `bh-${pi}`));
      return;
    }

    const italicFull = trimmed.match(/^\*([^*].+[^*])\*$/s);
    if (italicFull) {
      nodes.push(
        <blockquote
          key={`it-${pi}`}
          className="my-6 rounded-lg border px-6 py-5 text-center italic md:px-10"
          style={{
            ...BODY,
            fontSize: '1.05rem',
            lineHeight: 1.85,
            borderColor: `${accent}33`,
            background: `${accent}08`,
            color: '#444',
          }}
        >
          {italicFull[1]}
        </blockquote>
      );
      return;
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      nodes.push(
        <blockquote
          key={`qt-${pi}`}
          className="my-6 rounded-lg border px-6 py-5 text-center italic md:px-10"
          style={{
            ...BODY,
            fontSize: '1.05rem',
            lineHeight: 1.85,
            borderColor: `${accent}33`,
            background: `${accent}08`,
            color: '#444',
          }}
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
      const useGrid = bulletRun.length >= 4;
      lineNodes.push(
        <ul
          key={`bul-${lineNodes.length}`}
          className={`my-5 pl-1 ${useGrid ? 'grid gap-x-10 gap-y-3 md:grid-cols-2' : 'space-y-3'}`}
        >
          {bulletRun.map((content, bi) => (
            <li key={bi} className="flex items-start gap-3">
              <span className="mt-1 flex-shrink-0 text-sm font-bold" style={{ color: accent }}>
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
      if (linePrefixed && linePrefixed.level >= 2) {
        flushBullets();
        lineNodes.push(renderSubhead(linePrefixed.content, `lh-${pi}-${li}`));
        return;
      }

      if (isImportedBoldLine(t)) {
        flushBullets();
        const inner = t.match(/^\*\*(.+)\*\*$/s)?.[1] || t;
        lineNodes.push(renderSubhead(`**${inner}**`, `bl-${li}`));
        return;
      }

      if (/^[✦•\-]/.test(t)) {
        bulletRun.push(t.replace(/^✦\s*/, ''));
        return;
      }

      flushBullets();
      const isLead = !leadUsed && t.length > 80;
      if (isLead) leadUsed = true;
      lineNodes.push(
        <p
          key={`pl-${li}`}
          className={`leading-relaxed ${isLead ? 'mb-3 text-lg text-gray-700 md:text-xl' : 'text-justify'}`}
          style={{ ...BODY, lineHeight: isLead ? 1.9 : 1.78 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(t) }}
        />
      );
    });

    flushBullets();
    nodes.push(
      <div key={`p-${pi}`} className="space-y-2">
        {lineNodes}
      </div>
    );
  });

  return <div className="space-y-4">{nodes}</div>;
}
