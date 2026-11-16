import type { KnowledgeDoc } from "@/types";
import { answerKnowledgeQuestion } from "@/features/knowledge/utils/aiDraft";

export interface ChatSource {
  id: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources: ChatSource[];
  noEvidence: boolean;
  failed?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

let counter = 0;

export function chatId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function createConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: chatId("conv"),
    title: "새 대화",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function titleFromQuestion(question: string): string {
  const flat = question.replace(/\s+/g, " ").trim();
  if (!flat) return "새 대화";
  return flat.length > 26 ? `${flat.slice(0, 26)}…` : flat;
}

/** 근거를 찾지 못한 경우의 접두 문구를 화면용으로 정리합니다. */
function stripNoEvidencePrefix(text: string): string {
  return text.replace(/^관련 문서 없음\s*·\s*/, "").trim();
}

export function buildAssistantMessage(question: string, docs: KnowledgeDoc[]): ChatMessage {
  const result = answerKnowledgeQuestion(question, docs);
  return {
    id: chatId("ans"),
    role: "assistant",
    content: result.noEvidence ? stripNoEvidencePrefix(result.answer) : result.answer,
    createdAt: new Date().toISOString(),
    sources: result.sources.map((doc) => ({ id: doc.id, title: doc.title })),
    noEvidence: result.noEvidence,
  };
}

export function createFailureMessage(): ChatMessage {
  return {
    id: chatId("err"),
    role: "assistant",
    content: "답변을 만들지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
    createdAt: new Date().toISOString(),
    sources: [],
    noEvidence: false,
    failed: true,
  };
}

export function conversationPreview(conversation: ChatConversation): string {
  if (conversation.messages.length === 0) return "아직 질문이 없습니다";
  const last = conversation.messages[conversation.messages.length - 1];
  const flat = last.content.replace(/\s+/g, " ").trim();
  return flat.length > 52 ? `${flat.slice(0, 52)}…` : flat;
}