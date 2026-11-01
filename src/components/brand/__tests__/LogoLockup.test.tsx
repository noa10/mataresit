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

    expect(markWrapper().className.split(" ")).toContain("text-ledger-accent");

    rerender(
      <MemoryRouter>
        <LogoLockup tone="on-panel" />
      </MemoryRouter>,
    );

    expect(markWrapper().className.split(" ")).toContain("text-ledger-accent-on-panel");
    expect(markWrapper().className.split(" ")).not.toContain("text-ledger-accent");
  });

  it("keeps the focus ring readable on the always-dark panel tone", () => {
    const { rerender } = renderLockup(<LogoLockup />);
    const link = () => screen.getByRole("link", { name: "Mataresit home" });

    // A half-strength accent ring on the near-black panel is about 1.4:1 and
    // disappears, so the panel tone rings in the on-panel colour instead.
    expect(link().className.split(" ")).toContain("focus-visible:ring-ledger-accent");

    rerender(
      <MemoryRouter>
        <LogoLockup tone="on-panel" />
      </MemoryRouter>,
    );

    expect(link().className.split(" ")).toContain("focus-visible:ring-ledger-on-panel");
    expect(link().className.split(" ")).not.toContain("focus-visible:ring-ledger-accent");
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

  it("clips the scan pass to the mark, keeping the row holes open", () => {
    const { container } = render(<MataresitMark scan />);
    const clipPath = container.querySelector("clipPath path")!;

    // The clip defaults to `nonzero`, where the rows wind the same way as the
    // body and count as solid — the scan band would then paint over the holes.
    expect(clipPath).toHaveAttribute("clip-rule", "evenodd");
    expect(clipPath.getAttribute("d")!.match(/M/g)).toHaveLength(5);
  });

  it("centres the ink, not the box", () => {
    const { container } = render(<MataresitMark />);
    const group = container.querySelector("g")!;

    // The art spans y 5.15 to 21, so it is shifted up by 1.075 units.
    expect(group.getAttribute("transform")).toBe("translate(0 -1.075)");
  });
});
