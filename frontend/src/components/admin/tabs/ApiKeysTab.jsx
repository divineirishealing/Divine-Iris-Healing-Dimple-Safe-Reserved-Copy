import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Copy, Check, Eye, EyeOff, Key, Shield, Save, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useToast } from '../../../hooks/use-toast';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ApiKeysTab = () => {
  const { toast } = useToast();
  const [keys, setKeys] = useState([]);
  const [editedValues, setEditedValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  const loadKeys = () => {
    setLoading(true);
    axios.get(`${API}/admin/api-keys`).then(r => {
      setKeys(r.data);
      const vals = {};
      r.data.forEach(k => { vals[k.name] = k.value; });
      setEditedValues(vals);
    }).catch(() => {
      toast({ title: 'Could not load API keys', description: 'Check admin login and try Refresh.', variant: 'destructive' });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadKeys(); }, []);

  const toggleVisibility = (name) => setVisibleKeys(prev => ({ ...prev, [name]: !prev[name] }));

  const copyToClipboard = (value, name) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(name);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleChange = (name, value) => {
    setEditedValues(prev => ({ ...prev, [name]: value }));
  };

  const hasChanges = keys.some(k => editedValues[k.name] !== k.value);

  const saveKeys = async () => {
    setSaving(true);
    try {
      const changed = {};
      keys.forEach(k => {
        if (editedValues[k.name] !== k.value) changed[k.name] = editedValues[k.name];
      });
      await axios.put(`${API}/admin/api-keys`, changed);
      toast({ title: 'API keys saved successfully!' });
      loadKeys();
    } catch (err) {
      toast({ title: 'Failed to save', description: err.response?.data?.detail || 'Error', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // Group keys by service
  const grouped = {};
  keys.forEach(k => {
    const group = k.service;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(k);
  });

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

  return (
    <div data-testid="api-keys-tab">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-[#D4AF37]" />
          <h2 className="text-lg font-semibold text-gray-900">API Keys & Integrations</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading} data-testid="refresh-keys-btn">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            size="sm"
            onClick={saveKeys}
            disabled={saving || !hasChanges}
            className="bg-[#D4AF37] hover:bg-[#b8962e] text-white disabled:opacity-50"
            data-testid="save-keys-btn"
          >
            {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Edit a field below — the Save button activates when something changed. Keys apply immediately after save (no restart).
      </p>
      {!hasChanges && keys.length > 0 && (
        <p className="text-xs text-amber-700 mb-4" data-testid="api-keys-save-hint">
          To update Razorpay: click the eye icon, replace Key ID and Secret from your Razorpay dashboard, then Save Changes.
        </p>
      )}
      <div className="mb-6" />

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="mb-5">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{group}</h3>
          <div className="space-y-2">
            {items.map((item) => {
              const isEdited = editedValues[item.name] !== item.value;
              const isPassword = item.name.includes('pass') || item.name.includes('key') || item.name.includes('api');
              return (
                <div key={item.name} data-testid={`api-key-${item.name}`}
                  className={`bg-white border rounded-lg p-4 transition-all ${isEdited ? 'border-[#D4AF37] shadow-sm' : ''}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${editedValues[item.name] ? 'bg-green-500' : 'bg-red-400'}`} />
                    <h4 className="text-xs font-semibold text-gray-800">{item.label}</h4>
                    {item.source === 'admin' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37]">Custom</span>}
                    {isEdited && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Unsaved</span>}
                  </div>
                  <p className="text-[10px] text-gray-400 mb-2">{item.description}</p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      data-testid={`input-${item.name}`}
                      type={isPassword && !visibleKeys[item.name] ? 'password' : 'text'}
                      value={editedValues[item.name] || ''}
                      onChange={e => handleChange(item.name, e.target.value)}
                      placeholder={`Enter ${item.label.toLowerCase()}`}
                      className="flex-1 text-xs font-mono h-8"
                    />
                    {isPassword && (
                      <button data-testid={`toggle-${item.name}`} onClick={() => toggleVisibility(item.name)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                        {visibleKeys[item.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                    <button data-testid={`copy-${item.name}`} onClick={() => copyToClipboard(editedValues[item.name] || '', item.name)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                      {copiedKey === item.name ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {keys.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Shield size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No API keys configured yet.</p>
        </div>
      )}

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Shield size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-800">Security Note</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Keys are stored securely in the database. Changes take effect immediately after saving — no restart needed.</p>
          </div>
        </div>
      </div>

      {keys.length > 0 && (
        <div className="sticky bottom-4 mt-4 z-10">
          <Button
            onClick={saveKeys}
            disabled={saving || !hasChanges}
            className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-lg shadow-lg disabled:opacity-50"
            data-testid="save-keys-bottom-btn"
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
            {hasChanges ? 'Save All Changes' : 'Save Changes (edit a field first)'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ApiKeysTab;
