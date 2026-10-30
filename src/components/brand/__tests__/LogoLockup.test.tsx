import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LogoLockup } from "@/components/brand/LogoLockup";
import { MataresitMark } from "@/components/brand/MataresitMark";

function renderLockup(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("LogoLockup", () => {
  it("renders one brand mark and the wordmark behind a single accessible name", () => {
    const { container } = renderLockup(<LogoLockup />);

    const link = screen.getByRole("link", { name: "Mataresit home" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveTextContent("Mataresit");

    const marks = container.querySelectorAll('svg[data-mark="mataresit"]');
    expect(marks).toHaveLength(1);
    // The mark is decorative: the link already carries the accessible name.
    expect(marks[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the brand green by default and the dark-panel mint on panel tone", () => {
    const { container, rerender } = renderLockup(<LogoLockup />);
    const markWrapper = () => container.querySelector('svg[data-mark="mataresit"]')!.parentElement!;

    expect(markWrapper().className).toContain("text-ledger-accent");

    rerender(
      <MemoryRouter>
        <LogoLockup tone="on-panel" />
      </MemoryRouter>,
    );

    expect(markWrapper().className).toContain("text-[#3FBF8E]");
    expect(markWrapper().className).not.toContain("text-ledger-accent");
  });

  it("honours the size ladder without dropping below the 16px floor", () => {
    const { container, rerender } = renderLockup(<LogoLockup />);
    const markWrapper = () => container.querySelector('svg[data-mark="mataresit"]')!.parentElement!;

    expect(markWrapper().className).toContain("h-9");

    rerender(
      <MemoryRouter>
        <LogoLockup markSize="sm" />
      </MemoryRouter>,
    );
    expect(markWrapper().className).toContain("h-8");

    rerender(
      <MemoryRouter>
        <LogoLockup markSize="lg" />
      </MemoryRouter>,
    );
    expect(markWrapper().className).toContain("h-10");
  });

  it("renders an in-page anchor when href is supplied", () => {
    renderLockup(<LogoLockup href="#top" />);

    expect(screen.getByRole("link", { name: "Mataresit home" })).toHaveAttribute("href", "#top");
  });

  it("lets a caller override the accessible name", () => {
    renderLockup(<LogoLockup to="/dashboard" label="Back to workspace" />);

    const link = screen.getByRole("link", { name: "Back to workspace" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});

describe("MataresitMark", () => {
  it("stays decorative when given no title", () => {
    const { container } = render(<MataresitMark />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("becomes an image with an accessible name when titled", () => {
    render(<MataresitMark title="Mataresit" />);

    expect(screen.getByRole("img", { name: "Mataresit" })).toBeInTheDocument();
  });

  it("draws the single even-odd path with the four extracted rows", () => {
    const { container } = render(<MataresitMark />);
    const path = container.querySelector("path")!;

    expect(path).toHaveAttribute("fill-rule", "evenodd");
    // Five subpaths: the receipt body plus four cut rows.
    expect(path.getAttribute("d")!.match(/M/g)).toHaveLength(5);
  });
});
