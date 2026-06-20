import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { getApiUrl } from '../../lib/config';
import { ChevronDown, ChevronRight, FileText, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API = getApiUrl();

// ---------------------------------------------------------------------------
// Pre-built content from SoulSync_Neuro_Harmonics_Program.docx
// ---------------------------------------------------------------------------
const SOULSYNC_DRAFT = [
  {
    id: 'journey',
    section_type: 'journey',
    title: 'What Is SoulSync Neuro∞Harmonics?',
    subtitle: '',
    body: `SoulSync Neuro∞Harmonics is a first-of-its-kind, multi-dimensional healing program that works simultaneously at the atomic, cellular, genetic, subconscious, and soul levels to restore neurological harmony — naturally, gently, and profoundly.

Unlike conventional approaches that manage symptoms, SoulSync Neuro∞Harmonics seeks and resolves the root cause — whether it lives in this lifetime, in ancestral memory, in your DNA, or in the energetic blueprint of your soul.

This is not a program that asks you to fight your condition. It is a program that dissolves the very foundation upon which the condition was built.

SoulSync Neuro∞Harmonics meets every client — caregiver and care receiver alike — exactly where they are, and gently does the heavy lifting for them.`,
    image_url: '',
    is_enabled: true,
    order: 0,
  },
  {
    id: 'who_for',
    section_type: 'who_for',
    title: 'Who Is This Program For?',
    subtitle: 'Designed for individuals and families navigating any neurological or neurodevelopmental challenge, including:',
    body: `Autism Spectrum Disorder (ASD) — communication, sensory, social and behavioural support
ADHD & ADD — focus, impulse regulation, emotional dysregulation
Dyslexia & Dyspraxia — learning and coordination challenges
Sensory Processing Disorder (SPD) — overwhelm from touch, sound, light and environment
Parkinson's Disease — tremor reduction, motor control, emotional wellbeing
Multiple Sclerosis (MS) — nervous system support and quality of life
Essential Tremor — calming the nervous system at its root
Dystonia & Tourette Syndrome
Dementia — cognitive clarity, emotional calm, caregiver relief
Alzheimer's Disease — memory support, presence, dignity
Mild Cognitive Impairment (MCI) & Brain Fog
Stroke Recovery — neurological regeneration and emotional resilience
Traumatic Brain Injury (TBI)
PTSD & Complex Trauma — releasing what the nervous system holds
Anxiety & Panic Disorders — rooted in neurological dysregulation
OCD — compulsive neurological loops addressed at their source
Burnout & Chronic Fatigue Syndrome
Fibromyalgia & Chronic Pain with neurological origin
Families, caregivers and loved ones who hold the space — because when a caregiver is depleted, healing slows`,
    image_url: '',
    is_enabled: true,
    order: 1,
  },
  {
    id: 'experience',
    section_type: 'experience',
    title: 'The Healing Modalities',
    subtitle: 'A Multi-Dimensional Approach',
    body: `1. Atomic Healing
Every physical condition has its deepest origin at the atomic and subatomic level, where energy precedes matter. Atomic Healing works directly at this quantum foundation, dissolving energetic distortions that manifest as neurological dysfunction.

2. DNA Healing
Our DNA is not merely a fixed genetic code — it carries emotional imprints and traumas passed down through generations. DNA Healing clears ancestral imprints, rewrites limiting genetic expressions, and activates the highest healing potential encoded within every strand.

3. Quantum Healing
Quantum Healing operates within the understanding that all possibilities exist simultaneously. We work with the field of infinite potential to support the nervous system's return to coherence, harmony and optimal function.

4. Theta Healing
Theta Healing accesses the theta brainwave state — the bridge between conscious and subconscious mind. We identify and rewrite the core beliefs that keep neurological patterns locked in place, creating profound and lasting shifts.

5. Past Life Regression Therapy
Some neurological patterns have roots that extend beyond this lifetime. We work to identify and resolve karmic imprints, soul-level contracts and unresolved experiences from previous lifetimes that may be contributing to present-day challenges.

6. Akashic Records Reading & Healing
By accessing a client's Akashic Records, we understand the soul's blueprint, identify the deeper purpose behind a neurological challenge, and clear energetic blocks accumulated across lifetimes.`,
    image_url: '',
    is_enabled: true,
    order: 2,
  },
  {
    id: 'why_now',
    section_type: 'why_now',
    title: 'Why SoulSync Neuro∞Harmonics Is Unlike Anything Else',
    subtitle: 'The Effortless Healing Philosophy',
    body: `SoulSync Neuro∞Harmonics was built with a radical belief: healing should not add to the exhaustion. It should relieve it.

Our program does the heavy lifting at the energetic, subconscious and soul level — so that clients and caregivers do not have to fight, force or push. The healing works through them, not just for them.

✦ Root cause, not symptom management — we work at the atomic, genetic and soul level
✦ No medication, no procedures — completely natural, non-invasive and safe for all ages
✦ Caregiver relief is built in — the program intentionally reduces the burden on those who care
✦ Effortless healing model — clients do not need to push or perform; the healing field does the work
✦ Multi-dimensional approach — six powerful modalities working in concert, not in isolation
✦ Online group format — accessible from Dubai, India, or anywhere in the world
✦ Amplified by collective healing — group energy accelerates individual results
✦ Soul-level precision — Akashic and Past Life work provides context no medical scan can offer`,
    image_url: '',
    is_enabled: true,
    order: 3,
  },
];

// Identifies which program IDs have pre-built document drafts
const SEEDED_PROGRAM_IDS = {
  'fee1a9ee-fe0c-48fd-8593-834a77418a3': SOULSYNC_DRAFT,
};

// ---------------------------------------------------------------------------

export default function DraftContentPanel({ editingId, programForm, setProgramForm, siteSettings }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const draft = programForm.draft_content_sections || [];
  const hasSeed = !!SEEDED_PROGRAM_IDS[editingId];
  const hasDraft = draft.length > 0;

  const secTemplate = siteSettings?.program_section_template || [];
  const typeLabels = {
    journey: 'The Journey',
    who_for: 'Who It Is For?',
    experience: 'Your Experience',
    why_now: 'Why You Need This Now?',
    custom: 'Custom',
  };
  const typeColor = {
    journey: 'bg-blue-50 border-blue-200',
    who_for: 'bg-amber-50 border-amber-200',
    experience: 'bg-gray-800 border-gray-600',
    why_now: 'bg-green-50 border-green-200',
    custom: 'bg-white border-gray-200',
  };

  const updateDraftSection = (sectionId, field, val) => {
    const sections = [...draft];
    const idx = sections.findIndex(s => s.id === sectionId || s.section_type === sectionId);
    if (idx >= 0) {
      sections[idx] = { ...sections[idx], [field]: val };
    } else {
      sections.push({ id: sectionId, section_type: sectionId, [field]: val });
    }
    setProgramForm(f => ({ ...f, draft_content_sections: sections }));
  };

  const importFromDoc = () => {
    const seed = SEEDED_PROGRAM_IDS[editingId];
    if (!seed) return;
    setProgramForm(f => ({ ...f, draft_content_sections: JSON.parse(JSON.stringify(seed)) }));
    toast({ title: 'Document content imported into draft', description: 'Review and edit, then Save Draft.' });
  };

  const saveDraft = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/programs/${editingId}/draft-content`, {
        draft_content_sections: programForm.draft_content_sections || [],
      });
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
      '⚠️  This will REPLACE the live page content with your draft.\n\nThe changes will go live on the website immediately.\n\nContinue?'
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

  // Determine which sections to show: prefer existing draft; fall back to template
  const sectionsToEdit = hasDraft
    ? draft
    : secTemplate.filter(t => t.is_enabled !== false).map(t => ({
        id: t.id,
        section_type: t.section_type,
        title: t.default_title || '',
        subtitle: t.default_subtitle || '',
        body: '',
        image_url: '',
        is_enabled: true,
        order: t.order,
      }));

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
          DRAFT CONTENT {hasDraft ? `(${draft.length} sections staged)` : '— not live yet'}
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

          {/* Import button for seeded programs */}
          {hasSeed && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Upload size={14} className="text-blue-500 shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-blue-700">Content available from document</p>
                <p className="text-[10px] text-blue-500">SoulSync_Neuro_Harmonics_Program.docx — pre-structured and ready to import</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={importFromDoc}
                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                Import from Doc
              </Button>
            </div>
          )}

          {/* Section editors */}
          {sectionsToEdit.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">
              {hasSeed
                ? 'Click "Import from Doc" to pre-fill from the document, or add sections manually.'
                : 'No sections yet. Import content or add from the section template.'}
            </p>
          )}

          <div className="space-y-3">
            {sectionsToEdit.map((sec, idx) => {
              const isDark = sec.section_type === 'experience';
              const colClass = typeColor[sec.section_type] || 'bg-white border-gray-200';
              const label = typeLabels[sec.section_type] || sec.title || 'Section';

              return (
                <div key={sec.id || idx} className="border rounded-lg overflow-hidden">
                  <div className={`px-4 py-2 border-b ${colClass} flex items-center gap-2`}>
                    <span className={`text-[10px] font-bold ${isDark ? 'text-yellow-400' : 'text-gray-700'}`}>
                      #{idx + 1} {label}
                    </span>
                    {isDark && <span className="text-[8px] px-1.5 py-0.5 bg-black/30 text-white rounded">Dark Background</span>}
                    <span className="ml-auto text-[9px] text-purple-500 font-semibold">DRAFT</span>
                  </div>
                  <div className="p-4 bg-white">
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-[10px]">Title</Label>
                        <Input
                          value={sec.title || ''}
                          onChange={e => updateDraftSection(sec.id || sec.section_type, 'title', e.target.value)}
                          placeholder="Section heading..."
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Subtitle</Label>
                        <Input
                          value={sec.subtitle || ''}
                          onChange={e => updateDraftSection(sec.id || sec.section_type, 'subtitle', e.target.value)}
                          placeholder="Optional subtitle..."
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">
                        Body Content
                        {sec.section_type === 'who_for' && ' (one item per line)'}
                      </Label>
                      <Textarea
                        value={sec.body || ''}
                        onChange={e => updateDraftSection(sec.id || sec.section_type, 'body', e.target.value)}
                        rows={5}
                        placeholder={sec.section_type === 'who_for' ? 'One bullet per line...' : 'Section content...'}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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
            {!hasDraft && (
              <span className="text-[10px] text-gray-400 italic">Save a draft first before publishing.</span>
            )}
            {hasDraft && (
              <span className="flex items-center gap-1 text-[10px] text-purple-500">
                <CheckCircle2 size={11} /> Draft ready to publish
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
