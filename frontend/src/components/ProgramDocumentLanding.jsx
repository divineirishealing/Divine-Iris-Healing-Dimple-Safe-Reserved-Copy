import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import FaithfulDocumentParagraphs from './FaithfulDocumentParagraphs';
import { HEADING, BODY, CONTAINER, NARROW, SECTION_PY } from '../lib/designTokens';

/**
 * Highlighted landing layout — alternating bands, gold section titles, Welcome intro.
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

        const bg = isIntro
          ? 'linear-gradient(180deg, #faf9f7 0%, #ffffff 100%)'
          : idx % 2 === 0
            ? '#ffffff'
            : '#f8f8f8';

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
                <FaithfulDocumentParagraphs
                  body={block.body}
                  accent={accent}
                  leadAllowed={isIntro}
                  subheadStyle="accent"
                />
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
