import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';

function ContactPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate submission
    setTimeout(() => {
      toast({
        title: "Thank you for your interest!",
        description: "We'll get back to you within 24 hours.",
      });
      setFormData({ name: '', email: '', phone: '', message: '' });
      setSubmitting(false);
    }, 1000);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-serif text-gray-900 mb-4">
                Express Your Interest
              </h1>
              <p className="text-lg text-gray-600">
                Ready to begin your healing journey? Let us know how we can help.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-8 md:p-12">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <Textarea
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about what you're looking for..."
                    rows={6}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-6"
                  >
                    {submitting ? 'Submitting...' : 'Submit Inquiry'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="px-8"
                  >
                    Back
                  </Button>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Ways to Reach Us</h3>
                <div className="space-y-3 text-gray-600">
                  <p>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:support@divineirishealing.com" className="text-yellow-600 hover:underline">
                      support@divineirishealing.com
                    </a>
                  </p>
                  <p>
                    <strong>Phone:</strong>{' '}
                    <a href="tel:+971553325778" className="text-yellow-600 hover:underline">
                      +971 55 332 5778
                    </a>
                  </p>
                  <p>
                    <strong>WhatsApp:</strong>{' '}
                    <a
                      href="https://wa.me/971553325778"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-600 hover:underline"
                    >
                      Chat with us
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <FloatingButtons />
    </>
  );
}

export default ContactPage;
