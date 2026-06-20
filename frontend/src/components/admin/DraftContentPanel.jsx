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
//
// Layout: white intro section → dark section with image → white body section
//
// • journey   (white)  — everything up to and including "Who Is This Program For?"
// • who_for   (empty)  — intentionally blank so it is skipped (no gap rendered)
// • experience (dark)  — The Healing Modalities (keep image placeholder)
// • why_now   (white)  — all remaining document content in one flowing block
// ---------------------------------------------------------------------------
const SOULSYNC_DRAFT = [
  {
    id: 'journey',
    section_type: 'journey',
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
    order: 0,
  },
  {
    // Intentionally empty — skipped by the page renderer, no visual gap
    id: 'who_for',
    section_type: 'who_for',
    title: '',
    subtitle: '',
    body: '',
    image_url: '',
    is_enabled: true,
    order: 1,
  },
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
  {
    id: 'why_now',
    section_type: 'why_now',
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
Ideal for: Initial assessment, crisis stabilisation, caregivers seeking relief

**The 3-Month Transformation**
Designed for deep, lasting, multi-layered neurological transformation.
✦ Progressive healing that builds momentum week by week
✦ Past Life Regression and Akashic Records work included
✦ Sustained community healing field — the group energy amplifies individual results
✦ Direct messaging support between sessions
Ideal for: Long-term conditions, complex cases, families seeking sustained improvement

The group healing format is intentional and powerful. When individuals heal together, the collective field creates an amplification effect — each participant's healing accelerates the healing of others. Families often join together, and the shared experience becomes its own medicine.

**Why SoulSync Neuro∞Harmonics Is Unlike Anything Else**

One of the most overlooked aspects of neurological care is the immense burden it places on caregivers — parents of autistic children running from therapy to therapy, spouses managing a partner's Parkinson's alone, adult children watching a parent disappear into dementia. The conventional model of neurological care is exhausting for everyone involved.

SoulSync Neuro∞Harmonics was built with a radical belief: healing should not add to the exhaustion. It should relieve it.

Our program does the heavy lifting at the energetic, subconscious and soul level — so that clients and caregivers do not have to fight, force or push. The healing works through them, not just for them. We create the conditions for transformation to unfold naturally — so that progress is experienced as ease, not effort.

*"The greatest gift we give our clients is this: they do not have to try harder. They simply have to be present. The healing finds them."*

✦ **Root cause, not symptom management** — we work at the atomic, genetic and soul level
✦ **No medication, no procedures** — completely natural, non-invasive and safe for all ages
✦ **Caregiver relief is built in** — the program intentionally reduces the burden on those who care
✦ **Effortless healing model** — clients do not need to push or perform; the healing field does the work
✦ **Multi-dimensional approach** — six powerful modalities working in concert, not in isolation
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

With training across multiple healing disciplines and years of experience working with complex neurological cases, our founder brings both the technical precision of a trained healer and the compassionate presence of someone who understands — truly understands — what families navigating these journeys carry.

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
✦ Anyone who has tried conventional approaches and is ready for something deeper

**Ready to Begin?**

Your healing journey — and your family's relief — begins with one conversation. WhatsApp us today to learn which program is right for you.`,
    image_url: '',
    is_enabled: true,
    order: 3,
  },
];
  {
    id: 'journey',
    section_type: 'journey',
    title: '',
    subtitle: '',
    body: `At Divine Iris Healing, we believe that neurological conditions — whether Parkinson's, Autism, ADHD, Dementia, or any other neuro-divergent expression — are not life sentences. They are invitations. Invitations to heal at a level so deep, so fundamental, that modern medicine has yet to fully map it.

SoulSync Neuro∞Harmonics is our flagship group healing program, born from years of dedicated practice, profound client transformations, and an unwavering belief that every human being — regardless of diagnosis — carries within them an infinite capacity to heal.

**What Is SoulSync Neuro∞Harmonics?**

SoulSync Neuro∞Harmonics is a first-of-its-kind, multi-dimensional healing program that works simultaneously at the atomic, cellular, genetic, subconscious, and soul levels to restore neurological harmony — naturally, gently, and profoundly.

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
    title: '',
    subtitle: 'SoulSync Neuro∞Harmonics is designed for individuals and families navigating any neurological or neurodevelopmental challenge, including:',
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
Families, caregivers and loved ones who hold the space`,
    image_url: '',
    is_enabled: true,
    order: 1,
  },
  {
    id: 'experience',
    section_type: 'experience',
    title: '',
    subtitle: '',
    body: `**The Healing Modalities — A Multi-Dimensional Approach**

What makes SoulSync Neuro∞Harmonics truly extraordinary is the depth and breadth of healing wisdom it draws upon. Each modality has been carefully chosen for its ability to work at a specific layer of the human system, creating a wholistic, synergistic healing effect that no single modality can achieve alone.

**1. Atomic Healing**
Every physical condition has its deepest origin at the atomic and subatomic level, where energy precedes matter. Atomic Healing works directly at this quantum foundation, dissolving energetic distortions that manifest as neurological dysfunction.

**2. DNA Healing**
Our DNA carries not only our biological inheritance but also the emotional imprints and traumas passed down through generations. DNA Healing clears ancestral imprints, rewrites limiting genetic expressions, and activates the highest healing potential encoded within every strand.

**3. Quantum Healing**
Quantum Healing operates within the understanding that all possibilities exist simultaneously. We work with the field of infinite potential to support the nervous system's return to coherence, harmony and optimal function.

**4. Theta Healing**
Theta Healing accesses the theta brainwave state — the bridge between the conscious and subconscious mind. We identify and rewrite the core beliefs that keep neurological patterns locked in place, creating profound and lasting shifts.

**5. Past Life Regression Therapy**
Some neurological patterns have roots that extend beyond this lifetime. We work to identify and resolve karmic imprints, soul-level contracts and unresolved experiences from previous lifetimes contributing to present-day neurological challenges.

**6. Akashic Records Reading & Healing**
By accessing a client's Akashic Records, we understand the soul's blueprint, identify the deeper purpose behind a neurological challenge, and clear energetic blocks accumulated across lifetimes.`,
    image_url: '',
    is_enabled: true,
    order: 2,
  },
  {
    id: 'why_now',
    section_type: 'why_now',
    title: '',
    subtitle: '',
    body: `**How The Program Works**

SoulSync Neuro∞Harmonics is delivered as an intimate online group healing program, available in two formats to suit different needs and timelines:

**The 1-Month Intensive**
Designed for those seeking rapid stabilisation and a powerful initial shift.
✦ Weekly live group healing sessions with direct energy transmission
✦ Targeted healing across the atomic, DNA, theta and quantum layers
✦ Community support and shared healing field amplification
✦ Recording access for all sessions
Ideal for: Initial assessment, crisis stabilisation, caregivers seeking relief

**The 3-Month Transformation**
Designed for deep, lasting, multi-layered neurological transformation.
✦ Progressive healing that builds momentum week by week
✦ Past Life Regression and Akashic Records work included
✦ Sustained community healing field — the group energy amplifies individual results
✦ Direct messaging support between sessions
Ideal for: Long-term conditions, complex cases, families seeking sustained improvement

The group healing format is intentional and powerful. When individuals heal together, the collective field creates an amplification effect — each participant's healing accelerates the healing of others. Families often join together, and the shared experience becomes its own medicine.`,
    image_url: '',
    is_enabled: true,
    order: 3,
  },
];

// ---------------------------------------------------------------------------

export default function DraftContentPanel({ editingId, programForm, setProgramForm, siteSettings }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const draft = programForm.draft_content_sections || [];
  const hasDraft = draft.length > 0;

  const typeLabels = {
    journey: 'Intro / Journey',
    who_for: 'Who It Is For',
    experience: 'Experience (Dark)',
    why_now: 'Why Now / How It Works',
    custom: 'Custom Section',
  };
  const typeColor = {
    journey: 'bg-blue-50 border-blue-200',
    who_for: 'bg-amber-50 border-amber-200',
    experience: 'bg-gray-800 border-gray-600',
    why_now: 'bg-green-50 border-green-200',
    custom: 'bg-white border-gray-200',
  };

  const updateDraftSection = (idx, field, val) => {
    const sections = [...draft];
    sections[idx] = { ...sections[idx], [field]: val };
    setProgramForm(f => ({ ...f, draft_content_sections: sections }));
  };

  const importFromDoc = () => {
    setProgramForm(f => ({ ...f, draft_content_sections: JSON.parse(JSON.stringify(SOULSYNC_DRAFT)) }));
    toast({ title: 'Document content imported into draft', description: 'Review below, then Save Draft.' });
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

          {/* Import button */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Upload size={14} className="text-blue-500 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-blue-700">Import from document</p>
              <p className="text-[10px] text-blue-500">SoulSync_Neuro_Harmonics_Program.docx — 8 sections, full content, no generic headings</p>
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

          {/* Section editors */}
          {!hasDraft && (
            <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">
              Click "Import from Doc" above to pre-fill all 8 sections from the document.
            </p>
          )}

          {hasDraft && (
            <div className="space-y-3">
              {draft.map((sec, idx) => {
                const isDark = sec.section_type === 'experience';
                const colClass = typeColor[sec.section_type] || 'bg-white border-gray-200';
                const label = typeLabels[sec.section_type] || 'Section';
                return (
                  <div key={sec.id || idx} className="border rounded-lg overflow-hidden">
                    <div className={`px-4 py-2 border-b ${colClass} flex items-center gap-2`}>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-yellow-400' : 'text-gray-700'}`}>
                        #{idx + 1} {label}
                        {sec.id && sec.id !== sec.section_type ? ` (${sec.id})` : ''}
                      </span>
                      {isDark && <span className="text-[8px] px-1.5 py-0.5 bg-black/30 text-white rounded">Dark bg</span>}
                      <span className="ml-auto text-[9px] text-purple-500 font-semibold">DRAFT</span>
                    </div>
                    <div className="p-4 bg-white">
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
                          rows={7}
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
            {hasDraft && (
              <span className="flex items-center gap-1 text-[10px] text-purple-500">
                <CheckCircle2 size={11} /> Draft ready
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
