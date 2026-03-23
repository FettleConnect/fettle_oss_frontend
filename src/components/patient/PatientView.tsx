import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { PaymentPage } from '@/components/payment/PaymentPage';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, CreditCard, Plus, ChevronLeft, MessageSquare, Clock } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';
import { useToast } from '@/hooks/use-toast';
import { BASE_URL } from '@/base_url';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from "@/components/ui/sheet";

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
  const [intakeStep, setIntakeStep] = useState(0);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<ConsultationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [intakeData, setIntakeData] = useState({
    duration: '',
    symptoms: '',
    location: '',
    meds: '',
    history: '',
    images: [] as string[],
    reportImages: [] as string[],
  });

  const [privacyFlagged, setPrivacyFlagged] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [proceedNoImages, setProceedNoImages] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);

  const paymentProcessedRef = useRef(false);
  const isSendingRef = useRef(false);

  const INTAKE_QUESTIONS = [
    "Please upload a clear image of the skin condition — rash, lesion, or affected area. Do not include your face or any personally identifiable information. Only a direct image of the skin issue is required.",
    "Thank you. Now please upload any relevant medical reports or test results if you have them. Ensure all personal information such as your name and mobile number is redacted or covered before uploading. If you have no reports, type 'none'.",
    "1. How long has this skin concern been present? (Duration)",
    "2. What symptoms are you experiencing? (e.g. itching, pain, bleeding, spreading)",
    "3. Where on your body is this located?",
    "4. Have you tried any medications or creams for this? If so, which ones?",
    "5. Have you had any prior diagnoses for this or other skin conditions?",
    "6. Do you have any other relevant medical history or allergies?",
  ];

  const STEP_KEYS = ['images', 'reportImages', 'duration', 'symptoms', 'location', 'meds', 'history', 'history'];

  const DURATION_OPTIONS = [
    'Less than 1 week',
    '1–4 weeks',
    '1–3 months',
    '3–6 months',
    'Over 6 months',
  ];

  const lastAiContent = messages
    .filter(m => m.role === 'AI' || m.role === 'ai')
    .slice(-1)[0]?.content?.toLowerCase() ?? '';

  const educationAiReplyCount = messages.filter(
    m => (m.role === 'AI' || m.role === 'ai')
  ).length;

  const freeTierExhausted = mode === 'general_education' && educationAiReplyCount >= 3;
  const hasAnyAiReply = educationAiReplyCount > 0;

  const showDurationChips =
    mode === 'post_payment_intake' &&
    !isLoading &&
    !privacyFlagged &&
    lastAiContent.includes('how long has this skin concern');

  const showYesNo =
    mode === 'post_payment_intake' &&
    !isLoading &&
    !privacyFlagged &&
    (
      lastAiContent.includes('have you tried any medications') ||
      lastAiContent.includes('have you had any prior diagnoses') ||
      lastAiContent.includes('do you have any other relevant medical history')
    );

  const showProceedNoImages =
    mode === 'post_payment_intake' &&
    !isLoading &&
    !privacyFlagged &&
    !proceedNoImages &&
    (
      intakeStep === 0 ||
      lastAiContent.includes('proceed without images') ||
      lastAiContent.includes('significantly less reliable') ||
      lastAiContent.includes('proceed_no_images')
    );

  const showUpgradeButton =
    mode === 'general_education' &&
    !isLoading &&
    hasAnyAiReply &&
    !consentAcknowledged;

  const showConfirmPayment = consentAcknowledged && !isLoading;

  const isPrivacyFlagMessage = (content: string) =>
    content.toLowerCase().includes('these images may contain identifiable personal information') ||
    content.toLowerCase().includes('intake is paused');

  const isFaceDetectedMessage = (content: string) =>
    content.toLowerCase().includes('no clinical image of skin issue is visible') ||
    content.toLowerCase().includes('dermatological findings') ||
    content.toLowerCase().includes('face detected');

  const isReportPiiMessage = (content: string) =>
    content.toLowerCase().includes('personal information visible') ||
    content.toLowerCase().includes('name or number') ||
    content.toLowerCase().includes('redact');

  const fetchConsultationHistory = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${BASE_URL}/api/consultation_list/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, []);

  const fetchChatHistory = useCallback(async (threadId?: string) => {
    try {
      setIsLoading(true);
      const authToken = localStorage.getItem('authToken');
      const url = new URL(`${BASE_URL}/api/chat_history/`);
      if (threadId) url.searchParams.append('thread_id', threadId);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error('Failed to fetch chat history');
      const data = await response.json();
      if (data.error) {
        console.error('Chat history error:', data.errorMsg);
      } else {
        if (data.conv && Array.isArray(data.conv)) {
          if (threadId) {
            setMessages(data.conv);
          } else {
            setMessages(prev => {
              const backendIds = new Set(data.conv.map((m: ChatMessage) => m.id));
              const localOnly = prev.filter(m => !backendIds.has(m.id));
              return [...data.conv, ...localOnly];
            });
          }
        }
        if (data.mode) setMode(data.mode as ConversationMode);
      }
      if (data.thread_id) setActiveThreadId(data.thread_id);
    } catch (error) {
      console.error('Error fetching chat history:', error);
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
      const response = await fetch(`${BASE_URL}/api/archive_consultation/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages([]);
        setMode('general_education');
        setActiveThreadId(data.thread_id);
        setPrivacyFlagged(false);
        setConsentAcknowledged(false);
        setProceedNoImages(false);
        setIntakeStep(0);
        setIntakeComplete(false);
        paymentProcessedRef.current = false;
        fetchConsultationHistory();
        fetchChatHistory(data.thread_id);
        toast({ title: 'New Consultation Started', description: 'Your previous chat has been saved to history.' });
      }
    } catch (error) {
      console.error('Error starting new consultation:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const appendImagesToFormData = async (formData: FormData, images: string[]): Promise<void> => {
    for (let i = 0; i < images.length; i++) {
      try {
        const blob = await dataURLtoBlob(images[i]);
        const ext = blob.type.split('/')[1] ?? 'jpg';
        formData.append('image', blob, `image_${i + 1}.${ext}`);
      } catch (err) {
        console.error(`Failed to process image ${i + 1}:`, err);
      }
    }
  };

  const handlePrivacyRemoveImages = () => {
    setIntakeData(prev => ({ ...prev, images: [], reportImages: [] }));
    setPrivacyFlagged(false);
    toast({ title: 'Images Cleared', description: 'Please re-upload images without identifiable information.' });
  };

  const handlePrivacyOverride = async () => {
    setPrivacyFlagged(false);
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'IOverride');
      formData.append('thread_id', activeThreadId || '');
      await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'AI',
        content: INTAKE_QUESTIONS[intakeStep],
      }]);
    } catch (error) {
      console.error('Error sending IOverride:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedNoImages = async () => {
    setProceedNoImages(true);
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: "I don't have images — proceed with text only",
    }]);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'PROCEED_NO_IMAGES');
      formData.append('thread_id', activeThreadId || '');
      await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
      const nextStep = 2;
      setIntakeStep(nextStep);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'AI',
        content: INTAKE_QUESTIONS[nextStep],
      }]);
    } catch (error) {
      console.error('Error sending PROCEED_NO_IMAGES:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeClick = () => {
    setConsentAcknowledged(true);
  };

  const handleConfirmGoBack = () => {
    setConsentAcknowledged(false);
  };

  const handleConfirmPayment = () => {
    setConsentAcknowledged(false);
    setMode('payment_page');
  };

  const handlePaymentSuccess = async () => {
    if (paymentProcessedRef.current) return;
    paymentProcessedRef.current = true;

    setMode('post_payment_intake');
    setIntakeStep(0);
    setPrivacyFlagged(false);
    setConsentAcknowledged(false);
    setProceedNoImages(false);
    setIntakeComplete(false);
    setIntakeData({ duration: '', symptoms: '', location: '', meds: '', history: '', images: [], reportImages: [] });

    setMessages(prev => {
      const alreadyExists = prev.some(m => m.role === 'system' && m.content.includes('Thank you for your payment'));
      if (alreadyExists) return prev;
      return [...prev, {
        id: `system-${Date.now()}`,
        role: 'system',
        content: "Thank you for your payment! You are now connected to our intake process.",
      }];
    });

    setTimeout(() => {
      setMessages(prev => {
        const alreadyHasIntakeQ = prev.some(m => m.content === INTAKE_QUESTIONS[0]);
        if (alreadyHasIntakeQ) return prev;
        return [...prev, {
          id: `ai-${Date.now()}`,
          role: 'AI',
          content: INTAKE_QUESTIONS[0],
        }];
      });
    }, 800);

    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'CONFIRM');
      formData.append('thread_id', activeThreadId || '');
      await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
    } catch (error) {
      console.error('Error sending CONFIRM after payment:', error);
    }

    toast({ title: 'Payment Successful', description: 'You can now provide details for your consultation.' });
  };

  const handleSendMessage = async (content: string, images?: string[]) => {
    if (isSendingRef.current || isLoading) {
      console.warn('Send blocked - already sending');
      return;
    }
    isSendingRef.current = true;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      images: images && images.length > 0 ? images : undefined,
    };

    setMessages(prev => {
      const exists = prev.some(m => m.role === 'user' && m.content === content);
      if (exists) return prev;
      return [...prev, userMessage];
    });

    if (mode === 'post_payment_intake') {

      if (intakeStep === 0) {
        if (images && images.length > 0) {
          setIntakeData(prev => ({ ...prev, images }));
        }
        setIsLoading(true);
        try {
          const authToken = localStorage.getItem('authToken');
          const formData = new FormData();
          formData.append('question', content || 'IMAGE_UPLOAD_STEP_0');
          formData.append('thread_id', activeThreadId || '');
          formData.append('step', 'skin_image');
          if (images && images.length > 0) {
            await appendImagesToFormData(formData, images);
          }
          const response = await fetch(`${BASE_URL}/api/chat_view/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
          });
          const data = await response.json();

          if (data.result && isFaceDetectedMessage(data.result)) {
            setMessages(prev => [...prev, {
              id: `ai-${Date.now()}`,
              role: 'AI',
              content: "⚠️ No clinical image of skin issue is visible. Please provide an attachment that depicts dermatological findings — a direct image of the affected skin area without your face or other identifiable features.",
            }]);
            setIsLoading(false);
            isSendingRef.current = false;
            return;
          }

          if (data.result && isPrivacyFlagMessage(data.result)) {
            setPrivacyFlagged(true);
            setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: data.result }]);
            setIsLoading(false);
            isSendingRef.current = false;
            return;
          }
        } catch (error) {
          console.error('Error sending skin image step:', error);
        }

        const nextStep = 1;
        setIntakeStep(nextStep);
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'AI',
            content: INTAKE_QUESTIONS[nextStep],
          }]);
          setIsLoading(false);
          isSendingRef.current = false;
        }, 500);
        return;
      }

      if (intakeStep === 1) {
        if (images && images.length > 0) {
          setIntakeData(prev => ({ ...prev, reportImages: images }));
        }
        setIsLoading(true);
        try {
          const authToken = localStorage.getItem('authToken');
          const formData = new FormData();
          formData.append('question', content || 'IMAGE_UPLOAD_STEP_1');
          formData.append('thread_id', activeThreadId || '');
          formData.append('step', 'report_image');
          if (images && images.length > 0) {
            await appendImagesToFormData(formData, images);
          }
          const response = await fetch(`${BASE_URL}/api/chat_view/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
          });
          const data = await response.json();

          if (data.result && isReportPiiMessage(data.result)) {
            setMessages(prev => [...prev, {
              id: `ai-${Date.now()}`,
              role: 'AI',
              content: "⚠️ Personal information (name or mobile number) appears to be visible in the uploaded report. Please redact or cover this information and re-upload.",
            }]);
            setIsLoading(false);
            isSendingRef.current = false;
            return;
          }

          if (data.result && isPrivacyFlagMessage(data.result)) {
            setPrivacyFlagged(true);
            setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: data.result }]);
            setIsLoading(false);
            isSendingRef.current = false;
            return;
          }
        } catch (error) {
          console.error('Error sending report image step:', error);
        }

        const nextStep = 2;
        setIntakeStep(nextStep);
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'AI',
            content: INTAKE_QUESTIONS[nextStep],
          }]);
          setIsLoading(false);
          isSendingRef.current = false;
        }, 500);
        return;
      }

      const currentStepKey = STEP_KEYS[intakeStep] as keyof typeof intakeData;
      if (currentStepKey !== 'images' && currentStepKey !== 'reportImages') {
        setIntakeData(prev => ({ ...prev, [currentStepKey]: content }));
      }

      const isLastStep =
        content.toUpperCase().trim() === 'DONE' ||
        intakeStep >= INTAKE_QUESTIONS.length - 1;

      if (isLastStep) {
        setIsLoading(true);
        try {
          const authToken = localStorage.getItem('authToken');
          const formData = new FormData();
          const allImages = [...intakeData.images, ...intakeData.reportImages];
          formData.append(
            'question',
            `INTAKE COMPLETE. Summary:\nDuration: ${intakeData.duration}\nSymptoms: ${intakeData.symptoms}\nLocation: ${intakeData.location}\nMeds: ${intakeData.meds}\nHistory: ${intakeData.history}\nSkin images: ${intakeData.images.length} attached.\nReport images: ${intakeData.reportImages.length} attached.\nDONE`
          );
          formData.append('thread_id', activeThreadId || '');
          await appendImagesToFormData(formData, allImages);
          await fetch(`${BASE_URL}/api/chat_view/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
          });
          setMode('dermatologist_review');
          setIntakeComplete(true);
          setPrivacyFlagged(false);
          setProceedNoImages(false);
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'AI',
            content: "✅ Intake complete. Dr. Attili will now review your case and you will be notified once the clinical review is ready.\n\nIn the meantime, feel free to add any additional information, context, or images that may be relevant — just send them below.",
          }]);
        } catch (error) {
          console.error('Error completing intake:', error);
        } finally {
          setIsLoading(false);
          isSendingRef.current = false;
        }
        return;
      }

      const nextStep = intakeStep + 1;
      setIntakeStep(nextStep);
      setIsLoading(true);

      try {
        const authToken = localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('question', content);
        formData.append('thread_id', activeThreadId || '');
        const response = await fetch(`${BASE_URL}/api/chat_view/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` },
          body: formData,
        });
        const data = await response.json();
        if (data.result && isPrivacyFlagMessage(data.result)) {
          setPrivacyFlagged(true);
          setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: data.result }]);
          setIsLoading(false);
          isSendingRef.current = false;
          return;
        }
      } catch (error) {
        console.error('Error sending intake step:', error);
      }

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          role: 'AI',
          content: INTAKE_QUESTIONS[nextStep],
        }]);
        setIsLoading(false);
        isSendingRef.current = false;
      }, 500);
      return;
    }

    if (mode === 'dermatologist_review') {
      setIsLoading(true);
      try {
        const authToken = localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('question', `ADDITIONAL INFO: ${content}`);
        formData.append('thread_id', activeThreadId || '');
        if (images && images.length > 0) {
          await appendImagesToFormData(formData, images);
        }
        await fetch(`${BASE_URL}/api/chat_view/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` },
          body: formData,
        });
      } catch (error) {
        console.error('Error sending additional info:', error);
      } finally {
        setIsLoading(false);
        isSendingRef.current = false;
      }
      return;
    }

    // General education mode
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', content);
      formData.append('thread_id', activeThreadId || '');
      if (images && images.length > 0) {
        await appendImagesToFormData(formData, images);
      }
      const response = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to send message');
      const data = await response.json();
      if (data.mode) setMode(data.mode as ConversationMode);

      const aiContent =
        (data.result && data.result.trim()) ||
        (data.response && data.response.trim()) ||
        (data.message && data.message.trim()) ||
        (data.answer && data.answer.trim()) ||
        (data.content && data.content.trim()) ||
        (data.text && data.text.trim()) ||
        "Sorry, I did not receive a response. Please try again.";

      if (isPrivacyFlagMessage(aiContent)) {
        setPrivacyFlagged(true);
      }

      setMessages(prev => {
        const exists = prev.some(m => m.content === aiContent && (m.role === 'ai' || m.role === 'AI'));
        if (exists) return prev;
        return [...prev, { id: `ai-${Date.now()}`, role: data.role || 'ai', content: aiContent }];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'destructive' });
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const hasDoctorResponded = messages.some(m => m.role === 'doctor');
  const isEducational = mode === 'general_education';

  const transformedMessages = messages
    .filter(msg => {
      const c = msg.content ?? '';
      if (c.trim() === 'CONFIRM') return false;
      if (c.includes('INTAKE COMPLETE') && c.includes('Summary:')) return false;
      return true;
    })
    .map(msg => {
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
        <h2 className="font-bold text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          History
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {history.length > 0 ? history.map((item) => (
            <button
              key={item.id}
              onClick={() => { fetchChatHistory(item.id); if (isMobile) setShowHistory(false); }}
              className={cn(
                "w-full text-left p-3 rounded-lg text-sm transition-colors flex items-start gap-3 hover:bg-accent group",
                activeThreadId === item.id ? "bg-accent border border-primary/20" : "transparent"
              )}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="flex-1 overflow-hidden">
                <p className="font-bold truncate">{item.name}</p>
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

  if (mode === 'payment_page') {
    return (
      <div className="h-screen">
        <PaymentPage
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={() => {
            setMode('general_education');
            setConsentAcknowledged(false); // ← FIXED: was true, caused wrong state on cancel
          }}
          threadId={activeThreadId || ''}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {!isMobile && showHistory && (
        <div className="w-72 border-r border-border bg-card flex flex-col">
          <SidebarContent />
        </div>
      )}
      {isMobile && (
        <Sheet open={showHistory} onOpenChange={setShowHistory}>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent />
          </SheetContent>
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
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => {
                fetchChatHistory();
                fetchConsultationHistory();
                toast({ title: "Syncing...", description: "Updating consultation data." });
              }}
            >
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
            {isEducational && (
              <Button
                variant="default" size="sm"
                onClick={() => setMode('payment_page')}
                className="h-8 text-[10px] md:text-xs px-2 md:px-3"
              >
                <CreditCard className="h-3.5 w-3.5 md:mr-1.5" />
                <span className="font-bold">Pay for Consultation</span>
              </Button>
            )}
            {hasDoctorResponded && (
              <Button
                variant="default" size="sm"
                onClick={handleNewConsultation}
                className="h-8 text-[10px] md:text-xs px-2 md:px-3 bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-3.5 w-3.5 md:mr-1.5" />
                <span className="font-bold">New Consultation</span>
              </Button>
            )}
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
            showYesNo={showYesNo}
            onQuickReply={handleSendMessage}
            showDurationChips={showDurationChips}
            durationOptions={DURATION_OPTIONS}
            privacyFlagged={privacyFlagged}
            onPrivacyRemove={handlePrivacyRemoveImages}
            onPrivacyOverride={handlePrivacyOverride}
            showProceedNoImages={showProceedNoImages}
            onProceedNoImages={handleProceedNoImages}
            showUpgradeButton={showUpgradeButton}
            onUpgradeClick={handleUpgradeClick}
            showConfirmPayment={showConfirmPayment}
            onConfirmPayment={handleConfirmPayment}
            onConfirmGoBack={handleConfirmGoBack}
            freeTierExhausted={freeTierExhausted}
            freeAiReplyCount={educationAiReplyCount}
            intakeComplete={intakeComplete}
          />
        </div>
      </div>
    </div>
  );
};
