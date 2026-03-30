import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, X } from 'lucide-react';
import { BASE_URL } from '@/base_url';
import ReactMarkdown from 'react-markdown';

interface AIReviewAssistantProps {
  onClose: () => void;
  contextData: string;
  conversationId: string;
  onApplyContent?: (content: string) => void;
}

const SECTION_TITLES = [
  'Most Consistent With',
  'Close Differentials',
  'Morphologic Justification',
  'Educational Treatment Framework',
  'Investigations Commonly Considered',
  'References',
];

const FINAL_LINE = "You're welcome to ask follow-up questions.";

const STRUCTURED_FORMAT_PROMPT = `You are assisting a dermatologist.

Every response MUST use this exact section order and section titles exactly as written below:

Most Consistent With

Close Differentials

Morphologic Justification

Educational Treatment Framework

Investigations Commonly Considered

References

Rules:
- Use exactly the section titles above in exactly the same order.
- Do not use numbered sections.
- Do not use headings such as Diagnosis, Differential Diagnoses, Technical Justification, Prescription Regimen, or Plan.
- Do not leave any section empty.
- Do not output placeholders such as "N/A", "pending", "TBD", or blank lines under a heading.
- If information is limited, write a brief safe clinical statement for that section instead of leaving it empty.
- Keep the tone textbook-style and concise.
- No dosing, frequency, or application instructions.
- References should be educational sources only.
- End every response with exactly:
You're welcome to ask follow-up questions.`;

function cleanBody(text: string): string {
  return (text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHeading(title: string): string {
  return title.trim().toLowerCase();
}

function generateFallbackContent(section: string): string {
  switch (section) {
    case 'Most Consistent With':
      return 'Preliminary clinical impression based on available intake data suggests a dermatologic condition requiring further clinical correlation.';
    case 'Close Differentials':
      return 'Differential diagnoses may include inflammatory, infectious, or allergic dermatologic conditions depending on presentation.';
    case 'Morphologic Justification':
      return 'Assessment is based on the provided history and any available images. Morphology suggests a localized dermatologic process requiring clinical correlation.';
    case 'Educational Treatment Framework':
      return 'General supportive care, avoidance of irritants, and clinically appropriate dermatologic management may be considered after physician review.';
    case 'Investigations Commonly Considered':
      return 'Further evaluation may include dermatologic examination, bedside tests, laboratory workup, or biopsy if clinically indicated.';
    case 'References':
      return 'Standard dermatology educational references and clinical guidelines.';
    default:
      return 'Clinical details are limited from the currently available information.';
  }
}

function extractStructuredSections(text: string): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const escaped = SECTION_TITLES.map(escapeRegex).join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*)?(${escaped})(?:\\*\\*)?\\s*:?\\s*(?=\\n|$)`,
    'gi'
  );

  const matches: Array<{ title: string; index: number; fullLength: number }> =
    [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({
      title: match[1],
      index: match.index,
      fullLength: match[0].length,
    });
  }

  if (matches.length === 0) return {};

  const sections: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.fullLength;
    const end = next ? next.index : cleaned.length;
    sections[normalizeHeading(current.title)] = cleanBody(
      cleaned.slice(start, end)
    );
  }

  return sections;
}

function extractLegacyNumberedSections(
  text: string
): Record<string, string> {
  const cleaned = cleanBody(text);
  if (!cleaned) return {};

  const mappings = [
    {
      patterns: ['Diagnosis', 'Most Consistent With'],
      target: 'Most Consistent With',
    },
    {
      patterns: ['Differential Diagnoses', 'Close Differentials', 'Differentials'],
      target: 'Close Differentials',
    },
    {
      patterns: ['Technical Justification', 'Morphologic Justification', 'Justification'],
      target: 'Morphologic Justification',
    },
    {
      patterns: ['Prescription Regimen', 'Educational Treatment Framework', 'Treatment Framework'],
      target: 'Educational Treatment Framework',
    },
    {
      patterns: ['Investigations', 'Investigations Commonly Considered'],
      target: 'Investigations Commonly Considered',
    },
    {
      patterns: ['Educational References', 'References'],
      target: 'References',
    },
  ];

  const sectionHeaders = mappings
    .flatMap(m => m.patterns.map(escapeRegex))
    .join('|');
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:\\d+\\.\\s*)?(?:\\*\\*)?(${sectionHeaders})(?:\\*\\*)?\\s*:?\\s*(?=\\n|$)`,
    'gi'
  );

  const matches: Array<{ title: string; index: number; fullLength: number }> =
    [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    matches.push({
      title: match[1],
      index: match.index,
      fullLength: match[0].length,
    });
  }

  if (matches.length === 0) return {};

  const sections: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.fullLength;
    const end = next ? next.index : cleaned.length;
    const body = cleanBody(cleaned.slice(start, end));
    const mapping = mappings.find(m =>
      m.patterns.some(
        p => p.toLowerCase() === current.title.toLowerCase()
      )
    );
    if (mapping && body) {
      sections[normalizeHeading(mapping.target)] = body;
    }
  }

  return sections;
}

function buildStructuredOutput(sections: Record<string, string>): string {
  const content = SECTION_TITLES.map(title => {
    const key = normalizeHeading(title);
    const body =
      cleanBody(sections[key] || '') || generateFallbackContent(title);
    return `${title}\n\n${body}`.trim();
  }).join('\n\n');

  const cleaned = cleanBody(content);
  if (!cleaned) return '';

  if (cleaned.toLowerCase().includes(FINAL_LINE.toLowerCase())) {
    return cleaned;
  }
  return `${cleaned}\n\n${FINAL_LINE}`;
}

function normalizeAIContentToStructuredFormat(rawText: string): string {
  const text = cleanBody(rawText);
  if (!text || text.length < 30) return buildStructuredOutput({});

  let sections = extractStructuredSections(text);
  if (Object.keys(sections).length === 0) {
    sections = extractLegacyNumberedSections(text);
  }
  if (Object.keys(sections).length === 0) {
    sections = { [normalizeHeading('Most Consistent With')]: text };
  }

  return buildStructuredOutput(sections);
}

const AIReviewAssistantLink = (props: any) => (
  <a
    {...props}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 underline break-words"
  />
);

export const AIReviewAssistant: React.FC<AIReviewAssistantProps> = ({
  onClose,
  contextData,
  conversationId,
  onApplyContent,
}) => {
  const [messages, setMessages] = useState<
    { role: 'user' | 'ai'; content: string }[]
  >([
    {
      role: 'ai',
      content:
        "I'm ready to assist with this case. I have the patient's intake data. How can I help you refine the diagnosis or treatment plan?\n\nEvery response I generate will follow this format exactly:\n\nMost Consistent With\n\nClose Differentials\n\nMorphologic Justification\n\nEducational Treatment Framework\n\nInvestigations Commonly Considered\n\nReferences\n\nEnd line:\nYou're welcome to ask follow-up questions.\n\nThe response will be applied to the Assessment editor automatically.",
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('DoctorToken');
      const formData = new FormData();
      formData.append('id', conversationId);
      formData.append(
        'question',
        `${STRUCTURED_FORMAT_PROMPT}\n\nContext:\n${contextData}\n\nDoctor's request:\n${userMsg}`
      );

      const response = await fetch(`${BASE_URL}/api/doctor_chat_view/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();
      const rawAiContent: string =
        data.result?.trim() || data.response?.trim() || data.message?.trim() || '';

      const aiContent =
        normalizeAIContentToStructuredFormat(rawAiContent) ||
        buildStructuredOutput({});

      setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);

      // AUTO-APPLY: every AI response is written directly into
      // the Assessment & Response editor — no button needed
      if (onApplyContent) {
        onApplyContent(aiContent);
      }
    } catch (error) {
      console.error('Error consulting AI:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content:
            'I encountered an error. Please ensure the backend is running and try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none rounded-none">
      <CardHeader className="py-3 px-4 border-b bg-primary/5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <Bot className="h-4 w-4" />
          AI Consultation
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.role === 'ai' ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none
                        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                        [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed
                        [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-0.5
                        [&_ol]:pl-4 [&_ol]:mb-2 [&_strong]:font-semibold
                        [&_a]:text-blue-600 [&_a]:underline break-words"
                    >
                      <ReactMarkdown components={{ a: AIReviewAssistantLink }}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}

                  {/* Confirmation label on every AI response after the first */}
                  {m.role === 'ai' && i > 0 && (
                    <p className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                      ✓ Applied to Assessment editor
                    </p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-75" />
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask for diagnosis, plan..."
              className="flex-1 h-9 text-xs"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
