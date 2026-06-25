import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import { looksLikeMajorHeadline } from '../lib/organizeDocumentBody';
import { HEADING, BODY, CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

function DocumentParagraphs({ body, accent, leadAllowed = false }) {
  if (!body) return null;

  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const nodes = [];
  let leadUsed = !leadAllowed;

  paragraphs.forEach((para, pi) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    const italicFull = trimmed.match(/^\*([^*].+[^*])\*$/s);
    if (italicFull) {
      nodes.push(
        <blockquote
          key={`q-${pi}`}
          className="my-8 rounded-lg border px-6 py-5 text-center italic md:px-10"
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
          key={`dq-${pi}`}
          className="my-8 rounded-lg border px-6 py-5 text-center italic md:px-10"
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

      const subH = t.match(/^\*\*(.+)\*\*$/);
      if (subH) {
        flushBullets();
        lineNodes.push(
          <h3
            key={`sh-${li}`}
            className="mb-2 mt-7 border-l-4 pl-3 font-bold"
            style={{
              ...HEADING,
              fontSize: '1.05rem',
              color: '#1a1a1a',
              borderColor: accent,
              letterSpacing: '0.02em',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(subH[1]) }}
          />
        );
        return;
      }

      if (/^[✦•\-]/.test(t)) {
        bulletRun.push(t.replace(/^[✦•\-]\s*/, ''));
        return;
      }

      flushBullets();
      const isLead = !leadUsed && t.length > 80 && !looksLikeMajorHeadline(t);
      if (isLead) leadUsed = true;
      lineNodes.push(
        <p
          key={`pl-${li}`}
          className={`leading-relaxed ${isLead ? 'mb-3 text-lg text-gray-700 md:text-xl' : ''}`}
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

/**
 * Renders imported program copy as alternating landing sections.
 */
export default function ProgramDocumentLanding({ blocks, accent, startIndex = 0 }) {
  if (!blocks?.length) return null;

  return (
    <>
      {blocks.map((block, bi) => {
        const idx = startIndex + bi;
        const isIntro = block.type === 'intro';
        const isSectionTitle = block.type === 'section';

        if (isSectionTitle) {
          return (
            <section
              key={`doc-sec-${idx}`}
              data-testid={`document-landing-section-${idx}`}
              className={`${SECTION_PY} bg-white`}
            >
              <div className={CONTAINER}>
                <div className={`${NARROW} text-center`}>
                  <p
                    className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em]"
                    style={{ color: accent, fontFamily: BODY.fontFamily }}
                  >
                    Program overview
                  </p>
                  <h2
                    className="font-bold"
                    style={{
                      ...HEADING,
                      color: accent,
                      fontSize: 'clamp(1.35rem, 3vw, 1.75rem)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.35,
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(block.title) }}
                  />
                  <div className="mx-auto mt-4 h-0.5 w-12" style={{ background: accent }} />
                </div>
              </div>
            </section>
          );
        }

        const bg = isIntro ? 'linear-gradient(180deg, #faf9f7 0%, #ffffff 100%)' : idx % 2 === 0 ? '#ffffff' : '#f8f8f8';

        return (
          <section
            key={`doc-block-${idx}`}
            data-testid={`document-landing-block-${idx}`}
            className={SECTION_PY}
            style={{ background: bg }}
          >
            <div className={CONTAINER}>
              <div className={NARROW}>
                {isIntro && (
                  <p
                    className="mb-6 text-center text-[10px] font-semibold uppercase tracking-[0.28em]"
                    style={{ color: accent, fontFamily: BODY.fontFamily }}
                  >
                    Welcome
                  </p>
                )}
                <DocumentParagraphs body={block.body} accent={accent} leadAllowed={isIntro} />
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
