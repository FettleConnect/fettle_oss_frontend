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
      addMessage(conversationId, 'ai', 
        "Thank you for providing all that information! Your case has been submitted for review by our board-certified dermatologist. They will carefully review everything you've shared and provide their professional assessment. You'll receive their response soon.");
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
