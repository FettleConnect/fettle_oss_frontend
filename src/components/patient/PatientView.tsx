import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, MessageSquare, ChevronLeft } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PaymentPage } from '@/components/payment/PaymentPage';

interface User {
  role: 'doctor' | 'patient';
  name: string;
  email?: string;
}
interface PatientViewProps {
  user: User;
  onLogout: () => void;
}
interface ChatMessage {
  id: string;
  role: string;
  content: string;
  images?: string[];
}
interface ConsultationHistoryItem {
  id: string;
  name: string;
  mode: string;
  status: string;
  created_at: string;
}

export const PatientView: React.FC<PatientViewProps> = ({ user, onLogout }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ConversationMode>('general_education');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<ConsultationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  const intakeComplete = mode === 'dermatologist_review' || mode === 'final_output';
  const isSendingRef = useRef(false);

  const lastAiMessage = useMemo(() => {
    const aiMsgs = messages.filter(m => m.role === 'ai' || m.role === 'AI');
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1] : null;
  }, [messages]);

  const currentIntakeStep = useMemo(() => {
    if (mode !== 'post_payment_intake') return null;
    const content = lastAiMessage?.content.toLowerCase() || '';
    if (content.includes('relevant medical reports') || content.includes('medical reports')) return 'report_image';
    if (
      content.includes('upload clear images') ||
      content.includes('image of the skin condition') ||
      content.includes('affected area') ||
      content.includes('multiple angles')
    ) return 'skin_image';
    return 'text_questions';
  }, [mode, lastAiMessage]);

  const fetchConsultationHistory = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`${BASE_URL}/api/consultation_list/`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchChatHistory = useCallback(async (threadId?: string) => {
    try {
      setIsLoading(true);
      const authToken = localStorage.getItem('authToken');
      const url = new URL(`${BASE_URL}/api/chat_history/`);
      if (threadId) url.searchParams.append('thread_id', threadId);
      const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch chat history');
      const data = await res.json();
      if (!data.error && data.conv && Array.isArray(data.conv)) {
        setMessages(data.conv);
        if (data.mode) setMode(data.mode as ConversationMode);
      }
      if (data.thread_id) setActiveThreadId(data.thread_id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChatHistory();
    fetchConsultationHistory();
  }, [fetchChatHistory, fetchConsultationHistory]);

  const handleNewConsultation = async () => {
    try {
      setIsLoading(true);
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`${BASE_URL}/api/archive_consultation/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages([]);
        setMode('general_education');
        setActiveThreadId(data.thread_id);
        fetchConsultationHistory();
        fetchChatHistory(data.thread_id);
        toast({ title: 'New Consultation Started', description: 'Your previous chat has been saved to history.' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const sanitizeImages = (imgs?: string[]) =>
    (imgs ?? []).filter(img => typeof img === 'string' && img.trim().length > 10);

  const dataURLtoBlob = async (dataUrl: string): Promise<Blob> => {
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
      return (await fetch(dataUrl)).blob();
    }
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const appendImagesToFormData = async (formData: FormData, imgs: string[]) => {
    for (let i = 0; i < imgs.length; i++) {
      try {
        const blob = await dataURLtoBlob(imgs[i]);
        const ext = blob.type.split('/')[1] ?? 'jpg';
        formData.append('image', blob, `image_${i + 1}.${ext}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const resolveStepForSubmission = (hasImages: boolean): string => {
    if (!hasImages) return '';
    if (mode !== 'post_payment_intake') return 'skin_image';
    if (currentIntakeStep === 'report_image') return 'report_image';
    if (currentIntakeStep === 'skin_image') return 'skin_image';
    return 'skin_image';
  };

  const handleSendMessage = async (content: string, images?: string[]) => {
    if (isSendingRef.current || isLoading) return;
    isSendingRef.current = true;

    if (content === 'DEFER') {
      setMode('general_education');
      isSendingRef.current = false;
      return;
    }

    if (content === 'PAYNOW') {
      setShowPayment(true);
      isSendingRef.current = false;
      return;
    }

    const rawImages = sanitizeImages(images);
    const trimmedContent = content?.trim?.() || '';

    if (!trimmedContent && rawImages.length === 0) {
      isSendingRef.current = false;
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedContent,
      images: rawImages.length ? rawImages : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', trimmedContent);
      formData.append('thread_id', activeThreadId || '');

      if (rawImages.length) {
        const resolvedStep = resolveStepForSubmission(true);
        formData.append('step', resolvedStep);
        await appendImagesToFormData(formData, rawImages);
      }

      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      if (data.mode) setMode(data.mode as ConversationMode);

      if (data.result && data.result.trim()) {
        setMessages(prev => [
          ...prev,
          { id: `ai-${Date.now()}`, role: data.role || 'ai', content: data.result }
        ]);
      }
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);

    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'CONFIRM');
      formData.append('thread_id', activeThreadId || '');

      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mode) setMode(data.mode as ConversationMode);
        if (data.result && data.result.trim()) {
          setMessages(prev => [
            ...prev,
            { id: `ai-${Date.now()}`, role: data.role || 'ai', content: data.result },
          ]);
        }
      }
    } catch (e) {
      console.error('Failed to transition to intake:', e);
    }

    fetchConsultationHistory();
    toast({
      title: 'Payment Successful',
      description: 'Please complete the intake questions to proceed.',
    });
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
  };

  const transformedMessages = messages.map(msg => {
    let role: 'patient' | 'ai' | 'doctor' | 'system' = 'patient';
    if (msg.role === 'AI' || msg.role === 'ai') role = 'ai';
    else if (msg.role === 'doctor') role = 'doctor';
    else if (msg.role === 'system') role = 'system';
    return {
      id: msg.id,
      role,
      content: msg.content,
      images: msg.images,
      conversationId: activeThreadId || '',
      timestamp: new Date(),
      isVisible: true,
    };
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-bold text-base flex items-center gap-2 text-navy">
          <Clock className="h-4 w-4" />
          History
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-navy" onClick={() => setShowHistory(false)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {history.length > 0 ? history.map(item => (
            <button
              key={item.id}
              onClick={() => {
                fetchChatHistory(item.id);
                if (isMobile) setShowHistory(false);
              }}
              className={cn(
                'w-full text-left p-3 rounded-lg text-sm transition-colors flex items-start gap-3 hover:bg-accent group',
                activeThreadId === item.id ? 'bg-accent border border-navy/10' : 'transparent'
              )}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-accent-blue transition-colors" />
              <div className="flex-1 overflow-hidden">
                <p className="font-bold truncate text-navy">{item.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
              </div>
            </button>
          )) : (
            <div className="text-center py-8 text-muted-foreground text-xs italic">
              No previous consultations found.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  if (showPayment) {
    return (
      <section className="bg-gray-50 min-h-[80vh] flex items-center justify-center px-4">
        <PaymentPage
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      </section>
    );
  }

  return (
    <section className="bg-gray-50 py-12 px-4 md:px-6 min-h-[80vh] flex items-center">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-navy tracking-tight">
            Affordable Expert Skin Insights
          </h1>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto leading-relaxed">
            Receive educational skin health insights from a UK Consultant Dermatologist — similar to a private consultation,
            but at a fraction of the typical cost. Starting from just $49.
          </p>
          <div className="flex items-center justify-center gap-2 text-accent-blue font-bold text-sm">
            <a href="#" className="underline underline-offset-4 hover:text-navy transition-colors">view pricing</a>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-navy/5 border border-gray-100 overflow-hidden flex flex-col md:flex-row h-[700px]">
          {!isMobile && showHistory && (
            <div className="w-72 border-r border-border bg-card flex flex-col">
              <SidebarContent />
            </div>
          )}

          {isMobile && (
            <div className="absolute top-4 left-4 z-30">
              <Button variant="outline" size="icon" onClick={() => setShowHistory(true)} className="bg-white/80 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-navy" />
              </Button>
            </div>
          )}

          {isMobile && (
            <Sheet open={showHistory} onOpenChange={setShowHistory}>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          )}

          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                {!showHistory && !isMobile && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-navy" onClick={() => setShowHistory(true)}>
                    <Clock className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-navy"
                  onClick={() => {
                    fetchChatHistory();
                    fetchConsultationHistory();
                    toast({ title: 'Syncing…', description: 'Updating consultation data.' });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold hidden sm:block">
                  Logged in: <span className="text-navy">{user?.email}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="h-8 text-navy font-bold text-xs uppercase tracking-wider"
                >
                  Switch Account
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatContainer
                messages={transformedMessages}
                streamingContent=""
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                mode={mode}
                showDisclaimer={messages.length === 0}
                onQuickReply={handleSendMessage}
                intakeComplete={intakeComplete}
                onNewConsultation={handleNewConsultation}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-block bg-[#fdf5e6] px-6 py-3 rounded-lg border border-[#f5deb3]/50 max-w-2xl">
            <p className="text-xs text-gray-700 italic">
              <span className="font-bold uppercase not-italic mr-2">Service Disclaimer:</span>
              This is an advisory-only dermatology service. No prescriptions are issued. Consult a local doctor for in-person evaluation if required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
