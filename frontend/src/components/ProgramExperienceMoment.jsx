import React from 'react';
import { renderMarkdown } from '../lib/renderMarkdown';
import { parseExperienceMoment } from '../lib/parseExperienceMoment';
import { HEADING, BODY, CONTAINER, WIDE, SECTION_PY } from '../lib/designTokens';

/**
 * Black signature section: B&W portrait, powerful quote, life-changing message.
 */
export default function ProgramExperienceMoment({
  section,
  accent,
  portraitUrl,
  template = {},
}) {
  const { quote, heading, message } = parseExperienceMoment(section);

  if (!quote && !message && !portraitUrl) return null;

  return (
    <section
      data-testid="program-experience-moment"
      className={SECTION_PY}
      style={{ background: '#1a1a1a' }}
    >
      <div className={CONTAINER}>
        <div className={WIDE}>
          <div className="grid items-center gap-10 md:grid-cols-12 md:gap-14">
            {portraitUrl ? (
              <div className="md:col-span-5">
                <div className="relative mx-auto max-w-sm overflow-hidden rounded-lg shadow-2xl md:mx-0">
                  <img
                    src={portraitUrl}
                    alt="Healer portrait"
                    className="aspect-[4/5] w-full object-cover grayscale contrast-[1.05]"
                    style={{ objectPosition: section?.image_position || 'center top' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ boxShadow: `inset 0 0 0 1px ${accent}33` }}
                  />
                </div>
              </div>
            ) : null}

            <div className={portraitUrl ? 'md:col-span-7' : 'md:col-span-12 max-w-3xl mx-auto text-center'}>
              {quote ? (
                <blockquote
                  className="mb-8 border-none p-0"
                  style={{
                    ...HEADING,
                    color: '#f5f5f5',
                    fontSize: 'clamp(1.25rem, 2.8vw, 1.85rem)',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    lineHeight: 1.55,
                    letterSpacing: '0.02em',
                  }}
                >
                  <span
                    className="text-3xl leading-none opacity-40"
                    style={{ color: accent, fontFamily: 'Georgia, serif' }}
                    aria-hidden
                  >
                    &ldquo;
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: renderMarkdown(quote) }} />
                </blockquote>
              ) : null}

              <div
                className="mb-4 h-px w-16"
                style={{ background: accent, opacity: 0.85 }}
              />

              <h2
                className="mb-4 font-bold uppercase tracking-[0.18em]"
                style={{
                  ...HEADING,
                  color: accent,
                  fontSize: '0.72rem',
                  letterSpacing: '0.22em',
                }}
              >
                {heading}
              </h2>

              {message ? (
                <p
                  className="leading-relaxed"
                  style={{
                    ...BODY,
                    color: '#cccccc',
                    fontSize: '1rem',
                    lineHeight: 1.9,
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message) }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
