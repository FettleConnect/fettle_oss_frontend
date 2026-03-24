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
  /** Stable fingerprint built from file metadata — used to prevent duplicate adds. */
  fingerprint: string;
  fileName: string;
}

/** Stable fingerprint from file metadata (not content). Prevents selecting the same file twice. */
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
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * FIX (Bug 2): The previous implementation blocked any image whose base64 data URL
 * exceeded 5,000,000 characters. A normal 3 MB skin-lesion JPEG produces a data URL
 * of ~4–5 MB (base64 inflates by ~33%), so valid clinical photos were routinely
 * rejected before the user even saw the AI safety check.
 *
 * The real face/PII check is done server-side (Django) AND via the Anthropic API call
 * in PatientView.screenImages(). This lightweight client function now only rejects
 * images that fail basic format validation — nothing more.
 */
function basicImagePrivacyCheck(dataUrl: string): { blocked: boolean; reason: string } {
  // Reject empty or clearly invalid data URLs
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return { blocked: true, reason: 'Invalid image format.' };
  }
  // All other images pass here; the real AI-based check happens in PatientView.
  return { blocked: false, reason: '' };
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

  /**
   * FIX (Bug 3): imagesRef mirrors the images state synchronously so that
   * handleSubmit always snapshots the EXACT list of images at click time,
   * even if React has batched state updates that haven't flushed yet.
   */
  const imagesRef = useRef<PendingImage[]>([]);

  const isTextOnlyMode = mode === 'general_education';
  const canAttachImages = !isTextOnlyMode;

  const hasImages = images.length > 0;
  const trimmedText = text.trim();

  const canSend = useMemo(() => {
    if (disabled || isLoading || sending) return false;
    return trimmedText.length > 0 || hasImages;
  }, [disabled, isLoading, sending, trimmedText, hasImages]);

  /** Clear the native file input so the same file can be re-selected after removal. */
  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Unified images state setter that keeps imagesRef in sync.
   * Always call this instead of setImages directly.
   */
  const setImagesState = (updater: (prev: PendingImage[]) => PendingImage[]) => {
    setImages(prev => {
      const next = updater(prev);
      imagesRef.current = next; // keep ref in sync synchronously
      return next;
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
      const newItems = await Promise.all(
        selectedFiles.map(async file => {
          const dataUrl = await fileToDataUrl(file);

          // FIX (Bug 2): basicImagePrivacyCheck no longer rejects by file size.
          // It only catches malformed data URLs. Real validation is in PatientView.
          const validation = basicImagePrivacyCheck(dataUrl);
          if (validation.blocked) {
            alert(
              'Please upload images of only the lesion or infected area. ' +
              'Images with faces or personal information are not allowed.'
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

      // FIX (Bug 3): Deduplicate by fingerprint so selecting the same file twice
      // or picking overlapping sets never adds a duplicate to the pending list.
      setImagesState(prev => {
        const seen = new Set(prev.map(img => img.fingerprint));
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
      console.error('Image selection failed:', err);
    } finally {
      resetFileInput();
    }
  };

  /** FIX (Bug 3): Remove by stable id — the deleted image is gone from state
   *  and from imagesRef immediately, so it cannot sneak into the next send. */
  const handleRemoveImage = (id: string) => {
    setImagesState(prev => prev.filter(img => img.id !== id));
    resetFileInput();
  };

  const clearAll = () => {
    setText('');
    setImagesState(() => []);
    resetFileInput();
  };

  const handleSubmit = async () => {
    // FIX (Bug 3): Read the SNAPSHOT from imagesRef.current at the moment the
    // user clicks Send. This is the authoritative list:
    //   • already-removed images are absent (their removal updated the ref)
    //   • no stale closure over an old `images` value
    const currentTrimmedText = text.trim();
    const currentImages = [...imagesRef.current]; // snapshot

    if (disabled || isLoading || sending) return;
    if (currentTrimmedText.length === 0 && currentImages.length === 0) return;

    setSending(true);

    try {
      const payloadImages = currentImages.map(img => img.dataUrl);

      await onSend(
        currentTrimmedText,
        payloadImages.length ? payloadImages : undefined
      );

      // FIX (Bug 3): Clear state ONLY after a successful send so that
      // if onSend throws, the user's images are not silently lost.
      clearAll();
    } catch (err) {
      console.error('Send failed:', err);
      // Do NOT clear — let the user retry with the same images.
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
      {/* Pending image previews */}
      {hasImages && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-dashed bg-muted/30 p-2">
          {images.map(img => (
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
                aria-label={`Remove ${img.fileName}`}
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
              aria-label="Attach images"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </>
        )}

        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message…"
          disabled={isLoading || disabled || sending}
          className="min-h-[52px] max-h-40 resize-none"
        />

        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {canAttachImages && (
        <p className="mt-2 text-xs text-muted-foreground">
          Upload only clinical photos of the affected skin area. No faces or personal information allowed.
        </p>
      )}
    </div>
  );
};
