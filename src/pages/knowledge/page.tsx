import { useSearchParams } from "react-router-dom";
import KnowledgeDocs from "@/features/knowledge/components/KnowledgeDocs";
import GlossaryTab from "@/features/knowledge/components/GlossaryTab";
import AiQuestionTab from "@/features/knowledge/components/AiQuestionTab";
import InfoTip from "@/components/ui/InfoTip";
import TabBar from "@/components/ui/TabBar";

type TabKey = "docs" | "glossary" | "qa";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "docs", label: "지식 문서", icon: "ri-book-read-line" },
  { key: "glossary", label: "용어집", icon: "ri-book-2-line" },
  { key: "qa", label: "AI 질문", icon: "ri-question-answer-line" },
];

const HELP_TEXT =
  "프로젝트에서 만들어진 산출물·회의록·이슈를 조직 지식으로 축적하는 공간입니다. 문서는 공개 범위(전사·부서·멤버 전용)에 따라 조회 가능한 항목만 표시되며, AI 질문도 조회 권한이 있는 문서만 근거로 사용합니다. 지금 화면의 데이터는 실제 저장 서버에 연결되지 않은 데모입니다.";

export default function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const docId = searchParams.get("doc");
  const tabParam = searchParams.get("tab") as TabKey | null;
  const active: TabKey = docId ? "docs" : tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "docs";

  const changeTab = (key: TabKey) => {
    setSearchParams(key === "docs" ? {} : { tab: key });
  };

  return (
    <div className="space-y-4">
      <TabBar
        items={TABS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon }))}
        activeKey={active}
        onChange={(key) => changeTab(key as TabKey)}
        ariaLabel="지식 허브 보기"
        meta={
          <span className="flex items-center gap-1.5 text-[11px] text-foreground-500">
            <span className="whitespace-nowrap">데모 데이터 · 조회 권한이 있는 문서만 표시</span>
            <InfoTip text={HELP_TEXT} label="지식 허브 안내" />
          </span>
        }
      />

      {active === "docs" && <KnowledgeDocs />}
      {active === "glossary" && <GlossaryTab />}
      {active === "qa" && <AiQuestionTab />}
    </div>
  );
}