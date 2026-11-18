import { useEffect, useRef, useState, type FormEvent } from "react";
import { reassignProjectPm } from "@/features/project/api/projectApi";
import { projectApiError } from "@/features/project/i18n/ko";
import { positiveServerId, validServerProjectCode } from "@/features/project/utils/serverProjectInput";

export default function ServerProjectPmPanel() {
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const reassign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const newPmUserId = positiveServerId(userId);
    if (!validServerProjectCode(code) || !newPmUserId) {
      setNotice({ error: true, message: "프로젝트 코드와 새 PM의 사용자 ID를 확인해 주세요." });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice(null);
    try {
      const result = await reassignProjectPm({ projectCode: code, newPmUserId, signal: controller.signal });
      if (controller.signal.aborted) return;
      setNotice(result.ok === true ? { error: false, message: "PM을 재지정했습니다." }
        : { error: true, message: projectApiError(result.failure) });
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <section className="card max-w-xl space-y-3">
      <h2 className="text-lg font-semibold">프로젝트 PM 재지정</h2>
      <p>현재 PM이 비활성화된 프로젝트의 PM을 재지정합니다.</p>
      <form onSubmit={reassign} className="space-y-3">
        <fieldset disabled={busy} className="space-y-3">
          <label className="block">프로젝트 코드<input className="field" required maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <label className="block">새 PM 사용자 ID<input className="field" required inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
          <button className="btn-primary">PM 재지정</button>
        </fieldset>
      </form>
      {notice && <p role={notice.error ? "alert" : "status"}>{notice.message}</p>}
    </section>
  );
}
