/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { shouldCaptureBatchQueueWheel } from "../wheelCaptureGuard";

const createScrollContainer = (scrollHeight: number, clientHeight: number): HTMLElement => {
  const container = document.createElement("div");
  Object.defineProperty(container, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(container, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
  return container;
};

describe("shouldCaptureBatchQueueWheel", () => {
  it("returns false when upload count is 0", () => {
    const currentTarget = document.createElement("div");
    const target = document.createElement("div");
    currentTarget.appendChild(target);
    const scrollContainer = createScrollContainer(400, 200);

    expect(
      shouldCaptureBatchQueueWheel({
        uploadCount: 0,
        scrollContainer,
        currentTarget,
        target,
      })
    ).toBe(false);
  });

  it("returns false when scroll container is missing", () => {
    const currentTarget = document.createElement("div");
    const target = document.createElement("div");
    currentTarget.appendChild(target);

    expect(
      shouldCaptureBatchQueueWheel({
        uploadCount: 3,
        scrollContainer: null,
        currentTarget,
        target,
      })
    ).toBe(false);
  });

  it("returns false when queue container is not scrollable", () => {
    const currentTarget = document.createElement("div");
    const target = document.createElement("div");
    currentTarget.appendChild(target);
    const scrollContainer = createScrollContainer(200, 200);

    expect(
      shouldCaptureBatchQueueWheel({
        uploadCount: 3,
        scrollContainer,
        currentTarget,
        target,
      })
    ).toBe(false);
  });

  it("returns false when wheel event target is outside current target (portal case)", () => {
    const currentTarget = document.createElement("div");
    const target = document.createElement("div");
    const scrollContainer = createScrollContainer(500, 300);

    expect(
      shouldCaptureBatchQueueWheel({
        uploadCount: 3,
        scrollContainer,
        currentTarget,
        target,
      })
    ).toBe(false);
  });

  it("returns true when target is inside current target and queue is scrollable", () => {
    const currentTarget = document.createElement("div");
    const target = document.createElement("button");
    currentTarget.appendChild(target);
    const scrollContainer = createScrollContainer(600, 300);

    expect(
      shouldCaptureBatchQueueWheel({
        uploadCount: 2,
        scrollContainer,
        currentTarget,
        target,
      })
    ).toBe(true);
  });
});
