import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Mail, MessageSquare, Heart, Send, Trash2, ChevronDown, ChevronUp, Clock, Search, Users, Link2, Download } from 'lucide-react';
import { formatDateTimeDdMonYyyy } from '../../../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  new: 'bg-red-100 text-red-700',
  read: 'bg-blue-100 text-blue-700',
  replied: 'bg-green-100 text-green-700',
};

const inboxDateTime = (dateStr) => (dateStr ? formatDateTimeDdMonYyyy(dateStr) : '');

const InboxTab = () => {
  const { toast } = useToast();
  const [section, setSection] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [interests, setInterests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [counts, setCounts] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, iRes, qRes, pRes, countRes] = await Promise.all([
        axios.get(`${API}/inbox/contacts`),
        axios.get(`${API}/inbox/interests`),
        axios.get(`${API}/inbox/questions`),
        axios.get(`${API}/programs`),
        axios.get(`${API}/inbox/counts`),
      ]);
      setContacts(cRes.data || []);
      setInterests(iRes.data || []);
      setQuestions(qRes.data || []);
      setPrograms((pRes.data || []).filter(p => p.visible !== false));
      setCounts(countRes.data || {});
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (collection, id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await axios.delete(`${API}/inbox/${collection}/${id}`);
      toast({ title: 'Deleted' });
      fetchAll();
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  };

  const handleMarkRead = async (collection, id) => {
    try {
      await axios.put(`${API}/inbox/${collection}/${id}/status`, { status: 'read' });
      fetchAll();
    } catch { /* ignore */ }
  };

  const getFilteredItems = () => {
    let items = [];
    if (section === 'contacts') items = contacts;
    else if (section === 'interests') items = interests;
    else items = questions;

    if (filter === 'new') items = items.filter(i => (i.status || 'new') === 'new' && !i.replied);
    else if (filter === 'replied') items = items.filter(i => i.status === 'replied' || i.replied);

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      items = items.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q) ||
        (i.message || '').toLowerCase().includes(q) ||
        (i.question || '').toLowerCase().includes(q) ||
        (i.program_title || '').toLowerCase().includes(q)
      );
    }
    return items;
  };

  const handleDownloadAll = () => {
    window.open(`${API}/inbox/download`, '_blank');
  };

  const sections = [
    { key: 'contacts', label: 'Contact Form', icon: Mail, count: counts.contacts_new || 0, total: counts.contacts_total || 0 },
    { key: 'interests', label: 'Express Interest', icon: Heart, count: 0, total: counts.interests_total || 0 },
    { key: 'questions', label: 'Questions', icon: MessageSquare, count: counts.questions_new || 0, total: counts.questions_total || 0 },
  ];

  const items = getFilteredItems();

  return (
    <div data-testid="inbox-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Mail size={18} className="text-[#D4AF37]" /> Inbox
          </h2>
          <p className="text-xs text-gray-500 mt-1">View and reply to all form submissions. Replies are sent via email with optional attachments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="inbox-download-all" onClick={handleDownloadAll} variant="outline" className="text-[10px] h-8 gap-1.5 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10">
            <Download size={12} /> Download All Data
          </Button>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-0.5">
          {['all', 'new', 'replied'].map(f => (
            <button key={f} data-testid={`inbox-filter-${f}`} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[10px] rounded-md font-medium transition-colors ${filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'all' ? 'All' : f === 'new' ? 'New' : 'Replied'}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-4" data-testid="inbox-sections">
        {sections.map(s => (
          <button key={s.key} data-testid={`inbox-section-${s.key}`} onClick={() => { setSection(s.key); setExpandedId(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all border ${section === s.key ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <s.icon size={14} />
            <span>{s.label}</span>
            {s.count > 0 && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{s.count}</span>}
            <span className="text-[10px] text-gray-400">({s.total})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input data-testid="inbox-search" type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="Search by name, email, message..." className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No items found</div>
        )}
        {items.map(item => {
          const isExpanded = expandedId === item.id;
          const status = item.replied ? 'replied' : (item.status || 'new');
          return (
            <div key={item.id} data-testid={`inbox-item-${item.id}`}
              className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-[#D4AF37] shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
              {/* Header Row */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-white hover:bg-gray-50/50"
                onClick={() => {
                  setExpandedId(isExpanded ? null : item.id);
                  if (status === 'new' && !isExpanded) handleMarkRead(section, item.id);
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900 truncate">{item.name || item.email || 'Anonymous'}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>{status.toUpperCase()}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">
                    {section === 'contacts' && (item.message || 'No message')}
                    {section === 'interests' && `Interested in: ${item.program_title || 'Unknown program'}`}
                    {section === 'questions' && (item.question || 'No question')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} />{inboxDateTime(item.created_at)}</span>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Detail + Reply */}
              {isExpanded && (
                <ExpandedItem item={item} section={section} programs={programs} onReply={fetchAll} onDelete={() => handleDelete(section, item.id)} toast={toast} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ExpandedItem = ({ item, section, programs, onReply, onDelete, toast }) => {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [includePrograms, setIncludePrograms] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [includeWhatsapp, setIncludeWhatsapp] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [includeWorkshop, setIncludeWorkshop] = useState(false);
  const [includeSocial, setIncludeSocial] = useState(true);

  const toggleProgram = (pid) => {
    setSelectedPrograms(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return toast({ title: 'Please write a reply', variant: 'destructive' });
    setSending(true);
    try {
      await axios.post(`${API}/inbox/reply/${section}/${item.id}`, {
        message: replyText,
        include_programs: includePrograms,
        program_ids: selectedPrograms,
        include_whatsapp: includeWhatsapp,
        whatsapp_link: whatsappLink,
        include_workshop_updates: includeWorkshop,
        include_social_links: includeSocial,
      });
      toast({ title: 'Reply sent successfully!' });
      setReplyText('');
      onReply();
    } catch (e) {
      toast({ title: 'Failed to send reply', variant: 'destructive' });
    }
    setSending(false);
  };

  const upcomingPrograms = programs.filter(p => p.is_upcoming || p.is_flagship);

  return (
    <div className="border-t bg-gray-50/50 px-4 py-4" data-testid={`inbox-expanded-${item.id}`}>
      {/* Detail Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {item.name && <DetailField label="Name" value={item.name} />}
        {item.email && <DetailField label="Email" value={item.email} />}
        {item.phone && <DetailField label="Phone" value={item.phone} />}
        {item.program_title && <DetailField label="Program/Session" value={item.program_title} />}
        {item.created_at && <DetailField label="Submitted" value={formatDateTimeDdMonYyyy(item.created_at)} />}
        {item.replied_at && <DetailField label="Replied" value={formatDateTimeDdMonYyyy(item.replied_at)} />}
      </div>

      {/* Full Message */}
      {(item.message || item.question) && (
        <div className="bg-white rounded-lg border p-3 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 mb-1">{section === 'questions' ? 'QUESTION' : 'MESSAGE'}</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{item.message || item.question}</p>
        </div>
      )}

      {/* Previous Reply */}
      {item.reply && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-3 mb-4">
          <p className="text-[10px] font-semibold text-green-600 mb-1">YOUR REPLY</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{item.reply}</p>
        </div>
      )}

      {/* Reply Composer */}
      <div className="bg-white rounded-lg border p-4">
        <p className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Send size={12} className="text-[#D4AF37]" /> Compose Reply</p>
        <Textarea data-testid="inbox-reply-text" value={replyText} onChange={e => setReplyText(e.target.value)}
          rows={4} placeholder={`Write your reply to ${item.name || item.email || 'this person'}...`}
          className="text-xs mb-3" />

        {/* Attachment Options */}
        <div className="space-y-2.5 mb-4">
          {/* Attach Programs */}
          <div className="bg-amber-50/50 rounded-lg border border-amber-100 p-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-gray-700 font-semibold flex items-center gap-1.5"><Users size={11} /> Attach Upcoming Programs</Label>
              <Switch data-testid="inbox-toggle-programs" checked={includePrograms} onCheckedChange={setIncludePrograms} />
            </div>
            {includePrograms && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {upcomingPrograms.map(p => (
                  <button key={p.id} data-testid={`inbox-program-${p.id}`} onClick={() => toggleProgram(p.id)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${selectedPrograms.includes(p.id) ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]'}`}>
                    {p.title}
                  </button>
                ))}
                {upcomingPrograms.length === 0 && <span className="text-[10px] text-gray-400 italic">No upcoming programs</span>}
              </div>
            )}
          </div>

          {/* WhatsApp Group */}
          <div className="bg-green-50/50 rounded-lg border border-green-100 p-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-gray-700 font-semibold flex items-center gap-1.5"><Link2 size={11} /> Join Our Community (WhatsApp)</Label>
              <Switch data-testid="inbox-toggle-whatsapp" checked={includeWhatsapp} onCheckedChange={setIncludeWhatsapp} />
            </div>
            {includeWhatsapp && (
              <input data-testid="inbox-whatsapp-link" type="url" value={whatsappLink} onChange={e => setWhatsappLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..." className="mt-2 w-full text-[10px] border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400" />
            )}
          </div>

          {/* Workshop Updates */}
          <div className="bg-purple-50/50 rounded-lg border border-purple-100 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-gray-700 font-semibold flex items-center gap-1.5"><Mail size={11} /> Subscribe to Future Workshops</Label>
              <Switch data-testid="inbox-toggle-workshop" checked={includeWorkshop} onCheckedChange={setIncludeWorkshop} />
            </div>
            <p className="text-[9px] text-gray-400 mt-0.5">Adds them to your newsletter subscribers list</p>
          </div>

          {/* Social Links */}
          <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-gray-700 font-semibold flex items-center gap-1.5"><Heart size={11} /> Include Social Media Links</Label>
              <Switch data-testid="inbox-toggle-social" checked={includeSocial} onCheckedChange={setIncludeSocial} />
            </div>
            <p className="text-[9px] text-gray-400 mt-0.5">Auto-includes your configured social links in the email footer</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button data-testid="inbox-delete-btn" onClick={onDelete} className="text-red-400 hover:text-red-600 text-[10px] flex items-center gap-1">
            <Trash2 size={12} /> Delete
          </button>
          <Button data-testid="inbox-send-reply" onClick={handleSendReply} disabled={sending} className="bg-[#D4AF37] hover:bg-[#b8962e] text-xs gap-1.5">
            <Send size={12} />{sending ? 'Sending...' : 'Send Reply'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const DetailField = ({ label, value }) => (
  <div>
    <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-[11px] text-gray-800 font-medium truncate" title={value}>{value}</p>
  </div>
);

export default InboxTab;
