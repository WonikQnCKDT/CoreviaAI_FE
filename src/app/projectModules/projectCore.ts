import type { ProjectCore } from "@/core/projectModules/contracts";
import type { NotificationItem, Project, Task } from "@/types";

export function createProjectCore(project: Pick<Project, "id" | "serverId" | "riskScore">, tasks: readonly Task[], notifications: readonly NotificationItem[]): ProjectCore {
  const usesDemoData = project.serverId === undefined;
  return {
    work: {
      list: () => usesDemoData ? tasks.filter((task) => task.projectId === project.id).map((task) => ({
        id: task.id,
        title: task.name,
        status: task.status,
        dueDate: task.endDate,
        progress: task.progress,
      })) : [],
    },
    risk: { readScore: () => usesDemoData ? project.riskScore : null },
    notifications: {
      list: () => usesDemoData ? notifications.filter((notification) => notification.projectId === project.id).map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        createdAt: notification.createdAt,
        read: notification.read,
      })) : [],
    },
  };
}
