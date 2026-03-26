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
  ShieldCheck,
  ArrowLeft,
  ImageOff,
  ChevronRight,
  Lock,
  Stethoscope,
  CreditCard,
  Info,
} from 'lucide-react';

interface ChatContainerProps {
  messages: Message[];
  streamingContent: string;
  onSendMessage: (content: string, images?: string[]) => Promise<void> | void;
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
  onConfirmGoBack?: () => void;
  freeTierExhausted?: boolean;
  freeAiReplyCount?: number;
  intakeComplete?: boolean;
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
  onConfirmGoBack,
  freeTierExhausted = false,
  freeAiReplyCount = 0,
  intakeComplete = false,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isLoading]);

  const modeInfo = useMemo(() => {
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
  }, [mode]);

  const hideInput =
    privacyFlagged ||
    showConsentButtons ||
    showConfirmPayment ||
    freeTierExhausted;

  const pinnedNote =
    mode === 'general_education'
      ? 'Free mode is text-only. AI responses are educational only — not medical advice. Dermatologists are significantly better at interpreting skin patterns.'
      : mode === 'dermatologist_review' && intakeComplete
        ? 'Intake submitted. Dr. Attili will review your case. You may add any additional information or images below.'
        : null;

  const showPrivacyPanel = privacyFlagged;
  const showConfirmPanel = !showPrivacyPanel && showConfirmPayment;
  const showUpgradePanel =
    !showPrivacyPanel && !showConfirmPanel && showUpgradeButton;
  const showExhaustedPanel =
    !showPrivacyPanel &&
    !showConfirmPanel &&
    !showUpgradePanel &&
    freeTierExhausted;
  const showDurationPanel =
    !showPrivacyPanel && !showConfirmPanel && showDurationChips;
  const showYesNoPanel =
    !showPrivacyPanel && !showConfirmPanel && showYesNo;
  const showProceedPanel =
    !showPrivacyPanel && !showConfirmPanel && showProceedNoImages;

  const isCheckingImages =
    isLoading &&
    mode === 'post_payment_intake' &&
    !streamingContent;

  const loadingLabel = isCheckingImages
    ? 'Checking images for faces or personal information…'
    : 'AI is typing…';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Skin Consultation</h2>
          <p className="text-xs text-muted-foreground">
            OnlineSkinSpecialist.com
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'general_education' && freeAiReplyCount > 0 && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                freeAiReplyCount >= 3
                  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                  : freeAiReplyCount === 2
                    ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {freeAiReplyCount}/3 free
            </span>
          )}

          <Badge variant={modeInfo.variant}>{modeInfo.label}</Badge>
        </div>
      </div>

      {pinnedNote && (
        <div className="border-b border-border bg-amber-50 dark:bg-amber-950/20 px-4 py-2 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            {pinnedNote}
          </p>
        </div>
      )}

      {showDisclaimer && (
        <div className="px-4 pt-4 pb-0 flex-shrink-0">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
              {DISCLAIMER}
            </pre>
            <p className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700 text-xs font-medium text-amber-800 dark:text-amber-200">
              ⓘ Free educational mode includes up to 3 AI responses. After that,
              you can connect directly with Dr. Attili for a full dermatologist review.
            </p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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
                <span
                  className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
              <span>{loadingLabel}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showPrivacyPanel && (
        <div className="border-t border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Privacy Warning
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Your images may contain identifiable personal information.
                Please remove and re-upload without faces, documents, or names visible.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-100 font-medium"
              onClick={onPrivacyRemove}
              disabled={isLoading}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Remove &amp; Re-upload
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-50 font-medium"
              onClick={onPrivacyOverride}
              disabled={isLoading}
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              I Confirm — Not Identifiable
            </Button>
          </div>
        </div>
      )}

      {showConfirmPanel && onConfirmPayment && (
        <div className="border-t border-border bg-card px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <CreditCard className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Proceed to Dermatologist Review
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You'll be taken to the payment page to complete your consultation
                booking with Dr. Attili.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground font-medium shrink-0"
              onClick={onConfirmGoBack}
              disabled={isLoading}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Go back
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 shrink-0"
              onClick={onConfirmPayment}
              disabled={isLoading}
            >
              <CreditCard className="h-3.5 w-3.5 mr-2" />
              I confirm — proceed to payment
              <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {showUpgradePanel && onUpgradeClick && (
        <div className="border-t border-border bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <Stethoscope className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Get a full dermatologist review
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dr. Attili will personally review your case including images for
                an accurate clinical assessment.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
            onClick={onUpgradeClick}
            disabled={isLoading}
          >
            <Stethoscope className="h-3.5 w-3.5 mr-2" />
            Yes, continue with dermatologist review
            <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {showExhaustedPanel && (
        <div className="border-t border-border bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <Lock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Free responses used
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've used all 3 free educational responses. Connect with Dr. Attili
                for a full image-based dermatologist review.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
            onClick={onUpgradeClick}
            disabled={isLoading}
          >
            <Stethoscope className="h-3.5 w-3.5 mr-2" />
            Yes, get dermatologist review
            <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {showDurationPanel && onQuickReply && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Select duration:
          </p>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((option) => (
              <Button
                key={option}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => onQuickReply(option)}
                disabled={isLoading}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      )}

      {showYesNoPanel && onQuickReply && (
        <div className="px-4 pb-3 pt-3 flex gap-2 bg-card border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-green-300 text-green-700 hover:bg-green-50 font-semibold"
            onClick={() => onQuickReply('Yes')}
            disabled={isLoading}
          >
            Yes
          </Button>

          <Button
            type="button"
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50 font-semibold"
            onClick={() => onQuickReply('No')}
            disabled={isLoading}
          >
            No
          </Button>
        </div>
      )}

      {showProceedPanel && onProceedNoImages && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            No images? Continue with text-only assessment.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10 font-medium"
            onClick={onProceedNoImages}
            disabled={isLoading}
          >
            <ImageOff className="h-3.5 w-3.5 mr-1.5" />
            Proceed without images
          </Button>
        </div>
      )}

      {intakeComplete && mode === 'dermatologist_review' && !hideInput && (
        <div className="px-4 pt-3 pb-1 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground font-medium">
            Add any additional information or images for the dermatologist:
          </p>
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
