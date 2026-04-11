import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Clock,
  MessageSquare,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
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
  name?: string;
  title?: string;
  mode?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// FIX: Removed the regex that injected **bold** markers around section titles.
// The backend already applies ensure_markdown_bold_headings() to structured
// module outputs (module3 / module4). Running it again here on every message
// caused plain conversational replies to also get bold headings injected,
// which the frontend then rendered as bold/heading text for ALL AI messages.
// Only clean up excessive blank lines — nothing else.
const formatMessageContent = (text: string) => {
  if (!text) return '';
  return text.replace(/\n{3,}/g, '\n\n');
};

const formatConsultationDate = (value?: string) => {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getConsultationTitle = (item: ConsultationHistoryItem, index: number) => {
  const rawTitle = item.title || item.name;
  if (rawTitle && rawTitle.trim()) return rawTitle.trim();
  return `Consultation ${index + 1}`;
};

const AiMessagesLeftBadge = ({ remaining }: { remaining: number }) => {
  if (remaining <= 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm">
        <CheckCircle2 className="h-4 w-4" />
        Free AI replies finished
      </div>
    );
  }
  if (remaining === 1) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm">
        <AlertCircle className="h-4 w-4" />
        Last AI reply left
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
      <Sparkles className="h-4 w-4" />
      {remaining} AI replies left
    </div>
  );
};

const getPatientChatCacheKey = (threadId: string | null) =>
  `patient-chat-${threadId || 'default'}`;

// Tracks active blob URLs so we can revoke them on cleanup to avoid memory leaks
const activeBlobUrls: string[] = [];
const createBlobUrl = (file: File): string => {
  const url = URL.createObjectURL(file);
  activeBlobUrls.push(url);
  return url;
};

export const PatientView: React.FC<PatientViewProps> = ({ user, onLogout }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cachedMessages, setCachedMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ConversationMode>('general_education');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<ConsultationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const intakeComplete = mode === 'dermatologist_review' || mode === 'final_output';
  const isSendingRef = useRef(false);
  const EDUCATIONAL_MESSAGE_LIMIT = 3;

  const getEducationAiReplyCount = useCallback((chatMessages: ChatMessage[]) => {
    return chatMessages.filter((msg) => msg.role === 'ai' || msg.role === 'AI').length;
  }, []);

  const getRemainingEducationalMessages = useCallback(
    (chatMessages: ChatMessage[]) => {
      return Math.max(0, EDUCATIONAL_MESSAGE_LIMIT - getEducationAiReplyCount(chatMessages));
    },
    [getEducationAiReplyCount]
  );

  const resolvedMessages = useMemo(() => {
    return messages.length > 0 ? messages : cachedMessages;
  }, [messages, cachedMessages]);

  const remainingMessages = useMemo(() => {
    if (mode !== 'general_education') return null;
    return getRemainingEducationalMessages(resolvedMessages);
  }, [resolvedMessages, mode, getRemainingEducationalMessages]);

  const fetchConsultationHistory = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`${BASE_URL}/api/consultation_list/`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      console.error('Failed to fetch consultation history:', error);
      setHistory([]);
    }
  }, []);

  const fetchChatHistory = useCallback(async (threadId?: string) => {
    try {
      setIsLoading(true);
      const authToken = localStorage.getItem('authToken');
      const url = new URL(`${BASE_URL}/api/chat_history/`);
      if (threadId) {
        url.searchParams.append('thread_id', threadId);
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      const formatted = Array.isArray(data.conv)
        ? data.conv.map((m: ChatMessage) => ({
            ...m,
            content: formatMessageContent(m.content),
          }))
        : [];
      setMessages(formatted);
      if (data.thread_id && threadId) {
        setActiveThreadId(data.thread_id);
        try {
          localStorage.setItem(
            getPatientChatCacheKey(data.thread_id),
            JSON.stringify(formatted)
          );
        } catch (e) {
          console.error('Cache write failed:', e);
        }
      } else if (!threadId) {
        setActiveThreadId(null);
      }
      if (data.mode) {
        setMode(data.mode as ConversationMode);
        if (data.mode === 'payment_page') {
          setShowPayment(true);
        }
      }
    } catch (e) {
      console.error('Failed to fetch chat history:', e);
      if (!threadId) {
        setMessages([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsultationHistory();
    fetchChatHistory();
  }, [fetchConsultationHistory, fetchChatHistory]);

  // Polling for doctor replies when in doctor_patient or dermatologist_review mode.
  useEffect(() => {
    if (mode !== 'doctor_patient' && mode !== 'dermatologist_review') return;
    const interval = setInterval(() => {
      if (!isSendingRef.current) {
        fetchChatHistory(activeThreadId || undefined);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [mode, activeThreadId, fetchChatHistory]);

  useEffect(() => {
    if (!activeThreadId) return;
    try {
      const cached = localStorage.getItem(getPatientChatCacheKey(activeThreadId));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setCachedMessages(parsed);
        } else {
          setCachedMessages([]);
        }
      } else {
        setCachedMessages([]);
      }
    } catch (e) {
      console.error('Cache read failed:', e);
      setCachedMessages([]);
    }
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    try {
      localStorage.setItem(
        getPatientChatCacheKey(activeThreadId),
        JSON.stringify(messages)
      );
    } catch (e) {
      console.error('Cache update failed:', e);
    }
  }, [messages, activeThreadId]);

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      activeBlobUrls.forEach((url) => URL.revokeObjectURL(url));
      activeBlobUrls.length = 0;
    };
  }, []);

  // Clear both messages AND cachedMessages when switching threads to prevent
  // old thread content flashing while the new thread loads.
  const handleSelectHistory = async (threadId: string) => {
    setMessages([]);
    setCachedMessages([]);
    setActiveThreadId(threadId);
    setShowPayment(false);
    await fetchChatHistory(threadId);
    if (isMobile) {
      setShowHistory(false);
    }
  };

  const handleRefresh = async () => {
    await fetchConsultationHistory();
    await fetchChatHistory(activeThreadId || undefined);
  };

  const handleNewConsultation = async () => {
    try {
      setIsLoading(true);
      setMessages([]);
      setCachedMessages([]);
      setActiveThreadId(null);
      setMode('general_education');
      setShowPayment(false);
      await fetchConsultationHistory();
      if (isMobile) {
        setShowHistory(false);
      }
      toast({
        title: 'New Consultation',
        description: 'Start typing to begin a new consultation.',
      });
    } catch (e) {
      console.error('New consultation failed:', e);
      toast({
        title: 'Error',
        description: 'Could not start a new consultation.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = useCallback(async () => {
    setShowPayment(false);
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'PAYMENT_CONFIRMED');
      if (activeThreadId) {
        formData.append('thread_id', activeThreadId);
      }
      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const data = await res.json();
      if (data.mode) {
        setMode(data.mode as ConversationMode);
      }
      const nextThreadId = data.thread_id || activeThreadId;
      if (data.thread_id) {
        setActiveThreadId(data.thread_id);
      }
      await fetchChatHistory(nextThreadId || undefined);
      await fetchConsultationHistory();
      toast({ title: 'Payment successful', description: 'Proceeding to intake.' });
    } catch (e) {
      console.error('Payment advance failed:', e);
      await fetchChatHistory(activeThreadId || undefined);
      toast({ title: 'Payment received', description: 'Loading your consultation.' });
    } finally {
      setIsLoading(false);
    }
  }, [activeThreadId, fetchChatHistory, fetchConsultationHistory, toast]);

  const handlePaymentCancel = useCallback(() => {
    setShowPayment(false);
  }, []);

  const handleGoToDermatologistReview = async () => {
    if (isSendingRef.current || isLoading) return;
    isSendingRef.current = true;
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'Go to dermatologist review');
      if (activeThreadId) {
        formData.append('thread_id', activeThreadId);
      }
      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        toast({
          title: 'Error',
          description: data.errorMsg || 'Could not continue to dermatologist review.',
          variant: 'destructive',
        });
        return;
      }
      if (data.mode) {
        setMode(data.mode as ConversationMode);
      }
      const nextThreadId = data.thread_id || activeThreadId;
      if (data.thread_id) {
        setActiveThreadId(data.thread_id);
      }
      await fetchChatHistory(nextThreadId || undefined);
      await fetchConsultationHistory();
      if (data.mode === 'payment_page') {
        setShowPayment(true);
      }
    } catch (e) {
      console.error('Go to dermatologist review failed:', e);
      toast({
        title: 'Error',
        description: 'Could not continue to dermatologist review.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const handleSendMessage = async (content: string, images?: File[]) => {
    if (isSendingRef.current || isLoading) return;
    if (!content?.trim() && (!images || images.length === 0)) return;
    isSendingRef.current = true;

    // Use blob URLs so uploaded images appear immediately in the user bubble
    const blobImageUrls = images && images.length > 0
      ? images.map((f) => createBlobUrl(f))
      : [];

    const tempUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      images: blobImageUrls,
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append(
        'question',
        content?.trim() || (images && images.length > 0 ? 'Please analyze this image.' : '')
      );
      if (activeThreadId) {
        formData.append('thread_id', activeThreadId);
      }
      if (images && images.length > 0) {
        images.forEach((file) => {
          formData.append('images', file);
        });
      }
      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        toast({
          title: 'Error',
          description: data.errorMsg || 'Could not send message.',
          variant: 'destructive',
        });
        setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMessage.id));
        return;
      }
      if (data.mode) {
        setMode(data.mode as ConversationMode);
      }
      const nextThreadId = data.thread_id || activeThreadId;
      if (data.thread_id) {
        setActiveThreadId(data.thread_id);
      }
      // Refetch full chat history after every send so:
      // 1. Temp blob URLs are replaced with permanent server-stored image URLs
      // 2. The face/PII warning message from the backend appears correctly
      // 3. Doctor messages added server-side appear correctly
      await fetchChatHistory(nextThreadId || undefined);
      await fetchConsultationHistory();
      if (data.mode === 'payment_page') {
        setShowPayment(true);
      }
    } catch (e) {
      console.error('Send message failed:', e);
      toast({
        title: 'Error',
        description: 'Could not send message.',
        variant: 'destructive',
      });
      setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const transformedMessages = resolvedMessages.map((msg) => {
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

  const historySidebar = (
    <div className="h-full border-r bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Consultations</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewConsultation}
            title="New Consultation"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[calc(100%-57px)]">
        <div className="p-2">
          {history.length === 0 ? (
            <div className="px-3 py-6 text-sm text-slate-500">No consultations yet.</div>
          ) : (
            history.map((item, index) => {
              const isActive = activeThreadId === item.id;
              const title = getConsultationTitle(item, index);
              const dateText = formatConsultationDate(item.updated_at || item.created_at);
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectHistory(item.id)}
                  className={cn(
                    'mb-2 w-full rounded-xl border px-3 py-3 text-left transition',
                    isActive
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  )}
                >
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{dateText}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <section className="bg-gray-50 py-12 px-4 md:px-6 min-h-[80vh] flex items-center">
      <div className="container mx-auto max-w-6xl">
        {remainingMessages !== null && (
          <div className="px-4 pt-3 pb-1 bg-white border-b border-gray-100">
            <AiMessagesLeftBadge remaining={remainingMessages} />
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] h-[700px]">
            {!isMobile && showHistory && historySidebar}
            {showPayment ? (
              <PaymentPage
                onPaymentSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            ) : (
              <div className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowHistory(true)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Dermatology Chat
                      </h2>
                      <p className="text-xs text-slate-500">
                        {mode === 'doctor_patient'
                          ? 'Doctor will reply directly'
                          : mode === 'dermatologist_review'
                            ? 'Awaiting dermatologist review'
                            : mode === 'final_output'
                              ? 'Consultation completed'
                              : mode === 'payment_page'
                                ? 'Payment required'
                                : 'AI assistant active'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleNewConsultation}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2"
                    >
                      + New Consultation
                    </Button>
                    {mode === 'payment_page' && !showPayment && (
                      <Button onClick={() => setShowPayment(true)}>Open Payment</Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <ChatContainer
                    messages={transformedMessages}
                    streamingContent=""
                    onSendMessage={handleSendMessage}
                    onGoToDermatologistReview={handleGoToDermatologistReview}
                    isLoading={isLoading}
                    mode={mode}
                    showDisclaimer={resolvedMessages.length === 0}
                    intakeComplete={intakeComplete}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {isMobile && (
          <Sheet open={showHistory} onOpenChange={setShowHistory}>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              {historySidebar}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </section>
  );
};
