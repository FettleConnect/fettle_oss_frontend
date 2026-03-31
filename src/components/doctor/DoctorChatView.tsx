import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Conversation, Message, IntakeData } from '@/types/dermatology';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { IntakeSummaryCard } from './IntakeSummaryCard';
import { AIReviewAssistant } from './AIReviewAssistant';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Send, User, RefreshCw, ImagePlus, X, Bot,
  Sparkles, Plus, CheckCircle, Maximize2, Minimize2, RotateCcw, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface DoctorChatViewProps {
  conversation: Conversation;
  messages: Message[];
  onUpdate: () => void;
  onRefresh: () => void;
}

// FIX: stable ID per image — deletion is by ID not array index
interface SafeImage {
  dataUrl: string;
  id: string;
}

// ─────────────────────────────────────────────────────────
// Face + PII detection — runs BEFORE image enters state
// ─────────────────────────────────────────────────────────
async function detectFaceOrPII(
  dataUrl: string
): Promise<{ blocked: boolean; reason: string }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: extractMime(dataUrl),
                  data: extractBase64(dataUrl),
                },
              },
              {
                type: 'text',
                text: `You are a strict image safety checker for a medical platform.
Analyse this image and answer ONLY with valid JSON in this exact shape:
{"blocked":true|false,"reason":"short reason or empty string"}

Block (blocked:true) if the image contains ANY of:
- A human face (full or partial — eyes, nose, mouth visible together)
- Personal identifying text: full name, date of birth, national ID, passport, address, phone number, email
- Medical report header with patient name or ID printed on it

If the image is a safe clinical photo (skin lesion, wound, rash without an identifiable face or PII text), respond {"blocked":false,"reason":""}.
Reply with JSON only. No explanation outside the JSON.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn('PII detection API error, allowing image:', response.status);
      return { blocked: false, reason: '' };
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? '{}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as { blocked: boolean; reason: string };
  } catch (err) {
    console.warn('PII detection failed, allowing image:', err);
    return { blocked: false, reason: '' };
  }
}

function extractMime(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,/);
  return (match?.[1] ?? 'image/jpeg') as string;
}

function extractBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

const DEFAULT_ASSESSMENT_TEMPLATE = `Most Consistent With

Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.

Close Differentials

Differential diagnoses may include inflammatory, infectious, or allergic dermatologic conditions depending on presentation.

Morphologic Justification

Assessment is based on provided history and available images. Morphology suggests a localized dermatologic process.

Educational Treatment Framework

General care includes maintaining hygiene, avoiding irritants, and considering topical therapies as clinically appropriate.

Investigations Commonly Considered

Further evaluation may include dermatoscopic examination, lab tests, or biopsy if clinically indicated.

References

Standard dermatology clinical references and guidelines.

You're welcome to ask follow-up questions.`;

const SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Investigations Commonly Considered',
  'References',
];

function normalizeHeading(title: string): string {
  return title.trim().toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanBody(text: string): string {
  return (text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function isPlaceholder(text: string): boolean {
  const value = (text || '').trim().toLowerCase();
  if (!value) return true;

  const placeholders = [
    'type here',
    'enter response',
    'write response',
    'draft response',
    'assessment',
    'pending',
    'tbd',
    'todo',
    'n/a',
    'na',
    '-',
    '--',
  ];

  return placeholders.some((p) => value === p || value.includes(p));
}

function generateFallbackContent(section: string): string {
  switch (section) {
    case 'Most Consistent With':
      return 'Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.';
    case 'Close Differentials':
      return 'Differential diagnoses may include inflammatory, infectious, or allergic dermatologic conditions depending on presentation.';
    case 'Morphologic Justification':
      return 'Assessment is based on provided history and available images. Morphology suggests a localized dermatologic process.';
    case 'Educational Treatment Framework':
      return 'General care includes maintaining hygiene, avoiding irritants, and considering topical therapies as clinically appropriate.';
    case 'Investigations Commonly Considered':
      return 'Further evaluation may include dermatoscopic examination, lab tests, or biopsy if clinically indicated.';
    case 'References':
      return 'Standard dermatology clinical references and guidelines.';
    default:
      return 'Clinical details not available.';
  }
}

function extractStructuredSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const escaped = SECTION_TITLES.map(escapeRegex).join('|');
  const regex = new RegExp(`(?:^|\\n)\\s*(${escaped})\\s*:?\\s*(?=\\n|$)`, 'gi');

  const matches: Array<{ title: string; index: number; fullLength: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({
      title: match[1],
      index: match.index,
      fullLength: match[0].length,
    });
  }

  if (matches.length === 0) return {};

  const sections: Record<string, string> = {};

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.fullLength;
    const end = next ? next.index : cleaned.length;
    sections[normalizeHeading(current.title)] = cleanBody(cleaned.slice(start, end));
  }

  return sections;
}

function extractLegacyNumberedSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const mappings = [
    {
      patterns: ['Diagnosis', 'Most Consistent With'],
      target: 'Most Consistent With',
    },
    {
      patterns: ['Differential Diagnoses', 'Close Differentials', 'Differentials'],
      target: 'Close Differentials',
    },
    {
      patterns: ['Technical Justification', 'Morphologic Justification', 'Justification'],
      target: 'Morphologic Justification',
    },
    {
      patterns: ['Prescription Regimen', 'Educational Treatment Framework', 'Treatment Framework'],
      target: 'Educational Treatment Framework',
    },
    {
      patterns: ['Investigations', 'Investigations Commonly Considered'],
      target: 'Investigations Commonly Considered',
    },
    {
      patterns: ['Educational References', 'References'],
      target: 'References',
    },
  ];

  const sectionHeaders = mappings.flatMap((m) => m.patterns.map(escapeRegex)).join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\d+\\.\\s*)?(?:\\*\\*)?(${sectionHeaders})(?:\\*\\*)?\\s*:?\\s*(?=\\n|$)`,
    'gi'
  );

  const matches: Array<{ title: string; index: number; fullLength: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({
      title: match[1],
      index: match.index,
      fullLength: match[0].length,
    });
  }

  if (matches.length === 0) return {};

  const sections: Record<string, string> = {};

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.fullLength;
    const end = next ? next.index : cleaned.length;
    const body = cleanBody(cleaned.slice(start, end));

    const mapping = mappings.find((m) =>
      m.patterns.some((p) => p.toLowerCase() === current.title.toLowerCase())
    );

    if (mapping && body) {
      sections[normalizeHeading(mapping.target)] = body;
    }
  }

  return sections;
}

function normalizeAIContentToStructuredFormat(rawText: string): string {
  const text = cleanBody(rawText);

  if (!text || text.length < 30) {
    return DEFAULT_ASSESSMENT_TEMPLATE;
  }

  let sections = extractStructuredSections(text);

  if (Object.keys(sections).length === 0) {
    sections = extractLegacyNumberedSections(text);
  }

  const normalized = SECTION_TITLES.map((title) => {
    const key = normalizeHeading(title);
    let body = cleanBody(sections[key] || '');

    if (!body || isPlaceholder(body)) {
      body = generateFallbackContent(title);
    }

    return `${title}\n\n${body}`.trim();
  }).join('\n\n');

  let finalText = cleanBody(normalized);

  if (!finalText) {
    finalText = DEFAULT_ASSESSMENT_TEMPLATE;
  }

  if (!finalText.toLowerCase().includes(`you're welcome to ask follow-up questions.`.toLowerCase())) {
    finalText = `${finalText}\\n\\nYou're welcome to ask follow-up questions.`;
  }

  return finalText;
}

function extractSections(text: string): Record<string, string> {
  const structured = extractStructuredSections(text);
  if (Object.keys(structured).length > 0) return structured;

  const legacy = extractLegacyNumberedSections(text);
  if (Object.keys(legacy).length > 0) return legacy;

  return {};
}

function mergeStructuredContent(existingText: string, aiText: string): string {
  const normalizedExisting = normalizeAIContentToStructuredFormat(existingText);
  const normalizedAI = normalizeAIContentToStructuredFormat(aiText);

  const existingSections = extractSections(normalizedExisting);
  const aiSections = extractSections(normalizedAI);

  const mergedBlocks = SECTION_TITLES.map((title) => {
    const key = normalizeHeading(title);
    const existing = cleanBody(existingSections[key] ?? '');
    const ai = cleanBody(aiSections[key] ?? '');

    let finalBody: string;

    if (ai && !isPlaceholder(ai)) {
      // AI has meaningful content for this section — use it
      finalBody = ai;
    } else if (existing && !isPlaceholder(existing)) {
      // AI did not address this section — keep existing
      finalBody = existing;
    } else {
      // Neither has meaningful content — use fallback
      finalBody = generateFallbackContent(title);
    }

    return `${title}\n\n${cleanBody(finalBody)}`.trim();
  });

  let finalText = mergedBlocks.join('\n\n').trim();

  if (!finalText.toLowerCase().includes(`you're welcome to ask follow-up questions.`.toLowerCase())) {
    finalText = `${finalText}\n\nYou're welcome to ask follow-up questions.`;
  }

  return cleanBody(finalText);
}

// ─────────────────────────────────────────────────────────
// Intake parser
// ─────────────────────────────────────────────────────────
function parseIntakeFromMessages(messages: Message[]): IntakeData | null {
  const intakeMsg = messages.find(
    m =>
      m.content &&
      m.content.includes('INTAKE COMPLETE') &&
      m.content.includes('Summary:')
  );
  if (!intakeMsg) return null;
  const text = intakeMsg.content;
  const extract = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*([^\\n]*)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };
  const allPatientImages: string[] = messages
    .filter(m => m.role === 'patient')
    .flatMap(m => m.images ?? []);
  return {
    duration: extract('Duration'),
    symptoms: extract('Symptoms'),
    location: extract('Location'),
    medicationsTried: extract('Meds'),
    priorDiagnoses: extract('Prior Diagnoses') || extract('Prior') || '',
    relevantHealthHistory: extract('History'),
    images: allPatientImages,
  };
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
export const DoctorChatView: React.FC<DoctorChatViewProps> = ({
  conversation,
  messages,
  onUpdate,
  onRefresh,
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [patientMessage, setPatientMessage] = useState(
    conversation.draftResponse || ''
  );
  const [isSending, setIsSending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);

  // SafeImage[] with stable IDs
  const [images, setImages] = useState<SafeImage[]>([]);
  const [checkingImages, setCheckingImages] = useState(false);

  const [showAI, setShowAI] = useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowAI(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (conversation.draftResponse && !patientMessage) {
      setPatientMessage(conversation.draftResponse);
    }
  }, [conversation.draftResponse, conversation.id]);

  useEffect(() => {
    setCaseCompleted(conversation.mode === 'general_education');
  }, [conversation.id, conversation.mode]);

  const resolvedIntakeData: IntakeData | undefined = useMemo(() => {
    const parsed = parseIntakeFromMessages(messages);
    if (!parsed) return conversation.intakeData;
    return {
      ...(conversation.intakeData ?? parsed),
      images:
        parsed.images.length > 0
          ? parsed.images
          : conversation.intakeData?.images ?? [],
    };
  }, [conversation.intakeData, messages]);

  const visibleMessages = useMemo(() => {
    return messages.filter(
      m =>
        !(
          m.content &&
          m.content.includes('INTAKE COMPLETE') &&
          m.content.includes('Summary:')
        )
    );
  }, [messages]);

  const handleApplyDraft = () => {
    if (conversation.draftResponse) {
      setPatientMessage(conversation.draftResponse);
      toast({
        title: 'Draft Applied',
        description: 'AI-generated draft has been loaded into the editor.',
      });
    }
  };

  const handleRegenerateDraft = async () => {
    setIsRegenerating(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', 'REGENERATE_DRAFT');
      await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      toast({
        title: 'Regenerating Draft',
        description:
          'New draft is being generated. Click Sync in ~10 seconds to load it.',
      });
      setTimeout(() => {
        onRefresh();
      }, 12000);
    } catch (error) {
      console.error('Regenerate draft error:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate draft.',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Image select → read → detect → accept or reject
  // Input value reset FIRST before any await
  // ─────────────────────────────────────────────────────────
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Reset immediately so re-selecting same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';

      setCheckingImages(true);

      const fileArray = Array.from(files);
      const accepted: SafeImage[] = [];
      const rejected: string[] = [];

      await Promise.all(
        fileArray.map(
          file =>
            new Promise<void>(resolve => {
              const reader = new FileReader();
              reader.onload = async ev => {
                const dataUrl = ev.target?.result as string;
                if (!dataUrl) {
                  resolve();
                  return;
                }

                const { blocked, reason } = await detectFaceOrPII(dataUrl);

                if (blocked) {
                  rejected.push(
                    `"${file.name}" — ${reason || 'contains a face or personal information'}`
                  );
                } else {
                  accepted.push({
                    dataUrl,
                    id: `${Date.now()}-${Math.random()}`,
                  });
                }
                resolve();
              };
              reader.readAsDataURL(file);
            })
        )
      );

      setCheckingImages(false);

      if (accepted.length > 0) {
        setImages(prev => [...prev, ...accepted]);
      }

      if (rejected.length > 0) {
        toast({
          title: `${rejected.length} image${rejected.length > 1 ? 's' : ''} not accepted`,
          description: (
            <div className="space-y-1.5 pt-1">
              {rejected.map((r, i) => (
                <p key={i} className="text-xs flex gap-1.5 items-start">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  {r}
                </p>
              ))}
              <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                Please upload clinical photos only — no faces, names, or
                identifying information.
              </p>
            </div>
          ),
          variant: 'destructive',
          duration: 7000,
        });
      }
    },
    [toast]
  );

  // Remove by stable ID — no index-shifting bugs
  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const dataURLtoBlob = async (dataUrl: string): Promise<Blob> => {
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
      const res = await fetch(dataUrl);
      return res.blob();
    }
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const handleSendToPatient = async () => {
    if (!patientMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message.',
        variant: 'destructive',
      });
      return;
    }
    setIsSending(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', patientMessage);

      // Only images currently in safe state are sent
      for (let i = 0; i < images.length; i++) {
        const blob = await dataURLtoBlob(images[i].dataUrl);
        const ext = blob.type.split('/')[1] ?? 'jpg';
        formData.append('image', blob, `image_${i + 1}.${ext}`);
      }

      const response = await fetch(`${BASE_URL}/api/doctor_send_response/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to send message');

      setPatientMessage('');
      setImages([]); // Full clear after send
      setAssessmentExpanded(false);
      onUpdate();
      toast({
        title: 'Response Sent',
        description: 'Your response has been sent to the patient.',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleArchive = async () => {
    if (caseCompleted) return;
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const response = await fetch(`${BASE_URL}/api/archive_consultation/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ user_id: conversation.patient_id }),
      });
      if (response.ok) {
        setCaseCompleted(true);
        toast({
          title: 'Case Completed',
          description: 'Patient can now continue in general education mode.',
        });
        onUpdate();
      }
    } catch (error) {
      console.error('Archive failed:', error);
    }
  };

  // ─────────────────────────────────────────────────────────
  // AI content goes DIRECTLY into the Assessment editor.
  // Called automatically after every generate in AIReviewAssistant.
  // No Regenerate / Sync / Apply button needed.
  // ─────────────────────────────────────────────────────────
  const handleApplyAIContent = useCallback(
    (content: string) => {
      const normalized = normalizeAIContentToStructuredFormat(content);
      const merged = mergeStructuredContent(patientMessage, normalized);

      setPatientMessage(merged);

      toast({
        title: 'Assessment Updated',
        description: 'Structured AI content was applied to the editor.',
      });

      if (isMobile) setShowAI(false);
    },
    [isMobile, patientMessage, toast]
  );

  const canRespond =
    conversation.paymentStatus === 'paid' || !!conversation.draftResponse;
  const isCompleted = conversation.status === 'completed';
  const isCaseDone =
    caseCompleted || conversation.mode === 'general_education';

  const ConsultationSidebar = () => (
    <div className="h-full flex flex-col bg-card">
      <AIReviewAssistant
        onClose={() => setShowAI(false)}
        conversationId={String(conversation.id)}
        contextData={JSON.stringify(conversation.intakeData || {})}
        onApplyContent={handleApplyAIContent}
        editorContent={patientMessage}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* Header */}
      <div className="border-b border-border bg-card px-4 md:px-6 py-3 md:py-4 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <User className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm md:text-lg leading-none mb-1 truncate">
                {conversation.patientName}
              </h3>
              <p className="text-[10px] md:text-sm text-muted-foreground font-mono truncate">
                {conversation.patientEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={isCaseDone}
              className={`h-8 md:h-9 ${
                isCaseDone
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {isCaseDone ? (
                <CheckCircle className="h-3.5 w-3.5 md:mr-2" />
              ) : (
                <Plus className="h-3.5 w-3.5 md:mr-2" />
              )}
              <span className="hidden sm:inline">
                {isCaseDone ? 'Case Completed' : 'Complete Case'}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-8 md:h-9 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5 md:mr-2" />
              <span className="hidden sm:inline">Sync</span>
            </Button>
            <Badge
              variant={
                conversation.paymentStatus === 'paid' ? 'default' : 'secondary'
              }
              className="px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs"
            >
              {conversation.paymentStatus === 'paid'
                ? 'Paid Consultation'
                : 'Unpaid'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 w-full relative">

          <ScrollArea className="flex-1 px-4 md:px-6 py-4 md:py-6">
            <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto">
              {resolvedIntakeData && (
                <section>
                  <IntakeSummaryCard intakeData={resolvedIntakeData} />
                </section>
              )}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-2 md:px-3">
                    Conversation History
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {visibleMessages.length > 0 ? (
                  <div className="space-y-4">
                    {visibleMessages.map(message => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8 italic text-sm">
                    No conversation history available.
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>

          {/* Assessment & Response */}
          {canRespond && !isCompleted && (
            <div
              className={
                assessmentExpanded
                  ? 'fixed inset-0 z-50 bg-background flex flex-col p-4 md:p-8 shadow-2xl'
                  : 'border-t border-border bg-card p-4 md:p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20'
              }
            >
              <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-3 md:space-y-4">

                {/* Toolbar */}
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs md:text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    Assessment & Response
                  </label>
                  <div className="flex gap-1.5 md:gap-2">
                    {conversation.draftResponse &&
                      patientMessage !== conversation.draftResponse && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyDraft}
                          className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs text-primary border-primary/20"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          AI Draft
                        </Button>
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssessmentExpanded(e => !e)}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs"
                    >
                      {assessmentExpanded ? (
                        <>
                          <Minimize2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Collapse</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Expand</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant={showAI ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setShowAI(!showAI)}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {showAI ? 'Hide AI Tools' : 'Refine with AI'}
                    </Button>
                  </div>
                </div>

                {/* Image previews — stable id keys, remove by id */}
                {images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap bg-muted/30 p-2 rounded-lg border border-dashed">
                    {images.map(img => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.dataUrl}
                          alt="Attachment"
                          className="h-14 w-14 md:h-20 md:w-20 object-cover rounded-md border border-border shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-md"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Textarea
                  value={patientMessage}
                  onChange={e => setPatientMessage(e.target.value)}
                  placeholder="Write your professional assessment here..."
                  className={
                    assessmentExpanded
                      ? 'flex-1 text-xs md:text-base leading-relaxed p-3 md:p-4 resize-none shadow-sm'
                      : 'min-h-[100px] md:min-h-[150px] text-xs md:text-base leading-relaxed p-3 md:p-4 resize-y shadow-sm'
                  }
                  style={assessmentExpanded ? { minHeight: 0 } : undefined}
                />

                <div className="flex justify-between items-center gap-2">
                  <div className="flex gap-2 items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={checkingImages}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 md:h-10 text-[10px] md:text-sm px-2 md:px-4"
                    >
                      <ImagePlus className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
                      <span className="hidden sm:inline">
                        {checkingImages ? 'Checking images…' : 'Attach Images'}
                      </span>
                    </Button>
                    <p className="hidden md:block text-[10px] text-muted-foreground">
                      Clinical photos only — no faces or personal information
                    </p>
                  </div>
                  <Button
                    onClick={handleSendToPatient}
                    disabled={isSending || !patientMessage.trim()}
                    size="lg"
                    className="h-8 md:h-12 px-4 md:px-8 text-xs md:text-base shadow-md font-bold"
                  >
                    <Send className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                    Send Response
                  </Button>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Desktop AI sidebar */}
        {!isMobile && showAI && (
          <div className="w-96 border-l border-border bg-card flex flex-col">
            <ConsultationSidebar />
          </div>
        )}

        {/* Mobile AI sheet */}
        {isMobile && (
          <Sheet open={showAI} onOpenChange={setShowAI}>
            <SheetContent side="right" className="p-0 w-[90%] sm:w-96">
              <ConsultationSidebar />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
};
