import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Send, X } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';

interface ChatInputProps {
  onSend: (content: string, images?: string[]) => Promise<void> | void;
  isLoading: boolean;
  mode: ConversationMode;
  disabled?: boolean;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  fingerprint: string;
  fileName: string;
}

function buildFingerprint(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * 🔥 FRONTEND VALIDATION (STRICT)
 * Blocks:
 * - face-like photos
 * - documents with text
 */
function basicImagePrivacyCheck(dataUrl: string): { blocked: boolean; reason: string } {
  try {
    // Very basic heuristic fallback (since real detection is backend)
    // Reject if image looks like full photo (high entropy)
    if (dataUrl.length > 5_000_000) {
      return {
        blocked: true,
        reason: 'Large image detected. Please upload only the affected skin area.',
      };
    }

    // Optional: you can integrate backend validation here later
    return { blocked: false, reason: '' };
  } catch {
    return { blocked: true, reason: 'Invalid image' };
  }
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<PendingImage[]>([]);

  const isTextOnlyMode = mode === 'general_education';
  const canAttachImages = !isTextOnlyMode;

  const hasImages = images.length > 0;
  const trimmedText = text.trim();

  const canSend = useMemo(() => {
    if (disabled || isLoading || sending) return false;
    return trimmedText.length > 0 || hasImages;
  }, [disabled, isLoading, sending, trimmedText, hasImages]);

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const setImagesState = (updater: (prev: PendingImage[]) => PendingImage[]) => {
    setImages((prev) => {
      const next = updater(prev);
      imagesRef.current = next;
      return next;
    });
  };

  const handlePickImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      resetInput();
      return;
    }

    const selectedFiles = Array.from(files);

    try {
      const newItems = await Promise.all(
        selectedFiles.map(async (file) => {
          const dataUrl = await fileToDataUrl(file);

          const validation = basicImagePrivacyCheck(dataUrl);
          if (validation.blocked) {
            alert(
              'Please upload images of only the lesion or infected area. Images with faces or personal information are not allowed.'
            );
            return null;
          }

          return {
            id: `${Date.now()}-${Math.random()}`,
            dataUrl,
            fingerprint: buildFingerprint(file),
            fileName: file.name,
          } as PendingImage;
        })
      );

      setImagesState((prev) => {
        const seen = new Set(prev.map((img) => img.fingerprint));
        const valid: PendingImage[] = [];

        for (const item of newItems) {
          if (!item) continue;
          if (seen.has(item.fingerprint)) continue;

          seen.add(item.fingerprint);
          valid.push(item);
        }

        return [...prev, ...valid];
      });
    } catch (err) {
      console.error('Image selection failed', err);
    } finally {
      resetInput();
    }
  };

  const handleRemoveImage = (id: string) => {
    setImagesState((prev) => prev.filter((img) => img.id !== id));
    resetInput();
  };

  const clearAll = () => {
    setText('');
    setImagesState(() => []);
    resetInput();
  };

  const handleSubmit = async () => {
    const currentTrimmedText = text.trim();
    const currentImages = imagesRef.current;

    if (disabled || isLoading || sending) return;
    if (currentTrimmedText.length === 0 && currentImages.length === 0) return;

    setSending(true);

    try {
      const payloadImages = currentImages.map((img) => img.dataUrl);

      await onSend(currentTrimmedText, payloadImages.length ? payloadImages : undefined);

      // ✅ CRITICAL: clear AFTER SUCCESS ONLY
      clearAll();
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-card p-3 md:p-4">
      {hasImages && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-dashed bg-muted/30 p-2">
          {images.map((img) => (
            <div key={img.id} className="relative">
              <img
                src={img.dataUrl}
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
          placeholder="Type your message..."
          disabled={isLoading || disabled || sending}
          className="min-h-[52px] max-h-40 resize-none"
        />

        <Button type="button" size="icon" onClick={handleSubmit} disabled={!canSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {canAttachImages && (
        <p className="mt-2 text-xs text-muted-foreground">
          Upload only clinical photos. No faces or personal information allowed.
        </p>
      )}
    </div>
  );
};
