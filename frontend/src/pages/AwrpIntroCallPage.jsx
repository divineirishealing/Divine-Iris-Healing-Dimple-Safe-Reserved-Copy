import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSeoPage } from '../context/SeoPageContext';
import { useCurrency } from '../context/CurrencyContext';
import { HEADING, BODY, GOLD, LABEL } from '../lib/designTokens';
import dimplePhoto from '../assets/awrp-dimple.jpg';
import heroBanner from '../assets/awrp-hero.jpg';
import patternImage from '../assets/awrp-pattern.jpg';
import irisImage from '../assets/awrp-iris.jpg';
import communityImage from '../assets/awrp-community.jpg';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAGE_BODY = {
  ...BODY,
  fontSize: '1.5rem',
  lineHeight: '1.7',
};

const AWRP_PURPLE = '#6d2d91';
const AWRP_PURPLE_SOFT = '#ead4f3';

const HERO_LABEL = {
  ...LABEL,
  fontSize: '1.15rem',
  letterSpacing: '0.22em',
  fontWeight: 700,
  color: GOLD,
};

const SECTION_TITLE = {
  ...HEADING,
  fontWeight: 700,
  color: GOLD,
};

const STRUGGLES = [
  ['Your body', 'Weight that won’t shift, emotional eating, or frustration with how you feel in your skin.'],
  ['Your health', 'Living with psoriasis, migraines or other recurring concerns that keep coming back, however much you try.'],
  ['Your sleep', 'Insomnia, restless nights, or a mind that won’t switch off when your head hits the pillow.'],
  ['Your energy', 'Feeling drained, anxious, tense or overwhelmed, with no steady sense of balance.'],
  ['Your mind', 'Always overthinking, replaying the same trauma and the same hurt again and again, and unable to make it stop.'],
  ['Your heart', 'Always craving love, and longing to feel truly held, chosen and cared for.'],
  ['Your boundaries', 'People-pleasing, saying yes when you mean no, and putting everyone else’s needs before your own.'],
  ['Your sense of worth', 'Feeling unheard and unseen, and quietly wishing you mattered more in other people’s lives.'],
  ['Your relationships', 'Recurring conflict, heartbreak, distance or never quite feeling understood.'],
  ['Your work and direction', 'Working hard yet feeling unseen, unfulfilled or unable to move forward.'],
  ['The same old cycle', 'A pattern that keeps returning, even after you decide things will be different.'],
  ['Something else entirely', 'Whatever you’re carrying, it’s welcome here.'],
];

const DISCOVER_TOPICS = [
  ['Why Do The Same Challenges Keep Returning?', 'Explore why certain struggles may persist despite repeated efforts to change.'],
  ['The Seven Dimensions Of Human Existence', 'Discover seven interconnected dimensions that offer a wider perspective on human experiences and challenges.'],
  ['DNA, Genetics & Epigenetics', 'Understand inheritance, gene expression and the fascinating interaction between biology and environment.'],
  ['Emotional & Subconscious Patterns', 'Explore how memories, emotional experiences and learned beliefs may influence our responses and behaviours.'],
  ['Karma, Past Lives & Ancestral Patterns', 'Discover how spiritual traditions interpret recurring patterns across generations and lifetimes.'],
  ['The AWRP Methodology', 'Understand the philosophy, approach, healing practices and structure behind AWRP.'],
  ['Your Possibilities & Way Forward', 'Explore what AWRP may support, its limitations and whether the program is right for you.'],
];

const AWARDS = [
  ['Award', 'Atal Achievement Award'],
  ['Award', 'Bhartiya Nari Ratna Puraskar'],
  ['Award', 'Asia Pacific Excellence Award'],
  ['', 'Most Innovative Leader & Spiritual Healer in Holistic Well-Being'],
];

const FAQS = [
  ['My problem isn’t weight. Is this for me?', 'Yes. In AWRP, “weight” isn’t necessarily body weight. It’s the emotional and mental weight you carry, which can show up in your body, your heart, your mind, your relationships or your work. The call is for anyone who feels stuck in a recurring struggle.'],
  ['Is this the full AWRP program?', 'No. It’s a paid introductory call to understand the approach, format and whether it suits you. Enrolling in the full program is a separate decision.'],
  ['Why is the introductory call paid?', 'It’s a full, structured session with Dimple, not a quick sales call. It also means everyone on the call is genuinely committed to exploring their growth.'],
  ['Does AWRP guarantee results?', 'Every journey is unique, and specific outcomes cannot be guaranteed. However, AWRP has been part of the transformation journeys of thousands of individuals, with many participants reporting meaningful positive changes and greater ease in their lives.\n\nYour transformation is personal. Your possibilities are worth exploring.'],
  ['Can AWRP replace medical treatment or therapy?', 'No. AWRP is complementary and does not replace medical treatment or professional therapy. We encourage participants to continue their prescribed care and make any medication changes only in consultation with their doctor.\n\nOver the years, participants have shared encouraging experiences of improved well-being and, in some cases, reduced medication under their doctors’ supervision.\n\nWe believe in complementing your journey towards well-being, never compromising your medical care.'],
  ['Will karma and past lives be discussed?', 'Yes, as spiritual and philosophical perspectives, alongside established science such as genetics and epigenetics.'],
];

const AWRP_WORKSHOP_ID = '4120e50a-66a6-490e-ad72-50869a805bfb';

function findAwrpWorkshop(list) {
  const programs = Array.isArray(list) ? list : [];
  const byId = programs.find((program) => program.id === AWRP_WORKSHOP_ID);
  if (byId) return byId;
  return programs.find((program) => {
    const title = (program?.title || '').toLowerCase();
    const isAwrp = title.includes('awrp') || title.includes('atomic weight');
    return program?.is_upcoming && isAwrp && !title.includes('intro');
  }) || null;
}

function BookButton({ onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full px-8 py-3.5 text-base md:text-lg font-semibold tracking-wide text-[#1c1230] ${className}`}
      style={{ background: GOLD }}
    >
      {children}
    </button>
  );
}

export default function AwrpIntroCallPage({ surface = 'india' }) {
  const navigate = useNavigate();
  const { setPageSeo, clearPageSeo } = useSeoPage();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const [program, setProgram] = useState(null);
  const isIndia = surface !== 'website';
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    axios.get(`${API}/programs`).then((r) => {
      setProgram(findAwrpWorkshop(r.data));
    }).catch(() => {});
  }, []);

  const indiaAmount = Number(program?.offer_price_inr) > 0
    ? Number(program.offer_price_inr)
    : (Number(program?.price_inr) > 0 ? Number(program.price_inr) : 0);
  const websiteAmount = program ? Number(getOfferPrice(program) || getPrice(program) || 0) : 0;
  const priceText = isIndia
    ? (indiaAmount > 0 ? `₹${indiaAmount.toLocaleString()}` : '')
    : (websiteAmount > 0 ? `${symbol}${websiteAmount.toLocaleString()}` : '');

  useEffect(() => {
    window.scrollTo(0, 0);
    setPageSeo({
      title: 'AWRP Introductory Call',
      description: 'Live introductory call on the Atomic Weight Release Program with Dimple Ranawat. Sunday, 29 November 2026, 7:00–8:30 PM IST.',
    });
    return () => clearPageSeo();
  }, [setPageSeo, clearPageSeo]);

  const scrollToReserve = () => {
    document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bookNow = () => {
    navigate(`/enroll/program/${program?.id || AWRP_WORKSHOP_ID}`);
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#2b241c]">
      <Header />
      <main>
        <section className="bg-white pt-16 md:pt-20 pb-14 md:pb-20">
          <div className="container mx-auto px-6 md:px-8 max-w-3xl text-center">
            <img
              src={heroBanner}
              alt="Atomic Weight Release Program"
              className="block w-full h-auto mx-auto rounded-2xl mb-8 md:mb-10"
            />
            <p className="mb-1" style={HERO_LABEL}>Atomic Weight Release Program</p>
            <p className="mb-6 md:mb-8" style={HERO_LABEL}>Live Introductory Call</p>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl leading-tight mb-5 md:mb-6"
              style={{ ...HEADING, color: AWRP_PURPLE, fontWeight: 700 }}
            >
              You’ve tried so much. So why does something still feel stuck?
            </h1>
            <p className="mb-4 text-2xl md:text-3xl italic font-semibold" style={{ ...HEADING, color: GOLD, fontWeight: 600 }}>
              Weight isn’t only what shows on the scale.
            </p>
            <p className="mb-6 max-w-2xl mx-auto text-lg md:text-xl" style={{ ...PAGE_BODY, color: '#333333' }}>
              It’s also the emotional and mental weight you carry: old hurts, constant overthinking, stress and patterns that keep repeating. Join Dimple Ranawat for a live introductory call on the Atomic Weight Release Program and discover how to start releasing it.
            </p>
            <p className="text-lg md:text-xl mb-8 text-[#1a1a1a]">
              Live online · Sunday, 29 November 2026 · 7:00–8:30 PM IST{priceText ? ` · ${priceText}` : ''}
            </p>
            <button
              type="button"
              onClick={scrollToReserve}
              className="inline-flex items-center justify-center rounded-md px-10 py-4 text-sm md:text-base font-bold tracking-[0.2em] uppercase text-white"
              style={{ background: AWRP_PURPLE }}
            >
              Book your introductory call
            </button>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-5xl">
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              ['1000s', 'of lives transformed'],
              ['Award-winning', 'program'],
              ['TEDx', 'speaker'],
            ].map(([title, line]) => (
              <div
                key={title}
                className="rounded-2xl border px-5 py-6 text-center"
                style={{ background: AWRP_PURPLE, borderColor: AWRP_PURPLE_SOFT }}
              >
                <p className="text-3xl md:text-4xl mb-1" style={{ ...HEADING, color: GOLD }}>{title}</p>
                <p style={{ ...PAGE_BODY, color: 'rgba(255,255,255,0.88)' }}>{line}</p>
              </div>
            ))}
          </div>
          <p className="text-center max-w-2xl mx-auto mb-8 md:mb-10" style={PAGE_BODY}>
            Thousands of people have transformed their lives, their health and their relationships with this award-winning program.
          </p>
          <img
            src={communityImage}
            alt="AWRP community together on a live session"
            className="w-full max-w-4xl mx-auto rounded-3xl border-2 shadow-sm"
            style={{ borderColor: AWRP_PURPLE }}
          />
          <p className="text-center mt-4 max-w-2xl mx-auto text-[#6b5a45]" style={PAGE_BODY}>
            Our AWRP community, together on a live session.
          </p>
        </section>

        <section className="bg-white border-y border-[#eadfca]">
          <div className="container mx-auto px-6 md:px-8 py-14 max-w-5xl">
            <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-8 text-center">Which of these feels familiar?</p>
            <div className="grid md:grid-cols-2 gap-4">
              {STRUGGLES.map(([title, body]) => (
                <article key={title} className="rounded-2xl border border-[#eadfca] bg-[#faf7f2] p-5">
                  <h2 className="text-2xl mb-2" style={HEADING}>{title}</h2>
                  <p style={PAGE_BODY}>{body}</p>
                </article>
              ))}
            </div>
            <p className="text-center mt-8" style={PAGE_BODY}>Different struggles. Often, the same hidden weight underneath.</p>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
          <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-8 text-center">You’ve given it everything. Now it’s time to look deeper.</p>
          <img
            src={patternImage}
            alt=""
            className="w-full rounded-3xl object-cover aspect-[4/3] mb-8 md:mb-10"
          />
          <div className="space-y-5 text-center max-w-2xl mx-auto">
            <p style={PAGE_BODY}>You’ve changed your food, exercised, meditated, read the books, stayed positive, worked harder and started again. You’ve made promises to yourself and meant them.</p>
            <p style={PAGE_BODY}>And yet the same struggle keeps showing up.</p>
            <p style={PAGE_BODY}>What if you’ve been working on the part of the problem you can see, while the weight underneath it, made of old patterns, emotional conditioning and experiences you’ve carried for years, stayed exactly where it was?</p>
            <p style={PAGE_BODY}>You don’t need another promise that everything will change overnight. You deserve a space to understand what’s really going on, ask honest questions and decide what feels right for you.</p>
          </div>
          <div className="text-center mt-8 md:mt-10">
            <BookButton onClick={scrollToReserve}>Book your introductory call</BookButton>
          </div>
        </section>

        <section className="bg-[#1c1230] text-white">
          <div className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
            <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-3">The Atomic Weight Release Program</p>
            <p className="mb-4" style={{ ...PAGE_BODY, color: 'rgba(255,255,255,0.9)' }}>
              Created by Dimple Ranawat at Divine Iris, AWRP is a multidimensional healing and personal-transformation program for whatever you’re carrying, whether it shows up in your health, your emotions, your relationships or your work.
            </p>
            <p className="mb-4" style={{ ...PAGE_BODY, color: 'rgba(255,255,255,0.82)' }}>
              Instead of treating each struggle on its own, AWRP looks beneath it, at the recurring patterns, emotional conditioning and inherited tendencies that can keep the same problems returning in different forms.
            </p>
            <p style={{ ...PAGE_BODY, color: 'rgba(255,255,255,0.82)' }}>
              It brings together energy-healing practices, guided reflection, spiritual exploration and personal-development work, so change can happen at more than one level at a time.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
          <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-6 text-center">In their own words</p>
          <blockquote className="rounded-3xl border border-[#eadfca] bg-white p-6 md:p-8">
            <p className="text-base md:text-lg mb-4" style={PAGE_BODY}>
              “Thank you feels too small for what I’ve experienced here... ✨ The depth of last night’s session... unreal. And the kind of deep, uninterrupted sleep after? Something I haven’t felt in so long. I finally understand this — the right mentor can collapse years of confusion in a single moment. So grateful I found this space. So grateful I found Divine Iris. ❤️ This isn’t just healing... this is amplification of life itself.”
            </p>
            <footer style={PAGE_BODY}>— AWRP participant</footer>
          </blockquote>
          <p className="mt-6" style={PAGE_BODY}>Participants have also spoken about feeling happier, finding more calm, building discipline and moving through daily life with more ease.</p>
          <p className="mt-3 text-sm" style={PAGE_BODY}>Individual experiences. Results vary from person to person.</p>
        </section>

        <section className="bg-white border-y border-[#eadfca]">
          <div className="mx-auto px-4 sm:px-6 lg:px-10 py-14 w-full max-w-[min(1280px,96vw)]">
            <h2
              className="text-4xl md:text-5xl mb-8 md:mb-10 font-bold leading-tight"
              style={{ ...HEADING, color: AWRP_PURPLE }}
            >
              What You’ll Discover On The Call
            </h2>
            <div className="rounded-3xl border overflow-hidden bg-white shadow-sm" style={{ borderColor: AWRP_PURPLE_SOFT }}>
              <div className="text-white text-center px-6 py-10 md:py-12" style={{ background: AWRP_PURPLE }}>
                <p className="text-[11px] md:text-xs tracking-[0.28em] uppercase font-semibold text-white/90 mb-4">
                  At The Centre Of The Conversation
                </p>
                <p className="text-4xl md:text-5xl font-bold tracking-wide mb-2">AWRP</p>
                <p className="text-xs md:text-sm tracking-[0.22em] uppercase font-bold mb-5">Atomic Weight Release Program</p>
                <p className="text-sm md:text-base max-w-md mx-auto leading-relaxed text-white/95">
                  A multidimensional approach to understanding recurring challenges and exploring personal transformation.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3">
                {DISCOVER_TOPICS.map(([title, body], index) => (
                  <div
                    key={title}
                    className={`flex gap-3 md:gap-4 px-4 md:px-5 lg:px-7 py-5 md:py-6 border-b ${
                      index < 6 && index % 3 !== 2 ? 'md:border-r' : ''
                    } ${index < 6 ? 'md:border-b' : ''} ${
                      index === 6 ? 'md:col-span-3 md:justify-center md:border-r-0' : ''
                    }`}
                    style={{ borderColor: AWRP_PURPLE_SOFT }}
                  >
                    <div
                      className={`flex gap-3 md:gap-4 min-w-0 ${index === 6 ? 'md:max-w-4xl w-full' : 'w-full'}`}
                    >
                      <div
                        className="flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-lg text-sm md:text-base font-bold"
                        style={{ background: AWRP_PURPLE_SOFT, color: AWRP_PURPLE }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h3 className="text-lg md:text-xl mb-2 leading-snug" style={{ ...HEADING, color: AWRP_PURPLE }}>
                          {title}
                        </h3>
                        <p style={PAGE_BODY}>{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center px-6 py-10 md:py-12" style={{ background: AWRP_PURPLE_SOFT }}>
                <p className="text-2xl md:text-3xl mb-3" style={{ ...HEADING, color: AWRP_PURPLE }}>
                  Look beyond the obvious.
                </p>
                <p className="text-lg md:text-xl mb-4 max-w-lg mx-auto leading-snug" style={HEADING}>
                  Understand more. Explore differently. Discover new possibilities.
                </p>
                <p style={PAGE_BODY}>AWRP Introductory Call · Divine Iris – Soulful Healing Studio</p>
              </div>
            </div>
            <p className="text-center mt-8 mb-6" style={PAGE_BODY}>Bring your questions. There’s time on the call to ask them.</p>
            <div className="text-center">
              <BookButton onClick={scrollToReserve}>Reserve my place</BookButton>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-5xl">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] gap-8 lg:gap-10 items-start">
            <div className="order-2 lg:order-1 lg:col-start-1 lg:row-start-1">
              <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-2">Meet Dimple Ranawat</p>
              <p className="mb-2" style={PAGE_BODY}>Founder, Divine Iris · Soulful Healing Studio</p>
              <p className="mb-4" style={PAGE_BODY}>Energy Healer · Life Transformation Coach · Emotional Empowerment Practitioner · TEDx Speaker</p>
              <p className="mb-6" style={PAGE_BODY}>
                Dimple brings together spiritual exploration, energy-healing practices and personal-transformation work. Her gift is making life’s complexities easier to understand, so people can approach their growth with more clarity, compassion and confidence.
              </p>
              <p className="mb-0 lg:mb-4" style={PAGE_BODY}>Her work has been recognised with several honours, including:</p>
            </div>
            <img
              src={dimplePhoto}
              alt="Dimple Ranawat"
              className="order-1 lg:order-2 lg:col-start-2 lg:row-start-1 w-full max-w-sm mx-auto lg:mx-0 lg:max-w-none rounded-3xl object-cover h-auto"
            />
          </div>
          <div className="mt-6 rounded-2xl px-4 py-5 md:px-6 md:py-6" style={{ background: AWRP_PURPLE }}>
            <p
              className="text-center text-xl md:text-2xl tracking-[0.18em] uppercase mb-5"
              style={{ ...HEADING, color: GOLD, fontWeight: 800 }}
            >
              Award
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4">
              {AWARDS.map(([kind, name]) => (
                <li key={name} className="text-center px-1">
                  {kind && kind !== 'Award' && (
                    <p className="text-[10px] md:text-[11px] tracking-[0.14em] uppercase mb-1.5" style={{ color: GOLD }}>
                      {kind}
                    </p>
                  )}
                  <p className="text-sm md:text-base leading-snug" style={{ ...HEADING, color: '#fff', fontWeight: 600 }}>
                    {name}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="reserve" className="bg-[#f3ecdf]">
          <div className="container mx-auto px-6 md:px-8 py-16 max-w-2xl">
            <div className="text-center max-w-2xl mx-auto">
              <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-5 uppercase tracking-wide">
                Your next step
              </p>
              <div
                className="rounded-2xl px-5 py-6 md:px-8 md:py-8 space-y-4 mb-8"
                style={{ background: AWRP_PURPLE }}
              >
                <p
                  className="text-lg sm:text-xl md:text-2xl leading-snug uppercase tracking-wide"
                  style={{ ...HEADING, color: GOLD, fontWeight: 800 }}
                >
                  Give Yourself the Gift of a New Beginning.
                </p>
                <p
                  className="text-base sm:text-lg md:text-xl leading-snug uppercase tracking-wide"
                  style={{ ...HEADING, color: '#fff', fontWeight: 800 }}
                >
                  Restart. Reconnect. Recreate the life you deserve.
                </p>
              </div>
              <BookButton onClick={bookNow} className="text-lg md:text-xl px-10 py-4">
                Book now
              </BookButton>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 md:px-8 py-14 max-w-3xl">
          <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-6 text-center">Questions you might have</p>
          <div className="space-y-3">
            {FAQS.map(([question, answer], index) => (
              <div key={question} className="rounded-2xl border border-[#eadfca] bg-white">
                <button
                  type="button"
                  className="w-full text-left px-5 py-4 text-xl"
                  style={HEADING}
                  aria-expanded={openFaq === index}
                  onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                >
                  {question}
                </button>
                {openFaq === index && <p className="px-5 pb-4 whitespace-pre-line" style={PAGE_BODY}>{answer}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden">
          <img src={irisImage} alt="" className="w-full max-h-[280px] object-cover object-bottom" />
          <div className="container mx-auto px-6 md:px-8 py-14 max-w-3xl text-center">
            <p style={SECTION_TITLE} className="text-4xl md:text-5xl mb-4">You are more than the struggle you’re facing.</p>
            <p className="mb-3" style={PAGE_BODY}>Your happiness matters. Your well-being matters. And your story is still unfolding.</p>
            <p className="mb-6" style={PAGE_BODY}>Take one thoughtful step and see what’s possible when you set down what you’ve been carrying.</p>
            <BookButton onClick={scrollToReserve}>Book your introductory call</BookButton>
          </div>
        </section>

        <section className="bg-[#1c1230] text-white">
          <div className="container mx-auto px-6 md:px-8 py-10 max-w-3xl text-center">
            <p style={LABEL} className="mb-3">Divine Iris · Soulful Healing Studio</p>
            <p className="mb-4 text-sm"><a href="https://www.divineirishealing.com" className="underline">www.divineirishealing.com</a></p>
            <p className="mb-6 text-sm">
              <Link to="/privacy" className="underline">Privacy Policy</Link>
              <span> · </span>
              <Link to="/terms" className="underline">Terms</Link>
              <span> · </span>
              <Link to="/refund-cancellation" className="underline">Refund Policy</Link>
              <span> · </span>
              <Link to="/contact" className="underline">Contact</Link>
            </p>
            <p className="text-xs leading-relaxed text-white/75">
              AWRP is a complementary well-being and personal-development program. It is not medical, psychological or financial advice and does not diagnose, treat or cure any condition. Testimonials reflect individual experiences; results vary. This site is not part of the Facebook or Meta website or Meta Platforms, Inc.
            </p>
          </div>
        </section>
      </main>
      <div className="h-16 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadfca] bg-white/95 px-4 py-3 md:hidden">
        <button type="button" onClick={scrollToReserve} className="w-full rounded-full py-3.5 text-base font-semibold text-[#1c1230]" style={{ background: GOLD }}>
          Book your call{priceText ? ` · ${priceText}` : ''}
        </button>
      </div>
      <Footer />
    </div>
  );
}
