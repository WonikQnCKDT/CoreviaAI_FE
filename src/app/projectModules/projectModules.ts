import type { DepartmentProjectModule } from "@/core/projectModules/contracts";
import { createProjectModuleRegistry } from "@/core/projectModules/registry";
import { builtInProjectModules } from "./builtInProjectModules";

// Register department modules here. Route and menu resolution share the same registry.
const departmentModules: readonly DepartmentProjectModule[] = [];

export const projectModules = createProjectModuleRegistry(
  [...builtInProjectModules, ...departmentModules],
  ["", "missing", "settings"],
);
