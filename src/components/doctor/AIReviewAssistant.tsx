// 🔥 FULL FIXED FILE

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
}

const CHAT_MODE_PROMPT = `
You are assisting a dermatologist.

RULES:
- Respond conversationally.
- Answer the doctor's question directly.
- DO NOT generate full draft unless explicitly asked.
- Be concise and clinical.
`;

const STRUCTURED_PROMPT = `
You are assisting a dermatologist.

Generate a COMPLETE structured dermatology draft.

Use EXACT sections:

Most Consistent With

Close Differentials

Morphologic Justification

Educational Treatment Framework

Typical Course and Prognosis

When In-Person Evaluation Is Considered

Educational References

Rules:
- No placeholders
- No brackets (if any, if relevant)
- Paragraph format
- Clean professional output
`;

export const AIReviewAssistant: React.FC<AIReviewAssistantProps> = ({
  onClose,
  contextData,
  conversationId,
  onApplyContent,
  editorContent,
}) => {
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'ai',
      content: "Ask me anything about this case. I can modify the diagnosis, refine the draft, or answer clinical reasoning questions.",
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('DoctorToken');

      const formData = new FormData();
      formData.append('id', conversationId);
      formData.append('question', userMsg);

      // ✅ IMPORTANT: CHAT MODE PROMPT (NOT STRUCTURED)
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
        data.result || data.response || data.message || 'No response';

      setMessages(prev => [...prev, { role: 'ai', content: aiText }]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: 'Error getting AI response' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 APPLY BUTTON → STRUCTURED MODE
  const handleApply = async (content: string) => {
    try {
      const authToken = localStorage.getItem('DoctorToken');

      const formData = new FormData();
      formData.append('id', conversationId);
      formData.append('question', content);

      // ✅ STRUCTURED MODE ONLY HERE
      formData.append('systemPrompt', STRUCTURED_PROMPT);

      formData.append('contextData', contextData);
      formData.append('currentDraft', editorContent || '');

      const res = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      const data = await res.json();

      const structured =
        data.result || data.response || data.message || '';

      onApplyContent?.(structured);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="flex gap-2 items-center">
          <Bot className="h-4 w-4" /> AI Assistant
        </CardTitle>
        <Button size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i}>
                <div className="text-sm">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>

                {m.role === 'ai' && i > 0 && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => handleApply(m.content)}
                  >
                    Apply to Editor
                  </Button>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2 mt-3">
          <input
            className="flex-1 border rounded px-2 py-1"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <Button onClick={handleSend} disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
