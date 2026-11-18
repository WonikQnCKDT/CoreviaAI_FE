import { useEffect, useState } from "react";
import { checkProjectCode } from "@/features/project/api/projectApi";

type Permission = "checking" | "allowed" | "denied" | "unavailable";

export function useProjectCreationPermission(userId: number | undefined): Permission {
  const [result, setResult] = useState<{ userId: number; value: Permission } | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    const controller = new AbortController();
    // 코드 조회는 생성 권한을 검사하는 기존 읽기 API다. 코드의 사용 가능 여부는 여기서 필요하지 않다.
    void checkProjectCode({ code: "PROJECT-CHECK", signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return;
      const value = response.ok === true ? "allowed"
        : response.failure.kind === "http" && response.failure.status === 403 ? "denied" : "unavailable";
      setResult({ userId, value });
    });
    return () => controller.abort();
  }, [userId]);

  if (userId === undefined) return "denied";
  return result?.userId === userId ? result.value : "checking";
}
