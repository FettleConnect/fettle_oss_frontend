import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, X } from 'lucide-react';
import { BASE_URL } from '@/base_url';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
You are Module 3: AI Clinical Analysis for dermatologist review only.
THIS OUTPUT IS STRICTLY FOR DERMATOLOGIST REVIEW AND MUST NOT BE SHOWN TO THE PATIENT.

Rules:
- You may suggest a most likely diagnosis
- Provide a ranked differential diagnosis list
- Use standard dermatological reasoning
- Be concise, structured, and clinically precise
- Do NOT include treatment instructions
- Do NOT include patient-facing explanations
- Do NOT use lay language

For any question involving diagnosis, differential, morphology, investigations, red flags, or prognosis,
ALWAYS respond using this exact structured format:

**Primary Likely Diagnosis:**
- Single most likely condition

**Differential Diagnoses (Ranked):**
1.
2.
3.
4.

**Key Morphologic / Clinical Features:**
- Bullet points linking findings to diagnosis

**Red Flags (if any):**
- Features that may suggest serious or alternative pathology

**Suggested Investigations (if relevant):**
- Biopsy, dermoscopy, labs, etc.

**Diagnostic Confidence:**
- High / Moderate / Low

For purely conversational or clarification questions, you may respond briefly in prose.
`;

// ─── Markdown render components ───────────────────────────────────────────────

interface MdProps {
  children?: ReactNode;
  href?: string;
}

// inline style guarantees bold — cannot be overridden by any CSS class or reset
const BoldHeading = ({ children }: MdProps) => (
  <p style={{ fontWeight: 700 }} className="text-sm mt-3 mb-1">
    {children}
  </p>
);

const MdP = ({ children }: MdProps) => (
  <p className="text-sm leading-relaxed mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
);

const MdStrong = ({ children }: MdProps) => (
  <strong style={{ fontWeight: 700 }}>{children}</strong>
);

const MdUl = ({ children }: MdProps) => (
  <ul className="list-disc list-outside pl-5 mb-2 space-y-0.5 text-sm">{children}</ul>
);

const MdOl = ({ children }: MdProps) => (
  <ol className="list-decimal list-outside pl-5 mb-2 space-y-0.5 text-sm">{children}</ol>
);

const MdLi = ({ children }: MdProps) => (
  <li className="leading-relaxed">{children}</li>
);

const MdA = ({ href, children }: MdProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors"
  >
    {children}
  </a>
);

const mdComponents = {
  p: MdP,
  strong: MdStrong,
  h1: BoldHeading,
  h2: BoldHeading,
  h3: BoldHeading,
  h4: BoldHeading,
  h5: BoldHeading,
  h6: BoldHeading,
  ul: MdUl,
  ol: MdOl,
  li: MdLi,
  a: MdA,
};

// ─── Section titles for both Module 3 and Module 4 ────────────────────────────

const ALL_SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Typical Course and Prognosis',
  'When In-Person Evaluation Is Considered',
  'Educational References',
  'Primary Likely Diagnosis',
  'Differential Diagnoses (Ranked)',
  'Differential Diagnoses',
  'Key Morphologic / Clinical Features',
  'Key Morphologic Features',
  'Red Flags',
  'Suggested Investigations',
  'Diagnostic Confidence',
];

/**
 * Converts every known section title to ### heading so ReactMarkdown
 * always routes it to BoldHeading — regardless of ** or plain text.
 */
function normalizeContent(text: string): string {
  if (!text) return '';

  return text
    .replace(/\\n\\n/g, '\n\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.length < 2) return line;

      // Never touch numbered list items
      if (/^\d+\.\s/.test(trimmed)) return line;

      // Already a heading — leave it
      if (trimmed.startsWith('#')) return trimmed;

      // Strip existing ** wrapper to get bare title
      const stripped = trimmed.replace(/^\*\*(.+)\*\*$/, '$1').replace(/:$/, '').trim();

      const isSection = ALL_SECTION_TITLES.some(
        (title) =>
          stripped.toLowerCase() === title.toLowerCase() ||
          stripped.toLowerCase().startsWith(title.toLowerCase() + ':')
      );

      if (isSection) return `### ${stripped}`;

      // Return trimmed for existing inline bold (avoids indented-code misparse)
      if (trimmed.startsWith('**')) return trimmed;

      return line;
    })
    .join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

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
    if (prefillMessage && prefillMessage.trim() && !hasConsumedPrefill.current) {
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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={mdComponents}
                  >
                    {normalizeContent(m.content)}
                  </ReactMarkdown>

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
                  AI is typing…
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
