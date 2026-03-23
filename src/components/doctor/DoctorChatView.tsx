import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Conversation, Message, IntakeData } from '@/types/dermatology';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { IntakeSummaryCard } from './IntakeSummaryCard';
import { AIReviewAssistant } from './AIReviewAssistant';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, User, RefreshCw, ImagePlus, X, Bot, Sparkles, Plus, CheckCircle, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
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

function parseIntakeFromMessages(messages: Message[]): IntakeData | null {
  const intakeMsg = messages.find(
    m => m.content && m.content.includes('INTAKE COMPLETE') && m.content.includes('Summary:')
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

export const DoctorChatView: React.FC<DoctorChatViewProps> = ({
  conversation,
  messages,
  onUpdate,
  onRefresh,
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [patientMessage, setPatientMessage] = useState(conversation.draftResponse || '');
  const [isSending, setIsSending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setShowAI(!isMobile); }, [isMobile]);

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
      images: parsed.images.length > 0
        ? parsed.images
        : (conversation.intakeData?.images ?? []),
    };
  }, [conversation.intakeData, messages]);

  const visibleMessages = useMemo(() => {
    return messages.filter(
      m => !(m.content && m.content.includes('INTAKE COMPLETE') && m.content.includes('Summary:'))
    );
  }, [messages]);

  const handleApplyDraft = () => {
    if (conversation.draftResponse) {
      setPatientMessage(conversation.draftResponse);
      toast({ title: 'Draft Applied', description: 'AI-generated draft has been loaded into the editor.' });
    }
  };

  // ── Regenerate draft in updated format ──
  const handleRegenerateDraft = async () => {
    setIsRegenerating(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', 'REGENERATE_DRAFT');
      await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
      toast({
        title: 'Regenerating Draft',
        description: 'New draft is being generated. Click Sync in ~10 seconds to load it.',
      });
      // Auto-refresh after 12 seconds to give backend time to regenerate
      setTimeout(() => {
        onRefresh();
      }, 12000);
    } catch (error) {
      console.error('Regenerate draft error:', error);
      toast({ title: 'Error', description: 'Failed to regenerate draft.', variant: 'destructive' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setImages(prev => [...prev, event.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

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
      toast({ title: 'Error', description: 'Please enter a message to send to the patient.', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', String(conversation.id));
      formData.append('question', patientMessage);
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const blob = await dataURLtoBlob(images[i]);
          const ext = blob.type.split('/')[1] ?? 'jpg';
          formData.append('image', blob, `image_${i + 1}.${ext}`);
        }
      }
      const response = await fetch(`${BASE_URL}/api/doctor_send_response/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to send message');
      setPatientMessage('');
      setImages([]);
      setAssessmentExpanded(false);
      onUpdate();
      toast({ title: 'Response Sent', description: 'Your response has been sent to the patient.' });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'destructive' });
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ user_id: conversation.patient_id }),
      });
      if (response.ok) {
        setCaseCompleted(true);
        toast({ title: 'Case Completed', description: 'Patient can now continue in general education mode.' });
        onUpdate();
      }
    } catch (error) {
      console.error('Archive failed:', error);
    }
  };

  const canRespond = conversation.paymentStatus === 'paid' || !!conversation.draftResponse;
  const isCompleted = conversation.status === 'completed';
  const isCaseDone = caseCompleted || conversation.mode === 'general_education';

  const ConsultationSidebar = () => (
    <div className="h-full flex flex-col bg-card">
      <AIReviewAssistant
        onClose={() => setShowAI(false)}
        conversationId={String(conversation.id)}
        contextData={JSON.stringify(conversation.intakeData || {})}
        onApplyContent={(content) => {
          setPatientMessage(content);
          toast({ title: 'Applied to Editor', description: 'Assessment replaced with AI suggestion.' });
          if (isMobile) setShowAI(false);
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
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
            <Button
              variant="outline" size="sm"
              onClick={handleArchive}
              disabled={isCaseDone}
              className={`h-8 md:h-9 ${isCaseDone ? 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
            >
              {isCaseDone ? (
                <CheckCircle className="h-3.5 w-3.5 md:mr-2" />
              ) : (
                <Plus className="h-3.5 w-3.5 md:mr-2" />
              )}
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
            <div className={
              assessmentExpanded
                ? "fixed inset-0 z-50 bg-background flex flex-col p-4 md:p-8 shadow-2xl"
                : "border-t border-border bg-card p-4 md:p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20"
            }>
              <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-3 md:space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs md:text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    Assessment & Response
                  </label>
                  <div className="flex gap-1.5 md:gap-2">
                    {/* Regenerate Draft button */}
                    <Button
                      variant="outline" size="sm"
                      onClick={handleRegenerateDraft}
                      disabled={isRegenerating}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                      title="Regenerate AI draft in updated format"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{isRegenerating ? 'Generating...' : 'Regenerate Draft'}</span>
                    </Button>
                    {conversation.draftResponse && patientMessage !== conversation.draftResponse && (
                      <Button variant="outline" size="sm" onClick={handleApplyDraft} className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs text-primary border-primary/20">
                        <Bot className="h-3.5 w-3.5" />
                        AI Draft
                      </Button>
                    )}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setAssessmentExpanded(e => !e)}
                      className="h-7 md:h-8 px-2 md:px-3 gap-1 md:gap-2 text-[10px] md:text-xs"
                      title={assessmentExpanded ? 'Collapse editor' : 'Expand editor'}
                    >
                      {assessmentExpanded
                        ? <><Minimize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Collapse</span></>
                        : <><Maximize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Expand</span></>
                      }
                    </Button>
                    <Button
                      variant={showAI ? "default" : "secondary"} size="sm"
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
                    {images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img src={img} alt={`Upload ${index + 1}`} className="h-14 w-14 md:h-20 md:w-20 object-cover rounded-md border border-border shadow-sm" />
                        <button type="button" onClick={() => removeImage(index)} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-md">
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
                      ? "flex-1 text-xs md:text-base leading-relaxed p-3 md:p-4 resize-none shadow-sm"
                      : "min-h-[100px] md:min-h-[150px] text-xs md:text-base leading-relaxed p-3 md:p-4 resize-y shadow-sm"
                  }
                  style={assessmentExpanded ? { minHeight: 0 } : undefined}
                />

                <div className="flex justify-between items-center gap-2">
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 md:h-10 text-[10px] md:text-sm px-2 md:px-4">
                      <ImagePlus className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
                      <span className="hidden sm:inline">Attach Images</span>
                    </Button>
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
            <ConsultationSidebar />
          </div>
        )}
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
