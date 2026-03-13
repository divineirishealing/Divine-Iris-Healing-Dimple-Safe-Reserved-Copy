import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Monitor, Wifi, Mail, Phone, User, Calendar, Search, Download } from 'lucide-react';
import { Input } from '../../ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const downloadCSV = (data, filename, type) => {
  let csv = '';
  if (type === 'enrollments') {
    csv = 'Booker Name,Booker Email,Phone,Program,Status,Date,Participant Name,Participant Relationship,Participant Age,Attendance Mode,Participant Email\n';
    data.forEach(e => {
      const base = [
        `"${(e.booker_name || '').replace(/"/g, '""')}"`,
        `"${e.booker_email || ''}"`,
        `"${e.phone || ''}"`,
        `"${(e.program_title || e.item_title || '').replace(/"/g, '""')}"`,
        `"${e.status || 'pending'}"`,
        `"${e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}"`,
      ];
      if (e.participants && e.participants.length > 0) {
        e.participants.forEach(p => {
          csv += [...base, `"${(p.name || '').replace(/"/g, '""')}"`, `"${p.relationship || ''}"`, `"${p.age || ''}"`, `"${p.attendance_mode || ''}"`, `"${p.email || ''}"`].join(',') + '\n';
        });
      } else {
        csv += [...base, '', '', '', '', ''].join(',') + '\n';
      }
    });
  } else {
    csv = 'Program,Customer Email,Customer Name,Amount,Currency,Status,Stripe Intent,Date\n';
    data.forEach(t => {
      csv += [
        `"${(t.item_title || '').replace(/"/g, '""')}"`,
        `"${t.customer_email || ''}"`,
        `"${(t.customer_name || '').replace(/"/g, '""')}"`,
        t.amount || 0,
        `"${(t.currency || '').toUpperCase()}"`,
        `"${t.payment_status || 'pending'}"`,
        `"${t.stripe_payment_intent || ''}"`,
        `"${t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}"`,
      ].join(',') + '\n';
    });
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const EnrollmentsTab = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('enrollments'); // enrollments | transactions

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [enr, tx] = await Promise.all([
        axios.get(`${API}/enrollment/admin/list`),
        axios.get(`${API}/payments/transactions`),
      ]);
      setEnrollments(enr.data);
      setTransactions(tx.data);
    } catch (e) { console.error(e); }
  };

  const filtered = view === 'enrollments'
    ? enrollments.filter(e => {
        const q = search.toLowerCase();
        return !q || e.booker_name?.toLowerCase().includes(q) || e.booker_email?.toLowerCase().includes(q) ||
          e.participants?.some(p => p.name?.toLowerCase().includes(q));
      })
    : transactions.filter(t => {
        const q = search.toLowerCase();
        return !q || t.customer_email?.toLowerCase().includes(q) || t.item_title?.toLowerCase().includes(q);
      });

  return (
    <div data-testid="enrollments-tab">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Enrollments & Payments</h2>
      <p className="text-xs text-gray-400 mb-4">View all enrollments and payment transactions.</p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setView('enrollments')}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${view === 'enrollments' ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600'}`}>
          Enrollments ({enrollments.length})
        </button>
        <button onClick={() => setView('transactions')}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${view === 'transactions' ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600'}`}>
          Payments ({transactions.length})
        </button>
        <div className="ml-auto flex gap-2">
          {view === 'enrollments' && enrollments.length > 0 && (
            <button data-testid="download-enrollments-csv" onClick={() => downloadCSV(enrollments, 'enrollments', 'enrollments')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all">
              <Download size={13} /> Download CSV
            </button>
          )}
          {view === 'transactions' && transactions.length > 0 && (
            <button data-testid="download-transactions-csv" onClick={() => downloadCSV(transactions, 'payments', 'transactions')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all">
              <Download size={13} /> Download CSV
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or program..." className="pl-9 text-sm" />
      </div>

      {view === 'enrollments' && (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No enrollments yet</p>}
          {filtered.map((e, i) => (
            <div key={e.id || i} className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-sm text-gray-900">{e.booker_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Mail size={11} /> {e.booker_email}</span>
                    {e.phone && <span className="flex items-center gap-1"><Phone size={11} /> {e.phone}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    e.status === 'checkout_complete' ? 'bg-green-100 text-green-700' :
                    e.status === 'phone_verified' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{(e.status || 'pending').replace(/_/g, ' ')}</span>
                  <p className="text-[10px] text-gray-400 mt-1">{e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}</p>
                </div>
              </div>

              {e.participants && e.participants.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-[10px] text-gray-500 mb-1.5 font-medium">PARTICIPANTS ({e.participants.length})</p>
                  <div className="grid gap-1.5">
                    {e.participants.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                        <User size={11} className="text-gray-400" />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-gray-400">({p.relationship})</span>
                        <span className="text-gray-400">Age {p.age}</span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                          p.attendance_mode === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {p.attendance_mode === 'online' ? <Monitor size={9} /> : <Wifi size={9} />}
                          {p.attendance_mode === 'online' ? 'Zoom' : 'Remote'}
                        </span>
                        {p.notify && p.email && <span className="text-gray-400 flex items-center gap-0.5"><Mail size={9} /> {p.email}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'transactions' && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Program</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No payments yet</td></tr>}
              {filtered.map((t, i) => (
                <tr key={t.id || i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{t.item_title || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.customer_email || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#D4AF37]">
                    {t.currency?.toUpperCase()} {t.amount}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      t.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{t.payment_status || 'pending'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnrollmentsTab;
