import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Send, X } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';
interface ChatInputProps {
  onSend: (content: string, images?: File[]) => Promise<void> | void;
  isLoading: boolean;
  mode: ConversationMode;
  disabled?: boolean;
}
interface PendingImage {
  id: string;
  previewUrl: string;
  fingerprint: string;
  fileName: string;
  file: File;
}
function buildFingerprint(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`;
}
export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  mode,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  // FIX: Use a ref as the real send guard — setSending is async and can't
  // prevent a second call that arrives in the same render cycle (e.g. Enter
  // key + Send button clicked simultaneously).
  const sendingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<PendingImage[]>([]);
  // Only allow images in intake and review modes
  const canAttachImages = useMemo(() => {
    return (
      mode === 'post_payment_intake' ||
      mode === 'dermatologist_review' ||
      mode === 'final_output'
    );
  }, [mode]);
  const hasImages = images.length > 0;
  const trimmedText = text.trim();
  const canSend = useMemo(() => {
    if (disabled || isLoading || sending) return false;
    return trimmedText.length > 0 || hasImages;
  }, [disabled, isLoading, sending, trimmedText, hasImages]);
  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const setImagesState = (updater: (prev: PendingImage[]) => PendingImage[]) => {
    setImages((prev) => {
      const next = updater(prev);
      imagesRef.current = next;
      return next;
    });
  };
  const revokePreviewUrls = (items: PendingImage[]) => {
    items.forEach((item) => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch (e) {
        console.error('Failed to revoke preview URL:', e);
      }
    });
  };
  const handlePickImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      resetFileInput();
      return;
    }
    const selectedFiles = Array.from(files);
    try {
      const newItems: PendingImage[] = selectedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        previewUrl: URL.createObjectURL(file),
        fingerprint: buildFingerprint(file),
        fileName: file.name,
        file,
      }));
      setImagesState((prev) => {
        const seen = new Set(prev.map((img) => img.fingerprint));
        const valid: PendingImage[] = [];
        for (const item of newItems) {
          if (!item || seen.has(item.fingerprint)) {
            try {
              URL.revokeObjectURL(item.previewUrl);
            } catch (e) {
              console.error('Failed to revoke duplicate preview URL:', e);
            }
            continue;
          }
          seen.add(item.fingerprint);
          valid.push(item);
        }
        return [...prev, ...valid];
      });
    } catch (err) {
      console.error('Image selection failed:', err);
    } finally {
      resetFileInput();
    }
  };
  const handleRemoveImage = (id: string) => {
    setImagesState((prev) => {
      const removed = prev.filter((img) => img.id === id);
      revokePreviewUrls(removed);
      return prev.filter((img) => img.id !== id);
    });
    resetFileInput();
  };
  const clearAll = () => {
    setText('');
    setImagesState((prev) => {
      revokePreviewUrls(prev);
      return [];
    });
    resetFileInput();
  };
  const handleSubmit = async () => {
    const currentTrimmedText = text.trim();
    const currentImages = [...imagesRef.current];
    // FIX: Check ref first — this is synchronous and prevents the race
    // condition where two calls arrive before setSending(true) re-renders.
    if (disabled || isLoading || sendingRef.current) return;
    if (currentTrimmedText.length === 0 && currentImages.length === 0) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const payloadImages = currentImages.map((img) => img.file);
      await onSend(currentTrimmedText, payloadImages.length ? payloadImages : undefined);
      clearAll();
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  useEffect(() => {
    return () => {
      revokePreviewUrls(imagesRef.current);
    };
  }, []);
  return (
    <div className="border-t border-border bg-card p-3 md:p-4">
      {hasImages && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-dashed bg-muted/30 p-2">
          {images.map((img) => (
            <div key={img.id} className="relative">
              <img
                src={img.previewUrl}
                alt={img.fileName}
                className="h-20 w-20 rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(img.id)}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        {canAttachImages && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePickImages}
              disabled={isLoading || disabled || sending}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || disabled || sending}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={canAttachImages ? 'Type message or upload images...' : 'Type your message...'}
          disabled={isLoading || disabled || sending}
          className="min-h-[52px] max-h-40 resize-none"
        />
        <Button type="button" size="icon" onClick={handleSubmit} disabled={!canSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {canAttachImages && (
        <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-tight font-medium">
          Upload only clinical photos of skin area. No faces or personal information.
        </p>
      )}
    </div>
  );
};
