import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, Plus, ChevronLeft, MessageSquare, Clock } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';

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
  const [privacyFlagged, setPrivacyFlagged] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  const intakeComplete = mode === 'dermatologist_review' || mode === 'final_output';
  const isSendingRef = useRef(false);

  const lastAiMessage = useMemo(() => {
    const aiMsgs = messages.filter(m => m.role === 'ai' || m.role === 'AI');
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1] : null;
  }, [messages]);

  const currentIntakeStep = useMemo(() => {
    if (mode !== 'post_payment_intake') return null;
    const content = lastAiMessage?.content.toLowerCase() || '';
    if (content.includes('upload clear images') || content.includes('image of the skin condition')) return 'skin_image';
    if (content.includes('relevant medical reports')) return 'report_image';
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
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
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
        setPrivacyFlagged(false);
        setConsentAcknowledged(false);
        fetchConsultationHistory();
        fetchChatHistory(data.thread_id);
        toast({ title: 'New Consultation Started', description: 'Your previous chat has been saved to history.' });
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
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
      } catch (e) { console.error(e); }
    }
  };

  const handleSendMessage = async (content: string, images?: string[]) => {
    if (isSendingRef.current || isLoading) return;
    isSendingRef.current = true;

    const rawImages = sanitizeImages(images);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      images: rawImages.length ? rawImages : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', content);
      formData.append('thread_id', activeThreadId || '');
      
      if (rawImages.length && currentIntakeStep) {
        formData.append('step', currentIntakeStep);
        await appendImagesToFormData(formData, rawImages);
      }

      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      if (data.mode) setMode(data.mode as ConversationMode);

      if (data.result) {
        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: data.role || 'ai', content: data.result }]);
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
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
        <h2 className="font-bold text-base flex items-center gap-2"><Clock className="h-4 w-4" />History</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {history.length > 0 ? history.map(item => (
            <button key={item.id}
              onClick={() => { fetchChatHistory(item.id); if (isMobile) setShowHistory(false); }}
              className={cn('w-full text-left p-3 rounded-lg text-sm transition-colors flex items-start gap-3 hover:bg-accent group',
                activeThreadId === item.id ? 'bg-accent border border-primary/20' : 'transparent')}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="flex-1 overflow-hidden">
                <p className="font-bold truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
              </div>
            </button>
          )) : (
            <div className="text-center py-8 text-muted-foreground text-xs italic">No previous consultations found.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {!isMobile && showHistory && (
        <div className="w-72 border-r border-border bg-card flex flex-col"><SidebarContent /></div>
      )}
      {isMobile && (
        <Sheet open={showHistory} onOpenChange={setShowHistory}>
          <SheetContent side="left" className="p-0 w-72"><SidebarContent /></SheetContent>
        </Sheet>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-card border-b border-border px-3 md:px-4 py-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 md:gap-3">
            {!showHistory && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(true)}>
                <Clock className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              fetchChatHistory();
              fetchConsultationHistory();
              toast({ title: 'Syncing…', description: 'Updating consultation data.' });
            }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">
                <span className="font-bold">Logged in:</span>{' '}
                <span className="font-medium text-foreground">{user?.email}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 md:gap-2">
            <Button variant="ghost" size="sm" className="h-8 md:h-10 text-[10px] md:text-sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 md:mr-1.5" />
              <span className="font-bold">Logout</span>
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
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
  );
};
