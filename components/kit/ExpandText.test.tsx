// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExpandText, { cutAtWord } from "./ExpandText";

afterEach(cleanup);

const LONG = "the quiet before a sentence is still part of the sentence ".repeat(10).trim();

describe("cutAtWord", () => {
  it("leaves short text alone", () => {
    expect(cutAtWord("short", 10)).toBe("short");
  });
  it("cuts at a word boundary and marks the cut", () => {
    const cut = cutAtWord(LONG, 30);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(31);
    expect(LONG.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
  });
});

describe("ExpandText", () => {
  it("short text has no button", () => {
    render(<ExpandText text="short" limit={50} />);
    expect(screen.getByText("short")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("preview: Read all shows the whole text, Show less folds it back", () => {
    render(<ExpandText text={LONG} limit={40} />);
    const btn = screen.getByRole("button", { name: "Read all" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(LONG)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText(LONG)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText(LONG)).toBeNull();
  });
  it("block: the whole text is always in the page, held to a height until opened", () => {
    const { container } = render(<ExpandText as="pre" mode="block" className="h-make-text" text={LONG} limit={40} />);
    const pre = container.querySelector("pre")!;
    expect(pre.textContent).toBe(LONG);
    expect(pre.className).toContain("h-expand-held");
    fireEvent.click(screen.getByRole("button", { name: "Read all" }));
    expect(container.querySelector("pre")!.className).not.toContain("h-expand-held");
  });
});
