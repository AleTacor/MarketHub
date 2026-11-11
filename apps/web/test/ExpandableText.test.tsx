import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpandableText } from "@/components/ExpandableText";
import { renderWithClient } from "./render";

/** jsdom has no layout: fake how tall the clamped text is vs. its full content. */
function fakeLayout({ full, clamped }: { full: number; clamped: number }) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(full);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clamped);
}

afterEach(() => vi.restoreAllMocks());

describe("ExpandableText", () => {
  it("clamps long text and expands/collapses it with Ver más / Ver menos", async () => {
    fakeLayout({ full: 200, clamped: 60 });
    const { user } = renderWithClient(<ExpandableText text="Una descripción muy larga" />);
    const text = screen.getByText("Una descripción muy larga");
    expect(text).toHaveClass("line-clamp-3");

    await user.click(screen.getByRole("button", { name: "Ver más" }));
    expect(text).not.toHaveClass("line-clamp-3");
    expect(screen.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Ver menos" }));
    expect(text).toHaveClass("line-clamp-3");
  });

  it("has no button when the text fits", () => {
    fakeLayout({ full: 40, clamped: 40 });
    renderWithClient(<ExpandableText text="Corta" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("breaks long words instead of overflowing", () => {
    renderWithClient(<ExpandableText text={"a".repeat(80)} />);
    expect(screen.getByText("a".repeat(80))).toHaveClass("break-anywhere");
  });
});
