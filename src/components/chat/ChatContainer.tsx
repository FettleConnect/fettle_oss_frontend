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
        return { label: 'Educational Mode', variant: 'secondary' as const };
      case 'consent_clarification':
        return { label: 'Consent Mode', variant: 'default' as const };
      case 'post_payment_intake':
        return { label: 'Intake Mode', variant: 'default' as const };
      case 'dermatologist_review':
        return { label: 'Awaiting Review', variant: 'outline' as const };
      case 'final_output':
        return { label: 'Consultation Complete', variant: 'default' as const };
      default:
        return { label: mode, variant: 'secondary' as const };
    }
  }, [mode]);

  const lastAiContent = useMemo(() => {
    const aiMsgs = messages.filter(m => m.role === 'ai');
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1].content.toLowerCase() : '';
  }, [messages]);

  const showConsentConfirm = mode === 'consent_clarification';
  const showIntakeComplete = mode === 'post_payment_intake' && lastAiContent.includes('intake complete');
  
  // Free mode exhausts after 3 AI replies (including disclaimer message if it's role ai? No, messages usually start after user)
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
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Skin Consultation</h2>
          <p className="text-xs text-muted-foreground">OnlineSkinSpecialist.com</p>
        </div>
        <Badge variant={modeInfo.variant}>{modeInfo.label}</Badge>
      </div>

      {pinnedNote && (
        <div className="border-b border-border bg-amber-50 dark:bg-amber-950/20 px-4 py-2 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{pinnedNote}</p>
        </div>
      )}

      {showDisclaimer && (
        <div className="px-4 pt-4 pb-0 flex-shrink-0">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{DISCLAIMER}</pre>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>AI is typing...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showConsentConfirm && onQuickReply && (
        <div className="border-t border-border bg-card p-4 space-y-3">
          <div className="flex items-start gap-2 text-amber-600">
            <ShieldCheck className="h-5 w-5 mt-0.5" />
            <p className="text-sm font-medium">Please confirm your consent to proceed with the paid consultation.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onQuickReply('No')} disabled={isLoading}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Cancel
            </Button>
            <Button variant="default" className="flex-1" onClick={() => onQuickReply('CONFIRM')} disabled={isLoading}>
              <CheckCircle className="h-4 w-4 mr-2" /> CONFIRM
            </Button>
          </div>
        </div>
      )}

      {freeTierExhausted && (
        <div className="border-t border-border bg-gradient-to-r from-primary/5 to-primary/10 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Stethoscope className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Free responses exhausted</p>
              <p className="text-xs text-muted-foreground">Type YES to proceed to a full dermatologist-prepared assessment.</p>
            </div>
          </div>
          <Button variant="default" className="w-full" onClick={() => onQuickReply?.('YES')} disabled={isLoading}>
            Yes, get dermatologist review <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {mode === 'final_output' && onNewConsultation && (
        <div className="border-t border-border bg-green-50 dark:bg-green-900/10 p-4">
          <Button variant="default" className="w-full bg-green-600 hover:bg-green-700" onClick={onNewConsultation}>
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
