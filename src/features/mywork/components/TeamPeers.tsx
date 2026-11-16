import { useMemo, useState } from "react";
import { useDemoStore } from "@/stores/DemoStore";
import Avatar from "@/components/ui/Avatar";
import { ROLE_LABEL } from "@/utils/ui";
import type { RoleKey } from "@/types";

interface PeerRole {
  projectName: string;
  role: RoleKey;
}

interface Peer {
  id: string;
  name: string;
  dept: string;
  job: string;
  roles: PeerRole[];
}

export default function TeamPeers() {
  const { projects, users, currentUser } = useDemoStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const peers = useMemo<Peer[]>(() => {
    const sharedProjects = projects.filter(
      (project) => project.pmId === currentUser.id || project.members.some((member) => member.userId === currentUser.id),
    );
    const map = new Map<string, Peer>();
    sharedProjects.forEach((project) => {
      project.members.forEach((member) => {
        if (member.userId === currentUser.id) return;
        const user = users.find((u) => u.id === member.userId);
        if (!user) return;
        const entry = map.get(user.id) || {
          id: user.id,
          name: user.name,
          dept: user.dept,
          job: user.job,
          roles: [] as PeerRole[],
        };
        if (!entry.roles.some((role) => role.projectName === project.name)) {
          entry.roles.push({ projectName: project.name, role: member.role });
        }
        map.set(user.id, entry);
      });
    });
    return Array.from(map.values()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }, [projects, users, currentUser.id]);

  if (peers.length === 0) return null;

  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[12.5px] font-semibold text-foreground-800">함께 일하는 사람</h2>
        <span className="text-[11px] text-foreground-500">{peers.length}명</span>
        <div className="flex flex-wrap items-center gap-2">
          {peers.map((peer) => {
            const open = openId === peer.id;
            return (
              <div key={peer.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : peer.id)}
                  aria-label={`${peer.name} 정보 보기`}
                  aria-expanded={open}
                  title={`${peer.name} · ${peer.dept}`}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border bg-background-50 py-0.5 pl-0.5 pr-2 transition hover:border-primary-300 ${
                    open ? "border-primary-400 ring-1 ring-primary-200" : "border-background-300"
                  }`}
                >
                  <Avatar name={peer.name} seed={peer.id} size="xs" />
                  <span className="text-[11.5px] text-foreground-700">{peer.name}</span>
                  <i className="ri-arrow-down-s-line text-[11px] text-foreground-400" aria-hidden="true" />
                </button>
                {open && (
                  <>
                    <button
                      type="button"
                      aria-label="정보 닫기"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setOpenId(null)}
                    />
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-[250px] rounded-xl border border-background-300 bg-background-50 p-3 shadow-panel">
                      <div className="flex items-center gap-2">
                        <Avatar name={peer.name} seed={peer.id} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground-950">{peer.name}</p>
                          <p className="truncate text-[11px] text-foreground-600">
                            {peer.dept} · {peer.job}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 border-t border-background-200 pt-2">
                        <p className="text-[10.5px] font-medium text-foreground-500">프로젝트 역할</p>
                        <ul className="mt-1 space-y-1">
                          {peer.roles.map((role) => (
                            <li key={role.projectName} className="flex items-center justify-between gap-2">
                              <span className="truncate text-[11.5px] text-foreground-700">{role.projectName}</span>
                              <span className="shrink-0 rounded border border-background-300 bg-background-100 px-1.5 py-[1px] text-[10px] font-medium text-foreground-600">
                                {ROLE_LABEL[role.role]}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}