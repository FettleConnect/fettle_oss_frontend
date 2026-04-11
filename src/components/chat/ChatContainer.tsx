import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Message, ConversationMode, DISCLAIMER } from '@/types/dermatology';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  Info,
  CheckCircle,
  Plus,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  MessageSquare,
  PenLine,
  CreditCard,
} from 'lucide-react';

interface ChatContainerProps {
  messages: Message[];
  streamingContent: string;
  onSendMessage: (content: string, images?: File[]) => Promise<void> | void;
  isLoading: boolean;
  mode: ConversationMode;
  showDisclaimer: boolean;
  onQuickReply?: (reply: string) => void;
  intakeComplete?: boolean;
  onNewConsultation?: () => void;
  onGoToDermatologistReview?: () => void;
  patientLabel?: string; // "You" in patient view, patient name in doctor view
}

function parseOptions(content: string): { cleanText: string; options: string[] } {
  const regex = /\[OPTIONS:\s*([^\]]+)\]/i;
  const match = content.match(regex);
  if (!match) return { cleanText: content, options: [] };
  const options = match[1]
    .split('|')
    .map((o) => o.trim())
    .filter(Boolean);
  const cleanText = content.replace(regex, '').trim();
  return { cleanText, options };
}

interface OptionButtonsProps {
  options: string[];
  onSelect: (value: string) => void;
  disabled: boolean;
}

const OptionButtons: React.FC<OptionButtonsProps> = ({ options, onSelect, disabled }) => {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showOtherInput) inputRef.current?.focus();
  }, [showOtherInput]);

  const handleSelect = (option: string) => {
    if (disabled || selected) return;
    if (option.toLowerCase() === 'other') {
      setShowOtherInput(true);
      return;
    }
    setSelected(option);
    onSelect(option);
  };

  const handleOtherSubmit = () => {
    if (!otherText.trim() || disabled) return;
    setSelected(otherText.trim());
    setShowOtherInput(false);
    onSelect(otherText.trim());
  };

  const handleOtherKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleOtherSubmit();
    if (e.key === 'Escape') {
      setShowOtherInput(false);
      setOtherText('');
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isOther = option.toLowerCase() === 'other';
          const isSelected = selected === option;
          const isDisabled = disabled || (!!selected && selected !== option);
          return (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={isDisabled}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all duration-150',
                isSelected
                  ? 'bg-navy text-white border-navy shadow-md'
                  : isOther
                    ? 'bg-white text-navy border-navy/30 hover:border-navy hover:bg-navy/5'
                    : 'bg-white text-navy border-navy/20 hover:border-navy/60 hover:bg-navy/5',
                isDisabled && !isSelected && 'opacity-40 cursor-not-allowed',
                isOther && !isDisabled && 'flex items-center gap-1'
              )}
            >
              {isOther && <PenLine className="h-3 w-3" />}
              {option}
            </button>
          );
        })}
      </div>
      {showOtherInput && !selected && (
        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200">
          <input
            ref={inputRef}
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={handleOtherKeyDown}
            placeholder="Type your answer..."
            className="flex-1 h-9 px-3 text-xs rounded-lg border border-navy/20 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20 bg-white text-navy placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            className="h-9 px-4 bg-navy hover:bg-navy/90 text-white text-xs font-bold uppercase tracking-wider"
            onClick={handleOtherSubmit}
            disabled={!otherText.trim()}
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
};

interface MessageWithOptionsProps {
  message: Message;
  isLast: boolean;
  onSelect: (value: string) => void;
  isLoading: boolean;
  alreadyAnswered: boolean;
  patientLabel?: string;
}

const MessageWithOptions: React.FC<MessageWithOptionsProps> = ({
  message,
  isLast,
  onSelect,
  isLoading,
  alreadyAnswered,
  patientLabel,
}) => {
  const { cleanText, options } = useMemo(
    () => parseOptions(message.content),
    [message.content]
  );
  const cleanMessage = useMemo(
    () => ({ ...message, content: cleanText }),
    [message, cleanText]
  );
  const showOptions = options.length > 0 && isLast && !alreadyAnswered;
  return (
    <div>
      <ChatMessage message={cleanMessage} patientLabel={patientLabel} />
      {showOptions && (
        <div className="ml-2 mt-1 max-w-[85%]">
          <OptionButtons
            options={options}
            onSelect={onSelect}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
};

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  streamingContent,
  onSendMessage,
  isLoading,
  mode,
  showDisclaimer,
  onQuickReply,
  intakeComplete = false,
  onNewConsultation,
  onGoToDermatologistReview,
  patientLabel,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [messages.length, isLoading, streamingContent]);

  // FIX: Added 'payment_page' and 'doctor_patient' cases so the badge
  // never shows raw mode strings.
  const modeInfo = useMemo(() => {
    switch (mode) {
      case 'general_education':
        return { label: 'Educational Mode', variant: 'secondary' as const, color: 'text-muted-foreground' };
      case 'consent_clarification':
        return { label: 'Consent Mode', variant: 'default' as const, color: 'text-navy' };
      case 'post_payment_intake':
        return { label: 'Intake Mode', variant: 'default' as const, color: 'text-navy' };
      case 'dermatologist_review':
        return { label: 'Awaiting Review', variant: 'outline' as const, color: 'text-accent-blue' };
      case 'final_output':
        return { label: 'Consultation Complete', variant: 'default' as const, color: 'text-green-600' };
      // FIX: payment_page mode label
      case 'payment_page':
        return { label: 'Payment Required', variant: 'default' as const, color: 'text-amber-600' };
      // FIX: doctor_patient mode label
      case 'doctor_patient':
        return { label: 'Doctor Chat', variant: 'default' as const, color: 'text-navy' };
      default:
        return { label: mode, variant: 'secondary' as const, color: 'text-navy' };
    }
  }, [mode]);

  const showConsentConfirm = mode === 'consent_clarification';
  const aiReplyCount = messages.filter((m) => m.role === 'ai').length;
  const freeTierExhausted = mode === 'general_education' && aiReplyCount >= 3;

  // FIX: Also hide chat input during payment_page mode — user should not be able
  // to type while the payment overlay is open.
  const hideInput = showConsentConfirm || freeTierExhausted || mode === 'payment_page';
  const showNextStepCTA = mode === 'general_education' && aiReplyCount >= 1;

  const pinnedNote = useMemo(() => {
    if (mode === 'general_education') {
      return 'Free mode is text-only. AI responses are educational only — not medical advice.';
    }
    if (mode === 'dermatologist_review') {
      return 'Intake submitted. Dr. Attili will review your case shortly. You will be notified.';
    }
    if (mode === 'final_output') {
      return 'Consultation complete. You can view your final assessment above.';
    }
    // FIX: Informational note for doctor_patient mode
    if (mode === 'doctor_patient') {
      return 'You are now in a direct conversation with Dr. Attili.';
    }
    return null;
  }, [mode]);

  const lastAiMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'ai') return i;
    }
    return -1;
  }, [messages]);

  const patientAnsweredLast = useMemo(() => {
    if (lastAiMessageIndex === -1) return true;
    return messages
      .slice(lastAiMessageIndex + 1)
      .some((m) => m.role === 'patient' || m.role === 'user');
  }, [messages, lastAiMessageIndex]);

  const handleOptionSelect = (value: string) => {
    onSendMessage(value);
  };

  const handleGoToReview = () => {
    if (onGoToDermatologistReview) {
      onGoToDermatologistReview();
      return;
    }
    if (onQuickReply) {
      onQuickReply('YES');
      return;
    }
    onSendMessage('YES');
  };

  const handleConfirmPay = () => {
    if (onQuickReply) {
      onQuickReply('PAYNOW');
      return;
    }
    onSendMessage('PAYNOW');
  };

  const handleGoBack = () => {
    if (onQuickReply) {
      onQuickReply('DEFER');
      return;
    }
    onSendMessage('DEFER');
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-navy" />
          <h2 className="font-bold text-navy uppercase tracking-widest text-xs">
            Consultation Channel
          </h2>
        </div>
        <Badge
          className={cn(
            'font-bold uppercase text-[10px] tracking-tighter px-2 py-0.5',
            modeInfo.variant === 'default' ? 'bg-navy' : ''
          )}
          variant={modeInfo.variant}
        >
          {modeInfo.label}
        </Badge>
      </div>

      {pinnedNote && (
        <div className="bg-navy/5 border-b border-navy/10 px-4 py-2 flex items-start gap-2 flex-shrink-0 animate-in fade-in slide-in-from-top-1 duration-300">
          <Info className="h-3.5 w-3.5 text-navy flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-navy font-bold uppercase tracking-tight leading-relaxed">
            {pinnedNote}
          </p>
        </div>
      )}

      {showDisclaimer && (
        <div className="px-4 pt-4 pb-0 flex-shrink-0">
          <div className="bg-[#fdf5e6] border border-[#f5deb3]/50 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              Service Disclosure
            </p>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-600 italic">
              {DISCLAIMER}
            </pre>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 bg-gray-50/30 overflow-y-auto overflow-x-hidden">
        <div className="space-y-6 max-w-4xl mx-auto pb-4">
          {messages.map((message, index) => {
            if (message.role === 'ai') {
              const isLastAiMessage = index === lastAiMessageIndex;
              return (
                <MessageWithOptions
                  key={message.id}
                  message={message}
                  isLast={isLastAiMessage}
                  onSelect={handleOptionSelect}
                  isLoading={isLoading}
                  alreadyAnswered={patientAnsweredLast}
                  patientLabel={patientLabel}
                />
              );
            }
            return (
              <ChatMessage
                key={message.id}
                message={message}
                patientLabel={patientLabel}
              />
            );
          })}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 bg-navy rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-navy/60 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-navy/30 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
              <span>AI is typing...</span>
            </div>
          )}
          {streamingContent && !isLoading && (
            <ChatMessage
              message={{
                id: 'streaming-message',
                role: 'ai',
                content: streamingContent,
                timestamp: new Date(),
                isVisible: true,
                conversationId: '',
              }}
              isStreaming
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {showConsentConfirm && (
        <div className="border-t border-gray-100 bg-white p-6 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] flex-shrink-0 relative z-10">
          <div className="flex items-start gap-3 text-navy">
            <div className="bg-navy/10 p-2 rounded-full flex-shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight">
                Clinical Consent Required
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                By clicking confirm, you agree to proceed with a paid consultation which includes a specialist dermatological review.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 border-gray-200 text-navy font-bold uppercase text-xs tracking-widest"
              onClick={handleGoBack}
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
            </Button>
            <Button
              className="flex-1 h-11 bg-navy hover:bg-navy/90 text-white font-bold uppercase text-xs tracking-widest shadow-lg shadow-navy/20"
              onClick={handleConfirmPay}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Confirm & Pay
            </Button>
          </div>
        </div>
      )}

      {/* FIX: Show a "Proceed to Payment" CTA banner when mode is payment_page
          so the user has a clear action even inside the chat view */}
      {mode === 'payment_page' && !showConsentConfirm && (
        <div className="border-t border-amber-100 bg-amber-50 p-5 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full flex-shrink-0">
              <CreditCard className="h-4 w-4 text-amber-700" />
            </div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-tight flex-1">
              Payment required to proceed with the specialist review.
            </p>
          </div>
        </div>
      )}

      {showNextStepCTA && !freeTierExhausted && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-white to-[#f8f9fc] p-5 space-y-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.08)] flex-shrink-0 relative z-10">
          <div className="flex items-start gap-3">
            <div className="bg-navy/10 p-2 rounded-full shrink-0">
              <Stethoscope className="h-4 w-4 text-navy" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy tracking-tight">
                Would you like a specialist review?
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Get a full dermatologist-reviewed assessment including diagnosis, treatment framework, and personalised insights. Click below to proceed.
              </p>
            </div>
          </div>
          <Button
            className="w-full h-11 bg-navy hover:bg-navy/90 text-white font-bold uppercase text-xs tracking-widest shadow-lg shadow-navy/20"
            onClick={handleGoToReview}
            disabled={isLoading}
          >
            <Stethoscope className="h-3.5 w-3.5 mr-2" />
            Go to Dermatologist Review <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {freeTierExhausted && (
        <div className="border-t border-gray-100 bg-white p-6 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] flex-shrink-0 relative z-10">
          <div className="flex items-start gap-3">
            <div className="bg-accent-blue/10 p-2 rounded-full flex-shrink-0">
              <Stethoscope className="h-5 w-5 text-accent-blue" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight text-navy">
                Free Insight Limit Reached
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Please upgrade to a specialist review by Dr. Attili to continue receiving expert assessments.
              </p>
            </div>
          </div>
          <Button
            className="w-full h-12 bg-[#16437E] hover:bg-[#0d2d5a] text-white font-bold uppercase text-xs tracking-widest shadow-xl shadow-navy/20"
            onClick={handleGoToReview}
            disabled={isLoading}
          >
            <Stethoscope className="h-3.5 w-3.5 mr-2" />
            Go to Dermatologist Review <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {mode === 'final_output' && onNewConsultation && (
        <div className="border-t border-gray-100 bg-white p-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] flex-shrink-0 relative z-10">
          <Button
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold uppercase text-xs tracking-widest shadow-xl shadow-green-900/20"
            onClick={onNewConsultation}
          >
            <Plus className="h-4 w-4 mr-2" /> Start New Consultation
          </Button>
        </div>
      )}

      {!hideInput && (
        <div className="flex-shrink-0 relative z-10">
          <ChatInput
            onSend={onSendMessage}
            isLoading={isLoading}
            mode={mode}
            disabled={false}
          />
        </div>
      )}
    </div>
  );
};
