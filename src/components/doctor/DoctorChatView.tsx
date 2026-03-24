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

async function detectFaceOrPII(dataUrl: string): Promise<{ blocked: boolean; reason: string }> {
  try {
    const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,/);
    const mime = match?.[1] ?? 'image/jpeg';
    const b64 = dataUrl.split(',')[1] ?? '';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            { type: 'text', text: `You are a strict image safety checker for a medical platform.\nRespond ONLY with valid JSON: {"blocked":true|false,"reason":"short reason or empty string"}\nBlock if: human face visible, full name, DOB, national ID, phone, email, or medical report with patient name/ID.\nSafe clinical skin photo = {"blocked":false,"reason":""}.\nJSON only.` }
          ]
        }]
      }),
    });
    if (!response.ok) return { blocked: false, reason: '' };
    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { blocked: false, reason: '' };
  }
}

function parseIntakeFromMessages(messages: Message[]): IntakeData | null {
  const intakeMsg = messages.find(m => m.content?.includes('INTAKE COMPLETE') && m.content?.includes('Summary:'));
  if (!intakeMsg) return null;
  const text = intakeMsg.content;
  const extract = (label: string) => {
    const m = text.match(new RegExp(`${label}:\\s*([^\\n]*)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const allPatientImages = messages.filter(m => m.role === 'patient').flatMap(m => m.images ?? []);
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

const SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Investigations Commonly Considered',
  'Educational References',
];

function normalizeHeading(title: string) {
  return title.trim().toLowerCase();
}

function extractSections(text: string): Record<string, string> {
  const cleaned = (text || '').replace(/\r/g, '').trim();
  if (!cleaned) return {};
  const sections: Record<string, string> = {};
  const escaped = SECTION_TITLES.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.\\s*)?(${escaped})\\s*:?\\s*(?=\\n|$)`, 'gi');
  const matches: Array<{ title: string; index: number; fullLength: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({ title: match[1], index: match.index, fullLength: match[0].length });
  }
  if (matches.length === 0) return { __full__: cleaned };
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i], nxt = matches[i + 1];
    const start = cur.index + cur.fullLength;
    const end = nxt ? nxt.index : cleaned.length;
    sections[normalizeHeading(cur.title)] = cleaned.slice(start, end).trim();
  }
  return sections;
}

function isPlaceholder(text: string) {
  const v = (text || '').trim().toLowerCase();
  if (!v) return true;
  return ['type here', 'enter response', 'write response', 'draft response', 'assessment', 'pending', 'tbd', 'todo', 'n/a', 'na', '-', '--'].some(p => v === p || v.includes(p));
}

function mergeStructuredContent(existingText: string, aiText: string): string {
  if (!aiText.trim()) return existingText;
  if (!existingText.trim()) return aiText.trim();
  const existingSections = extractSections(existingText);
  const aiSections = extractSections(aiText);
  if (existingSections.__full__ || aiSections.__full__) return existingText.trim();
  const mergedBlocks = SECTION_TITLES.map(title => {
    const key = normalizeHeading(title);
    const existing = existingSections[key] ?? '';
    const ai = aiSections[key] ?? '';
    const finalBody = (!existing.trim() || isPlaceholder(existing)) ? (ai || existing) : existing;
    return finalBody.trim() ? `${title}\n${finalBody.trim()}` : '';
  }).filter(Boolean);
  return mergedBlocks.length === 0 ? existingText.trim() : mergedBlocks.join('\n\n').trim();
}

export const DoctorChatView: React.FC<DoctorChatViewProps> = ({
  conversation, messages, onUpdate, onRefresh,
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // ── Start empty — doctor types their own response.
  // Draft is available via "Apply to Editor" button only, never auto-applied.
  const [patientMessage, setPatientMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [images, setImages] = useState<SafeImage[]>([]);
  const [checkingImages, setCheckingImages] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setShowAI(!isMobile); }, [isMobile]);

  // Reset editor when conversation changes — always start clean
  useEffect(() => {
    setPatientMessage('');
    setImages([]);
  }, [conversation.id]);

  useEffect(() => {
    setCaseCompleted(conversation.mode === 'general_education');
  }, [conversation.id, conversation.mode]);

  const resolvedIntakeData: IntakeData | undefined = useMemo(() => {
    const parsed = parseIntakeFromMessages(messages);
    if (!parsed) return conversation.intakeData;
    return {
      ...(conversation.intakeData ?? parsed),
      images: parsed.images.length > 0 ? parsed.images : (conversation.intakeData?.images ?? []),
    };
  }, [conversation.intakeData, messages]);

  const visibleMessages = useMemo(() =>
    messages.filter(m => !(m.content?.includes('INTAKE COMPLETE') && m.content?.includes('Summary:'))),
    [messages]
  );

  // "Apply to Editor" — merges AI draft into editor without overwriting doctor's content
  const handleApplyDraft = () => {
    if (!conversation.draftResponse) return;
    const merged = mergeStructuredContent(patientMessage, conversation.draftResponse);
    setPatientMessage(merged);
    toast({
      title: 'Draft Applied',
      description: patientMessage.trim()
        ? 'AI draft merged into empty sections. Your existing content was preserved.'
        : 'AI draft loaded into the editor.',
    });
  };

  const handleRegenerateDraft = async () => {
    setIsRegenerating(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', 'REGENERATE_DRAFT');
      const res = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Failed');
      toast({
        title: 'Draft Regenerated',
        description: 'New draft ready. Click "Apply to Editor" to load it.',
      });
      // Refresh so conversation.draftResponse is updated
      onRefresh();
    } catch {
      toast({ title: 'Error', description: 'Failed to regenerate draft.', variant: 'destructive' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setCheckingImages(true);
    const accepted: SafeImage[] = [];
    const rejected: string[] = [];
    await Promise.all(Array.from(files).map(file => new Promise<void>(resolve => {
      const reader = new FileReader();
      reader.onload = async ev => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) { resolve(); return; }
        const { blocked, reason } = await detectFaceOrPII(dataUrl);
        if (blocked) rejected.push(`"${file.name}" — ${reason || 'contains a face or personal information'}`);
        else accepted.push({ dataUrl, id: `${Date.now()}-${Math.random()}` });
        resolve();
      };
      reader.readAsDataURL(file);
    })));
    setCheckingImages(false);
    if (accepted.length > 0) setImages(prev => [...prev, ...accepted]);
    if (rejected.length > 0) {
      toast({
        title: `${rejected.length} image${rejected.length > 1 ? 's' : ''} not accepted`,
        description: (
          <div className="space-y-1.5 pt-1">
            {rejected.map((r, i) => (
              <p key={i} className="text-xs flex gap-1.5 items-start">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />{r}
              </p>
            ))}
            <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
              Please upload clinical photos only — no faces, names, or identifying information.
            </p>
          </div>
        ),
        variant: 'destructive', duration: 7000,
      });
    }
  }, [toast]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const dataURLtoBlob = async (dataUrl: string): Promise<Blob> => {
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) return (await fetch(dataUrl)).blob();
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const handleSendToPatient = async () => {
    if (!patientMessage.trim()) {
      toast({ title: 'Error', description: 'Please enter a message.', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', patientMessage);
      for (let i = 0; i < images.length; i++) {
        const blob = await dataURLtoBlob(images[i].dataUrl);
        formData.append('image', blob, `image_${i + 1}.${blob.type.split('/')[1] ?? 'jpg'}`);
      }
      const res = await fetch(`${BASE_URL}/api/doctor_send_response/`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
      });
      if (!res.ok) throw new Error('Failed to send message');
      setPatientMessage(''); setImages([]); setAssessmentExpanded(false);
      onUpdate();
      toast({ title: 'Response Sent', description: 'Your response has been sent to the patient.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleArchive = async () => {
    if (caseCompleted) return;
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const res = await fetch(`${BASE_URL}/api/archive_consultation/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ user_id: conversation.patient_id }),
      });
      if (res.ok) {
        setCaseCompleted(true);
        toast({ title: 'Case Completed', description: 'Patient can now continue in general education mode.' });
        onUpdate();
      }
    } catch (e) { console.error(e); }
  };

  const handleApplyAIContent = useCallback((content: string) => {
    const cleaned = content.replace(/\n{3,}/g, '\n\n').trim();
    const merged = mergeStructuredContent(patientMessage, cleaned);
    setPatientMessage(merged);
    toast({
      title: 'Assessment Updated',
      description: patientMessage.trim()
        ? 'AI content merged into empty sections. Your existing content preserved.'
        : 'AI content loaded into the editor.',
    });
    if (isMobile) setShowAI(false);
  }, [isMobile, patientMessage, toast]);

  const canRespond = conversation.paymentStatus === 'paid' || !!conversation.draftResponse;
  const isCompleted = conversation.status === 'completed';
  const isCaseDone = caseCompleted || conversation.mode === 'general_education';

  const hasDraft = !!conversation.draftResponse?.trim();

  const ConsultationSidebar = () => (
    <div className="h-full flex flex-col bg-card">
      <AIReviewAssistant
        onClose={() => setShowAI(false)}
        conversationId={String(conversation.id)}
        contextData={JSON.stringify(conversation.intakeData || {})}
        onApplyContent={handleApplyAIContent}
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
              <h3 className="font-bold text-sm md:text-lg leading-none mb-1 truncate">{conversation.patientName}</h3>
              <p className="text-[10px] md:text-sm text-muted-foreground font-mono truncate">{conversation.patientEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={isCaseDone}
              className={`h-8 md:h-9 ${isCaseDone ? 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
              {isCaseDone ? <CheckCircle className="h-3.5 w-3.5 md:mr-2" /> : <Plus className="h-3.5 w-3.5 md:mr-2" />}
              <span className="hidden sm:inline">{isCaseDone ? 'Case Completed' : 'Complete Case'}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8 md:h-9 text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3.5 w-3.5 md:mr-2" />
              <span className="hidden sm:inline">Sync</span>
            </Button>
            <Badge variant={conversation.paymentStatus === 'paid' ? 'default' : 'secondary'} className="px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs">
              {conversation.paymentStatus === 'paid' ? 'Paid Consultation' : 'Unpaid'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 w-full relative">
          <ScrollArea className="flex-1 px-4 md:px-6 py-4 md:py-6">
            <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto">
              {resolvedIntakeData && <section><IntakeSummaryCard intakeData={resolvedIntakeData} /></section>}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-2 md:px-3">Conversation History</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {visibleMessages.length > 0 ? (
                  <div className="space-y-4">
                    {visibleMessages.map(message => <ChatMessage key={message.id} message={message} />)}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8 italic text-sm">No conversation history available.</div>
                )}
              </section>
            </div>
          </ScrollArea>

          {canRespond && !isCompleted && (
            <div className={assessmentExpanded
              ? 'fixed inset-0 z-50 bg-background flex flex-col p-4 md:p-8 shadow-2xl'
              : 'border-t border-border bg-card p-4 md:p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20'
            }>
              <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-3 md:space-y-4">

                {/* Toolbar */}
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs md:text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    Assessment &amp; Response
                  </label>
                  <div className="flex gap-1.5 md:gap-2 flex-wrap justify-end">
                    {/* Regenerate Draft */}
                    <Button variant="outline" size="sm" onClick={handleRegenerateDraft} disabled={isRegenerating}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                      <RotateCcw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{isRegenerating ? 'Generating…' : 'Regenerate Draft'}</span>
                    </Button>

                    {/* Apply to Editor — only shown when draft exists */}
                    {hasDraft && (
                      <Button variant="outline" size="sm" onClick={handleApplyDraft}
                        className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs text-primary border-primary/30 hover:bg-primary/5">
                        <Bot className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Apply to Editor</span>
                        <span className="sm:hidden">Apply</span>
                      </Button>
                    )}

                    {/* Expand / Collapse */}
                    <Button variant="outline" size="sm" onClick={() => setAssessmentExpanded(e => !e)}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs">
                      {assessmentExpanded
                        ? <><Minimize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Collapse</span></>
                        : <><Maximize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Expand</span></>}
                    </Button>

                    {/* AI Tools toggle */}
                    <Button variant={showAI ? 'default' : 'secondary'} size="sm" onClick={() => setShowAI(!showAI)}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                      {showAI ? 'Hide AI Tools' : 'AI Tools'}
                    </Button>
                  </div>
                </div>

                {/* Draft available hint */}
                {hasDraft && !patientMessage.trim() && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-md text-xs text-primary">
                    <Bot className="h-3.5 w-3.5 shrink-0" />
                    An AI draft is ready. Click <strong className="mx-1">Apply to Editor</strong> to load it, or type your own response below.
                  </div>
                )}

                {/* Attached images */}
                {images.length > 0 && (
                  <div className="flex gap-2 flex-wrap bg-muted/30 p-2 rounded-lg border border-dashed">
                    {images.map(img => (
                      <div key={img.id} className="relative">
                        <img src={img.dataUrl} alt="attachment" className="h-16 w-16 rounded-md object-cover border" />
                        <button type="button" onClick={() => removeImage(img.id)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assessment textarea */}
                <Textarea
                  value={patientMessage}
                  onChange={e => setPatientMessage(e.target.value)}
                  placeholder={`Write your professional assessment here using the structured format:\n\nMost Consistent With\n[your diagnosis]\n\nClose Differentials\n[alternatives]\n\nMorphologic Justification\n[visual evidence]\n\nEducational Treatment Framework\n[treatment approach]\n\nInvestigations Commonly Considered\n[investigations]\n\nEducational References\n[references]`}
                  className="min-h-[220px] md:min-h-[280px] resize-none font-mono text-sm leading-relaxed"
                />

                {/* Bottom bar */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={checkingImages || isSending}>
                      <ImagePlus className="h-4 w-4 mr-2" />
                      {checkingImages ? 'Checking…' : 'Attach Images'}
                    </Button>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Clinical photos only — no faces or personal information</p>
                  </div>
                  <Button type="button" onClick={handleSendToPatient} disabled={isSending || !patientMessage.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending…' : 'Send Response'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isMobile && showAI && (
          <div className="w-[380px] border-l border-border bg-card shrink-0"><ConsultationSidebar /></div>
        )}
        {isMobile && (
          <Sheet open={showAI} onOpenChange={setShowAI}>
            <SheetContent side="right" className="w-[92vw] sm:w-[420px] p-0"><ConsultationSidebar /></SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
};
