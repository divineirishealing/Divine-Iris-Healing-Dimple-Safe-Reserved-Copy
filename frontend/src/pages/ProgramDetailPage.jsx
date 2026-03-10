import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Menu, X, Facebook, Instagram, Youtube, Linkedin, Mail, Phone } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Program Not Found</h2>
          <Button onClick={() => navigate('/')} className="bg-yellow-600 hover:bg-yellow-700">Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header - Same as original */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white p-2 hover:bg-white/10 rounded transition-colors flex items-center gap-2"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              <span className="text-sm font-medium">MENU</span>
            </button>

            <div className="flex items-center space-x-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-500 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-500 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-500 transition-colors">
                <Youtube size={20} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-500 transition-colors">
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="mt-4 pb-4">
              <nav className="flex flex-col space-y-3">
                <a href="/" className="text-white hover:text-yellow-500 transition-colors text-sm font-medium">HOME</a>
                <a href="/#about" className="text-white hover:text-yellow-500 transition-colors text-sm font-medium">ABOUT</a>
                <a href="/sessions" className="text-white hover:text-yellow-500 transition-colors text-sm font-medium">SESSIONS</a>
                <a href="/#media" className="text-white hover:text-yellow-500 transition-colors text-sm font-medium">MEDIA</a>
                <a href="/programs" className="text-white hover:text-yellow-500 transition-colors text-sm font-medium">PROGRAMS</a>
                <a href="/#contact" className="text-white hover:text-yellow-500 transition-colors text-sm font-medium">CONTACT</a>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section - Dark background with centered title */}
      <section className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <p className="text-yellow-600 text-sm tracking-[0.3em] uppercase mb-6">
          FLAGSHIP PROGRAM | FOUNDATION OF ALL WORK
        </p>
        <h1 className="text-white text-4xl md:text-6xl font-serif mb-8 max-w-4xl leading-tight">
          {program.title}
        </h1>
        <div className="h-1 w-24 bg-yellow-600 mx-auto"></div>
      </section>

      {/* Content Section - Light background */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          
          {/* The Journey */}
          <div className="mb-16">
            <h2 className="text-3xl font-serif text-center mb-8">The Journey</h2>
            <div className="h-1 w-16 bg-yellow-600 mx-auto mb-8"></div>
            <p className="text-gray-700 leading-relaxed text-lg text-justify">
              {program.description}
            </p>
          </div>

          {/* Who it is for */}
          <div className="mb-16 bg-gray-50 p-8 rounded-lg">
            <h2 className="text-2xl font-serif mb-6">Who it is for</h2>
            <p className="text-yellow-700 italic mb-4">A Sacred Invitation for those who resonate</p>
            <ul className="space-y-3 text-gray-700">
              <li>• You feel chronically tired, heavy, or emotionally burdened despite effort and awareness</li>
              <li>• You experience recurring health issues with no clear explanation</li>
              <li>• Your life keeps repeating similar emotional, relational, or professional patterns</li>
              <li>• You have "done a lot of inner work" but still feel stuck</li>
              <li>• You are highly responsible, empathetic, or have spent years holding it together</li>
            </ul>
          </div>

          {/* Your Experience */}
          <div className="mb-16">
            <h2 className="text-2xl font-serif mb-6">Your Experience</h2>
            <p className="text-gray-700 leading-relaxed text-lg mb-6 text-justify">
              You begin to experience an internal lightness that feels unfamiliar yet deeply natural. The body softens, breathing deepens, and emotional reactions lose their intensity. Patterns that once felt automatic start dissolving without conscious effort. Healing no longer feels like work — it becomes a by-product of inner safety and release.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg italic">
              Many people describe this phase as finally living a happy life in the true sense, not because life is perfect, but because it is no longer heavy.
            </p>
          </div>

          {/* CTA Section */}
          <div className="mb-16 text-center bg-gradient-to-r from-gray-800 to-gray-900 text-white p-12 rounded-lg">
            <h3 className="text-2xl font-serif mb-4">When you are seeking</h3>
            <p className="mb-8 text-lg">
              When you are done fixing, forcing, or proving — and you are ready to live with ease, clarity, and emotional freedom — this program becomes the foundation for that shift.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {program.price_usd > 0 && (
                <Button 
                  onClick={() => navigate(`/checkout/program/${program.id}`)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-6 text-lg rounded-full"
                >
                  Pay Now - From ${program.price_usd}
                </Button>
              )}
              <Button 
                onClick={() => navigate('/contact')}
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-gray-900 px-8 py-6 text-lg rounded-full"
              >
                Express Your Interest
              </Button>
            </div>
          </div>

          {/* Testimonials */}
          <div className="mb-16">
            <h2 className="text-3xl font-serif text-center mb-12">Testimonials</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <img 
                    src={`https://images.unsplash.com/photo-${1500000000000 + i}?w=400&h=400&fit=crop&crop=faces`}
                    alt={`Testimonial ${i}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-serif mb-4">Divine Iris Healing</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Delve into the deeper realm of your soul with Divine Iris – Soulful Healing Studio
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/" className="hover:text-yellow-500 transition-colors">Home</a></li>
                <li><a href="/#about" className="hover:text-yellow-500 transition-colors">About</a></li>
                <li><a href="/sessions" className="hover:text-yellow-500 transition-colors">Sessions</a></li>
                <li><a href="/#media" className="hover:text-yellow-500 transition-colors">Media</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Flagship Programs</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/programs" className="hover:text-yellow-500 transition-colors">All Programs</a></li>
                <li><a href="/#programs" className="hover:text-yellow-500 transition-colors">View Programs</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-3 text-gray-400 text-sm">
                <li>
                  <a href="mailto:support@divineirishealing.com" className="hover:text-yellow-500 transition-colors">
                    support@divineirishealing.com
                  </a>
                </li>
                <li>
                  <a href="tel:+971553325778" className="hover:text-yellow-500 transition-colors">
                    +971553325778
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-gray-500 text-sm">
              © 2026 Divine Iris Healing. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating Contact Buttons */}
      <div className="fixed right-6 bottom-6 flex flex-col gap-3 z-40">
        <a
          href="mailto:support@divineirishealing.com"
          className="w-14 h-14 bg-yellow-600 hover:bg-yellow-700 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
        >
          <Mail size={24} className="text-white" />
        </a>
        <a
          href="https://wa.me/971553325778"
          target="_blank"
          rel="noopener noreferrer"
          className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
        >
          <Phone size={24} className="text-white" />
        </a>
      </div>
    </div>
  );
}

export default ProgramDetailPage;
