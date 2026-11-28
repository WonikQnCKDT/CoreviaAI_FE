import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import Modal from "@/components/ui/Modal";
import ChatSidebar from "@/features/knowledge/components/ai-chat/ChatSidebar";
import ChatMessages from "@/features/knowledge/components/ai-chat/ChatMessages";
import ChatComposer from "@/features/knowledge/components/ai-chat/ChatComposer";
import DocPreviewModal from "@/features/knowledge/components/ai-chat/DocPreviewModal";
import {
  buildAssistantMessage,
  chatId,
  createConversation,
  createFailureMessage,
  titleFromQuestion,
  type ChatConversation,
  type ChatMessage,
} from "@/features/knowledge/utils/knowledgeChat";
import { canViewKnowledge } from "@/utils/business";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";

interface ChatMemory {
  conversations: ChatConversation[];
  activeId: string;
}

let memory: ChatMemory | null = null;

const HISTORY_WIDTH_KEY = "corevia-chat-history-width";
const HISTORY_MIN = 200;
const HISTORY_MAX = 400;
const HISTORY_DEFAULT = 252;

function loadHistoryWidth(): number {
  try {
    const saved = Number(localStorage.getItem(HISTORY_WIDTH_KEY));
    if (Number.isFinite(saved) && saved >= HISTORY_MIN && saved <= HISTORY_MAX) return saved;
  } catch {
    // 저장된 폭이 없으면 기본 폭을 사용합니다.
  }
  return HISTORY_DEFAULT;
}

function ensureMemory(): ChatMemory {
  if (!memory) {
    const conversation = createConversation();
    memory = { conversations: [conversation], activeId: conversation.id };
  }
  return memory;
}

export default function AiQuestionTab() {
  const { knowledgeDocs, projects, currentUser, saveKnowledgeQuestion } = useDemoStore();
  const initial = ensureMemory();

  const [conversations, setConversations] = useState<ChatConversation[]>(initial.conversations);
  const [activeId, setActiveId] = useState<string>(initial.activeId);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [pendingConvId, setPendingConvId] = useState<string | null>(null);
  // 데스크톱: 기록 패널을 접었는지 여부. 모바일: 기록 드로어가 열렸는지 여부.
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  // 사용자가 드래그로 조절한 기록 패널 폭입니다.
  const [historyWidth, setHistoryWidth] = useState<number>(loadHistoryWidth);
  const [resizing, setResizing] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const historyWidthRef = useRef(historyWidth);

  useEffect(() => {
    historyWidthRef.current = historyWidth;
    try {
      localStorage.setItem(HISTORY_WIDTH_KEY, String(historyWidth));
    } catch {
      // 저장에 실패해도 화면 동작에는 영향이 없습니다.
    }
  }, [historyWidth]);

  const startHistoryResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof window === "undefined" || window.innerWidth < 1024) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = historyWidthRef.current;
    setResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), HISTORY_MIN), HISTORY_MAX);
      setHistoryWidth(Math.round(next));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setResizing(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const visibleDocs = useMemo(
    () => knowledgeDocs.filter((doc) => canViewKnowledge(doc, currentUser, projects)),
    [knowledgeDocs, currentUser, projects],
  );
  const docsRef = useRef(visibleDocs);

  useEffect(() => {
    docsRef.current = visibleDocs;
  }, [visibleDocs]);

  useEffect(() => {
    memory = { conversations, activeId };
  }, [conversations, activeId]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const activeConv = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const loading = Boolean(activeConv && pendingConvId === activeConv.id);
  const previewDoc = visibleDocs.find((doc) => doc.id === previewDocId) ?? null;

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [conversations],
  );

  const finishAnswer = (convId: string, question: string) => {
    const now = new Date().toISOString();
    let message: ChatMessage;
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
      message = buildAssistantMessage(question, docsRef.current);
      if (message.sources.length > 0) {
        saveKnowledgeQuestion({
          question,
          answer: `AI 초안입니다. ${message.content}`,
          sourceDocIds: message.sources.map((source) => source.id),
        });
      }
    } catch {
      message = createFailureMessage();
    }
    setConversations((prev) => prev.map((conversation) => (
      conversation.id === convId
        ? { ...conversation, updatedAt: now, messages: [...conversation.messages, message] }
        : conversation
    )));
    setPendingConvId(null);
  };

  const send = (raw: string) => {
    if (!activeConv || pendingConvId) return;
    const question = raw.trim();
    if (question.length < 2) {
      setInputError("질문을 2자 이상 입력해 주세요.");
      return;
    }
    setInputError("");
    setDraft("");
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: chatId("ask"),
      role: "user",
      content: question,
      createdAt: now,
      sources: [],
      noEvidence: false,
    };
    const convId = activeConv.id;
    setConversations((prev) => prev.map((conversation) => (
      conversation.id === convId
        ? {
          ...conversation,
          title: conversation.messages.length === 0 ? titleFromQuestion(question) : conversation.title,
          updatedAt: now,
          messages: [...conversation.messages, userMessage],
        }
        : conversation
    )));
    setPendingConvId(convId);
    timerRef.current = window.setTimeout(() => finishAnswer(convId, question), 700);
  };

  const retry = (messageId: string) => {
    if (pendingConvId) return;
    const conversation = conversations.find((item) => item.messages.some((message) => message.id === messageId));
    if (!conversation) return;
    const index = conversation.messages.findIndex((message) => message.id === messageId);
    const questionMessage = [...conversation.messages.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!questionMessage) return;
    setConversations((prev) => prev.map((item) => (
      item.id === conversation.id
        ? { ...item, messages: item.messages.filter((message) => message.id !== messageId) }
        : item
    )));
    setActiveId(conversation.id);
    setMobileHistoryOpen(false);
    setPendingConvId(conversation.id);
    timerRef.current = window.setTimeout(() => finishAnswer(conversation.id, questionMessage.content), 600);
  };

  const startNewConversation = () => {
    setMobileHistoryOpen(false);
    setInputError("");
    setDraft("");
    if (activeConv && activeConv.messages.length === 0) return;
    const conversation = createConversation();
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    setMobileHistoryOpen(false);
    setInputError("");
  };

  if (!activeConv) return null;

  return (
    <div className="w-full" style={{ "--chat-history-w": `${historyWidth}px` } as CSSProperties}>
      <div className="relative flex h-[calc(100vh-260px)] min-h-[440px] max-h-[900px] w-full overflow-hidden rounded-xl border border-background-300 bg-background-50 shadow-sm">
        {/* 데스크톱: 메뉴바처럼 접고 펼치는 기록 패널 */}
        <div
          className={`relative hidden shrink-0 flex-col border-r border-background-200 lg:flex ${
            resizing ? "" : "transition-[width] duration-200"
          } ${historyCollapsed ? "w-[60px]" : "w-[var(--chat-history-w)]"}`}
        >
          <ChatSidebar
            conversations={sortedConversations}
            activeId={activeConv.id}
            loadingConvId={pendingConvId}
            onCreate={startNewConversation}
            onSelect={selectConversation}
            collapsed={historyCollapsed}
            onToggleCollapse={() => setHistoryCollapsed((prev) => !prev)}
          />

          {!historyCollapsed && (
            <div
              role="separator"
              aria-label="대화 기록 폭 조절"
              aria-orientation="vertical"
              title="드래그해서 폭 조절"
              onPointerDown={startHistoryResize}
              className="group absolute inset-y-0 right-0 z-0 hidden w-1.5 cursor-col-resize items-center justify-center lg:flex"
            >
              <span className="h-full w-px bg-transparent transition-colors group-hover:bg-primary-300" />
            </div>
          )}
        </div>

        {/* 모바일: 기록 드로어 */}
        {mobileHistoryOpen && (
          <>
            <button
              type="button"
              aria-label={BUTTON_TEXT.closeChatHistory}
              onClick={() => setMobileHistoryOpen(false)}
              className="absolute inset-0 z-20 cursor-default bg-foreground-950/25 lg:hidden"
            />
            <div className="absolute inset-y-0 left-0 z-30 flex w-[260px] max-w-[85%] flex-col overflow-hidden border-r border-background-300 bg-background-50 shadow-panel lg:hidden">
              <ChatSidebar
                conversations={sortedConversations}
                activeId={activeConv.id}
                loadingConvId={pendingConvId}
                onCreate={startNewConversation}
                onSelect={selectConversation}
                onClose={() => setMobileHistoryOpen(false)}
              />
            </div>
          </>
        )}

        {/* 대화 영역: 화면 폭에 맞춰 늘어나고 줄어듭니다. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-background-200 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              aria-label={BUTTON_TEXT.openChatHistory}
              title={BUTTON_TEXT.chatHistory}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-600 hover:bg-background-100 hover:text-foreground-900 lg:hidden"
            >
              <i className="ri-history-line text-[15px]" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-foreground-950">{activeConv.title}</p>
              <p className="truncate text-[10.5px] text-foreground-500">
                조회 가능한 문서 {visibleDocs.length}건 기준 · 권한 밖 문서는 근거에서 제외
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label={BUTTON_TEXT.help}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-900"
              >
                <i className="ri-question-line" />
              </button>
            </div>
          </header>

          <ChatMessages
            conversation={activeConv}
            loading={loading}
            onRetry={retry}
            onOpenSource={(docId) => setPreviewDocId(docId)}
            onAskExample={(question) => send(question)}
          />

          <ChatComposer
            value={draft}
            onChange={(value) => { setDraft(value); setInputError(""); }}
            onSubmit={() => send(draft)}
            disabled={Boolean(pendingConvId)}
            error={inputError}
          />
        </div>
      </div>

      <Modal open={helpOpen} title="AI 질문 도움말" onClose={() => setHelpOpen(false)} width="max-w-lg">
        <div className="space-y-3 text-[11.5px] leading-5 text-foreground-700">
          <div>
            <p className="text-[12px] font-semibold text-foreground-900">검색 범위</p>
            <p className="mt-0.5">현재 사용자가 조회할 수 있는 지식 문서만 근거로 사용합니다. 멤버 전용·부서 공개 문서는 권한이 있을 때만 포함되며, 이미지·첨부 파일 내부 텍스트는 검색하지 않습니다.</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-foreground-900">답변과 출처</p>
            <p className="mt-0.5">답변 아래의 출처 버튼을 누르면 근거 문서 미리보기가 열립니다. 근거를 찾지 못하면 출처를 만들지 않고 ‘근거 문서를 찾지 못했습니다’로 안내합니다.</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-foreground-900">대화 기록 패널</p>
            <p className="mt-0.5">왼쪽 대화 기록 패널은 상단의 <strong>&lt;</strong> 버튼으로 접을 수 있고, 접힌 상태에서는 <strong>&gt;</strong> 버튼으로 다시 펼칩니다. 패널 오른쪽 경계를 마우스로 끌면 폭을 원하는 만큼 넓히거나 좁힐 수 있습니다. 접으면 아이콘만 남아 대화 영역이 넓어집니다. 작은 화면에서는 헤더의 기록 아이콘을 눌러 패널을 열고 닫습니다.</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-foreground-900">질문 입력</p>
            <p className="mt-0.5">Enter는 전송, Shift+Enter는 줄바꿈입니다. 기록 패널을 열거나 닫거나 창 크기가 바뀌어도 입력 중인 내용과 현재 대화는 그대로 유지됩니다.</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
            현재는 문서 키워드 매칭 기반의 <strong>데모 응답</strong>입니다. 실제 AI 모델과 문서 검색 엔진은 아직 연결되어 있지 않으며, 서버 연동 시 이 영역의 답변 생성 로직만 교체하면 됩니다.
          </div>
        </div>
      </Modal>

      <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDocId(null)} />
    </div>
  );
}