import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ServerLabelsPanel from "@/features/admin/components/ServerLabelsPanel";
import { ADMIN_LABEL_TEXT } from "@/features/admin/i18n/ko";
import { I18nContext } from "@/shared/i18n/i18nContext";
import { BUTTON_TEXT } from "@/shared/i18n/catalog/button";
import { jsonOk, stubFetch } from "@test/support/appHarness";

const labelDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  labelKey: "button.save",
  textKo: "저장",
  textEn: null,
  textZhTw: "儲存",
  version: 0,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

const renderPanel = (reloadLabels = vi.fn(async () => undefined)) =>
  render(
    <I18nContext.Provider
      value={{
        language: "ko",
        canChangeLanguage: true,
        changeLanguage: vi.fn(async () => ({ ok: true as const })),
        reloadLabels,
      }}
    >
      <ServerLabelsPanel />
    </I18nContext.Provider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ServerLabelsPanel 다국어 라벨 관리 (FR-ADM-06, NFR-20, SCRUM-169·171)", () => {
  it("번역 누락(null) 라벨을 표시하고 누락 필터(en) 선택 시 missing=en 쿼리로 재조회한다", async () => {
    const { calls, unexpected } = stubFetch({
      "GET /api/admin/i18n/labels": ({ url }) => {
        if (url.searchParams.get("missing") === "en") {
          return jsonOk({ items: [labelDto({ textEn: null })], nextCursor: null, hasNext: false });
        }
        return jsonOk({
          items: [labelDto({ textEn: null }), labelDto({ id: 2, labelKey: "button.cancel", textKo: "취소", textEn: "Cancel" })],
          nextCursor: null,
          hasNext: false,
        });
      },
    });

    renderPanel();
    expect(await screen.findByText("button.save")).toBeTruthy();
    expect(screen.getByText(ADMIN_LABEL_TEXT.missing)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(ADMIN_LABEL_TEXT.missingFilter), { target: { value: "en" } });

    await waitFor(() => expect(screen.queryByText("button.cancel")).toBeNull());
    expect(calls.some((c) => c.path.includes("missing=en"))).toBe(true);
    expect(unexpected).toEqual([]);
  });

  it("라벨 문구를 수정한 뒤 '지금 화면에 적용'을 누르면 재배포 없이 reloadLabels()로 즉시 반영한다", async () => {
    const reloadLabels = vi.fn(async () => undefined);
    const { calls, unexpected } = stubFetch({
      "GET /api/admin/i18n/labels": () => jsonOk({ items: [labelDto()], nextCursor: null, hasNext: false }),
      "PATCH /api/admin/i18n/labels/1": () => jsonOk(labelDto({ textEn: "Save", version: 1 })),
    });

    renderPanel(reloadLabels);
    const editBtn = await screen.findByRole("button", { name: `button.save ${ADMIN_LABEL_TEXT.edit}` });
    fireEvent.click(editBtn);

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(ADMIN_LABEL_TEXT.textEn), { target: { value: "Save" } });
    fireEvent.click(within(dialog).getByRole("button", { name: BUTTON_TEXT.save }));

    await waitFor(() => expect(screen.getByText("Save")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/admin/i18n/labels/1")).toMatchObject({
      body: { textKo: "저장", textEn: "Save", textZhTw: "儲存", version: 0 },
    });

    fireEvent.click(screen.getByRole("button", { name: ADMIN_LABEL_TEXT.applyNow }));
    await waitFor(() => expect(reloadLabels).toHaveBeenCalledTimes(1));
    expect(unexpected).toEqual([]);
  });
});
