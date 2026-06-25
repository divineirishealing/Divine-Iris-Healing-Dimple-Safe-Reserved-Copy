import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { getApiUrl, isUploadApiReachable } from '../../lib/config';
import { ChevronDown, ChevronRight, FileText, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API = getApiUrl();

const TYPE_LABELS = {
  journey: 'Intro / Journey',
  who_for: 'Who It Is For',
  experience: 'Experience (Dark)',
  why_now: 'Why Now / How It Works',
  document: 'Document Block',
  custom: 'Custom Section',
};

const TYPE_COLOR = {
  journey: 'bg-blue-50 border-blue-200',
  who_for: 'bg-amber-50 border-amber-200',
  experience: 'bg-gray-800 border-gray-600',
  why_now: 'bg-green-50 border-green-200',
  document: 'bg-indigo-50 border-indigo-200',
  custom: 'bg-white border-gray-200',
};

function sectionHasContent(sec) {
  return Boolean(
    (sec?.title || '').trim()
    || (sec?.subtitle || '').trim()
    || (sec?.body || '').trim()
    || (sec?.image_url || '').trim()
  );
}

/** Show sections with content first so import results are obvious. */
function sortDraftForDisplay(sections) {
  return [...sections].sort((a, b) => {
    const aContent = sectionHasContent(a) ? 0 : 1;
    const bContent = sectionHasContent(b) ? 0 : 1;
    if (aContent !== bContent) return aContent - bContent;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

function countContentSections(sections) {
  return (sections || []).filter(sectionHasContent).length;
}

function importErrorMessage(error) {
  if (!isUploadApiReachable()) {
    return 'API not configured. Set REACT_APP_BACKEND_URL on the frontend host and redeploy.';
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error?.response?.status === 404) {
    return 'Import endpoint not found — redeploy the backend (needs POST /programs/{id}/import-docx).';
  }
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Could not reach the API. Check your connection and try again.';
  }
  return error?.message || 'Could not read the document';
}

// ---------------------------------------------------------------------------

export default function DraftContentPanel({
  editingId,
  programTitle,
  programForm,
  setProgramForm,
  siteSettings,
  onDraftUpdated,
  draftLoading = false,
}) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const draft = programForm.draft_content_sections || [];
  const hasDraft = draft.length > 0;
  const displayDraft = sortDraftForDisplay(draft);
  const contentCount = countContentSections(draft);
  const draftSource = (programForm.draft_import_filename || '').trim();

  useEffect(() => {
    setImporting(false);
    setDragOver(false);
  }, [editingId]);

  const persistDraft = async (sections, { filename, importAt } = {}) => {
    const patch = { draft_content_sections: sections };
    if (filename !== undefined) patch.draft_import_filename = filename;
    if (importAt !== undefined) patch.draft_import_at = importAt;
    setProgramForm((f) => ({ ...f, ...patch }));
    if (!editingId) return false;
    await axios.patch(`${API}/programs/${editingId}/draft-content`, {
      draft_content_sections: sections,
      draft_import_filename: filename ?? programForm.draft_import_filename ?? '',
      draft_import_at: importAt ?? programForm.draft_import_at ?? '',
    });
    onDraftUpdated?.(editingId, sections, {
      draft_import_filename: filename ?? programForm.draft_import_filename ?? '',
      draft_import_at: importAt ?? programForm.draft_import_at ?? '',
    });
    return true;
  };

  const handleDocxFile = async (file) => {
    if (!file) return;
    if (draftLoading) {
      toast({ title: 'Still loading program…', description: 'Wait a moment, then try again.', variant: 'destructive' });
      return;
    }
    if (!isUploadApiReachable()) {
      toast({ title: 'Upload not available', description: importErrorMessage(null), variant: 'destructive' });
      return;
    }
    if (!editingId) {
      toast({
        title: 'Save the program first',
        description: 'Create or save this program, then upload a document for it.',
        variant: 'destructive',
      });
      return;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
      toast({
        title: 'Use .docx format',
        description: 'Old .doc files are not supported. In Word: File → Save As → Word Document (.docx).',
        variant: 'destructive',
      });
      return;
    }
    if (!lower.endsWith('.docx')) {
      toast({ title: 'Please choose a .docx file', variant: 'destructive' });
      return;
    }
    if (hasDraft && contentCount > 0) {
      const label = programTitle ? `"${programTitle}"` : 'this program';
      const ok = window.confirm(
        `Replace the existing draft on ${label} with "${file.name}"?\n\nOther programs are not affected.`
      );
      if (!ok) return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await axios.post(`${API}/programs/${editingId}/import-docx`, formData, {
        timeout: 120000,
      });
      const sections = r.data?.draft_content_sections || [];
      if (!sections.length) {
        throw new Error('No sections returned from document');
      }
      const importedAt = r.data?.draft_import_at || new Date().toISOString();
      const importedName = r.data?.draft_import_filename || r.data?.filename || file.name;
      setProgramForm((f) => ({
        ...f,
        draft_content_sections: sections,
        draft_import_filename: importedName,
        draft_import_at: importedAt,
      }));
      onDraftUpdated?.(editingId, sections, {
        draft_import_filename: importedName,
        draft_import_at: importedAt,
      });
      const n = r.data?.content_section_count ?? countContentSections(sections);
      toast({
        title: `Imported for ${programTitle || 'program'}`,
        description: `"${importedName}" — ${n} section(s). Only this program was updated.`,
      });
    } catch (e) {
      toast({
        title: 'Import failed',
        description: importErrorMessage(e),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateDraftSection = (idx, field, val) => {
    const sec = displayDraft[idx];
    const realIdx = draft.findIndex((s) => (s.id && s.id === sec.id) || s === sec);
    if (realIdx < 0) return;
    const sections = [...draft];
    sections[realIdx] = { ...sections[realIdx], [field]: val };
    setProgramForm((f) => ({ ...f, draft_content_sections: sections }));
  };

  const clearDraft = async () => {
    if (!editingId) return;
    const label = programTitle ? `"${programTitle}"` : 'this program';
    if (!window.confirm(`Clear the draft on ${label}?\n\nLive website content is unchanged.`)) return;
    setSaving(true);
    try {
      await axios.delete(`${API}/programs/${editingId}/draft-content`);
      setProgramForm((f) => ({
        ...f,
        draft_content_sections: [],
        draft_import_filename: '',
        draft_import_at: '',
      }));
      onDraftUpdated?.(editingId, [], { draft_import_filename: '', draft_import_at: '' });
      toast({ title: 'Draft cleared', description: `You can now upload a new .docx for ${programTitle || 'this program'}.` });
    } catch (e) {
      toast({ title: 'Could not clear draft', description: importErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!editingId) {
      toast({
        title: 'Save the program first',
        description: 'Create or save this program, then use Save Draft.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await persistDraft(programForm.draft_content_sections || []);
      toast({ title: 'Draft saved', description: 'Live website is unchanged.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!editingId) return;
    const ok = window.confirm(
      '⚠️  This will REPLACE the live page content with your draft.\n\nChanges will be visible on the website immediately.\n\nContinue?'
    );
    if (!ok) return;
    setPublishing(true);
    try {
      await axios.post(`${API}/programs/${editingId}/publish-draft`);
      toast({ title: 'Draft published!', description: 'Live program page now shows the new content.' });
    } catch (e) {
      toast({ title: 'Publish failed', description: e.response?.data?.detail || e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mt-4 border-2 border-dashed border-purple-300 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-purple-500" /> : <ChevronRight size={14} className="text-purple-500" />}
        <FileText size={14} className="text-purple-500" />
        <span className="text-[11px] font-bold text-purple-700 flex-1 text-left">
          DRAFT CONTENT
          {programTitle ? ` — ${programTitle}` : ''}
          {hasDraft ? ` (${contentCount} with content · ${draft.length} total)` : ' — not live yet'}
        </span>
        {hasDraft && (
          <span className="text-[9px] bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-semibold">STAGED</span>
        )}
      </button>

      {open && (
        <div className="p-4 bg-white space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <strong>Draft mode:</strong> Changes here are saved separately and do <em>not</em> affect the live website until you click <strong>"Publish Draft → Live"</strong>.
            </p>
          </div>

          {draftLoading && (
            <p className="text-[11px] text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              Loading draft for {programTitle || 'this program'}…
            </p>
          )}

          {draftSource && !draftLoading && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Current draft source: <strong>{draftSource}</strong>
              {programForm.draft_import_at ? ` · saved ${new Date(programForm.draft_import_at).toLocaleString()}` : ''}
            </p>
          )}

          {/* Import — per program; drag a .docx or choose file */}
          <div
            className={`space-y-2 rounded-lg p-3 border-2 border-dashed transition-colors ${
              dragOver ? 'bg-blue-100 border-blue-400' : 'bg-blue-50 border-blue-200'
            } ${draftLoading ? 'opacity-60 pointer-events-none' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleDocxFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="flex items-start gap-3">
              <Upload size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-blue-700">Import document for this program</p>
                <p className="text-[10px] text-blue-600 mt-0.5 leading-relaxed">
                  Upload a <strong>.docx</strong> for <strong>{programTitle || 'this program only'}</strong>.
                  Word <strong>Heading 1/2</strong>, <strong>bold</strong>, and <strong>highlight</strong> become gold headings;
                  lists become ✦ bullets — no duplicate sections.
                </p>
                {!editingId && (
                  <p className="text-[10px] text-amber-700 mt-1 font-medium">Save this program before importing.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => handleDocxFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                disabled={importing || !editingId || draftLoading}
                onClick={() => fileRef.current?.click()}
                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                {importing ? 'Reading document…' : 'Choose .docx file'}
              </Button>
              {hasDraft && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={importing || saving || draftLoading}
                  onClick={clearDraft}
                  className="text-[10px] border-red-300 text-red-700 shrink-0"
                >
                  Clear draft
                </Button>
              )}
            </div>
          </div>

          {/* Section editors */}
          {!hasDraft && !draftLoading && (
            <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">
              No draft yet — upload your program&apos;s .docx file above.
            </p>
          )}

          {hasDraft && (
            <div className="space-y-3">
              {displayDraft.map((sec, idx) => {
                const isDark = sec.section_type === 'experience';
                const colClass = TYPE_COLOR[sec.section_type] || 'bg-white border-gray-200';
                const label = TYPE_LABELS[sec.section_type] || 'Section';
                const hasContent = sectionHasContent(sec);
                const bodyLen = (sec.body || '').length;
                return (
                  <div key={sec.id || idx} className={`border rounded-lg overflow-hidden ${!hasContent ? 'opacity-75' : ''}`}>
                    <div className={`px-4 py-2 border-b ${colClass} flex items-center gap-2 flex-wrap`}>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-yellow-400' : 'text-gray-700'}`}>
                        #{idx + 1} {label}
                        {sec.id && sec.id !== sec.section_type ? ` (${sec.id})` : ''}
                      </span>
                      {!hasContent && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Blank — hidden on live page</span>
                      )}
                      {hasContent && bodyLen > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">{bodyLen.toLocaleString()} chars</span>
                      )}
                      {isDark && <span className="text-[8px] px-1.5 py-0.5 bg-black/30 text-white rounded">Dark bg</span>}
                      <span className="ml-auto text-[9px] text-purple-500 font-semibold">DRAFT</span>
                    </div>
                    <div className="p-4 bg-white">
                      {!hasContent && (
                        <p className="text-[10px] text-gray-400 mb-3 italic">
                          Intentionally empty — suppresses the default template heading on the public program page.
                        </p>
                      )}
                      <div className="grid md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-[10px]">Title <span className="text-gray-400 font-normal">(leave blank = no heading on page)</span></Label>
                          <Input
                            value={sec.title || ''}
                            onChange={e => updateDraftSection(idx, 'title', e.target.value)}
                            placeholder="Leave blank for no heading..."
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Subtitle</Label>
                          <Input
                            value={sec.subtitle || ''}
                            onChange={e => updateDraftSection(idx, 'subtitle', e.target.value)}
                            placeholder="Optional..."
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px]">
                          Body Content
                          {sec.section_type === 'who_for' && ' (one condition per line for bullet grid)'}
                          {' '}<span className="text-gray-400 font-normal">— use **bold** for headings within text</span>
                        </Label>
                        <Textarea
                          value={sec.body || ''}
                          onChange={e => updateDraftSection(idx, 'body', e.target.value)}
                          rows={bodyLen > 2000 ? 14 : bodyLen > 500 ? 10 : 7}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <Button
              type="button"
              size="sm"
              onClick={saveDraft}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white text-[11px]"
            >
              {saving ? 'Saving…' : '💾 Save Draft'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={publishDraft}
              disabled={publishing || !hasDraft}
              variant="outline"
              className="border-green-500 text-green-700 hover:bg-green-50 text-[11px]"
            >
              {publishing ? 'Publishing…' : '🚀 Publish Draft → Live'}
            </Button>
            {hasDraft && contentCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-purple-500">
                <CheckCircle2 size={11} /> {contentCount} section(s) ready — Publish to update live page
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
