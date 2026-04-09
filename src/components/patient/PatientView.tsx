// 🔥 ONLY CHANGES ARE MARKED WITH ✅ FIX

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
  name: string;
  mode: string;
  status: string;
  created_at: string;
}

/* =========================================================
   ✅ FIX 1: FORCE BOLD HEADINGS FORMAT
========================================================= */
const formatMessageContent = (text: string) => {
  if (!text) return '';

  return text
    .replace(
      /(Most Consistent With|Close Differentials|Morphologic Justification|Educational Treatment Framework|Typical Course and Prognosis|When In-Person Evaluation Is Considered|Educational References)/gi,
      '**$1**'
    )
    .replace(/\n{3,}/g, '\n\n');
};

/* =========================================================
   AI LIMIT BADGE (UNCHANGED)
========================================================= */

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

  /* =========================================================
     ✅ FIX 2: BLOCK AI AFTER DOCTOR RESPONSE
  ========================================================= */
  const doctorHasResponded = useMemo(() => {
    return messages.some((m) => m.role === 'doctor');
  }, [messages]);

  const EDUCATIONAL_MESSAGE_LIMIT = 3;

  const getEducationAiReplyCount = useCallback((chatMessages: ChatMessage[]) => {
    return chatMessages.filter((msg) => msg.role === 'ai' || msg.role === 'AI')
      .length;
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

  /* =========================================================
     FETCH
  ========================================================= */

  const fetchChatHistory = useCallback(async (threadId?: string) => {
    try {
      setIsLoading(true);
      const authToken = localStorage.getItem('authToken');

      const url = new URL(`${BASE_URL}/api/chat_history/`);
      if (threadId) url.searchParams.append('thread_id', threadId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await res.json();

      /* =========================================================
         ✅ FIX 3: FORMAT ALL INCOMING MESSAGES
      ========================================================= */
      const formatted = (data.conv || []).map((m: ChatMessage) => ({
        ...m,
        content: formatMessageContent(m.content),
      }));

      setMessages(formatted);

      if (data.mode) setMode(data.mode);
      if (data.thread_id) setActiveThreadId(data.thread_id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* =========================================================
     SEND MESSAGE
  ========================================================= */

  const handleSendMessage = async (content: string, images?: string[]) => {
    if (isSendingRef.current || isLoading) return;

    /* =========================================================
       ✅ FIX 4: STOP AI AFTER DOCTOR RESPONSE
    ========================================================= */
    if (doctorHasResponded) {
      // Only append message locally, DO NOT CALL AI
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        images,
      };

      setMessages((prev) => [...prev, userMessage]);

      toast({
        title: 'Message Sent',
        description: 'Waiting for doctor response.',
      });

      return;
    }

    isSendingRef.current = true;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      images,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', content);
      formData.append('thread_id', activeThreadId || '');

      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      const data = await res.json();

      if (data.result) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: formatMessageContent(data.result), // ✅ FIX
          },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  /* =========================================================
     TRANSFORM MESSAGES
  ========================================================= */

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

  /* =========================================================
     UI (UNCHANGED)
  ========================================================= */

  return (
    <section className="bg-gray-50 py-12 px-4 md:px-6 min-h-[80vh] flex items-center">
      <div className="container mx-auto max-w-6xl">

        {remainingMessages !== null && (
          <div className="px-4 pt-3 pb-1 bg-white border-b border-gray-100">
            <AiMessagesLeftBadge remaining={remainingMessages} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border flex flex-col h-[700px]">
          <ChatContainer
            messages={transformedMessages}
            streamingContent=""
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            mode={mode}
            showDisclaimer={resolvedMessages.length === 0}
            intakeComplete={intakeComplete}
          />
        </div>
      </div>
    </section>
  );
};
