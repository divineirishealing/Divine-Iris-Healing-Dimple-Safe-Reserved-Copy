import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Save, Loader2, CheckCircle, Calendar } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PROGRAMS = ['AWRP', 'Money Magic Multiplier', 'Quarterly Meetups', 'Bi-Annual Downloads'];

const SchedulerTab = () => {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [activeProgram, setActiveProgram] = useState('AWRP');
  const [changes, setChanges] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/subscribers/list`);
      setSubscribers(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getProgramDetail = (sub, progName) => {
    const pd = sub.subscription?.programs_detail || [];
    return pd.find(p => p.name === progName) || null;
  };

  const getSchedule = (sub, progName) => {
    const pd = getProgramDetail(sub, progName);
    return pd?.schedule || [];
  };

  const getMaxSlots = (progName) => {
    let max = 0;
    for (const sub of subscribers) {
      const pd = getProgramDetail(sub, progName);
      if (pd) max = Math.max(max, pd.duration_value || 0);
    }
    return max || (progName === 'AWRP' ? 12 : progName === 'Money Magic Multiplier' ? 6 : progName === 'Quarterly Meetups' ? 4 : 2);
  };

  const updateCell = (subId, slotIndex, field, value) => {
    const key = `${subId}_${slotIndex}_${field}`;
    setChanges(prev => ({ ...prev, [key]: { subId, slotIndex, field, value } }));
  };

  const getCellValue = (sub, slotIndex, field) => {
    const key = `${sub.id}_${slotIndex}_${field}`;
    if (changes[key]) return changes[key].value;
    const schedule = getSchedule(sub, activeProgram);
    return schedule[slotIndex]?.[field] || '';
  };

  const saveAll = async () => {
    setSaving('all');
    const grouped = {};
    for (const ch of Object.values(changes)) {
      if (!grouped[ch.subId]) grouped[ch.subId] = {};
      if (!grouped[ch.subId][ch.slotIndex]) grouped[ch.subId][ch.slotIndex] = {};
      grouped[ch.subId][ch.slotIndex][ch.field] = ch.value;
    }

    for (const [subId, slots] of Object.entries(grouped)) {
      try {
        const sub = subscribers.find(s => s.id === subId);
        if (!sub) continue;
        const subscription = { ...sub.subscription };
        const pd = [...(subscription.programs_detail || [])];
        const progIdx = pd.findIndex(p => p.name === activeProgram);
        if (progIdx === -1) continue;

        const schedule = [...(pd[progIdx].schedule || [])];
        for (const [si, fields] of Object.entries(slots)) {
          const idx = parseInt(si);
          while (schedule.length <= idx) {
            schedule.push(pd[progIdx].duration_unit === 'months'
              ? { month: schedule.length + 1, date: '', end_date: '', mode_choice: '', completed: false }
              : { session: schedule.length + 1, date: '', time: '', mode_choice: '', completed: false });
          }
          schedule[idx] = { ...schedule[idx], ...fields };
        }
        pd[progIdx] = { ...pd[progIdx], schedule };
        subscription.programs_detail = pd;

        await axios.put(`${API}/admin/subscribers/update/${subId}`, {
          ...subscription,
          name: sub.name,
          email: sub.email,
          programs: subscription.programs || [],
          programs_detail: pd,
          emis: subscription.emis || [],
          sessions: subscription.sessions || {},
        });
      } catch (e) { console.error(e); }
    }

    setChanges({});
    toast({ title: 'Schedule saved' });
    fetchData();
    setSaving(null);
  };

  const maxSlots = getMaxSlots(activeProgram);
  const isMonths = activeProgram === 'AWRP' || activeProgram === 'Money Magic Multiplier';

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>;

  return (
    <div className="space-y-4" data-testid="scheduler-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Program Scheduler</h2>
          <p className="text-sm text-gray-500">Set dates for all subscribers in one view</p>
        </div>
        <Button onClick={saveAll} disabled={saving || Object.keys(changes).length === 0} className="bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="save-schedule-btn">
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
          Save All Changes {Object.keys(changes).length > 0 && `(${Object.keys(changes).length})`}
        </Button>
      </div>

      {/* Program Tabs */}
      <div className="flex gap-1">
        {PROGRAMS.map(prog => (
          <button key={prog} onClick={() => { setActiveProgram(prog); setChanges({}); }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${activeProgram === prog ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            data-testid={`prog-tab-${prog}`}>
            {prog}
          </button>
        ))}
      </div>

      {/* Spreadsheet Grid */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]" style={{ minWidth: `${200 + maxSlots * (isMonths ? 200 : 140)}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase text-gray-500 sticky left-0 bg-gray-50 z-10 border-r w-40">Subscriber</th>
                {Array.from({ length: maxSlots }, (_, i) => (
                  <th key={i} className="px-1 py-2 text-center border-l" colSpan={isMonths ? 2 : 2}>
                    <span className="text-[9px] font-bold text-gray-500">{isMonths ? `Month ${i + 1}` : `Session ${i + 1}`}</span>
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50 border-b text-[8px] text-gray-400 uppercase">
                <th className="px-3 py-1 sticky left-0 bg-gray-50 z-10 border-r"></th>
                {Array.from({ length: maxSlots }, (_, i) => (
                  <React.Fragment key={i}>
                    <th className="px-1 py-1 text-center border-l">{isMonths ? 'Start' : 'Date'}</th>
                    <th className="px-1 py-1 text-center">{isMonths ? 'End' : 'Time'}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscribers.map(sub => {
                const schedule = getSchedule(sub, activeProgram);
                const pd = getProgramDetail(sub, activeProgram);
                if (!pd) return null;
                return (
                  <tr key={sub.id} className="border-b hover:bg-gray-50/50" data-testid={`sched-row-${sub.id}`}>
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r">
                      <div className="font-bold text-gray-900 text-[10px] truncate w-36">{sub.name}</div>
                      <div className="text-[8px] text-gray-400 truncate">{sub.email}</div>
                    </td>
                    {Array.from({ length: maxSlots }, (_, si) => {
                      const sess = schedule[si] || {};
                      const isCompleted = getCellValue(sub, si, 'completed') === true || sess.completed;
                      return (
                        <React.Fragment key={si}>
                          <td className={`px-0.5 py-1 border-l ${isCompleted ? 'bg-green-50' : ''}`}>
                            <div className="relative">
                              <input type="date"
                                value={getCellValue(sub, si, 'date')}
                                onChange={e => updateCell(sub.id, si, 'date', e.target.value)}
                                className={`w-full h-6 text-[9px] border rounded px-1 outline-none focus:ring-1 focus:ring-[#D4AF37] ${isCompleted ? 'bg-green-50' : 'bg-white'} ${changes[`${sub.id}_${si}_date`] ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-gray-200'}`}
                              />
                              {isCompleted && <CheckCircle size={8} className="absolute right-1 top-1.5 text-green-500" />}
                            </div>
                          </td>
                          <td className={`px-0.5 py-1 ${isCompleted ? 'bg-green-50' : ''}`}>
                            {isMonths ? (
                              <input type="date"
                                value={getCellValue(sub, si, 'end_date')}
                                onChange={e => updateCell(sub.id, si, 'end_date', e.target.value)}
                                className={`w-full h-6 text-[9px] border rounded px-1 outline-none focus:ring-1 focus:ring-[#D4AF37] ${changes[`${sub.id}_${si}_end_date`] ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-gray-200'}`}
                              />
                            ) : (
                              <input type="text"
                                value={getCellValue(sub, si, 'time')}
                                onChange={e => updateCell(sub.id, si, 'time', e.target.value)}
                                placeholder="Time"
                                className={`w-full h-6 text-[9px] border rounded px-1 outline-none focus:ring-1 focus:ring-[#D4AF37] ${changes[`${sub.id}_${si}_time`] ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-gray-200'}`}
                              />
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Object.keys(changes).length > 0 && (
          <div className="px-4 py-2 bg-[#D4AF37]/10 border-t flex items-center justify-between">
            <span className="text-[10px] text-[#D4AF37] font-semibold">{Object.keys(changes).length} unsaved changes</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setChanges({})} className="h-6 text-[9px]">Discard</Button>
              <Button size="sm" onClick={saveAll} className="h-6 text-[9px] bg-[#D4AF37] hover:bg-[#b8962e]">Save All</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulerTab;
