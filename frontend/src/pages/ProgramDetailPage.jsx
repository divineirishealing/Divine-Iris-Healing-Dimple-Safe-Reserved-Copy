import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonialImages = [
    'https://divineirishealing.com/assets/images/testimonials/1770288231_121a7ff8d43c21a47ee2.jpeg',
    'https://divineirishealing.com/assets/images/testimonials/1770288262_5df1ff82fddb95f146db.jpeg',
    'https://divineirishealing.com/assets/images/testimonials/1770288598_757da7a271614cb10822.jpeg',
    'https://divineirishealing.com/assets/images/testimonials/1770289072_ab4f5c6689469efb1b7f.jpeg',
    'https://divineirishealing.com/assets/images/testimonials/1770289093_21c29f8d6a2dc5b1c8a9.jpeg',
    'https://divineirishealing.com/assets/images/testimonials/1770289131_cf06997582aa897db7fc.jpeg',
  ];

  useEffect(() => {
    loadProgram();
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

  const nextTestimonial = () => setCurrentTestimonial((p) => (p + 1) % testimonialImages.length);
  const prevTestimonial = () => setCurrentTestimonial((p) => (p - 1 + testimonialImages.length) % testimonialImages.length);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-lg text-white">Loading...</div></div>;
  if (!program) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h2 className="text-2xl text-white mb-4">Program Not Found</h2>
        <button onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-6 py-3 rounded-full text-sm">Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      {/* Hero */}
      <section
        data-testid="program-hero"
        className="min-h-[55vh] flex flex-col items-center justify-center text-center px-4 pt-24 pb-16"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #0d1b2a 100%)' }}
      >
        <p className="text-[#D4AF37] text-xs tracking-[0.3em] uppercase mb-6">FLAGSHIP PROGRAM</p>
        <h1 data-testid="program-title" className="text-white text-3xl md:text-5xl mb-8 max-w-4xl leading-tight">{program.title}</h1>
        <div className="h-0.5 w-20 bg-[#D4AF37] mx-auto"></div>
      </section>

      {/* Content */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Program image */}
          {program.image && (
            <div className="mb-12 rounded-lg overflow-hidden shadow-xl">
              <img
                src={resolveImageUrl(program.image)}
                alt={program.title}
                className="w-full h-72 object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          <div className="mb-16">
            <h2 className="text-2xl text-center mb-6 text-gray-900">The Journey</h2>
            <div className="h-0.5 w-12 bg-[#D4AF37] mx-auto mb-8"></div>
            <p className="text-gray-600 leading-relaxed text-base text-justify">{program.description}</p>
          </div>

          <div className="mb-16 bg-gray-50 p-8 rounded-lg">
            <h2 className="text-xl mb-4 text-gray-900">Who it is for</h2>
            <p className="text-[#D4AF37] italic mb-4 text-sm">A Sacred Invitation for those who resonate</p>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li>- You feel chronically tired, heavy, or emotionally burdened despite effort and awareness</li>
              <li>- You experience recurring health issues with no clear explanation</li>
              <li>- Your life keeps repeating similar emotional, relational, or professional patterns</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Your Experience */}
      <section className="bg-black py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl text-center mb-12 text-[#D4AF37]">Your Experience</h2>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <img
              src="https://divineirishealing.com/assets/images/dimple_ranawat.png"
              alt="Healer"
              className="w-full rounded-lg shadow-2xl"
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=600&fit=crop&crop=faces';
              }}
            />
            <div className="text-white space-y-4 text-sm leading-relaxed">
              <p>You begin to experience an internal lightness that feels unfamiliar yet deeply natural. The body softens, breathing deepens, and emotional reactions lose their intensity.</p>
              <p>Patterns that once felt automatic start dissolving without conscious effort. Healing no longer feels like work — it becomes a by-product of inner safety and release.</p>
              <p className="italic text-[#D4AF37]">Many people describe this phase as finally living a happy life in the true sense, not because life is perfect, but because it is no longer heavy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <p className="text-[#D4AF37] text-xs tracking-[0.2em] mb-4">WHEN YOU ARE SEEKING</p>
          <p className="text-gray-600 text-sm mb-8">When you are done fixing, forcing, or proving — and you are ready to live with ease, clarity, and emotional freedom — this program becomes the foundation for that shift.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {program.enrollment_open !== false ? (
              <button
                data-testid="pay-now-btn"
                onClick={() => navigate(`/checkout/program/${program.id}`)}
                className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm tracking-wider"
              >
                Enroll Now
              </button>
            ) : (
              <button
                data-testid="express-interest-btn"
                onClick={() => navigate('/contact')}
                className="bg-[#D4AF37] hover:bg-[#b8962e] text-white px-8 py-3 rounded-full text-sm tracking-wider"
              >
                Express Your Interest
              </button>
            )}
            <button
              onClick={() => navigate('/contact')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-full text-sm tracking-wider"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Carousel */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl text-center mb-10 text-gray-900">Testimonials</h2>
          <div className="max-w-5xl mx-auto relative flex items-center justify-center gap-4">
            <button onClick={prevTestimonial} className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50"><ChevronLeft size={20} /></button>
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2, 3, 4].map((offset) => {
                const idx = (currentTestimonial + offset) % testimonialImages.length;
                return (
                  <img
                    key={offset}
                    src={testimonialImages[idx]}
                    alt={`Testimonial ${idx + 1}`}
                    className="w-40 h-40 object-cover rounded-lg shadow-lg flex-shrink-0"
                  />
                );
              })}
            </div>
            <button onClick={nextTestimonial} className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50"><ChevronRight size={20} /></button>
          </div>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}

export default ProgramDetailPage;
