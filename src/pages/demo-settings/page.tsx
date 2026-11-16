import { useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import { Badge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { SYSTEM_ROLE_LABEL } from "@/utils/permission";
import type { SystemRole } from "@/types";

const ROLE_BADGE: Record<SystemRole, string> = {
  user: "border-background-300 bg-background-100 text-foreground-700",
  exec: "border-accent-200 bg-accent-50 text-accent-800",
  admin: "border-primary-200 bg-primary-50 text-primary-700",
};

const MATRIX: { area: string; pm: string; dev: string; qa: string; biz: string }[] = [
  { area: "업무 배정·수정·삭제", pm: "전체", dev: "본인 업무", qa: "본인 업무", biz: "조회" },
  { area: "WBS 편집·일정 변경", pm: "가능", dev: "본인 업무", qa: "본인 업무", biz: "조회" },
  { area: "하위작업 추가", pm: "가능", dev: "본인 담당", qa: "본인 담당", biz: "불가" },
  { area: "칸반 상태 변경", pm: "전체", dev: "본인 담당", qa: "본인 담당", biz: "조회" },
  { area: "결함 검증·종결", pm: "일반 이슈 종결", dev: "조치", qa: "검증·종결", biz: "조회" },
  { area: "산출물 승인·반려", pm: "게이트 승인자 지정", dev: "제출", qa: "제출", biz: "승인·반려" },
  { area: "단계 전환(게이트)", pm: "가능", dev: "불가", qa: "불가", biz: "검수" },
  { area: "AI 리스크 제안 승인", pm: "가능", dev: "조회", qa: "조회", biz: "조회" },
  { area: "멤버·설정", pm: "가능", dev: "조회", qa: "조회", biz: "조회" },
];

export default function DemoSettingsPage() {
  const { users, currentUser, switchDemoUser, resetDemo, signedIn } = useDemoStore();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
          <i className="ri-flask-line" /> 데모 전용 설정
        </p>
        <p className="mt-1 text-[11.5px] leading-5 text-amber-800">
          권한 확인을 위한 계정 전환 도구입니다. 실제 서버 인증·권한 제어가 아니며, 화면 접근 제어는 UI 시뮬레이션입니다.
          실제 인증 연동 시 5회 실패 잠금과 30분 무활동 만료를 서버에서 적용해야 합니다.
        </p>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground-950">데모 계정 전환</h3>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              계정을 전환하면 시스템 역할과 프로젝트 역할에 따라 메뉴와 버튼이 달라집니다.
            </p>
          </div>
          <Badge className="border-background-300 bg-background-100 text-foreground-600">
            현재 {currentUser.name}
          </Badge>
        </div>
        <ul className="divide-y divide-background-200">
          {users.map((user) => {
            const active = user.id === currentUser.id && signedIn;
            return (
              <li key={user.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${active ? "bg-primary-50/40" : ""}`}>
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-foreground-950">
                    {user.name}
                    {!user.active && (
                      <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-[1px] text-[10px] text-rose-700">
                        비활성
                      </span>
                    )}
                    {active && (
                      <span className="rounded border border-primary-200 bg-primary-50 px-1.5 py-[1px] text-[10px] text-primary-700">
                        로그인됨
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground-500">
                    {user.dept} · {user.job} · {user.email}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={ROLE_BADGE[user.systemRole]}>{SYSTEM_ROLE_LABEL[user.systemRole]}</Badge>
                  {user.canCreateProject && (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">프로젝트 생성</Badge>
                  )}
                  <button
                    type="button"
                    disabled={!user.active || active}
                    onClick={() => {
                      switchDemoUser(user.id);
                      setMessage(`${user.name} 계정으로 전환했습니다. 사이드바와 화면의 권한이 함께 바뀝니다.`);
                    }}
                    className="btn-outline px-2.5 py-1 text-[11.5px]"
                  >
                    {active ? "사용 중" : "전환"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {message && (
          <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-[11.5px] text-foreground-700">
            <i className="ri-information-line mr-1" />
            {message}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-background-200 px-4 py-3">
          <h3 className="text-[13.5px] font-semibold text-foreground-950">프로젝트 역할별 권한 요약</h3>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            한 사람이 프로젝트마다 다른 역할을 가질 수 있습니다. 시스템 관리자도 프로젝트 역할이 없으면 프로젝트 데이터에
            자동 접근할 수 없습니다.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="th">업무 영역</th>
                <th className="th w-[150px]">PM</th>
                <th className="th w-[150px]">개발자</th>
                <th className="th w-[130px]">QA</th>
                <th className="th w-[150px]">현업 담당자</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.area} className="border-b border-background-200 last:border-0">
                  <td className="td font-medium text-foreground-900">{row.area}</td>
                  <td className="td text-[12px] text-foreground-700">{row.pm}</td>
                  <td className="td text-[12px] text-foreground-700">{row.dev}</td>
                  <td className="td text-[12px] text-foreground-700">{row.qa}</td>
                  <td className="td text-[12px] text-foreground-700">{row.biz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-background-200 bg-background-100 px-4 py-2.5 text-[10.5px] leading-4 text-foreground-500">
          경영진은 소속 범위 프로젝트만 읽기 전용으로 조회하며, 개인 업무일지·개인 지연 이력·개인 순위는 표시하지
          않습니다. 경영진 업무량은 부서 단위로만 집계합니다.
        </div>
      </section>

      <section className="card">
        <div className="border-b border-background-200 px-4 py-3">
          <h3 className="text-[13.5px] font-semibold text-foreground-950">데모 데이터</h3>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="max-w-xl text-[11.5px] leading-5 text-foreground-600">
            프로젝트·업무·일지·이슈·회의록 등 데모 변경 사항은 브라우저에 저장되어 새로고침 후에도 유지됩니다. 초기화하면
            처음 가상 데이터로 돌아갑니다.
          </p>
          <button type="button" className="btn-outline" onClick={resetDemo}>
            <i className="ri-restart-line" /> 데모 데이터 초기화
          </button>
        </div>
      </section>

      <section className="card px-4 py-3.5">
        <h3 className="text-[13px] font-semibold text-foreground-950">미연결 항목</h3>
        <ul className="mt-2 grid grid-cols-1 gap-1.5 text-[11.5px] leading-5 text-foreground-600 sm:grid-cols-2">
          <li className="flex gap-1.5"><i className="ri-close-line mt-0.5 text-rose-500" /> 실제 서버 인증·세션 관리</li>
          <li className="flex gap-1.5"><i className="ri-close-line mt-0.5 text-rose-500" /> 예약 실행·실시간 알림 발송</li>
          <li className="flex gap-1.5"><i className="ri-close-line mt-0.5 text-rose-500" /> AI 분석 엔진·LLM API</li>
          <li className="flex gap-1.5"><i className="ri-close-line mt-0.5 text-rose-500" /> 파일 서버 업로드·다운로드</li>
        </ul>
      </section>
    </div>
  );
}