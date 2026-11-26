import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  error: string;
}

const MAX_LENGTH = 300;

export default function ChatComposer({ value, onChange, onSubmit, disabled, error }: ChatComposerProps) {
  const composingRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // 한글·일본어 조합 중 Enter는 전송하지 않습니다.
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    onSubmit();
  };

  const canSend = !disabled && value.trim().length >= 2;

  return (
    <div className="border-t border-background-200 bg-background-50 px-3 py-2.5 sm:px-4">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            rows={1}
            aria-label="지식 허브에 질문 입력"
            placeholder="지식 허브에 질문해 보세요. 예: 멤버 전용 프로젝트 권한 정책은?"
            className="field max-h-[120px] min-h-[42px] flex-1 resize-none py-2.5 text-[12.5px] leading-5"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            aria-label={BUTTON_TEXT.sendQuestion}
            className="btn-primary h-[42px] w-[42px] shrink-0 p-0"
          >
            <i className={disabled ? "ri-loader-4-line animate-spin" : "ri-send-plane-2-line"} />
          </button>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] text-foreground-500">Enter 전송 · Shift+Enter 줄바꿈</span>
          {value.length > 220 && <span className="text-[10px] text-foreground-400">{value.length}/{MAX_LENGTH}</span>}
          <span className="ml-auto text-[10px] text-foreground-400">규칙 기반 데모 · 실제 AI 모델 미연결</span>
        </div>
        {error && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
            <i className="ri-error-warning-line" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}