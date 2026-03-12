import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';
import { useCurrency } from '../context/CurrencyContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const applyStyle = (styleObj, defaults = {}) => {
  if (!styleObj) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
    ...(styleObj.text_align && { textAlign: styleObj.text_align }),
  };
};

function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPrice, getOfferPrice, symbol } = useCurrency();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    loadProgram();
    loadTestimonials();
  }, [id]);

  const loadProgram = async () => {
    try {
      const response = await axios.get(`${API}/programs/${id}`);
      setProgram(response.data);
    } catch (error) {
      console.error('Error loading program:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTestimonials = async () => {
    try {
      const res = await axios.get(`${API}/testimonials`);
      const all = res.data.filter(t => t.visible !== false);
      setTestimonials(all);
    } catch (e) {}
  };

  const enabledSections = (program?.content_sections || [])
    .filter(s => s.is_enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const nextTestimonial = () => setCurrentTestimonial((p) => (p + 1) % Math.max(testimonials.length, 1));
  const prevTestimonial = () => setCurrentTestimonial((p) => (p - 1 + testimonials.length) % Math.max(testimonials.length, 1));

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-sm text-white">Loading...</div></div>;
  if (!program) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h2 className="text-xl text-white mb-4">Program Not Found</h2>
        <button onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-6 py-3 rounded-full text-xs">Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      {/* Hero Section */}
      <section
        data-testid="program-hero"
        className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4 pt-24 pb-14"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #0d1b2a 100%)' }}
      >
        <p className="text-[#D4AF37] text-[10px] tracking-[0.35em] uppercase mb-5">{program.category || 'FLAGSHIP PROGRAM'}</p>
        <h1 data-testid="program-title" className="text-white text-2xl md:text-4xl mb-6 max-w-4xl leading-tight font-light">{program.title}</h1>
        <div className="h-0.5 w-16 bg-[#D4AF37] mx-auto"></div>
      </section>

      {/* Dynamic Content Sections */}
      {enabledSections.length > 0 ? (
        enabledSections.map((section, idx) => {
          const isEven = idx % 2 === 0;
          const bgClass = isEven ? 'bg-white' : 'bg-gray-50';
          const hasImage = section.image_url && section.image_url.trim();

          return (
            <section key={section.id || idx} data-testid={`content-section-${idx}`} className={`${bgClass} py-14`}>
              <div className="container mx-auto px-4 max-w-4xl">
                {section.title && (
                  <h2
                    className="text-xl text-center mb-3 text-gray-900 font-light"
                    style={applyStyle(section.title_style)}
                  >
                    {section.title}
                  </h2>
                )}
                {section.subtitle && (
                  <p
                    className="text-[#D4AF37] italic text-center mb-6 text-xs"
                    style={applyStyle(section.subtitle_style)}
                  >
                    {section.subtitle}
                  </p>
                )}
                {section.title && <div className="h-0.5 w-10 bg-[#D4AF37] mx-auto mb-8"></div>}

                {hasImage ? (
                  <div className="grid md:grid-cols-2 gap-10 items-center">
                    <div className={idx % 2 === 0 ? 'order-1' : 'order-1 md:order-2'}>
                      <img
                        src={resolveImageUrl(section.image_url)}
                        alt={section.title}
                        className="w-full rounded-lg shadow-lg"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className={idx % 2 === 0 ? 'order-2' : 'order-2 md:order-1'}>
                      <p
                        className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap"
                        style={applyStyle(section.body_style)}
                      >
                        {section.body}
                      </p>
                    </div>
                  </div>
                ) : (
                  section.body && (
                    <p
                      className="text-gray-600 leading-relaxed text-sm text-justify whitespace-pre-wrap"
                      style={applyStyle(section.body_style)}
                    >
                      {section.body}
                    </p>
                  )
                )}
              </div>
            </section>
          );
        })
      ) : (
        <>
          {/* Fallback: Show program description if no sections configured */}
          <section className="bg-white py-14">
            <div className="container mx-auto px-4 max-w-4xl">
              {program.image && (
                <div className="mb-10 rounded-lg overflow-hidden shadow-xl">
                  <img src={resolveImageUrl(program.image)} alt={program.title} className="w-full h-64 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
              <h2 className="text-xl text-center mb-4 text-gray-900 font-light">The Journey</h2>
              <div className="h-0.5 w-10 bg-[#D4AF37] mx-auto mb-6"></div>
              <p className="text-gray-600 leading-relaxed text-sm text-justify">{program.description}</p>
            </div>
          </section>
        </>
      )}

      {/* CTA with Duration Tiers */}
      <section className="bg-white py-14 border-t border-gray-100">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <p className="text-[#D4AF37] text-[10px] tracking-[0.25em] mb-3 uppercase">When You Are Seeking</p>
          <p className="text-gray-500 text-xs mb-8 max-w-2xl mx-auto">When you are ready to experience deep inner transformation and lasting change, this program becomes the foundation for that shift.</p>

          {program.is_flagship && program.duration_tiers && program.duration_tiers.length > 0 && (
            <div data-testid="duration-tiers" className="max-w-3xl mx-auto mb-8">
              <p className="text-[10px] text-gray-400 mb-3 tracking-wider uppercase">Choose Your Duration</p>
              <div className={`grid gap-3 ${program.duration_tiers.length === 3 ? 'sm:grid-cols-3' : program.duration_tiers.length === 2 ? 'sm:grid-cols-2' : 'max-w-xs mx-auto'}`}>
                {program.duration_tiers.map((tier, idx) => {
                  const isAnnual = tier.label?.toLowerCase().includes('annual') || tier.label?.toLowerCase().includes('year') || tier.duration_unit === 'year';
                  const tierPrice = getPrice(program, idx);
                  const tierOffer = getOfferPrice(program, idx);
                  const showContact = isAnnual && tierPrice === 0;
                  return (
                    <div key={idx} data-testid={`tier-${idx}`}
                      className="border border-gray-200 hover:border-[#D4AF37] rounded-lg p-4 transition-all duration-300 cursor-pointer group hover:shadow-md"
                      onClick={() => showContact ? navigate(`/contact?program=${program.id}&title=${encodeURIComponent(program.title)}&tier=${tier.label}`) : navigate(`/enroll/program/${program.id}?tier=${idx}`)}>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-[#D4AF37] transition-colors">{tier.label}</p>
                      {showContact ? (
                        <div className="mt-2">
                          <p className="text-gray-400 text-[10px] mb-2">Custom pricing</p>
                          <span className="inline-block bg-gray-900 group-hover:bg-[#D4AF37] text-white text-[10px] py-1.5 px-5 rounded-full transition-colors">Contact Us</span>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <div className="mb-2">
                            {tierOffer > 0 ? (
                              <>
                                <p className="text-sm font-semibold text-[#D4AF37]">{symbol} {tierOffer.toLocaleString()}</p>
                                <p className="text-[10px] text-gray-400 line-through">{symbol} {tierPrice.toLocaleString()}</p>
                              </>
                            ) : tierPrice > 0 ? (
                              <p className="text-sm font-semibold text-gray-900">{symbol} {tierPrice.toLocaleString()}</p>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Contact for pricing</p>
                            )}
                          </div>
                          <span className="inline-block bg-gray-900 group-hover:bg-[#D4AF37] text-white text-[10px] py-1.5 px-5 rounded-full transition-colors">Select</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {program.enrollment_open !== false ? (
              <button data-testid="pay-now-btn" onClick={() => navigate(`/enroll/program/${program.id}`)}
                className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-7 py-2.5 rounded-full text-xs tracking-wider transition-colors">
                Enroll Now
              </button>
            ) : (
              <button data-testid="express-interest-btn" onClick={() => navigate('/contact')}
                className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-7 py-2.5 rounded-full text-xs tracking-wider transition-colors">
                Express Your Interest
              </button>
            )}
            <button onClick={() => navigate('/contact')} className="bg-gray-900 hover:bg-gray-800 text-white px-7 py-2.5 rounded-full text-xs tracking-wider transition-colors">
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Carousel */}
      {testimonials.length > 0 && (
        <section className="bg-gray-50 py-14">
          <div className="container mx-auto px-4">
            <h2 className="text-xl text-center mb-8 text-gray-900 font-light">Testimonials</h2>
            <div className="max-w-5xl mx-auto relative flex items-center justify-center gap-3">
              <button onClick={prevTestimonial} className="p-1.5 rounded-full bg-white shadow hover:bg-gray-50 flex-shrink-0"><ChevronLeft size={18} /></button>
              <div className="flex gap-2 overflow-hidden">
                {[0, 1, 2, 3, 4].map((offset) => {
                  if (testimonials.length === 0) return null;
                  const idx = (currentTestimonial + offset) % testimonials.length;
                  const t = testimonials[idx];
                  if (!t) return null;
                  const imgSrc = t.type === 'graphic' ? resolveImageUrl(t.image) : (t.thumbnail || `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`);
                  return (
                    <img
                      key={offset}
                      src={imgSrc}
                      alt={t.name || `Testimonial ${idx + 1}`}
                      className="w-36 h-36 object-cover rounded-lg shadow flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  );
                })}
              </div>
              <button onClick={nextTestimonial} className="p-1.5 rounded-full bg-white shadow hover:bg-gray-50 flex-shrink-0"><ChevronRight size={18} /></button>
            </div>
          </div>
        </section>
      )}

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default ProgramDetailPage;
