import React, { useRef, useEffect } from 'react';
import { Message, ConversationMode, DISCLAIMER } from '@/types/dermatology';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, RefreshCw, ShieldCheck,
  ArrowLeft, ImageOff, ChevronRight, Lock, Stethoscope, CreditCard
} from 'lucide-react';

interface ChatContainerProps {
  messages: Message[];
  streamingContent: string;
  onSendMessage: (content: string, images?: string[]) => void;
  isLoading: boolean;
  mode: ConversationMode;
  showDisclaimer: boolean;
  showYesNo?: boolean;
  onQuickReply?: (reply: string) => void;
  showDurationChips?: boolean;
  durationOptions?: string[];
  privacyFlagged?: boolean;
  onPrivacyRemove?: () => void;
  onPrivacyOverride?: () => void;
  showGoBack?: boolean;
  onGoBack?: () => void;
  showProceedNoImages?: boolean;
  onProceedNoImages?: () => void;
  showUpgradeButton?: boolean;
  onUpgradeClick?: () => void;
  showConsentButtons?: boolean;
  onConsentProceed?: () => void;
  showConfirmPayment?: boolean;
  onConfirmPayment?: () => void;
  freeTierExhausted?: boolean;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  streamingContent,
  onSendMessage,
  isLoading,
  mode,
  showDisclaimer,
  showYesNo = false,
  onQuickReply,
  showDurationChips = false,
  durationOptions = [],
  privacyFlagged = false,
  onPrivacyRemove,
  onPrivacyOverride,
  showGoBack = false,
  onGoBack,
  showProceedNoImages = false,
  onProceedNoImages,
  showUpgradeButton = false,
  onUpgradeClick,
  showConsentButtons = false,
  onConsentProceed,
  showConfirmPayment = false,
  onConfirmPayment,
  freeTierExhausted = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const getModeLabel = () => {
    switch (mode) {
      case 'general_education':
        return { label: 'Educational Mode', variant: 'secondary' as const };
      case 'post_payment_intake':
        return { label: 'Intake Mode', variant: 'default' as const };
      case 'dermatologist_review':
        return { label: 'Awaiting Review', variant: 'outline' as const };
      case 'final_output':
        return { label: 'Consultation Complete', variant: 'default' as const };
      default:
        return { label: mode, variant: 'secondary' as const };
    }
  };

  const modeInfo = getModeLabel();
  const isWaitingForDoctor = mode === 'dermatologist_review';
  const hideInput = privacyFlagged || showConsentButtons || showConfirmPayment || freeTierExhausted || isWaitingForDoctor;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Skin Consultation</h2>
          <p className="text-xs text-muted-foreground">OnlineSkinSpecialist.com</p>
        </div>
        <Badge variant={modeInfo.variant}>{modeInfo.label}</Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {showDisclaimer && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
              <pre className="whitespace-pre-wrap font-sans">{DISCLAIMER}</pre>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {streamingContent && (
            <ChatMessage
              message={{
                id: 'streaming',
                conversationId: '',
                role: 'ai',
                content: streamingContent,
                timestamp: new Date(),
                isVisible: true,
              }}
              isStreaming
            />
          )}

          {isLoading && !streamingContent && (
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

      {/* ── Bottom action area ── */}

      {/* Privacy flag */}
      {privacyFlagged && (
        <div className="border-t border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Privacy Warning</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Your images may contain identifiable personal information. Please remove and re-upload without faces, documents, or names visible.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button" variant="outline" size="sm"
              className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-100 font-medium"
              onClick={onPrivacyRemove} disabled={isLoading}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Remove &amp; Re-upload
            </Button>
            <Button
              type="button" variant="outline" size="sm"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-50 font-medium"
              onClick={onPrivacyOverride} disabled={isLoading}
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              I Confirm — Not Identifiable
            </Button>
          </div>
        </div>
      )}

      {/* Duration chips */}
      {!privacyFlagged && showDurationChips && onQuickReply && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Select duration:</p>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((option) => (
              <Button
                key={option} type="button" variant="outline" size="sm"
                className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => onQuickReply(option)} disabled={isLoading}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Yes/No */}
      {!privacyFlagged && showYesNo && onQuickReply && (
        <div className="px-4 pb-3 pt-3 flex gap-2 bg-card border-t border-border">
          <Button
            type="button" variant="outline"
            className="flex-1 border-green-300 text-green-700 hover:bg-green-50 font-semibold"
            onClick={() => onQuickReply('Yes')} disabled={isLoading}
          >
            Yes
          </Button>
          <Button
            type="button" variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50 font-semibold"
            onClick={() => onQuickReply('No')} disabled={isLoading}
          >
            No
          </Button>
        </div>
      )}

      {/* Proceed without images */}
      {!privacyFlagged && showProceedNoImages && onProceedNoImages && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            No images? Continue with text-only assessment.
          </p>
          <Button
            type="button" variant="outline" size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10 font-medium"
            onClick={onProceedNoImages} disabled={isLoading}
          >
            <ImageOff className="h-3.5 w-3.5 mr-1.5" />
            Proceed without images
          </Button>
        </div>
      )}

      {/* Free tier exhausted */}
      {freeTierExhausted && !showConsentButtons && !showConfirmPayment && (
        <div className="border-t border-border bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <Lock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Free responses used</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect with Dr. Attili for a full image-based dermatologist review.
              </p>
            </div>
          </div>
          {showUpgradeButton && onUpgradeClick && (
            <div className="flex items-center justify-start">
              <Button
                type="button" variant="default" size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
                onClick={onUpgradeClick} disabled={isLoading}
              >
                <Stethoscope className="h-3.5 w-3.5 mr-2" />
                Yes, get dermatologist review
                <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upgrade button after every AI reply in MODE 1 (not exhausted) */}
      {!freeTierExhausted && showUpgradeButton && onUpgradeClick && !showConsentButtons && !showConfirmPayment && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground shrink-0">Want a specialist review?</p>
          <Button
            type="button" variant="default" size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 shrink-0"
            onClick={onUpgradeClick} disabled={isLoading}
          >
            <Stethoscope className="h-3.5 w-3.5 mr-2" />
            Yes, get dermatologist review
            <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* Consent mode — two buttons, no free-text input */}
      {showConsentButtons && onConsentProceed && (
        <div className="border-t border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-3">
            This provides a dermatologist-prepared educational overview — not medical advice.
          </p>
          <div className="flex items-center gap-2">
            {showGoBack && onGoBack && (
              <Button
                type="button" variant="ghost" size="sm"
                className="text-muted-foreground hover:text-foreground font-medium shrink-0"
                onClick={onGoBack} disabled={isLoading}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Go back
              </Button>
            )}
            <Button
              type="button" variant="default" size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 shrink-0"
              onClick={onConsentProceed} disabled={isLoading}
            >
              <Stethoscope className="h-3.5 w-3.5 mr-2" />
              I understand — proceed
              <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm payment — shown after consent acknowledged, before PaymentPage mounts */}
      {showConfirmPayment && onConfirmPayment && (
        <div className="border-t border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-3">
            You're ready to proceed. Click below to open the payment page.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="ghost" size="sm"
              className="text-muted-foreground hover:text-foreground font-medium shrink-0"
              onClick={() => {
                // Re-show consent buttons
                if (onGoBack) onGoBack();
              }}
              disabled={isLoading}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Go back
            </Button>
            <Button
              type="button" variant="default" size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 shrink-0"
              onClick={onConfirmPayment} disabled={isLoading}
            >
              <CreditCard className="h-3.5 w-3.5 mr-2" />
              Confirm — proceed to payment
              <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Chat input */}
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
