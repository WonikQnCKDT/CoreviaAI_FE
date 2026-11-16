import { useEffect, useRef, useState } from "react";
import type { ChatConversation, ChatMessage } from "@/features/knowledge/utils/knowledgeChat";

const EXAMPLE_QUESTIONS = [
  "멤버 전용 프로젝트의 외부 협력사 초대 기준은?",
  "결함 재현 절차는 어떻게 작성하나요?",
  "디자인 가이드 불일치 결함은 어떻게 조치했나요?",
];

interface ChatMessagesProps {
  conversation: ChatConversation;
  loading: boolean;
  onRetry: (messageId: string) => void;
  onOpenSource: (docId: string) => void;
  onAskExample: (question: string) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessages({ conversation, loading, onRetry, onOpenSource, onAskExample }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation.id, conversation.messages.length, loading]);

  const copyAnswer = async (message: ChatMessage) => {
    try {
      const sourceText = message.sources.length > 0 ? `\n\n근거: ${message.sources.map((s) => s.title).join(", ")}` : "";
      await navigator.clipboard.writeText(`${message.content}${sourceText}`);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setCopiedId(null);
    }
  };

  const empty = conversation.messages.length === 0 && !loading;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
      {empty ? (
        <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <i className="ri-sparkling-2-line text-xl" />
          </div>
          <h3 className="mt-2.5 text-[14px] font-semibold text-foreground-950">지식 허브에 대해 무엇이든 물어보세요</h3>
          <p className="mt-1 max-w-md text-[11.5px] leading-5 text-foreground-500">
            조회 권한이 있는 문서만 근거로 사용합니다. 이어서 질문하면 같은 대화에 계속 쌓입니다.
          </p>
          <div className="mt-4 w-full max-w-lg">
            <p className="mb-1.5 text-left text-[10.5px] font-semibold text-foreground-500">예시 질문</p>
            <div className="space-y-1.5">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onAskExample(question)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-left text-[11.5px] text-foreground-800 transition hover:border-primary-300 hover:bg-primary-50"
                >
                  <i className="ri-arrow-right-s-line shrink-0 text-foreground-400" />
                  <span className="min-w-0 flex-1">{question}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl space-y-4">
          {conversation.messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[88%] sm:max-w-[80%]">
                    <div className="rounded-2xl rounded-br-md border border-primary-200 bg-primary-50 px-3.5 py-2.5">
                      <p className="whitespace-pre-wrap text-[12.5px] leading-6 text-foreground-900">{message.content}</p>
                    </div>
                    <p className="mt-1 pr-1 text-right text-[10px] text-foreground-400">{formatTime(message.createdAt)}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className="flex gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-[9.5px] font-semibold text-background-50">
                  AI
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`rounded-2xl rounded-tl-md border px-3.5 py-2.5 ${
                      message.failed
                        ? "border-rose-200 bg-rose-50/70"
                        : message.noEvidence
                          ? "border-amber-200 bg-amber-50/70"
                          : "border-background-200 bg-background-100"
                    }`}
                  >
                    {message.failed ? (
                      <div className="flex items-start gap-2">
                        <i className="ri-error-warning-line mt-0.5 text-[14px] text-rose-600" />
                        <p className="text-[12px] leading-6 text-rose-800">{message.content}</p>
                      </div>
                    ) : (
                      <>
                        {message.noEvidence && (
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <i className="ri-file-search-line text-[13px] text-amber-600" />
                            <p className="text-[11.5px] font-semibold text-amber-900">근거 문서를 찾지 못했습니다</p>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-[12.5px] leading-6 text-foreground-800">{message.content}</p>
                        {message.sources.length > 0 && (
                          <div className="mt-2.5 border-t border-background-300/70 pt-2">
                            <p className="text-[10.5px] font-semibold text-foreground-600">근거 문서 {message.sources.length}건</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {message.sources.map((source) => (
                                <button
                                  key={source.id}
                                  type="button"
                                  onClick={() => onOpenSource(source.id)}
                                  className="flex max-w-full cursor-pointer items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10.5px] text-primary-700 transition hover:border-primary-300 hover:bg-primary-100"
                                >
                                  <i className="ri-file-text-line shrink-0" />
                                  <span className="truncate">{source.title}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                    <span className="text-[10px] text-foreground-400">{formatTime(message.createdAt)}</span>
                    {message.failed ? (
                      <button
                        type="button"
                        onClick={() => onRetry(message.id)}
                        className="flex cursor-pointer items-center gap-1 rounded border border-rose-200 bg-background-50 px-1.5 py-[1px] text-[10px] text-rose-700 hover:bg-rose-50"
                      >
                        <i className="ri-refresh-line" /> 재시도
                      </button>
                    ) : (
                      <>
                        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-[1px] text-[9.5px] text-amber-700">데모 답변</span>
                        <button
                          type="button"
                          onClick={() => copyAnswer(message)}
                          className="flex cursor-pointer items-center gap-1 rounded px-1 py-[1px] text-[10px] text-foreground-500 hover:bg-background-200 hover:text-foreground-800"
                        >
                          <i className={copiedId === message.id ? "ri-check-line" : "ri-file-copy-line"} />
                          {copiedId === message.id ? "복사됨" : "복사"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-[9.5px] font-semibold text-background-50">
                AI
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-background-200 bg-background-100 px-3.5 py-2.5">
                <i className="ri-loader-4-line animate-spin text-[13px] text-primary-500" />
                <span className="text-[11.5px] text-foreground-600">조회 가능한 문서에서 근거를 찾는 중…</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}