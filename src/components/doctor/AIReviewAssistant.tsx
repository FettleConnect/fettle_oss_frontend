import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, X } from 'lucide-react';
import { BASE_URL } from '@/base_url';
import ReactMarkdown from 'react-markdown';

interface AIReviewAssistantProps {
  onClose: () => void;
  contextData: string;
  conversationId: string;
  onApplyContent?: (content: string) => void;
  editorContent?: string;
  prefillMessage?: string;
  onPrefillConsumed?: () => void;
}

interface AssistantMessage {
  role: 'ai' | 'user';
  content: string;
}

const CHAT_MODE_PROMPT = `
You are assisting a dermatologist.

RULES:
- Respond conversationally.
- Answer the doctor's question directly.
- DO NOT generate full draft unless explicitly asked.
- Be concise and clinical.
`;

export const AIReviewAssistant: React.FC<AIReviewAssistantProps> = ({
  onClose,
  contextData,
  conversationId,
  onApplyContent,
  editorContent,
  prefillMessage,
  onPrefillConsumed,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'ai',
      content:
        'Ask me anything about this case. I can modify the diagnosis, refine the draft, or answer clinical reasoning questions.',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasConsumedPrefill = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [messages, isLoading]);

  useEffect(() => {
    if (
      prefillMessage &&
      prefillMessage.trim() &&
      !hasConsumedPrefill.current
    ) {
      hasConsumedPrefill.current = true;
      setInput(prefillMessage);
      onPrefillConsumed?.();
    }
  }, [prefillMessage, onPrefillConsumed]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();

    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('DoctorToken');

      const formData = new FormData();
      formData.append('id', conversationId);
      formData.append('question', userMsg);
      formData.append('systemPrompt', CHAT_MODE_PROMPT);
      formData.append('contextData', contextData);
      formData.append('currentDraft', editorContent || '');

      const res = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      const data = await res.json();

      const aiText =
        data?.result?.trim() ||
        data?.response?.trim() ||
        data?.message?.trim() ||
        'No response';

      setMessages((prev) => [...prev, { role: 'ai', content: aiText }]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'Error getting AI response' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (content: string) => {
    onApplyContent?.(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none relative">
      <CardHeader className="relative border-b pr-14">
        <CardTitle className="flex gap-2 items-center text-sm md:text-base">
          <Bot className="h-4 w-4" />
          AI Assistant
        </CardTitle>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-3 top-3 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {m.role === 'ai' && i > 0 && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApply(m.content)}
                      >
                        Apply to Editor
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
                  AI is typing...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm bg-background"
              placeholder="Ask AI about this case..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
