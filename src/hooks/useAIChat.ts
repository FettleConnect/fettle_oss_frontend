import { useState, useCallback, useRef } from 'react';
import { Message, ConversationMode } from '@/types/dermatology';
import { addMessage, getMessages, updateConversationMode, setPaymentPaid } from '@/store/dataStore';

interface UseAIChatProps {
  conversationId: string;
  mode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
}

export const useAIChat = ({ conversationId, mode, onModeChange }: UseAIChatProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    // Check for mode triggers
    const upperContent = content.toUpperCase().trim();
    
    if (upperContent === 'YES' && mode === 'general_education') {
      onModeChange('payment_page');
      return;
    }
    
    if (upperContent === 'DONE' && mode === 'post_payment_intake') {
      addMessage(conversationId, 'patient', content);
      
      // Simulate Backend: Generate Draft Response for Doctor
      // In a real implementation, the backend would generate this when mode changes to 'dermatologist_review'
      const mockDraftResponse = `1. Most Consistent With
The presentation is most consistent with Nummular Eczema (Discoid Eczema), a common inflammatory skin pattern. This classification is based on the characteristic discrete, coin-shaped morphology of the lesions and their typical distribution.

2. Close Differentials
Close differential patterns include Tinea Corporis (fungal infection) and Guttate Psoriasis.

3. Morphologic Justification
The skin shows multiple well-demarcated, erythematous, disc-shaped plaques. There is evidence of fine scaling and mild crusting, which is typical for the subacute phase of this pattern. The absence of central clearing helps distinguish it from classic fungal patterns.

4. Educational Treatment Framework
Management typically begins with foundational care including soap substitutes and thick emollients. Topical corticosteroids are the primary escalation for active inflammation. In persistent cases, calcineurin inhibitors or phototherapy may be considered.

5. Investigations Commonly Considered
Skin scrapings for mycology are often performed to definitively exclude fungal infection. A skin biopsy may be considered in atypical presentations to confirm the inflammatory pattern.

6. Educational References
Information is based on educational resources from the NHS (UK), DermNet NZ, and the British Association of Dermatologists (BAD).

You're welcome to ask follow-up questions.`;

      // Update store with draft response (this would normally be fetched from backend)
      import('@/store/dataStore').then(({ setDraftResponse }) => {
        setDraftResponse(conversationId, mockDraftResponse);
      });

      addMessage(conversationId, 'ai', 
        "Thank you. I have compiled your medical case. A board-certified dermatologist will now review your images and history. You will receive a detailed notification and response once the review is complete.");
      onModeChange('dermatologist_review');
      return;
    }

    // Add patient message
    addMessage(conversationId, 'patient', content);
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Get conversation history
      const history = getMessages(conversationId);
      const chatMessages = history.map(m => ({
        role: m.role === 'patient' ? 'user' : 'assistant',
        content: m.content,
      }));

      // Add current message
      chatMessages.push({ role: 'user', content });

      abortControllerRef.current = new AbortController();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: chatMessages,
          conversationMode: mode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setStreamingContent(fullContent);
            }
          } catch {
            // Incomplete JSON, put back and wait
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save the complete message
      if (fullContent) {
        addMessage(conversationId, 'ai', fullContent);
      }
      setStreamingContent('');
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Chat error:', error);
        addMessage(conversationId, 'ai', 
          "I apologize, but I'm having trouble responding right now. Please try again in a moment.");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, mode, onModeChange]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    sendMessage,
    isLoading,
    streamingContent,
    cancelRequest,
  };
};
