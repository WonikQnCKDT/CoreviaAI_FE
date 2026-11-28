import { useEffect, useRef, useState } from "react";
import { fetchAdminUser } from "@/features/admin/api/adminApi";

/**
 * 사용자 ID → 이름. 에러 로그에는 사용자 ID만 있어 사용자 관리 API(GET /api/admin/users/{id})로 이름을 찾는다(02-5 FE 표시 규칙).
 * 같은 ID는 한 번만 묻고, 찾지 못한 ID는 null로 기억해 다시 묻지 않는다(화면은 '사용자 #ID'로 표시).
 */
export const useUserNames = function (userIds: (number | null)[]) {
  const [names, setNames] = useState<Record<number, string | null>>({});
  const requested = useRef(new Set<number>());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const key = [...new Set(userIds.filter((id): id is number => id !== null))].sort((a, b) => a - b).join(",");

  useEffect(() => {
    const pending = key
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((id) => !requested.current.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => requested.current.add(id));
    controllerRef.current ??= new AbortController();
    const { signal } = controllerRef.current;
    pending.forEach(async (userId) => {
      const result = await fetchAdminUser({ userId, signal });
      if (signal.aborted) return;
      setNames((prev) => ({ ...prev, [userId]: result.ok === true ? result.data.name : null }));
    });
  }, [key]);

  return names;
};
