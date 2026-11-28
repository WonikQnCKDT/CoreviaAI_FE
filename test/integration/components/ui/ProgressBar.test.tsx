// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ProgressBar from "@/components/ui/ProgressBar";

afterEach(cleanup);

describe("ProgressBar", () => {
  it("값을 보이고 막대 너비를 맞춘다", () => {
    const { container, getByText } = render(<ProgressBar value={70} showLabel />);
    expect(getByText("70%")).toBeTruthy();
    expect((container.querySelector("[style]") as HTMLElement).style.width).toBe("70%");
  });

  it("값을 모르면(null) '-'와 빈 막대", () => {
    const { container, getByText } = render(<ProgressBar value={null} showLabel />);
    expect(getByText("-")).toBeTruthy();
    expect((container.querySelector("[style]") as HTMLElement).style.width).toBe("0%");
  });

  it("범위를 벗어난 값은 0~100으로 자른다", () => {
    expect(render(<ProgressBar value={140} showLabel />).getByText("100%")).toBeTruthy();
    cleanup();
    expect(render(<ProgressBar value={-5} showLabel />).getByText("0%")).toBeTruthy();
  });
});
