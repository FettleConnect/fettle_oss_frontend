import React, { useRef, useEffect } from 'react';
import { Message, ConversationMode, DISCLAIMER } from '@/types/dermatology';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ShieldCheck, ArrowLeft, ImageOff, ArrowUpCircle, Lock } from 'lucide-react';

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
  // Fix 1: upgrade button in MODE 1
  showUpgradeButton?: boolean;
  onUpgradeClick?: () => void;
  // Fix 2: consent two-button layout
  showConsentButtons?: boolean;
  onConsentProceed?: () => void;
  // Fix 4: free tier exhausted
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

  // Input is hidden in consent mode (Fix 2) and when free tier is exhausted (Fix 4)
  const hideInput = privacyFlagged || showConsentButtons || freeTierExhausted || isWaitingForDoctor;

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

      {/* Privacy flag banner */}
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
        <div className="px-4 pb-2 pt-3 bg-card border-t border-border">
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

      {/* Yes/No quick reply */}
      {!privacyFlagged && showYesNo && onQuickReply && (
        <div className="px-4 pb-2 flex gap-2 bg-card border-t border-border pt-3">
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
            No images available? You can continue with a text-only assessment.
          </p>
          <Button
            type="button" variant="outline" size="sm"
            className="w-full border-primary/30 text-primary hover:bg-primary/10 font-medium"
            onClick={onProceedNoImages} disabled={isLoading}
          >
            <ImageOff className="h-3.5 w-3.5 mr-1.5" />
            Proceed without images
          </Button>
        </div>
      )}

      {/* Fix 4: Free tier exhausted banner */}
      {freeTierExhausted && !showConsentButtons && (
        <div className="border-t border-border bg-card px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Free consultation limit reached</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've used your 3 free AI responses. To continue and connect directly with Dr. Attili for a full dermatologist review, please proceed to payment.
              </p>
            </div>
          </div>
          {showUpgradeButton && onUpgradeClick && (
            <Button
              type="button" variant="default" size="sm"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={onUpgradeClick} disabled={isLoading}
            >
              <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
              Yes, get dermatologist review
            </Button>
          )}
        </div>
      )}

      {/* Fix 1: Upgrade button after every AI reply in MODE 1 (not exhausted) */}
      {!freeTierExhausted && showUpgradeButton && onUpgradeClick && !showConsentButtons && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border">
          <Button
            type="button" variant="default" size="sm"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={onUpgradeClick} disabled={isLoading}
          >
            <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />
            Yes, get dermatologist review
          </Button>
        </div>
      )}

      {/* Fix 2: Consent mode — two buttons, no free text input */}
      {showConsentButtons && onConsentProceed && (
        <div className="px-4 pb-3 pt-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            This provides a dermatologist-prepared educational overview — not medical advice.
          </p>
          <div className="flex gap-2">
            {showGoBack && onGoBack && (
              <Button
                type="button" variant="outline" size="sm"
                className="border-gray-300 text-gray-600 hover:bg-gray-50 font-medium"
                onClick={onGoBack} disabled={isLoading}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Go back
              </Button>
            )}
            <Button
              type="button" variant="default" size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={onConsentProceed} disabled={isLoading}
            >
              I understand — proceed to payment
            </Button>
          </div>
        </div>
      )}

      {/* Input — hidden in consent mode, free tier exhausted, privacy flag, waiting for doctor */}
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
