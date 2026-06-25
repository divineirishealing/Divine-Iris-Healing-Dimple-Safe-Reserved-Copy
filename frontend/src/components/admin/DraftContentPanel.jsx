import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { getApiUrl, isUploadApiReachable } from '../../lib/config';
import { ChevronDown, ChevronRight, FileText, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API = getApiUrl();

// ---------------------------------------------------------------------------
// Pre-built content from SoulSync_Neuro_Harmonics_Program.docx
//
// Layout produced on the live page:
//   1. doc_intro  (document type, white, order -1) — flows before template sections
//   2. journey / who_for / why_now → all blank → skipped (no gap rendered)
//   3. experience  (dark section, order 2)  — your photo + quote
//   4. doc_body   (document type, white, order 4) — all remaining doc content
//
// The "document" section type uses rich typographic rendering:
//   **Heading**  → centred gold heading + gold rule
//   **Sub**      → inline bold dark sub-heading
//   ✦ line       → gold bullet
//   *quote*      → centred italic quote
//   plain text   → justified body
// ---------------------------------------------------------------------------
const SOULSYNC_DRAFT = [
  // ── Blank template placeholders (all skipped by the empty-section guard) ──
  { id: 'journey',  section_type: 'journey',  title: '', subtitle: '', body: '', image_url: '', is_enabled: true, order: 0 },
  { id: 'who_for',  section_type: 'who_for',  title: '', subtitle: '', body: '', image_url: '', is_enabled: true, order: 1 },
  { id: 'why_now',  section_type: 'why_now',  title: '', subtitle: '', body: '', image_url: '', is_enabled: true, order: 3 },

  // ── Dark section: your photo + opening quote ──
  {
    id: 'experience',
    section_type: 'experience',
    title: '',
    subtitle: '',
    body: `"What if the answers to your most complex neurological challenges were not found in a prescription bottle, but encoded within the deepest layers of your own soul, your DNA, and the quantum field that surrounds every cell of your being?"`,
    image_url: '',
    is_enabled: true,
    order: 2,
  },

  // ── Document section BEFORE the dark block ──
  {
    id: 'doc_intro',
    section_type: 'document',
    title: '',
    subtitle: '',
    body: `At Divine Iris Healing, we believe that neurological conditions — whether Parkinson's, Autism, ADHD, Dementia, or any other neuro-divergent expression — are not life sentences. They are invitations. Invitations to heal at a level so deep, so fundamental, that modern medicine has yet to fully map it.

SoulSync Neuro∞Harmonics is our flagship group healing program, born from years of dedicated practice, profound client transformations, and an unwavering belief that every human being — regardless of diagnosis — carries within them an infinite capacity to heal.

**What Is SoulSync Neuro∞Harmonics?**

SoulSync Neuro∞Harmonics is a first-of-its-kind, multi-dimensional healing program that works simultaneously at the atomic, cellular, genetic, subconscious, and soul levels to restore neurological harmony — naturally, gently, and profoundly.

Unlike conventional approaches that manage symptoms, SoulSync Neuro∞Harmonics seeks and resolves the root cause — whether it lives in this lifetime, in ancestral memory, in your DNA, or in the energetic blueprint of your soul.

This is not a program that asks you to fight your condition. It is a program that dissolves the very foundation upon which the condition was built.

SoulSync Neuro∞Harmonics meets every client — caregiver and care receiver alike — exactly where they are, and gently does the heavy lifting for them.

**Who Is This Program For?**

SoulSync Neuro∞Harmonics is designed for individuals and families navigating any neurological or neurodevelopmental challenge, including:

**Neurodevelopmental Conditions**
✦ Autism Spectrum Disorder (ASD) — communication, sensory, social and behavioural support
✦ ADHD & ADD — focus, impulse regulation, emotional dysregulation
✦ Dyslexia & Dyspraxia — learning and coordination challenges
✦ Sensory Processing Disorder (SPD) — overwhelm from touch, sound, light and environment

**Degenerative & Movement Disorders**
✦ Parkinson's Disease — tremor reduction, motor control, emotional wellbeing
✦ Multiple Sclerosis (MS) — nervous system support and quality of life
✦ Essential Tremor — calming the nervous system at its root
✦ Dystonia & Tourette Syndrome

**Cognitive & Memory Conditions**
✦ Dementia — cognitive clarity, emotional calm, caregiver relief
✦ Alzheimer's Disease — memory support, presence, dignity
✦ Mild Cognitive Impairment (MCI) & Brain Fog
✦ Stroke Recovery — neurological regeneration and emotional resilience
✦ Traumatic Brain Injury (TBI)

**Emotional & Nervous System Conditions**
✦ PTSD & Complex Trauma — releasing what the nervous system holds
✦ Anxiety & Panic Disorders — rooted in neurological dysregulation
✦ OCD — compulsive neurological loops addressed at their source
✦ Burnout & Chronic Fatigue Syndrome
✦ Fibromyalgia & Chronic Pain with neurological origin

This program is also designed for the families, caregivers and loved ones who hold the space — because when a caregiver is depleted, healing slows. SoulSync Neuro∞Harmonics lightens the load for everyone in the healing journey.`,
    image_url: '',
    is_enabled: true,
    order: -1,
  },

  // ── Document section AFTER the dark block ──
  {
    id: 'doc_body',
    section_type: 'document',
    title: '',
    subtitle: '',
    body: `**The Healing Modalities — A Multi-Dimensional Approach**

What makes SoulSync Neuro∞Harmonics truly extraordinary is the depth and breadth of healing wisdom it draws upon. Each modality has been carefully chosen for its ability to work at a specific layer of the human system, creating a wholistic, synergistic healing effect that no single modality can achieve alone.

**1. Atomic Healing**
Every physical condition has its deepest origin at the atomic and subatomic level, where energy precedes matter. Atomic Healing works directly at this quantum foundation, dissolving energetic distortions that manifest as neurological dysfunction. When we heal at the atomic level, we are healing at the level of pure potential — where all transformation begins.

**2. DNA Healing**
Our DNA is not merely a fixed genetic code. It is a living, responsive library — one that carries not only our biological inheritance but also the emotional imprints, traumas and limiting patterns passed down through generations. DNA Healing works to clear these ancestral imprints, rewrite limiting genetic expressions, and activate the highest healing potential encoded within every strand.

**3. Quantum Healing**
Quantum Healing operates within the understanding that all possibilities exist simultaneously, and that consciousness has the power to collapse limiting timelines and activate healing realities. Through Quantum Healing, we work with the field of infinite potential to support the nervous system's return to coherence, harmony and optimal function.

**4. Theta Healing**
Theta Healing accesses the theta brainwave state — the bridge between the conscious and subconscious mind, the state of deep meditation and restorative sleep. In this state, the subconscious is most receptive to positive change. We use Theta Healing to identify and rewrite the core beliefs that keep neurological patterns locked in place, creating profound and lasting shifts at the deepest level of the mind.

**5. Past Life Regression Therapy**
Some neurological patterns have roots that extend beyond this lifetime. As a certified Past Life Regression Therapist, our practitioner works to identify and resolve karmic imprints, soul-level contracts and unresolved experiences from previous lifetimes that may be contributing to present-day neurological challenges. This is gentle, compassionate, deeply transformative work.

**6. Akashic Records Reading & Healing**
The Akashic Records are the energetic archive of every soul's journey — past, present and potential futures. By accessing a client's Akashic Records, we can understand the soul's blueprint, identify the deeper purpose behind a neurological challenge, and clear energetic blocks that have accumulated across lifetimes. This is healing with context, compassion and cosmic clarity.

**How The Program Works**

SoulSync Neuro∞Harmonics is delivered as an intimate online group healing program, available in two formats to suit different needs and timelines:

**The 1-Month Intensive**
Designed for those seeking rapid stabilisation and a powerful initial shift.
✦ Weekly live group healing sessions with direct energy transmission
✦ Targeted healing across the atomic, DNA, theta and quantum layers
✦ Community support and shared healing field amplification
✦ Recording access for all sessions
*Ideal for: Initial assessment, crisis stabilisation, caregivers seeking relief*

**The 3-Month Transformation**
Designed for deep, lasting, multi-layered neurological transformation.
✦ Progressive healing that builds momentum week by week
✦ Past Life Regression and Akashic Records work included
✦ Sustained community healing field — the group energy amplifies individual results
✦ Direct messaging support between sessions
*Ideal for: Long-term conditions, complex cases, families seeking sustained improvement*

The group healing format is intentional and powerful. When individuals heal together, the collective field creates an amplification effect — each participant's healing accelerates the healing of others. Families often join together, and the shared experience becomes its own medicine.

**Why SoulSync Neuro∞Harmonics Is Unlike Anything Else**

One of the most overlooked aspects of neurological care is the immense burden it places on caregivers. SoulSync Neuro∞Harmonics was built with a radical belief: healing should not add to the exhaustion. It should relieve it.

Our program does the heavy lifting at the energetic, subconscious and soul level — so that clients and caregivers do not have to fight, force or push. The healing works through them, not just for them.

*"The greatest gift we give our clients is this: they do not have to try harder. They simply have to be present. The healing finds them."*

✦ **Root cause, not symptom management** — we work at the atomic, genetic and soul level
✦ **No medication, no procedures** — completely natural, non-invasive and safe for all ages
✦ **Caregiver relief is built in** — reduces the burden on those who care
✦ **Effortless healing model** — clients do not need to push or perform
✦ **Multi-dimensional approach** — six powerful modalities working in concert
✦ **Online group format** — accessible from Dubai, India, or anywhere in the world
✦ **Amplified by collective healing** — group energy accelerates individual results
✦ **Soul-level precision** — Akashic and Past Life work provides context no medical scan can offer

**How SoulSync Neuro∞Harmonics Is Transforming Lives**

The results witnessed within SoulSync Neuro∞Harmonics continue to humble and inspire us. While every journey is unique, the patterns of transformation we see consistently include:

**In Parkinson's Disease**
✦ Significant reduction in tremor frequency and intensity
✦ Improved motor control and ease of movement
✦ Greater emotional stability and reduced anxiety
✦ Families reporting a visible lightness and presence returning
✦ Reduced caregiver exhaustion as the client's needs naturally stabilise

**In Autism Spectrum Disorder**
✦ Reduced sensory overwhelm and meltdown frequency
✦ Improved communication and social engagement
✦ Greater emotional regulation and self-expression
✦ Calmer, more connected family dynamics
✦ Parents reporting more ease, more joy, less crisis management

**In ADHD**
✦ Improved focus and task completion
✦ Reduced impulsivity and emotional dysregulation
✦ Better sleep and nervous system regulation
✦ Greater self-awareness and confidence

**In Dementia & Alzheimer's**
✦ Moments of remarkable clarity and recognition
✦ Reduced agitation and emotional distress
✦ Greater peace and dignity in daily life
✦ Significant relief for family caregivers

These are not isolated incidents. They are the consistent, recurring outcomes of healing that works at the level where all change begins — within.

**Your Healer**

The SoulSync Neuro∞Harmonics program is led by the founder of Divine Iris Healing — a certified Quantum Healer, Theta Healer, Past Life Regression Therapist and Akashic Records Reader with a deep commitment to making profound healing accessible to every family, in every corner of the world.

With training across multiple healing disciplines and years of experience working with complex neurological cases, our founder brings both the technical precision of a trained healer and the compassionate presence of someone who truly understands what families navigating these journeys carry.

*"I created SoulSync Neuro∞Harmonics because I witnessed what was possible when we stopped trying to manage conditions and started healing them at their root. The results I have seen have changed my understanding of what healing is capable of — and I want every family to know that this possibility exists for them."*

**Program Details**

Format: Online — accessible globally, including Dubai and India
✦ Live group sessions with healing transmission
✦ Session recordings provided
✦ Community support between sessions

Options:
✦ 1-Month Intensive Program — rapid stabilisation and initial transformation
✦ 3-Month Deep Transformation Program — sustained, layered, lasting change

Who Can Join:
✦ Individuals with any neurological or neurodevelopmental condition
✦ Parents and caregivers joining alongside or on behalf of a loved one
✦ Families seeking a different path — natural, holistic and profound
✦ Anyone who has tried conventional approaches and is ready for something deeper`,
    image_url: '',
    is_enabled: true,
    order: 4,
  },
];

// ---------------------------------------------------------------------------

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
}) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastImportedFile, setLastImportedFile] = useState('');

  const draft = programForm.draft_content_sections || [];
  const hasDraft = draft.length > 0;
  const displayDraft = sortDraftForDisplay(draft);
  const contentCount = countContentSections(draft);

  const persistDraft = async (sections, { filename } = {}) => {
    setProgramForm((f) => ({ ...f, draft_content_sections: sections }));
    if (!editingId) return false;
    await axios.patch(`${API}/programs/${editingId}/draft-content`, {
      draft_content_sections: sections,
    });
    onDraftUpdated?.(editingId, sections);
    if (filename) setLastImportedFile(filename);
    return true;
  };

  const applyDraftSections = async (sections, { filename, autoSave = true } = {}) => {
    setOpen(true);
    const n = countContentSections(sections);
    if (!editingId) {
      setProgramForm((f) => ({ ...f, draft_content_sections: sections }));
      toast({
        title: 'Content loaded into draft',
        description: `${n} section(s) with content. Save this program first, then Save Draft.`,
        duration: 8000,
      });
      return;
    }
    if (autoSave) {
      setSaving(true);
      try {
        await persistDraft(sections, { filename });
        toast({
          title: filename ? `Imported for ${programTitle || 'this program'}` : 'Document imported',
          description: `"${filename || 'Document'}" — ${n} section(s) saved to this program's draft only.`,
        });
      } catch (e) {
        setProgramForm((f) => ({ ...f, draft_content_sections: sections }));
        toast({
          title: 'Imported locally — save failed',
          description: importErrorMessage(e),
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    } else {
      setProgramForm((f) => ({ ...f, draft_content_sections: sections }));
      toast({
        title: filename ? `Imported ${filename}` : 'Document imported',
        description: `${n} section(s) with content. Click Save Draft to persist.`,
      });
    }
  };

  const importSoulSyncTemplate = () => {
    applyDraftSections(JSON.parse(JSON.stringify(SOULSYNC_DRAFT)), { filename: 'SoulSync template' });
  };

  const handleDocxFile = async (file) => {
    if (!file) return;
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
      setProgramForm((f) => ({ ...f, draft_content_sections: sections }));
      onDraftUpdated?.(editingId, sections);
      setLastImportedFile(file.name);
      const n = r.data?.content_section_count ?? countContentSections(sections);
      toast({
        title: `Imported for ${programTitle || 'program'}`,
        description: `"${file.name}" — ${n} section(s) saved to this program only.`,
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

          {/* Import — per program; drag a .docx or choose file */}
          <div
            className={`space-y-2 rounded-lg p-3 border-2 border-dashed transition-colors ${
              dragOver ? 'bg-blue-100 border-blue-400' : 'bg-blue-50 border-blue-200'
            }`}
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
                  Each program has its <strong>own draft</strong>. Upload a <strong>.docx</strong> file (drag here or choose file).
                  {lastImportedFile ? ` Last import: ${lastImportedFile}.` : ''}
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
                disabled={importing || !editingId}
                onClick={() => fileRef.current?.click()}
                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                {importing ? 'Reading document…' : 'Choose .docx file'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={importing || !editingId}
                onClick={importSoulSyncTemplate}
                className="text-[10px] border-blue-300 text-blue-700 shrink-0"
              >
                SoulSync sample template
              </Button>
            </div>
          </div>

          {/* Section editors */}
          {!hasDraft && (
            <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">
              Upload a .docx file or use the SoulSync template to pre-fill draft sections.
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
