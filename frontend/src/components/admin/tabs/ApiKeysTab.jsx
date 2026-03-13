import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Copy, Check, Eye, EyeOff, Key, Shield } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ApiKeysTab = () => {
  const { toast } = useToast();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/api-keys`).then(r => setKeys(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleVisibility = (name) => setVisibleKeys(prev => ({ ...prev, [name]: !prev[name] }));

  const copyToClipboard = (value, name) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(name);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskValue = (val) => {
    if (!val || val.length < 8) return '••••••••';
    return val.slice(0, 6) + '•'.repeat(Math.min(val.length - 10, 20)) + val.slice(-4);
  };

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

  return (
    <div data-testid="api-keys-tab">
      <div className="flex items-center gap-2 mb-1">
        <Key size={18} className="text-[#D4AF37]" />
        <h2 className="text-lg font-semibold text-gray-900">API Keys & Integrations</h2>
      </div>
      <p className="text-xs text-gray-500 mb-6">All active API keys and service credentials used by your website.</p>

      <div className="space-y-3">
        {keys.map((item) => (
          <div key={item.name} data-testid={`api-key-${item.name}`}
            className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${item.active ? 'bg-green-500' : 'bg-red-400'}`} />
                  <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{item.service}</span>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">{item.description}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 border rounded px-3 py-1.5 text-xs font-mono text-gray-700 truncate">
                    {visibleKeys[item.name] ? item.value : maskValue(item.value)}
                  </code>
                  <button data-testid={`toggle-${item.name}`} onClick={() => toggleVisibility(item.name)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    {visibleKeys[item.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button data-testid={`copy-${item.name}`} onClick={() => copyToClipboard(item.value, item.name)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    {copiedKey === item.name ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {keys.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Shield size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No API keys configured yet.</p>
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Shield size={14} className="text-amber-600 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800">Security Note</p>
            <p className="text-[11px] text-amber-700 mt-0.5">These keys are stored securely on the server. Never share API keys publicly or commit them to version control.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysTab;
