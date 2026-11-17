import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { ProgramDetailPage } from './ProgramDetailPage';
import { isAwrpIntroProgram } from '../lib/awrpIntroProgram';
import { indiaProgramRazorpayPath, MAHALAKSHMI_PROGRAM_ID } from '../lib/indiaProgramLanding';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * `/india/program/:id` — same long program page as the public site, with Razorpay reserve block.
 */
export default function IndiaProgramLandingPage() {
  const { id: programId } = useParams();
  const navigate = useNavigate();
  const [gate, setGate] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGate('loading');
      setLoadError('');
      try {
        const { data: prog } = await axios.get(`${API}/programs/${programId}`);
        if (cancelled) return;
        if (isAwrpIntroProgram(prog)) {
          navigate(indiaProgramRazorpayPath(prog), { replace: true });
          return;
        }
        if (prog.id === MAHALAKSHMI_PROGRAM_ID) {
          navigate('/india/shri-mahalakshmi-akshaya-samriddhi', { replace: true });
          return;
        }
        const dedicated = String(prog.link || '').trim().split('?')[0];
        if (
          dedicated.startsWith('/india/')
          && !dedicated.startsWith('/india/program/')
          && dedicated !== '/india/program'
        ) {
          navigate(dedicated, { replace: true });
          return;
        }
        setGate('ready');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.detail || 'Could not load this program.');
          setGate('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, navigate]);

  if (gate === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
      </div>
    );
  }

  if (gate === 'error') {
    return (
      <div className="min-h-screen bg-[#faf7f2] px-6 py-20 text-center">
        <p className="text-red-700 mb-4">{loadError || 'Program not found.'}</p>
        <Link to="/programs" className="text-sm underline text-gray-700">
          Back to programs
        </Link>
      </div>
    );
  }

  return <ProgramDetailPage surface="india-razorpay" />;
}