import React from 'react';
import { Message } from '@/types/dermatology';
import { cn } from '@/lib/utils';
import { Bot, User, Stethoscope } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming }) => {
  const isPatient = message.role === 'patient';
  const isDoctor = message.role === 'doctor';
  const isSystem = message.role === 'system';
  const isAI = message.role === 'ai';

  const formatContent = (text: string | null | undefined): string => {
    if (!text) return '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized
      .split('\n')
      .map(line => {
        const trimmed = line.trimEnd();
        const content = trimmed.trim();

        if (content.length < 2) return line;

        // Bold standalone headings (nothing after colon, max 60 chars)
        if (content.length <= 60 && /^(\d+\.\s+)?[A-Z][A-Za-z\s\/\-\(\)]+:?\s*$/.test(content)) {
          return `**${content}**`;
        }

        // Bold lettered sub-headings: "A. First-line topical therapy:"
        if (content.length <= 60 && /^[A-Z]\.\s+[A-Z][A-Za-z\s\/\-\(\)]+:?\s*$/.test(content)) {
          return `**${content}**`;
        }

        // Bold lines where heading is followed by text e.g. "Note: some text..."
        // Matches "Note:", "Summary:", "To help you...:", "You can find...:" etc.
        if (/^(Note|Summary|Diagnosis|Assessment|Plan|Warning|Important|Tip|Recommendations?|To help you[^:]*|You can find[^:]*|For in-depth[^:]*|Clinical Rationale[^:]*|Mechanism of Action[^:]*):\s*.+/.test(content)) {
          return line.replace(/^([^:]+:)/, '**$1**');
        }

        return line;
      })
      .join('\n');
  };

  const getRoleLabel = () => {
    if (message.senderName) return message.senderName;
    if (isPatient) return 'You';
    if (isDoctor) return 'Doctor';
    if (isSystem) return 'System Notification';
    return 'AI Educational Assistant';
  };

  const getRoleIcon = () => {
    if (isPatient) return <User className="h-4 w-4" />;
    if (isDoctor) return <Stethoscope className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  const getBubbleColors = () => {
    if (isPatient) return 'bg-muted text-foreground';
    if (isDoctor) return 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100';
    if (isSystem) return 'bg-blue-50 text-blue-900 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-900/30';
    return 'bg-primary/10 text-foreground';
  };

  const getLabelColors = () => {
    if (isPatient) return 'text-muted-foreground';
    if (isDoctor) return 'text-green-700 dark:text-green-300';
    if (isSystem) return 'text-blue-700 dark:text-blue-300';
    return 'text-primary';
  };

  if (isSystem) {
    return (
      <div className="flex flex-col items-center gap-2 w-full my-4">
        <div className={cn('rounded-lg px-6 py-3 text-sm text-center font-medium max-w-[90%]', getBubbleColors())}>
          {message.content ?? ''}
        </div>
      </div>
    );
  }

  const safeContent = message.content ?? '';
  const renderedContent = (isDoctor || isAI) ? formatContent(safeContent) : safeContent;

  return (
    <div className={cn('flex flex-col gap-1 max-w-[85%]', isPatient ? 'ml-auto items-end' : 'mr-auto items-start')}>
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', getLabelColors())}>
        {getRoleIcon()}
        <span>{getRoleLabel()}</span>
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-none',
        getBubbleColors(),
        isPatient ? 'rounded-br-md' : 'rounded-bl-md'
      )}>
        <ReactMarkdown
          components={{
            p: ({ node, ...props }) => (
              <p className="whitespace-pre-wrap mb-2 last:mb-0" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-bold" {...props} />
            ),
          }}
        >
          {renderedContent}
        </ReactMarkdown>

        {message.images && message.images.length > 0 && (
          <div className={cn("grid gap-2 mt-3", message.images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {message.images.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-black/5 hover:opacity-90 transition-opacity">
                <img src={url} alt="Attached clinical image" className="w-full h-auto object-cover max-h-64" />
              </a>
            ))}
          </div>
        )}

        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />
        )}
      </div>

      <span className="text-xs text-muted-foreground">
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};
