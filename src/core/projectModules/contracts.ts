import type { ComponentType } from "react";

export interface ProjectModuleProfile {
  readonly departmentType: string | null;
  readonly method: string;
  readonly actors: readonly string[];
}

export interface ProjectModuleScope extends ProjectModuleProfile {
  readonly projectId: string;
}

export interface ProjectWorkItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly dueDate: string;
  readonly progress: number;
}

export interface ProjectNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly read: boolean;
}

export interface ProjectCore {
  readonly work: { list(): readonly ProjectWorkItem[] };
  readonly risk: { readScore(): number | null };
  readonly notifications: { list(): readonly ProjectNotification[] };
}

export interface ProjectModuleProps {
  readonly scope: ProjectModuleScope;
  readonly core: ProjectCore;
}

export interface ProjectModulePage {
  readonly path: string;
  readonly label: string;
  readonly Component: ComponentType<ProjectModuleProps>;
}

export interface ProjectModule {
  readonly id: string;
  readonly label: string;
  readonly supports?: (scope: ProjectModuleScope) => boolean;
  readonly showPageLinks?: boolean;
  readonly pages: readonly [ProjectModulePage, ...ProjectModulePage[]];
}

export type DepartmentProjectModule = ProjectModule & Required<Pick<ProjectModule, "supports">>;
