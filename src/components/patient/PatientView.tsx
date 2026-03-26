import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { PaymentPage } from '@/components/payment/PaymentPage';
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

// ── CALIBRATED Client-side face/PII detection ────────────────────────────────
async function clientDetectFaceOrPII(dataUrl: string): Promise<{ blocked: boolean; reason: string; confidence?: number }> {
  try {
    const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,/);
    const mime = match?.[1] ?? 'image/jpeg';
    const b64 = dataUrl.split(',')[1] ?? '';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            {
              type: 'text',
              text: `You are a medical image safety analyzer. Examine this image carefully.

CLASSIFICATION RULES — BE PRECISE:
1. FACE DETECTION (Block ONLY if a CLEAR face is present):
   - BLOCK if: Full face with eyes+nose+mouth visible together, or clear partial face with 2+ facial features
   - ALLOW if: Hands, fingers, arms, legs, feet, torso, back, scalp (without face), or clinical close-ups of skin lesions
   - Hands and fingers are NOT faces — never block hands alone

2. PII TEXT DETECTION (Block ONLY if LEGIBLE personal info):
   - BLOCK if: Clearly readable name, date of birth, patient ID, phone number, email, or address
   - ALLOW if: Blurry text, medical terminology, labels like "Report", "Lab", or unreadable characters

3. CLINICAL IMAGES (Always allow):
   - Skin lesions, rashes, wounds, moles, acne, eczema, psoriasis
   - Dermatology close-ups, even if on fingers/hands
   - Medical reports where personal info is redacted/blurred

RESPOND ONLY WITH JSON:
{"blocked":true|false,"confidence":0-100,"reason":"specific reason if blocked, empty if allowed"}

Confidence guide:
- 90–100: Clear face or readable PII
- 70–89: Likely face/PII but not certain
- 0–69: Safe clinical image or no PII detected

Be conservative — only block when confident. Hands and clinical skin photos should NEVER be blocked.`,
            }
          ]
        }]
      })
    });

    if (!res.ok) {
      console.warn('Detection API error:', res.status, '— allowing image through (backend will re-check)');
      return { blocked: false, reason: '', confidence: 0 };
    }

    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? '';

    let result;
    try {
      result = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (parseError) {
      console.warn('JSON parse error in face detection — allowing image through:', parseError);
      return { blocked: false, reason: '', confidence: 0 };
    }

    const confidence = result.confidence ?? 0;
    const isBlocked = result.blocked === true && confidence >= 70;

    return {
      blocked: isBlocked,
      confidence,
      reason: isBlocked ? (result.reason || 'Potential personal information detected') : '',
    };

  } catch (error) {
    console.warn('Detection error — allowing image through:', error);
    return { blocked: false, reason: '', confidence: 0 };
  }
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
  });
  const [privacyFlagged, setPrivacyFlagged] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [proceedNoImages, setProceedNoImages] = useState(false);
  const [isCheckingImages, setIsCheckingImages] = useState(false);

  const intakeComplete = mode === 'dermatologist_review' || mode === 'final_output';

  const paymentProcessedRef = useRef(false);
  const isSendingRef = useRef(false);

  const INTAKE_QUESTIONS = [
    'Please upload a clear image of the skin condition — rash, lesion, or affected area. Do not include your face or any personally identifiable information. Only a direct image of the skin issue is required.',
    "Thank you. Now please upload any relevant medical reports or test results if you have them. Ensure all personal information such as your name and mobile number is redacted or covered before uploading. If you have no reports, type 'none'.",
    '1. How long has this skin concern been present? (Duration)',
    '2. What symptoms are you experiencing? (e.g. itching, pain, bleeding, spreading)',
    '3. Where on your body is this located?',
    '4. Have you tried any medications or creams for this? If so, which ones?',
    '5. Have you had any prior diagnoses for this or other skin conditions?',
    '6. Do you have any other relevant medical history or allergies?',
  ];

  const STEP_KEYS = [
    'images', 'reportImages', 'duration', 'symptoms',
    'location', 'meds', 'history', 'history',
  ] as const;

  const DURATION_OPTIONS = [
    'Less than 1 week', '1–4 weeks', '1–3 months', '3–6 months', 'Over 6 months',
  ];

  const lastAiContent = 
    messages.filter(m => m.role === 'AI' || m.role === 'ai').slice(-1)[0]?.content?.toLowerCase() ?? '';
  const educationAiReplyCount = messages.filter(m => m.role === 'AI' || m.role === 'ai').length;
  const freeTierExhausted = mode === 'general_education' && educationAiReplyCount >= 3;
  const hasAnyAiReply = educationAiReplyCount > 0;

  const showDurationChips = 
    mode === 'post_payment_intake' && !isLoading && !privacyFlagged && 
    lastAiContent.includes('how long has this skin concern');

  const showYesNo = 
    mode === 'post_payment_intake' && !isLoading && !privacyFlagged && (
      lastAiContent.includes('have you tried any medications') || 
      lastAiContent.includes('have you had any prior diagnoses') || 
      lastAiContent.includes('do you have any other relevant medical history')
    );

  const showProceedNoImages = 
    mode === 'post_payment_intake' && !isLoading && !privacyFlagged && !proceedNoImages && 
    (intakeStep === 0 || lastAiContent.includes('proceed without images'));

  const showUpgradeButton = 
    mode === 'general_education' && !isLoading && hasAnyAiReply && 
    !freeTierExhausted && !consentAcknowledged;

  const showConfirmPayment = consentAcknowledged && !isLoading;

  const sanitizeImages = (imgs?: string[]) => 
    (imgs ?? []).filter(img => typeof img === 'string' && img.trim().length > 10);

  const clearUnsafeImages = useCallback(() => {
    setMessages(prev => prev.map(m => m.images?.length ? { ...m, images: [] } : m));
  }, []);

  const isPrivacyFlagMessage = (c: string) => {
    const l = (c || '').toLowerCase();
    return l.includes('these images may contain identifiable personal information') || l.includes('intake is paused');
  };

  const isFaceDetectedMessage = (content: string) => {
    const lower = content.toLowerCase();
    return lower.includes('face detected') || lower.includes('no clinical image of skin issue is visible');
  };

  const isReportPiiMessage = (content: string) => {
    const lower = content.toLowerCase();
    return lower.includes('personal information visible') || lower.includes('name or number');
  };

  const deriveIntakeStepFromMessages = useCallback((msgs: ChatMessage[]): number => {
    let step = 0;
    for (const msg of msgs) {
      if (msg.role === 'AI' || msg.role === 'ai') {
        const content = msg.content || '';
        if (content.includes('Please upload a clear image of the skin condition')) step = Math.max(step, 1);
        if (content.includes('upload any relevant medical reports')) step = Math.max(step, 2);
        if (content.includes('How long has this skin concern')) step = Math.max(step, 3);
        if (content.includes('What symptoms are you experiencing')) step = Math.max(step, 4);
        if (content.includes('Where on your body is this located')) step = Math.max(step, 5);
        if (content.includes('Have you tried any medications')) step = Math.max(step, 6);
        if (content.includes('Have you had any prior diagnoses')) step = Math.max(step, 7);
        if (content.includes('any other relevant medical history')) step = Math.max(step, 7);
      }
    }
    return step;
  }, []);

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
        let loadedMessages: ChatMessage[] = [];
        if (threadId) {
          setMessages(data.conv);
          loadedMessages = data.conv;
        } else {
          setMessages(prev => {
            const backendIds = new Set(data.conv.map((m: ChatMessage) => m.id));
            const localOnly = prev.filter(m => !backendIds.has(m.id));
            loadedMessages = [...data.conv, ...localOnly];
            return loadedMessages;
          });
          loadedMessages = data.conv;
        }

        if (data.mode) {
          const restoredMode = data.mode as ConversationMode;
          setMode(restoredMode);
          if (restoredMode === 'post_payment_intake') {
            const step = deriveIntakeStepFromMessages(loadedMessages);
            setIntakeStep(step);
          }
        }
      }
      if (data.thread_id) setActiveThreadId(data.thread_id);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, [deriveIntakeStepFromMessages]);

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
        setProceedNoImages(false);
        setIntakeStep(0);
        setIntakeData({ duration: '', symptoms: '', location: '', meds: '', history: '' });
        paymentProcessedRef.current = false;
        fetchConsultationHistory();
        fetchChatHistory(data.thread_id);
        toast({ title: 'New Consultation Started', description: 'Your previous chat has been saved to history.' });
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

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

  const screenImages = async (imgs: string[], label: string): Promise<string[] | null> => {
    if (imgs.length === 0) return [];

    setIsCheckingImages(true);
    toast({ title: 'Checking image…', description: 'Verifying no face or personal info is present.' });

    const safe: string[] = [];
    const rejected: { reason: string; confidence?: number }[] = [];

    const results = await Promise.all(
      imgs.map(async img => {
        const detection = await clientDetectFaceOrPII(img);
        return { img, detection };
      })
    );

    for (const { img, detection } of results) {
      if (detection.blocked) {
        rejected.push({ reason: detection.reason || 'Potential personal information detected', confidence: detection.confidence });
      } else {
        safe.push(img);
      }
    }

    setIsCheckingImages(false);

    if (rejected.length > 0) {
      const rejectionDetails = rejected
        .map(r => r.confidence ? `${r.reason} (confidence: ${r.confidence}%)` : r.reason)
        .join('; ');

      const rejectionMessage =
        `⚠️ Image${rejected.length > 1 ? 's' : ''} rejected before upload.

**Reason:** ${rejectionDetails}

Please upload only clinical images of the affected skin area — no faces, names, or personal details visible.

If this was a mistake (e.g. a hand or arm photo was rejected), please retake the photo ensuring no face is in frame and try again.`;

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'AI',
        content: rejectionMessage,
      }]);

      toast({
        title: 'Image Rejected',
        description: 'Please upload only clinical images without face or personal info',
        variant: 'destructive',
      });

      return null;
    }

    return safe;
  };

  const handlePrivacyRemoveImages = () => {
    clearUnsafeImages();
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
      await fetch(`${BASE_URL}/api/chat_view/`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData });
      setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[intakeStep] }]);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleProceedNoImages = async () => {
    setProceedNoImages(true);
    setIsLoading(true);
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: "I don't have images — proceed with text only" }]);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'PROCEED_NO_IMAGES');
      formData.append('thread_id', activeThreadId || '');
      await fetch(`${BASE_URL}/api/chat_view/`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData });
      const nextStep = 2;
      setIntakeStep(nextStep);
      setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[nextStep] }]);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleUpgradeClick = () => setConsentAcknowledged(true);
  const handleConfirmGoBack = () => setConsentAcknowledged(false);
  const handleConfirmPayment = () => { setConsentAcknowledged(false); setMode('payment_page'); };

  const handlePaymentSuccess = async () => {
    if (paymentProcessedRef.current) return;
    paymentProcessedRef.current = true;
    setMode('post_payment_intake');
    setIntakeStep(0);
    setPrivacyFlagged(false);
    setConsentAcknowledged(false);
    setProceedNoImages(false);
    setIntakeData({ duration: '', symptoms: '', location: '', meds: '', history: '' });
    setMessages(prev => {
      if (prev.some(m => m.role === 'system' && m.content.includes('Thank you for your payment'))) return prev;
      return [...prev, { id: `system-${Date.now()}`, role: 'system', content: 'Thank you for your payment! You are now connected to our intake process.' }];
    });
    setTimeout(() => {
      setMessages(prev => {
        if (prev.some(m => m.content === INTAKE_QUESTIONS[0])) return prev;
        return [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[0] }];
      });
    }, 800);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', 'CONFIRM');
      formData.append('thread_id', activeThreadId || '');
      await fetch(`${BASE_URL}/api/chat_view/`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData });
    } catch (e) { console.error(e); }
    toast({ title: 'Payment Successful', description: 'You can now provide details for your consultation.' });
  };

  const handleSendMessage = async (content: string, images?: string[]) => {
    if (isSendingRef.current || isLoading || isCheckingImages) return;
    isSendingRef.current = true;

    if (mode === 'post_payment_intake') {
      const rawImages = sanitizeImages(images);

      if (intakeStep === 0) {
        if (rawImages.length === 0) {
          setMessages(prev => [...prev,
            { id: `user-${Date.now()}`, role: 'user', content: content || '(no image)' },
            { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[0] },
          ]);
          isSendingRef.current = false;
          return;
        }

        const safeImages = await screenImages(rawImages, 'skin');
        if (!safeImages) {
          isSendingRef.current = false;
          return;
        }

        setMessages(prev => [...prev, {
          id: `user-${Date.now()}`, role: 'user', content, images: safeImages,
        }]);

        const authToken = localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('question', content || 'IMAGE_UPLOAD_SKIN');
        formData.append('thread_id', activeThreadId || '');
        formData.append('step', 'skin_image');
        await appendImagesToFormData(formData, safeImages);
        const response = await fetch(`${BASE_URL}/api/chat_view/`, {
          method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
        });
        const data = await response.json();
        
        if (data.result && isFaceDetectedMessage(data.result)) {
          setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: "⚠️ Your image appears to contain a face or identifiable features. Please upload only a direct close-up of the affected skin area — no faces or identifying information should be visible." }]);
          isSendingRef.current = false; return;
        }

        const nextStep = 1;
        setIntakeStep(nextStep);
        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[nextStep] }]);
        isSendingRef.current = false;
        return;
      }

      if (intakeStep === 1) {
        const textLower = content.trim().toLowerCase();
        const skipped = textLower === 'none' || textLower === 'no' || rawImages.length === 0;

        if (!skipped && rawImages.length > 0) {
          const safeImages = await screenImages(rawImages, 'report');
          if (!safeImages) {
            isSendingRef.current = false;
            return;
          }

          setMessages(prev => [...prev, {
            id: `user-${Date.now()}`, role: 'user', content, images: safeImages,
          }]);

          const authToken = localStorage.getItem('authToken');
          const formData = new FormData();
          formData.append('question', content || 'IMAGE_UPLOAD_REPORT');
          formData.append('thread_id', activeThreadId || '');
          formData.append('step', 'report_image');
          await appendImagesToFormData(formData, safeImages);
          const response = await fetch(`${BASE_URL}/api/chat_view/`, {
            method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
          });
          const data = await response.json();
          
          if (data.result && isReportPiiMessage(data.result)) {
            setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: "⚠️ Your report appears to contain personal information (name or mobile number). Please redact all personal details and re-upload — only the medical findings should be visible." }]);
            isSendingRef.current = false; return;
          }
        } else {
          setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: content || 'none' }]);
        }

        const nextStep = 2;
        setIntakeStep(nextStep);
        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[nextStep] }]);
        isSendingRef.current = false;
        return;
      }

      const currentStepKey = STEP_KEYS[intakeStep] as keyof typeof intakeData;
      setMessages(prev => {
        if (prev.some(m => m.role === 'user' && m.content === content)) return prev;
        return [...prev, { id: `user-${Date.now()}`, role: 'user', content }];
      });

      if (currentStepKey !== 'images' && currentStepKey !== 'reportImages') {
        setIntakeData(prev => ({ ...prev, [currentStepKey]: content }));
      }

      const isLastStep = content.toUpperCase().trim() === 'DONE' || intakeStep >= INTAKE_QUESTIONS.length - 1;

      if (isLastStep) {
        setIsLoading(true);
        try {
          const authToken = localStorage.getItem('authToken');
          const formData = new FormData();
          const updatedData = {
            ...intakeData,
            ...(currentStepKey !== 'images' && currentStepKey !== 'reportImages' ? { [currentStepKey]: content } : {}),
          };

          formData.append('question', `INTAKE COMPLETE. Summary:\nDuration: ${updatedData.duration}\nSymptoms: ${updatedData.symptoms}\nLocation: ${updatedData.location}\nMeds: ${updatedData.meds}\nHistory: ${updatedData.history}\nImages were uploaded in earlier steps.\nDONE`);
          formData.append('thread_id', activeThreadId || '');
          
          if (images?.length) {
            const safeFinalImages = await screenImages(sanitizeImages(images), 'final');
            if (safeFinalImages) await appendImagesToFormData(formData, safeFinalImages);
          }

          await fetch(`${BASE_URL}/api/chat_view/`, {
            method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
          });

          setMode('dermatologist_review');
          setPrivacyFlagged(false);
          setProceedNoImages(false);
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`, role: 'AI',
            content: '✅ Your intake is complete. Dr. Attili will personally review your case and respond shortly. You will be notified when your consultation is ready.\n\nYou can add any extra information or images below while you wait.',
          }]);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); isSendingRef.current = false; }
        return;
      }

      const nextStep = intakeStep + 1;
      setIntakeStep(nextStep);

      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', content);
      formData.append('thread_id', activeThreadId || '');
      fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
      }).catch(e => console.error(e));

      setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'AI', content: INTAKE_QUESTIONS[nextStep] }]);
      isSendingRef.current = false;
      return;
    }

    if (mode === 'dermatologist_review') {
      const rawImages = sanitizeImages(images);

      if (rawImages.length > 0) {
        const safeImages = await screenImages(rawImages, 'additional');
        if (!safeImages) {
          isSendingRef.current = false;
          return;
        }

        setMessages(prev => {
          if (prev.some(m => m.role === 'user' && m.content === content && JSON.stringify(m.images) === JSON.stringify(safeImages))) return prev;
          return [...prev, { id: `user-${Date.now()}`, role: 'user', content, images: safeImages }];
        });

        const authToken = localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('question', `ADDITIONAL INFO: ${content}`);
        formData.append('thread_id', activeThreadId || '');
        await appendImagesToFormData(formData, safeImages);
        fetch(`${BASE_URL}/api/chat_view/`, {
          method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
        }).catch(e => console.error(e));
      } else {
        setMessages(prev => {
          if (prev.some(m => m.role === 'user' && m.content === content)) return prev;
          return [...prev, { id: `user-${Date.now()}`, role: 'user', content }];
        });

        const authToken = localStorage.getItem('authToken');
        const formData = new FormData();
        formData.append('question', `ADDITIONAL INFO: ${content}`);
        formData.append('thread_id', activeThreadId || '');
        fetch(`${BASE_URL}/api/chat_view/`, {
          method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
        }).catch(e => console.error(e));
      }

      isSendingRef.current = false;
      return;
    }

    const sanitizedImages = sanitizeImages(images);
    let safeImages: string[] = [];
    if (sanitizedImages.length > 0) {
      const screened = await screenImages(sanitizedImages, 'general');
      if (!screened) {
        isSendingRef.current = false;
        return;
      }
      safeImages = screened;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`, role: 'user', content,
      images: safeImages.length ? safeImages : undefined,
    };
    setMessages(prev => {
      if (prev.some(m => m.role === 'user' && m.content === content && JSON.stringify(m.images) === JSON.stringify(safeImages))) return prev;
      return [...prev, userMessage];
    });
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('question', content);
      formData.append('thread_id', activeThreadId || '');
      if (safeImages.length) await appendImagesToFormData(formData, safeImages);
      const res = await fetch(`${BASE_URL}/api/chat_view/`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
      });
      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      if (data.mode) {
        const modeOrder: ConversationMode[] = [
          'general_education', 'payment_page', 'post_payment_intake',
          'dermatologist_review', 'final_output',
        ];
        const currentIndex = modeOrder.indexOf(mode);
        const newIndex = modeOrder.indexOf(data.mode as ConversationMode);
        if (newIndex > currentIndex) {
          setMode(data.mode as ConversationMode);
        }
      }

      const aiContent = 
        data.result?.trim() || data.response?.trim() || data.message?.trim() || 
        data.answer?.trim() || data.content?.trim() || data.text?.trim() || 
        'Sorry, I did not receive a response. Please try again.';
      if (isPrivacyFlagMessage(aiContent)) setPrivacyFlagged(true);
      setMessages(prev => {
        if (prev.some(m => m.content === aiContent && (m.role === 'ai' || m.role === 'AI'))) return prev;
        return [...prev, { id: `ai-${Date.now()}`, role: data.role || 'ai', content: aiContent }];
      });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'destructive' });
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  const hasDoctorResponded = messages.some(m => m.role === 'doctor');
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

  if (mode === 'payment_page') {
    return (
      <div className="h-screen">
        <PaymentPage
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={() => { setMode('general_education'); setConsentAcknowledged(false); }}
          threadId={activeThreadId || ''}
        />
      </div>
    );
  }

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
            {hasDoctorResponded && (
              <Button variant="default" size="sm" onClick={handleNewConsultation}
                className="h-8 text-[10px] md:text-xs px-2 md:px-3 bg-green-600 hover:bg-green-700 text-white">
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
            isLoading={isLoading || isCheckingImages}
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