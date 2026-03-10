import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Facebook, Instagram, Youtube, Linkedin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Footer = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const response = await axios.get(`${API}/programs`);
      setPrograms(response.data.slice(0, 6)); // Get first 6 programs
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  return (
    <footer id="contact" className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-serif mb-4">Divine Iris Healing</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Delve into the deeper realm of your soul with Divine Iris – Soulful Healing Studio
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <Youtube size={20} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-500 transition-colors">
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="/#home" className="hover:text-yellow-500 transition-colors">Home</a></li>
              <li><a href="/#about" className="hover:text-yellow-500 transition-colors">About</a></li>
              <li><a href="/#media" className="hover:text-yellow-500 transition-colors">Media</a></li>
              <li><a href="/sessions" className="hover:text-yellow-500 transition-colors">Sessions</a></li>
              <li><a href="/programs" className="hover:text-yellow-500 transition-colors">All Programs</a></li>
            </ul>
          </div>

          {/* Flagship Programs - Dynamic from database */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Flagship Programs</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              {programs.map((program) => (
                <li key={program.id}>
                  <button 
                    onClick={() => navigate(`/program/${program.id}`)}
                    className="hover:text-yellow-500 transition-colors text-left"
                  >
                    {program.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Us */}
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
              <li className="pt-4">
                <a href="#" className="hover:text-yellow-500 transition-colors">Terms & Conditions</a>
              </li>
              <li>
                <a href="#" className="hover:text-yellow-500 transition-colors">Privacy Policy</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            © 2026 Divine Iris Healing. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
