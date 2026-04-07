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
  Send,
  User,
  RefreshCw,
  ImagePlus,
  X,
  Bot,
  Sparkles,
  Plus,
  CheckCircle,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface DoctorChatViewProps {
  conversation: Conversation;
  messages: Message[];
  onUpdate: () => void;
  onRefresh: () => void;
}

interface SafeImage {
  dataUrl: string;
  id: string;
}

async function detectFaceOrPII(
  dataUrl: string
): Promise<{ blocked: boolean; reason: string }> {
  try {
    const base64 = extractBase64(dataUrl);

    const response = await fetch('/api/openai-vision-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        prompt:
          'Reply with only YES if this image contains a human face or any personal identifying information such as a name, ID number, address, or date of birth. Reply with only NO otherwise.',
      }),
    });

    if (!response.ok) {
      console.warn('PII detection API error, allowing image:', response.status);
      return { blocked: false, reason: '' };
    }

    const data = await response.json();
    const answer: string = data.result?.trim().toUpperCase() ?? 'NO';

    if (answer === 'YES') {
      return {
        blocked: true,
        reason: 'contains a face or personal identifying information',
      };
    }

    return { blocked: false, reason: '' };
  } catch (err) {
    console.warn('PII detection failed, allowing image:', err);
    return { blocked: false, reason: '' };
  }
}

function extractBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

const DEFAULT_ASSESSMENT_TEMPLATE = `**Most Consistent With**

Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.

**Close Differentials**

Related dermatologic conditions may present with overlapping clinical features and require further evaluation.

**Morphologic Justification**

Assessment is based on provided history and available images. Morphology suggests a localised dermatologic process requiring clinical correlation.

**Educational Treatment Framework**

General supportive care, avoidance of irritants, and clinically appropriate dermatologic management may be considered after physician review.

**Typical Course and Prognosis**

Course depends on the underlying condition and may vary. General improvement is expected with appropriate management over several weeks.

**When In-Person Evaluation Is Considered**

In-person evaluation is recommended if symptoms worsen, features are atypical, diagnosis is uncertain, or the condition does not respond as expected.

**Educational References**

DermNet NZ
British Association of Dermatologists
Medscape

You're welcome to ask follow-up questions.`;

const SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Typical Course and Prognosis',
  'When In-Person Evaluation Is Considered',
  'Educational References',
];

function normalizeHeading(title: string): string {
  return title.trim().toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanBody(text: string): string {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/^\s*\((?:if any|if relevant|ranked)\)\s*:?\s*$/gim, '')
    .replace(/\s*\((?:if any|if relevant|ranked)\)\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
      return 'Related dermatologic conditions may present with overlapping clinical features and require further evaluation.';
    case 'Morphologic Justification':
      return 'Assessment is based on provided history and available images. Morphology suggests a localised dermatologic process requiring clinical correlation.';
    case 'Educational Treatment Framework':
      return 'General supportive care, avoidance of irritants, and clinically appropriate dermatologic management may be considered after physician review.';
    case 'Typical Course and Prognosis':
      return 'Course depends on the underlying condition and may vary. General improvement is expected with appropriate management over several weeks.';
    case 'When In-Person Evaluation Is Considered':
      return 'In-person evaluation is recommended if symptoms worsen, features are atypical, diagnosis is uncertain, or the condition does not respond as expected.';
    case 'Educational References':
      return 'DermNet NZ\nBritish Association of Dermatologists\nMedscape';
    default:
      return 'Clinical details not available.';
  }
}

function extractStructuredSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const escaped = SECTION_TITLES.map(escapeRegex).join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*)?(${escaped})(?:\\*\\*)?\\s*:?\\s*(?=\\n|$)`,
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
    sections[normalizeHeading(current.title)] = cleanBody(cleaned.slice(start, end));
  }

  return sections;
}

function extractLegacyNumberedSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const mappings = [
    {
      patterns: ['Diagnosis', 'Most Consistent With', 'Primary Likely Diagnosis'],
      target: 'Most Consistent With',
    },
    {
      patterns: [
        'Differential Diagnoses',
        'Close Differentials',
        'Differentials',
        'Differential Diagnoses Ranked',
        'Differential Diagnoses (Ranked)',
      ],
      target: 'Close Differentials',
    },
    {
      patterns: [
        'Technical Justification',
        'Morphologic Justification',
        'Justification',
        'Key Morphologic / Clinical Features',
        'Key Morphologic Features',
      ],
      target: 'Morphologic Justification',
    },
    {
      patterns: [
        'Prescription Regimen',
        'Educational Treatment Framework',
        'Treatment Framework',
      ],
      target: 'Educational Treatment Framework',
    },
    {
      patterns: [
        'Typical Course and Prognosis',
        'Prognosis',
        'Course and Prognosis',
        'Suggested Investigations',
        'Suggested Investigations Relevant',
        'Investigations Commonly Considered',
        'Investigations',
      ],
      target: 'Typical Course and Prognosis',
    },
    {
      patterns: [
        'When In-Person Evaluation Is Considered',
        'In-Person Evaluation',
        'Red Flags',
        'Red Flags Any',
        'Diagnostic Confidence',
      ],
      target: 'When In-Person Evaluation Is Considered',
    },
    {
      patterns: ['Educational References', 'References'],
      target: 'Educational References',
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

  if (Object.keys(sections).length === 0) {
    sections = {
      [normalizeHeading('Most Consistent With')]: text,
    };
  }

  const normalized = SECTION_TITLES.map((title) => {
    const key = normalizeHeading(title);
    let body = cleanBody(sections[key] || '');

    if (!body || isPlaceholder(body)) {
      body = generateFallbackContent(title);
    }

    return `**${title}**\n\n${body}`.trim();
  }).join('\n\n');

  let finalText = cleanBody(normalized);

  if (!finalText) {
    finalText = DEFAULT_ASSESSMENT_TEMPLATE;
  }

  if (
    !finalText
      .toLowerCase()
      .includes(`you're welcome to ask follow-up questions.`.toLowerCase())
  ) {
    finalText = `${finalText}\n\nYou're welcome to ask follow-up questions.`;
  }

  return finalText;
}

function parseIntakeFromMessages(messages: Message[]): IntakeData | null {
  const intakeMsg = messages.find(
    (m) =>
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
    .filter((m) => m.role === 'patient')
    .flatMap((m) => m.images ?? []);

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
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [images, setImages] = useState<SafeImage[]>([]);
  const [checkingImages, setCheckingImages] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState(false);
  const [aiPrefillMessage, setAiPrefillMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowAI(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (conversation.draftResponse && !patientMessage) {
      setPatientMessage(normalizeAIContentToStructuredFormat(conversation.draftResponse));
    }
  }, [conversation.draftResponse, conversation.id, patientMessage]);

  useEffect(() => {
    setCaseCompleted(conversation.mode === 'general_education');
  }, [conversation.id, conversation.mode]);

  const resolvedIntakeData: IntakeData | undefined = useMemo(() => {
    const parsed = parseIntakeFromMessages(messages);
    const raw = conversation.intakeData as any;

    const merged: IntakeData = {
      duration: raw?.duration || parsed?.duration || '',
      symptoms: raw?.symptoms || parsed?.symptoms || '',
      location: raw?.location || parsed?.location || '',
      medicationsTried:
        raw?.medications_tried ||
        raw?.medicationsTried ||
        parsed?.medicationsTried ||
        '',
      priorDiagnoses:
        raw?.prior_diagnoses || raw?.priorDiagnoses || parsed?.priorDiagnoses || '',
      relevantHealthHistory:
        raw?.relevant_health_history ||
        raw?.relevantHealthHistory ||
        parsed?.relevantHealthHistory ||
        '',
      images: Array.isArray(raw?.images) ? raw.images : [],
    };

    const hasData = Object.values(merged).some((v) =>
      typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) ? v.length > 0 : false
    );

    return hasData ? merged : undefined;
  }, [conversation.intakeData, messages]);

  const visibleMessages = useMemo(() => {
    return messages.filter(
      (m) =>
        !(
          m.content &&
          m.content.includes('INTAKE COMPLETE') &&
          m.content.includes('Summary:')
        )
    );
  }, [messages]);

  const handleApplyDraft = () => {
    if (conversation.draftResponse) {
      setPatientMessage(normalizeAIContentToStructuredFormat(conversation.draftResponse));
      toast({
        title: 'Draft Applied',
        description: 'AI-generated draft has been loaded into the editor.',
      });
    }
  };

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (fileInputRef.current) fileInputRef.current.value = '';

      setCheckingImages(true);

      const fileArray = Array.from(files);
      const accepted: SafeImage[] = [];
      const rejected: string[] = [];
      const seen = new Set<string>();

      await Promise.all(
        fileArray.map(
          (file) =>
            new Promise<void>((resolve) => {
              const reader = new FileReader();
              reader.onload = async (ev) => {
                const dataUrl = ev.target?.result as string;
                if (!dataUrl) {
                  resolve();
                  return;
                }

                if (seen.has(dataUrl)) {
                  resolve();
                  return;
                }
                seen.add(dataUrl);

                const { blocked, reason } = await detectFaceOrPII(dataUrl);

                if (blocked) {
                  rejected.push(
                    `"${file.name}" — ${reason || 'contains a face or personal information'}`
                  );
                } else {
                  accepted.push({
                    dataUrl,
                    id: `${Date.now()}-${Math.random()}-${file.name}`,
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
        setImages((prev) => {
          const existing = new Set(prev.map((img) => img.dataUrl));
          const dedupedAccepted = accepted.filter((img) => !existing.has(img.dataUrl));
          return [...prev, ...dedupedAccepted];
        });
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
                Please upload clinical photos only — no faces, names, or identifying
                information.
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

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
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

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

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

      const uniqueImages = Array.from(
        new Map(images.map((img) => [img.dataUrl, img])).values()
      );

      for (let i = 0; i < uniqueImages.length; i++) {
        const blob = await dataURLtoBlob(uniqueImages[i].dataUrl);
        const ext = blob.type.split('/')[1] ?? 'jpg';
        formData.append('image', blob, `image_${i + 1}.${ext}`);
      }

      const response = await fetch(`${BASE_URL}/api/doctor_send_response/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setPatientMessage('');
      setImages([]);
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

  const handleApplyAIContent = useCallback(
    (content: string) => {
      const normalized = normalizeAIContentToStructuredFormat(content);
      setPatientMessage(normalized);

      toast({
        title: 'Assessment Updated',
        description: 'AI response applied to the Assessment editor.',
      });

      if (isMobile) {
        setShowAI(false);
      }
    },
    [isMobile, toast]
  );

  const canRespond =
    conversation.paymentStatus === 'paid' || !!conversation.draftResponse;
  const isCompleted = conversation.status === 'completed';
  const isCaseDone = caseCompleted || conversation.mode === 'general_education';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
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
              variant={conversation.paymentStatus === 'paid' ? 'default' : 'secondary'}
              className="px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs"
            >
              {conversation.paymentStatus === 'paid'
                ? 'Paid Consultation'
                : 'Unpaid'}
            </Badge>
          </div>
        </div>
      </div>

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
                    {visibleMessages.map((message) => (
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

          {canRespond && !isCompleted && (
            <div
              className={
                assessmentExpanded
                  ? 'fixed inset-0 z-50 bg-background flex flex-col p-4 md:p-8 shadow-2xl'
                  : 'border-t border-border bg-card p-4 md:p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20'
              }
            >
              <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-3 md:space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs md:text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    Assessment & Response
                  </label>

                  <div className="flex gap-1.5 md:gap-2">
                    {conversation.draftResponse &&
                      patientMessage !==
                        normalizeAIContentToStructuredFormat(conversation.draftResponse) && (
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
                      onClick={() => setAssessmentExpanded((e) => !e)}
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
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (patientMessage.trim()) {
                          setAiPrefillMessage(patientMessage.trim());
                        }
                        setShowAI(true);
                      }}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Ask AI</span>
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

                {images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap bg-muted/30 p-2 rounded-lg border border-dashed">
                    {images.map((img) => (
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
                  onChange={(e) => setPatientMessage(e.target.value)}
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

        {!isMobile && showAI && (
          <div className="w-96 border-l border-border bg-card flex flex-col">
            <AIReviewAssistant
              onClose={() => setShowAI(false)}
              conversationId={String(conversation.id)}
              contextData={JSON.stringify(
                resolvedIntakeData || conversation.intakeData || {}
              )}
              onApplyContent={handleApplyAIContent}
              editorContent={patientMessage}
              prefillMessage={aiPrefillMessage}
              onPrefillConsumed={() => setAiPrefillMessage('')}
            />
          </div>
        )}

        {isMobile && (
          <Sheet open={showAI} onOpenChange={setShowAI}>
            <SheetContent side="right" className="p-0 w-[90%] sm:w-96">
              <AIReviewAssistant
                onClose={() => setShowAI(false)}
                conversationId={String(conversation.id)}
                contextData={JSON.stringify(
                  resolvedIntakeData || conversation.intakeData || {}
                )}
                onApplyContent={handleApplyAIContent}
                editorContent={patientMessage}
                prefillMessage={aiPrefillMessage}
                onPrefillConsumed={() => setAiPrefillMessage('')}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
};
