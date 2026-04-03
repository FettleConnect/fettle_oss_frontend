import React, { useRef, useEffect, useMemo } from 'react';
import { Message, ConversationMode, DISCLAIMER } from '@/types/dermatology';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Info,
  CheckCircle,
  Plus,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';

interface ChatContainerProps {
  messages: Message[];
  streamingContent: string;
  onSendMessage: (content: string, images?: string[]) => Promise<void> | void;
  isLoading: boolean;
  mode: ConversationMode;
  showDisclaimer: boolean;
  onQuickReply?: (reply: string) => void;
  intakeComplete?: boolean;
  onNewConsultation?: () => void;
}

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
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isLoading]);

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
      default:
        return { label: mode, variant: 'secondary' as const, color: 'text-navy' };
    }
  }, [mode]);

  const lastAiContent = useMemo(() => {
    const aiMsgs = messages.filter(m => m.role === 'ai');
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1].content.toLowerCase() : '';
  }, [messages]);

  const showConsentConfirm = mode === 'consent_clarification';
  
  const aiReplyCount = messages.filter(m => m.role === 'ai').length;
  const freeTierExhausted = mode === 'general_education' && aiReplyCount >= 3;

  const hideInput = showConsentConfirm || freeTierExhausted;

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
    return null;
  }, [mode]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-gray-100 bg-white px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-navy" />
          <h2 className="font-bold text-navy uppercase tracking-widest text-xs">Consultation Channel</h2>
        </div>
        <Badge className={cn("font-bold uppercase text-[10px] tracking-tighter px-2 py-0.5", modeInfo.variant === 'default' ? 'bg-navy' : '')} variant={modeInfo.variant}>
          {modeInfo.label}
        </Badge>
      </div>

      {pinnedNote && (
        <div className="bg-navy/5 border-b border-navy/10 px-4 py-2 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
          <Info className="h-3.5 w-3.5 text-navy flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-navy font-bold uppercase tracking-tight leading-relaxed">{pinnedNote}</p>
        </div>
      )}

      {showDisclaimer && (
        <div className="px-4 pt-4 pb-0 flex-shrink-0">
          <div className="bg-[#fdf5e6] border border-[#f5deb3]/50 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              Service Disclosure
            </p>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-600 italic">{DISCLAIMER}</pre>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4 bg-gray-50/30">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 text-navy font-bold text-[10px] uppercase tracking-widest ml-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-navy rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-navy/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-navy/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Dermatological Assistant is thinking</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showConsentConfirm && onQuickReply && (
        <div className="border-t border-gray-100 bg-white p-6 space-y-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="flex items-start gap-3 text-navy">
            <div className="bg-navy/10 p-2 rounded-full">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight">Clinical Consent Required</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                By clicking confirm, you agree to proceed with a paid consultation which includes a specialist dermatological review.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-11 border-gray-200 text-navy font-bold uppercase text-xs tracking-widest" onClick={() => onQuickReply('No')} disabled={isLoading}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Defer
            </Button>
            <Button className="flex-1 h-11 bg-navy hover:bg-navy/90 text-white font-bold uppercase text-xs tracking-widest shadow-lg shadow-navy/20" onClick={() => onQuickReply('CONFIRM')} disabled={isLoading}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirm & Pay
            </Button>
          </div>
        </div>
      )}

      {freeTierExhausted && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-white to-gray-50 p-6 space-y-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="flex items-start gap-3">
            <div className="bg-accent-blue/10 p-2 rounded-full">
              <Stethoscope className="h-5 w-5 text-accent-blue" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight text-navy">Free Consultation Threshold Reached</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                You have received the maximum allowed free insights. Please upgrade to a full review by Dr. Attili to continue.
              </p>
            </div>
          </div>
          <Button className="w-full h-12 bg-[#16437E] hover:bg-[#0d2d5a] text-white font-bold uppercase text-xs tracking-widest shadow-xl shadow-navy/20" onClick={() => onQuickReply?.('YES')} disabled={isLoading}>
            Upgrade to Specialist Review <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {mode === 'final_output' && onNewConsultation && (
        <div className="border-t border-gray-100 bg-white p-6 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold uppercase text-xs tracking-widest shadow-xl shadow-green-900/20" onClick={onNewConsultation}>
            <Plus className="h-4 w-4 mr-2" /> Start New Consultation
          </Button>
        </div>
      )}

      {!hideInput && (
        <ChatInput
          onSend={onSendMessage}
          isLoading={isLoading}
          mode={mode}
          disabled={false}
        />
      )}
    </div>
  );
};
