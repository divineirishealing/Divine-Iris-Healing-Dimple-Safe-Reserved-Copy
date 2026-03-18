import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Upload, Download, FileText, Loader2, Users, ChevronDown, ChevronUp, CreditCard, Calendar } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriberRow = ({ s }) => {
  const [open, setOpen] = useState(false);
  const sub = s.subscription || {};
  const sess = sub.sessions || {};
  const emis = sub.emis || [];
  const paidEmis = emis.filter(e => e.status === 'paid').length;

  return (
    <>
      <tr className="border-b hover:bg-gray-50 text-xs" data-testid={`subscriber-row-${s.id}`}>
        <td className="px-3 py-2.5 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span className="truncate max-w-[150px]">{s.name}</span>
          </button>
        </td>
        <td className="px-3 py-2 text-gray-500">{s.email}</td>
        <td className="px-3 py-2 font-medium">{sub.annual_program}</td>
        <td className="px-3 py-2 text-center">{sub.start_date}</td>
        <td className="px-3 py-2 text-center">{sub.end_date}</td>
        <td className="px-3 py-2 text-right font-mono">{sub.currency} {sub.total_fee?.toLocaleString()}</td>
        <td className="px-3 py-2 text-center">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.payment_mode === 'EMI' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
            {sub.payment_mode || 'N/A'}
          </span>
        </td>
        <td className="px-3 py-2 text-center">{paidEmis}/{emis.length}</td>
        <td className="px-3 py-2 text-center">{sess.availed || 0}/{sess.total || 0}</td>
        <td className="px-3 py-2 text-center">{sess.yet_to_avail || 0}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} className="bg-gray-50 px-6 py-4 border-b">
            <div className="grid md:grid-cols-2 gap-6">
              {/* EMI Schedule */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                  <CreditCard size={12} /> EMI Schedule
                </h4>
                {emis.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No EMI data</p>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left py-1">#</th>
                        <th className="text-left py-1">Due Date</th>
                        <th className="text-right py-1">Amount</th>
                        <th className="text-right py-1">Remaining</th>
                        <th className="text-center py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emis.map(e => (
                        <tr key={e.number} className="border-b border-gray-100">
                          <td className="py-1 font-medium">{e.number}</td>
                          <td className="py-1">{e.due_date || '-'}</td>
                          <td className="py-1 text-right font-mono">{e.amount?.toLocaleString()}</td>
                          <td className="py-1 text-right font-mono">{e.remaining?.toLocaleString()}</td>
                          <td className="py-1 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              e.status === 'paid' ? 'bg-green-100 text-green-700' :
                              e.status === 'due' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{e.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {/* Sessions & Programs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Sessions & Programs
                </h4>
                <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
                  <div className="bg-white p-2 rounded border text-center">
                    <div className="text-gray-400">Carry Fwd</div>
                    <div className="font-bold text-gray-900">{sess.carry_forward || 0}</div>
                  </div>
                  <div className="bg-white p-2 rounded border text-center">
                    <div className="text-gray-400">Current</div>
                    <div className="font-bold text-gray-900">{sess.current || 0}</div>
                  </div>
                  <div className="bg-white p-2 rounded border text-center">
                    <div className="text-gray-400">Due</div>
                    <div className="font-bold text-red-600">{sess.due || 0}</div>
                  </div>
                </div>
                {sub.programs?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-gray-400 uppercase">Programs in Package:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sub.programs.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-medium">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {sess.scheduled_dates?.length > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase">Scheduled:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sess.scheduled_dates.map((d, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px]">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const SubscribersTab = () => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscribers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/subscribers/list`);
      setSubscribers(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadStats(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/admin/subscribers/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStats(res.data.stats);
      toast({ title: 'Upload Complete', description: `Created: ${res.data.stats.created}, Updated: ${res.data.stats.updated}` });
      setFile(null);
      fetchSubscribers();
    } catch (err) {
      toast({ title: 'Upload Failed', description: err.response?.data?.detail || 'Error', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${API}/admin/subscribers/download-template`, '_blank');
  };

  const handleExport = () => {
    window.open(`${API}/admin/subscribers/export`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Annual Subscribers</h2>
          <p className="text-sm text-gray-500 mt-1">Manage subscriber packages, EMIs, sessions & programs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="download-template-btn">
            <FileText size={14} className="mr-1" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-subscribers-btn">
            <Download size={14} className="mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white p-5 rounded-lg border shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Upload Subscriber Database</h3>
        <p className="text-xs text-gray-500 mb-3">
          Upload Excel with columns: Name, Email, Annual Program, Start/End Date, Total Fee, Currency, Payment Mode, EMIs (1-12), Sessions, Programs.
          <button onClick={handleDownloadTemplate} className="text-[#5D3FD3] ml-1 hover:underline">Download template</button>
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => setFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              data-testid="subscriber-file-input"
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !file} className="bg-[#D4AF37] hover:bg-[#b8962e]" data-testid="subscriber-upload-btn">
            {uploading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
            Upload
          </Button>
        </div>
        {uploadStats && (
          <div className="mt-3 p-3 bg-green-50 rounded border border-green-200 text-xs">
            <span className="font-semibold text-green-700">Results:</span> Created: {uploadStats.created}, Updated: {uploadStats.updated}
            {uploadStats.errors?.length > 0 && <span className="text-red-600 ml-2">Errors: {uploadStats.errors.length}</span>}
          </div>
        )}
      </div>

      {/* Subscribers Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Users size={16} /> Subscribers ({subscribers.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
        ) : subscribers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400 italic">
            No subscribers yet. Upload an Excel file to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b">
                  <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10 border-r">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Program</th>
                  <th className="px-3 py-2 text-center">Start</th>
                  <th className="px-3 py-2 text-center">End</th>
                  <th className="px-3 py-2 text-right">Total Fee</th>
                  <th className="px-3 py-2 text-center">Mode</th>
                  <th className="px-3 py-2 text-center">EMIs</th>
                  <th className="px-3 py-2 text-center">Sessions</th>
                  <th className="px-3 py-2 text-center">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map(s => <SubscriberRow key={s.id} s={s} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscribersTab;
