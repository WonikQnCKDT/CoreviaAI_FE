import type { ChatConversation } from "@/features/knowledge/utils/knowledgeChat";
import { conversationPreview } from "@/features/knowledge/utils/knowledgeChat";

interface ChatSidebarProps {
  conversations: ChatConversation[];
  activeId: string;
  loadingConvId: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function ChatSidebar({
  conversations,
  activeId,
  loadingConvId,
  onCreate,
  onSelect,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  if (collapsed) {
    return (
      <div className="relative flex h-full min-h-0 w-full flex-col items-center">
        <div className="flex h-[46px] w-full shrink-0 items-center justify-center border-b border-background-200">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="대화 기록 펼치기"
            aria-expanded={false}
            title="대화 기록 펼치기"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-arrow-right-s-line text-[16px]" aria-hidden="true" />
          </button>
        </div>

        <div className="w-full shrink-0 px-2 py-2">
          <button
            type="button"
            onClick={onCreate}
            aria-label="새 대화"
            title="새 대화"
            className="flex h-8 w-full cursor-pointer items-center justify-center rounded-md bg-primary-500 text-background-50 hover:bg-primary-600"
          >
            <i className="ri-add-line text-[16px]" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 w-full flex-1 overflow-y-auto px-2 pb-2">
          <ul className="space-y-1">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-label={conversation.title}
                    aria-current={active ? "true" : undefined}
                    className={`flex h-8 w-full cursor-pointer items-center justify-center rounded-md border ${
                      active
                        ? "border-primary-200 bg-primary-50 text-primary-600"
                        : "border-transparent text-foreground-500 hover:bg-background-100 hover:text-foreground-900"
                    }`}
                  >
                    {loadingConvId === conversation.id ? (
                      <i className="ri-loader-4-line animate-spin text-[14px]" aria-hidden="true" />
                    ) : (
                      <i className="ri-chat-3-line text-[14px]" aria-hidden="true" />
                    )}
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden w-max max-w-[220px] -translate-y-1/2 truncate rounded-md bg-foreground-950 px-2 py-1 text-[11.5px] font-medium text-background-50 opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 lg:block"
                  >
                    {conversation.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="w-full shrink-0 border-t border-background-200 px-2 py-2">
          <span className="block text-center text-[9.5px] leading-4 text-foreground-400">데모</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="대화 기록 접기"
          aria-expanded
          title="대화 기록 접기"
          className="absolute right-0 top-[18px] z-10 hidden h-6 w-6 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-background-300 bg-background-50 text-foreground-500 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 lg:flex"
        >
          <i className="ri-arrow-left-s-line text-[15px]" aria-hidden="true" />
        </button>
      )}

      <div className="flex items-center gap-1.5 border-b border-background-200 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground-900">대화 기록</span>
        <button type="button" className="btn-primary shrink-0 whitespace-nowrap px-2 py-1 text-[11.5px]" onClick={onCreate}>
          <i className="ri-add-line" /> 새 대화
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="대화 기록 닫기"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-200 lg:hidden"
          >
            <i className="ri-close-line" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-1 pb-1.5 text-[10px] font-semibold tracking-wide text-foreground-500">대화 {conversations.length}</p>
        <ul className="space-y-1">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={active ? "true" : undefined}
                  className={`w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition ${
                    active ? "border-primary-200 bg-primary-50" : "border-transparent hover:bg-background-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <i className={`ri-chat-3-line shrink-0 text-[12px] ${active ? "text-primary-600" : "text-foreground-400"}`} />
                    <span className={`min-w-0 flex-1 truncate text-[12px] font-medium ${active ? "text-primary-800" : "text-foreground-800"}`}>
                      {conversation.title}
                    </span>
                    {loadingConvId === conversation.id && <i className="ri-loader-4-line shrink-0 animate-spin text-[11px] text-primary-500" />}
                  </span>
                  <span className="mt-0.5 block truncate pl-[18px] text-[10px] text-foreground-500">{conversationPreview(conversation)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-background-200 px-3 py-2 text-[10px] leading-4 text-foreground-500">
        대화는 이 화면에서만 유지되는 데모입니다.
      </div>
    </div>
  );
}