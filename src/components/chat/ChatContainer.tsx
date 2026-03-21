import React, { useRef, useEffect } from 'react';
import { Message, ConversationMode, DISCLAIMER } from '@/types/dermatology';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

      {/* ✅ Duration chip buttons — shown when AI asks "how long has this skin concern" */}
      {showDurationChips && onQuickReply && (
        <div className="px-4 pb-2 pt-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Select duration:</p>
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

      {/* ✅ Yes/No quick reply buttons — shown for yes/no intake questions */}
      {showYesNo && onQuickReply && (
        <div className="px-4 pb-2 flex gap-2 bg-card border-t border-border pt-3">
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

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        isLoading={isLoading}
        mode={mode}
        disabled={isWaitingForDoctor}
      />
    </div>
  );
};
