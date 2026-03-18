import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Save, Loader2, CheckCircle, Plus, X, Calendar } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SchedulerTab = () => {
  const { toast } = useToast();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/subscribers/program-schedule`);
      const data = res.data || [];
      if (data.length > 0) {
        setPrograms(data);
      } else {
        // Seed from package config
        try {
          const pkgRes = await axios.get(`${API}/admin/subscribers/packages`);
          const pkg = (pkgRes.data || [])[0];
          if (pkg?.included_programs?.length > 0) {
            setPrograms(pkg.included_programs.map(p => ({
              name: p.name, duration_value: p.duration_value, duration_unit: p.duration_unit, schedule: []
            })));
          }
        } catch (e2) {}
      }
    } catch (e) {
      // Seed defaults if endpoint doesn't exist yet
      setPrograms([
        { name: 'AWRP', duration_value: 12, duration_unit: 'months', schedule: [] },
        { name: 'Money Magic Multiplier', duration_value: 6, duration_unit: 'months', schedule: [] },
        { name: 'Quarterly Meetups', duration_value: 4, duration_unit: 'sessions', schedule: [] },
        { name: 'Bi-Annual Downloads', duration_value: 2, duration_unit: 'sessions', schedule: [] },
      ]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateSlot = (progIdx, slotIdx, field, value) => {
    const updated = [...programs];
    const sched = [...(updated[progIdx].schedule || [])];
    sched[slotIdx] = { ...sched[slotIdx], [field]: field === 'completed' ? value : value };
    updated[progIdx] = { ...updated[progIdx], schedule: sched };
    setPrograms(updated);
  };

  const generateSlots = (progIdx) => {
    const prog = programs[progIdx];
    const sched = [];
    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth(); // current month

    for (let i = 0; i < prog.duration_value; i++) {
      if (prog.name === 'AWRP') {
        // Fixed: 3rd to 30th of every month
        const m = (startMonth + i) % 12;
        const y = startYear + Math.floor((startMonth + i) / 12);
        const mo = String(m + 1).padStart(2, '0');
        const daysInMo = new Date(y, m + 1, 0).getDate();
        // 30th or spill: Feb 28d → Mar 2, Feb 29d → Mar 1
        let endDate;
        if (daysInMo >= 30) {
          endDate = `${y}-${mo}-30`;
        } else {
          const spillDays = 30 - daysInMo;
          const spillDate = new Date(y, m + 1, spillDays);
          endDate = spillDate.toISOString().split('T')[0];
        }
        sched.push({ month: i + 1, date: `${y}-${mo}-03`, end_date: endDate, time: '10PM IST', note: 'Weekends: Offline', completed: false });
      } else if (prog.duration_unit === 'months') {
        sched.push({ month: i + 1, date: '', end_date: '', time: '', completed: false });
      } else {
        sched.push({ session: i + 1, date: '', time: '', completed: false });
      }
    }
    const updated = [...programs];
    updated[progIdx] = { ...updated[progIdx], schedule: sched };
    setPrograms(updated);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/subscribers/program-schedule`, programs);
      toast({ title: 'Program schedule saved & synced to all subscribers' });
    } catch (e) { toast({ title: 'Error saving', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>;

  return (
    <div className="space-y-4" data-testid="scheduler-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Program Scheduler</h2>
          <p className="text-sm text-gray-500">Set dates once — applies to all subscribers</p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid="save-schedule-btn">
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
          Save & Sync to All
        </Button>
      </div>

      {/* One table per program */}
      {programs.map((prog, pi) => {
        const isMonths = prog.duration_unit === 'months';
        const schedule = prog.schedule || [];
        const completedCount = schedule.filter(s => s.completed).length;

        return (
          <div key={pi} className="bg-white rounded-xl border shadow-sm overflow-hidden" data-testid={`sched-prog-${prog.name}`}>
            {/* Program Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-[#5D3FD3]/5 to-[#D4AF37]/5 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-[#5D3FD3]" />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{prog.name}</h3>
                  <p className="text-[10px] text-gray-500">{prog.duration_value} {prog.duration_unit} · {completedCount}/{schedule.length} completed</p>
                </div>
              </div>
              {schedule.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => generateSlots(pi)} className="h-7 text-xs">
                  <Plus size={12} className="mr-1" /> Generate {prog.duration_value} Slots
                </Button>
              )}
            </div>

            {/* Schedule Grid */}
            {schedule.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase border-b">
                      <th className="px-3 py-2 text-left w-16">#</th>
                      <th className="px-2 py-2 text-left">Start Date</th>
                      {isMonths && <th className="px-2 py-2 text-left">End Date</th>}
                      <th className="px-2 py-2 text-left">Time</th>
                      <th className="px-2 py-2 text-left">Note</th>
                      <th className="px-2 py-2 text-center w-16">Done</th>
                      <th className="px-2 py-2 text-center w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((slot, si) => {
                      const label = isMonths ? `Month ${si + 1}` : `Session ${si + 1}`;
                      const hasDate = !!slot.date;
                      return (
                        <tr key={si} className={`border-b border-gray-50 ${slot.completed ? 'bg-green-50/50' : ''}`}>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold ${slot.completed ? 'bg-green-500 text-white' : hasDate ? 'bg-[#5D3FD3] text-white' : 'bg-gray-100 text-gray-400'}`}>
                              {slot.completed ? <CheckCircle size={12} /> : si + 1}
                            </span>
                            <span className="ml-2 text-gray-600 font-medium">{label}</span>
                          </td>
                          <td className="px-2 py-2">
                            <Input type="date" value={slot.date || ''} onChange={e => updateSlot(pi, si, 'date', e.target.value)}
                              className="h-7 text-xs w-36" />
                          </td>
                          {isMonths && (
                            <td className="px-2 py-2">
                              <Input type="date" value={slot.end_date || ''} onChange={e => updateSlot(pi, si, 'end_date', e.target.value)}
                                className="h-7 text-xs w-36" />
                            </td>
                          )}
                          <td className="px-2 py-2">
                            <Input value={slot.time || ''} onChange={e => updateSlot(pi, si, 'time', e.target.value)}
                              placeholder="e.g. 7PM IST" className="h-7 text-xs w-28" />
                          </td>
                          <td className="px-2 py-2">
                            {slot.note ? (
                              <span className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">{slot.note}</span>
                            ) : (
                              <Input value={slot.note || ''} onChange={e => updateSlot(pi, si, 'note', e.target.value)}
                                placeholder="Note" className="h-7 text-xs w-28" />
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={slot.completed || false}
                              onChange={e => updateSlot(pi, si, 'completed', e.target.checked)}
                              className="w-4 h-4 accent-green-500 cursor-pointer" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              slot.completed ? 'bg-green-100 text-green-700' :
                              hasDate ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-400'
                            }`}>
                              {slot.completed ? 'Done' : hasDate ? 'Scheduled' : 'TBD'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {schedule.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400 italic">
                Click "Generate Slots" to create the schedule
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SchedulerTab;
