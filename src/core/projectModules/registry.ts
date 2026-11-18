import type { ProjectModule, ProjectModuleScope } from "./contracts";

const PAGE_PATH = /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/;

export function createProjectModuleRegistry(modules: readonly ProjectModule[], reservedPaths: readonly string[]) {
  const ids = new Set<string>();
  const paths = new Set(reservedPaths);
  const registered = modules.map((module) => {
    if (!module.id || ids.has(module.id) || !module.pages.length) {
      throw new Error(`Invalid or duplicate project module: ${module.id}`);
    }
    ids.add(module.id);
    const pages = module.pages.map((page) => {
      if (!PAGE_PATH.test(page.path) || paths.has(page.path)) {
        throw new Error(`Invalid or duplicate project module path: ${page.path}`);
      }
      paths.add(page.path);
      return { ...page };
    });
    return { ...module, pages };
  });

  return {
    list(scope: ProjectModuleScope, includeScoped = true) {
      return registered.filter((module) => !module.supports || (includeScoped && module.supports(scope)));
    },
  };
}
