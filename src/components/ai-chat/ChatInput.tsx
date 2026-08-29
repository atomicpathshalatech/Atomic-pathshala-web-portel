"use client";

import {
  Camera,
  FileText,
  ImagePlus,
  Mic,
  MicOff,
  Plus,
  Send,
  Square,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import type { AttachmentKind, Language } from "@/types/ai-chat";

const MAX_ATTACHMENTS = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1800;
const IMAGE_QUALITY = 0.88;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type AttachmentStatus = "processing" | "ready" | "error";

export interface ChatInputAttachment {
  id: string;
  kind: AttachmentKind;
  file: File;
  name: string;
  mimeType: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

interface PendingAttachment {
  id: string;
  kind: AttachmentKind;
  file: File;
  name: string;
  mimeType: string;
  size: number;
  base64?: string;
  previewUrl?: string;
  status: AttachmentStatus;
  progress: number;
  error?: string;
}

interface ChatInputProps {
  onSend: (
    text: string,
    imageFile?: File,
    attachments?: ChatInputAttachment[]
  ) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  isGenerating?: boolean;
  onStop?: () => void;
  language?: Language;
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentKind(file: File): AttachmentKind | null {
  if (IMAGE_TYPES.has(file.type)) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }

  return null;
}

function validateFile(file: File): string | null {
  const kind = getAttachmentKind(file);

  if (!kind) {
    return "Only JPEG, PNG, WebP, GIF, and PDF files are supported.";
  }

  if (kind === "image" && file.size > MAX_IMAGE_BYTES) {
    return `Image is too large. Maximum size is ${formatFileSize(MAX_IMAGE_BYTES)}.`;
  }

  if (kind === "pdf" && file.size > MAX_PDF_BYTES) {
    return `PDF is too large. Maximum size is ${formatFileSize(MAX_PDF_BYTES)}.`;
  }

  return null;
}

function getSpeechLanguageCode(language?: Language) {
  // hi-IN handles common English loanwords reasonably well and is far more
  // accurate for Hindi/Hinglish speech than forcing en-IN, which mishears
  // Hindi words entirely.
  if (language === "english") return "en-IN";
  return "hi-IN";
}

async function requestMicrophoneAccess() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Voice input needs HTTPS or localhost.");
  }

  if (!navigator.mediaDevices?.getUserMedia) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError") {
        throw new Error("Microphone permission was blocked. Allow mic access from the browser address bar.");
      }

      if (error.name === "NotFoundError") {
        throw new Error("No microphone was found on this device.");
      }
    }

    throw new Error("Could not start microphone. Check browser mic permission and try again.");
  }
}

function readFileAsBase64(
  file: File,
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      onProgress(100);
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Could not read this file."));
    };

    reader.readAsDataURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Could not compress this image."));
      },
      type,
      quality
    );
  });
}

async function compressImage(
  file: File,
  onProgress: (progress: number) => void
) {
  if (file.type === "image/gif") {
    onProgress(40);
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    bitmap.close();
    throw new Error("Image compression is not available in this browser.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  onProgress(35);

  const targetType = "image/webp";
  const blob = await canvasToBlob(canvas, targetType, IMAGE_QUALITY);
  onProgress(50);

  if (blob.size >= file.size) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName || "image"}.webp`, {
    type: targetType,
    lastModified: file.lastModified,
  });
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
  isGenerating = false,
  onStop,
  language,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const voiceBaseTextRef = useRef("");
  const transcriptSeenRef = useRef(false);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    if (!listening) return;
    if (transcript) transcriptSeenRef.current = true;

    setText(`${voiceBaseTextRef.current}${transcript}`.trimStart());
  }, [listening, transcript]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
    };
  }, []);

  const updateAttachment = useCallback(
    (id: string, patch: Partial<PendingAttachment>) => {
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.id === id ? { ...attachment, ...patch } : attachment
        )
      );
    },
    []
  );

useEffect(() => {
    if (!showAttachMenu) return;
    function handleClickOutside(event: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachMenu]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });

    setAttachments([]);
    setInputError(null);

    if (imageInputRef.current) imageInputRef.current.value = "";
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, []);

  const processFile = useCallback(
    async (file: File, id: string, kind: AttachmentKind) => {
      try {
        const processedFile =
          kind === "image"
            ? await compressImage(file, (progress) =>
                updateAttachment(id, { progress: Math.min(progress, 50) })
              )
            : file;

        const base64 = await readFileAsBase64(processedFile, (progress) => {
          updateAttachment(id, {
            progress: kind === "image" ? 50 + Math.round(progress / 2) : progress,
          });
        });

        const previous = attachmentsRef.current.find((item) => item.id === id);
        if (previous?.previewUrl && previous.file !== processedFile) {
          URL.revokeObjectURL(previous.previewUrl);
        }

        updateAttachment(id, {
          file: processedFile,
          name: processedFile.name,
          mimeType: processedFile.type || file.type,
          size: processedFile.size,
          base64,
          previewUrl: URL.createObjectURL(processedFile),
          status: "ready",
          progress: 100,
        });
      } catch (error) {
        updateAttachment(id, {
          status: "error",
          progress: 100,
          error:
            error instanceof Error
              ? error.message
              : "Could not process this attachment.",
        });
      }
    },
    [updateAttachment]
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const incomingFiles = Array.from(files);
      if (incomingFiles.length === 0) return;

      setInputError(null);

      const availableSlots = MAX_ATTACHMENTS - attachmentsRef.current.length;
      if (availableSlots <= 0) {
        setInputError(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
        return;
      }

      incomingFiles.slice(0, availableSlots).forEach((file) => {
        const kind = getAttachmentKind(file);
        const validationError = validateFile(file);
        const id = createId();
        const previewUrl = kind ? URL.createObjectURL(file) : undefined;

        const pending: PendingAttachment = {
          id,
          kind: kind ?? "image",
          file,
          name: file.name || "attachment",
          mimeType: file.type || (kind === "pdf" ? "application/pdf" : ""),
          size: file.size,
          previewUrl,
          status: validationError ? "error" : "processing",
          progress: validationError ? 100 : 5,
          error: validationError ?? undefined,
        };

        setAttachments((current) => [...current, pending]);

        if (validationError || !kind) return;
        void processFile(file, id, kind);
      });

      if (incomingFiles.length > availableSlots) {
        setInputError(`Only ${availableSlots} more attachment(s) were added.`);
      }
    },
    [processFile]
  );

  const readyAttachments = useMemo<ChatInputAttachment[]>(
    () =>
      attachments
        .filter((attachment) => attachment.status === "ready" && attachment.base64)
        .map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          file: attachment.file,
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          base64: attachment.base64 ?? "",
          previewUrl: attachment.previewUrl,
        })),
    [attachments]
  );

  const hasProcessingAttachment = attachments.some(
    (attachment) => attachment.status === "processing"
  );

  const canSend =
    !disabled &&
    !hasProcessingAttachment &&
    (text.trim().length > 0 || readyAttachments.length > 0);

  const handleSend = async () => {
    if (!canSend) return;

    const trimmed = text.trim();
    const firstImage = readyAttachments.find(
      (attachment) => attachment.kind === "image"
    )?.file;

    await Promise.resolve(onSend(trimmed, firstImage, readyAttachments));

    setText("");
    clearAttachments();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (pastedFiles.length === 0) return;

    event.preventDefault();
    addFiles(pastedFiles);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const toggleVoiceInput = async () => {
    setInputError(null);

    if (!browserSupportsSpeechRecognition) {
      setInputError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isMicrophoneAvailable === false) {
      setInputError("Microphone permission is blocked. Allow mic access from the browser address bar.");
      return;
    }

    if (listening) {
      SpeechRecognition.stopListening();
      return;
    }

    try {
      await requestMicrophoneAccess();
      voiceBaseTextRef.current = text.trim() ? `${text.trim()} ` : "";
      resetTranscript();
      transcriptSeenRef.current = false;

      const primaryLanguage = getSpeechLanguageCode(language);

      await SpeechRecognition.startListening({
        continuous: browserSupportsContinuousListening !== false,
        language: primaryLanguage,
      });

      // If the chosen locale produces no speech-recognition activity within 3s
      // (common with hi-IN on some Windows/Chrome setups), fall back to en-IN.
      if (primaryLanguage !== "en-IN") {
        window.setTimeout(() => {
          if (!transcriptSeenRef.current) {
            SpeechRecognition.stopListening();
            resetTranscript();
            void SpeechRecognition.startListening({
              continuous: browserSupportsContinuousListening !== false,
              language: "en-IN",
            });
          }
        }, 3000);
      }
    } catch (error) {
      setInputError(
        error instanceof Error
          ? error.message
          : "Could not start voice input. Check microphone permission and try again."
      );
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-t bg-white p-3 transition-colors dark:bg-atomic-navy sm:p-4 ${
        isDragging
          ? "border-atomic-orange bg-orange-50/60 dark:bg-slate-900"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      {attachments.length > 0 && (
        <div className="mb-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group relative flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {attachment.kind === "image" && attachment.previewUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(attachment.previewUrl, "_blank")}
                  className="relative h-10 w-12 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Preview image"
                >
                  <Image
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    attachment.previewUrl && window.open(attachment.previewUrl, "_blank")
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-900/20"
                  title="Preview PDF"
                >
                  <FileText className="h-5 w-5" />
                </button>
              )}

              <div className="min-w-0">
                <p className="max-w-44 truncate font-medium">{attachment.name}</p>
                <p
                  className={`mt-0.5 ${
                    attachment.status === "error"
                      ? "text-red-500"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {attachment.status === "processing"
                    ? `Processing ${attachment.progress}%`
                    : attachment.status === "error"
                      ? attachment.error
                      : formatFileSize(attachment.size)}
                </p>
                {attachment.status === "processing" && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-atomic-orange transition-all"
                      style={{ width: `${attachment.progress}%` }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700"
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {inputError && (
        <p className="mb-2 text-xs font-medium text-red-500">{inputError}</p>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          multiple
          onChange={(event) => addFiles(event.target.files ?? [])}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          multiple
          onChange={(event) => addFiles(event.target.files ?? [])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => addFiles(event.target.files ?? [])}
        />

        <div className="flex shrink-0 items-end gap-1">
          {/* "+" button with popup menu (all screen sizes) */}
          <div ref={attachMenuRef} className="relative">
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    cameraInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    imageInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <ImagePlus className="h-4 w-4" />
                  Photos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    pdfInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <FileText className="h-4 w-4" />
                  Files
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowAttachMenu((current) => !current)}
              disabled={disabled}
              className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-atomic-orange disabled:opacity-50 dark:hover:bg-slate-800"
              title="Add attachment"
              aria-label="Add attachment"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void toggleVoiceInput()}
            disabled={disabled}
            className={`rounded-xl p-2.5 transition-colors disabled:opacity-50 ${
              listening
                ? "bg-red-500 text-white hover:bg-red-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-atomic-orange dark:hover:bg-slate-800"
            }`}
            title={
              browserSupportsSpeechRecognition
                ? listening
                  ? "Stop voice input"
                  : "Start voice input"
                : "Voice input is not supported"
            }
            aria-label={listening ? "Stop voice input" : "Start voice input"}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={placeholder ?? "Ask your doubt here..."}
          rows={1}
          className="max-h-44 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-atomic-orange focus:outline-none focus:ring-2 focus:ring-atomic-orange/20 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
        />

        {isGenerating && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            aria-label="Stop generation"
            title="Stop generation"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-atomic-orange text-white shadow-md transition-all hover:bg-atomic-orange-dark disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
            title="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        )}
      </div>

      <p className="mt-2 hidden text-center text-xs text-slate-400 sm:block dark:text-slate-500">
        Paste screenshots, drop images or PDFs, upload modules, or use the camera on mobile.
      </p>
    </div>
  );
}
