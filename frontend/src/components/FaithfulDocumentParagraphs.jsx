import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import {
  prepareFaithfulDocumentBody,
  isImportedBoldLine,
  parseHeadingPrefix,
  stripAlignPrefix,
  textAlignStyle,
  headingStyleForLevel,
} from '../lib/faithfulDocument';
import { HEADING, BODY } from '../lib/designTokens';

/**
 * Shared renderer for imported doc blocks (mirror = Word layout; default = styled landing).
 */
export default function FaithfulDocumentParagraphs({
  body,
  accent,
  leadAllowed = false,
  subheadStyle = 'default',
  variant = 'default',
}) {
  const prepared = prepareFaithfulDocumentBody(body);
  if (!prepared) return null;

  const isMirror = variant === 'mirror';
  const paragraphs = prepared.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const nodes = [];
  let leadUsed = !leadAllowed;

  const renderSubhead = (content, key, level = 2, align = null) => {
    if (isMirror) {
      const style = {
        ...headingStyleForLevel(level, HEADING),
        textAlign: textAlignStyle(align),
        marginTop: level === 1 ? '2rem' : '1.35rem',
        marginBottom: '0.5rem',
      };
      return (
        <h3
          key={key}
          className="font-bold"
          style={style}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      );
    }
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

  const renderMirrorQuote = (text, key, align) => (
    <p
      key={key}
      className="my-5 italic"
      style={{
        ...BODY,
        textAlign: textAlignStyle(align || 'center'),
        lineHeight: 1.65,
        color: '#333',
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );

  const renderMirrorBody = (text, key, align) => (
    <p
      key={key}
      className="my-3"
      style={{
        ...BODY,
        textAlign: textAlignStyle(align || 'justify'),
        lineHeight: 1.65,
        color: '#333',
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );

  paragraphs.forEach((para, pi) => {
    const { align: paraAlign, text: paraText } = stripAlignPrefix(para);
    const trimmed = paraText.trim();
    if (!trimmed) return;

    const prefixed = parseHeadingPrefix(trimmed);
    if (prefixed) {
      if (prefixed.level === 1) {
        nodes.push(renderSubhead(prefixed.content, `h1-${pi}`, 1, paraAlign));
      } else if (prefixed.level >= 2) {
        nodes.push(renderSubhead(prefixed.content, `hd-${pi}`, prefixed.level, paraAlign));
      }
      return;
    }

    if (isImportedBoldLine(trimmed)) {
      if (isMirror) {
        nodes.push(renderMirrorBody(trimmed, `bh-${pi}`, paraAlign || (trimmed.length < 80 ? 'center' : 'left')));
        return;
      }
      const inner = trimmed.match(/^\*\*(.+)\*\*$/s)?.[1] || trimmed;
      nodes.push(renderSubhead(`**${inner}**`, `bh-${pi}`));
      return;
    }

    const italicFull = trimmed.match(/^\*([^*].+[^*])\*$/s);
    if (italicFull) {
      if (isMirror) {
        nodes.push(renderMirrorQuote(italicFull[1], `it-${pi}`, paraAlign || 'center'));
        return;
      }
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
      if (isMirror) {
        nodes.push(renderMirrorQuote(trimmed, `qt-${pi}`, paraAlign || 'center'));
        return;
      }
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
      if (isMirror) {
        lineNodes.push(
          <ul key={`bul-${lineNodes.length}`} className="my-3 space-y-2 pl-0 list-none">
            {bulletRun.map((content, bi) => (
              <li key={bi} className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 text-sm" style={{ color: '#1a1a1a' }}>
                  ✦
                </span>
                <span
                  className="flex-1 leading-relaxed"
                  style={{ ...BODY, color: '#333' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              </li>
            ))}
          </ul>
        );
      } else {
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
      }
      bulletRun = [];
    };

    lines.forEach((line, li) => {
      const { align: lineAlign, text: lineText } = stripAlignPrefix(line);
      const t = lineText.trim();
      if (!t) return;

      const linePrefixed = parseHeadingPrefix(t);
      if (linePrefixed && linePrefixed.level >= 2) {
        flushBullets();
        lineNodes.push(renderSubhead(linePrefixed.content, `lh-${pi}-${li}`, linePrefixed.level, lineAlign));
        return;
      }

      if (isImportedBoldLine(t)) {
        flushBullets();
        if (isMirror) {
          lineNodes.push(renderMirrorBody(t, `bl-${li}`, lineAlign));
        } else {
          const inner = t.match(/^\*\*(.+)\*\*$/s)?.[1] || t;
          lineNodes.push(renderSubhead(`**${inner}**`, `bl-${li}`));
        }
        return;
      }

      if (/^[✦•\-]/.test(t)) {
        bulletRun.push(t.replace(/^✦\s*/, ''));
        return;
      }

      flushBullets();
      if (isMirror) {
        lineNodes.push(renderMirrorBody(t, `pl-${li}`, lineAlign || paraAlign));
        return;
      }
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
      <div key={`p-${pi}`} className={isMirror ? '' : 'space-y-2'}>
        {lineNodes}
      </div>
    );
  });

  return <div className={isMirror ? 'program-doc-mirror' : 'space-y-4'}>{nodes}</div>;
}
