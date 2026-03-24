import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Send, X } from 'lucide-react';
import { ConversationMode } from '@/types/dermatology';

interface ChatInputProps {
  onSend: (content: string, images?: string[]) => void;
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
        reject(new Error('Failed to convert file to data URL.'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  mode,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isTextOnlyMode = mode === 'general_education';
  const canAttachImages = !isTextOnlyMode;

  const hasImages = images.length > 0;
  const trimmedText = text.trim();

  const canSend = useMemo(() => {
    if (disabled || isLoading) return false;
    if (trimmedText.length > 0) return true;
    if (hasImages) return true;
    return false;
  }, [disabled, isLoading, trimmedText, hasImages]);

  const resetNativeFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePickImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      resetNativeFileInput();
      return;
    }

    const selectedFiles = Array.from(files);

    try {
      const nextItems = await Promise.all(
        selectedFiles.map(async (file) => {
          const dataUrl = await fileToDataUrl(file);
          return {
            id: `${Date.now()}-${Math.random()}-${file.name}`,
            dataUrl,
            fingerprint: buildFingerprint(file),
            fileName: file.name,
          } as PendingImage;
        })
      );

      setImages((prev) => {
        const existingFingerprints = new Set(prev.map((img) => img.fingerprint));
        const deduped = nextItems.filter((item) => !existingFingerprints.has(item.fingerprint));
        return [...prev, ...deduped];
      });
    } catch (error) {
      console.error('Image selection failed:', error);
    } finally {
      resetNativeFileInput();
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    resetNativeFileInput();
  };

  const clearComposer = () => {
    setText('');
    setImages([]);
    resetNativeFileInput();
  };

  const handleSubmit = () => {
    if (!canSend) return;

    const payloadText = trimmedText;
    const payloadImages = images.map((img) => img.dataUrl);

    onSend(payloadText, payloadImages.length > 0 ? payloadImages : undefined);
    clearComposer();
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
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                aria-label={`Remove ${img.fileName}`}
                disabled={isLoading || disabled}
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
              disabled={isLoading || disabled}
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || disabled}
              className="shrink-0"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </>
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            canAttachImages
              ? 'Type your answer...'
              : 'Free mode is text-only. Type your message...'
          }
          disabled={isLoading || disabled}
          className="min-h-[52px] max-h-40 resize-none"
        />

        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={!canSend}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {canAttachImages && (
        <p className="mt-2 text-xs text-muted-foreground">
          Upload only clinical photos or files. No faces, names, IDs, or personal information.
        </p>
      )}
    </div>
  );
};
