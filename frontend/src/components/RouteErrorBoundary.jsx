import React from 'react';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Route render failed:', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a] px-6 text-center">
          <h1 className="text-white text-lg mb-2" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            This page could not be loaded
          </h1>
          <p className="text-gray-400 text-sm mb-6 max-w-md">
            Please refresh the page. If the problem continues, try again from the homepage.
          </p>
          <a
            href="/"
            className="inline-block text-white px-6 py-2.5 text-xs tracking-[0.2em] uppercase rounded-full"
            style={{ background: '#D4AF37' }}
          >
            Back to Home
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
