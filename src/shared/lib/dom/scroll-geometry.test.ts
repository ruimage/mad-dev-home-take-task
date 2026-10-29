import { expect, test } from "bun:test";
import { calculateCenteredScroll, calculateScrollPadding } from "./scroll-geometry";

test.each([
  [402, 500],
  [502, 600],
  [302, 400],
])("centering target at %i gives scrollTop %i", (targetTop, expected) => {
  expect(
    calculateCenteredScroll({
      scrollTop: 500,
      viewportTop: 100,
      viewportHeight: 600,
      borderTop: 3,
      targetTop,
      targetHeight: 2,
    }),
  ).toBe(expected);
});

test("padding permits centering at the content edges", () => {
  expect(calculateScrollPadding(600, true, 0, 0)).toEqual({ padding: 300, scrollTop: 300 });
});

test("resizing compensates padding without losing the user's position", () => {
  expect(calculateScrollPadding(800, true, 300, 425)).toEqual({ padding: 400, scrollTop: 525 });
  expect(calculateScrollPadding(600, true, 400, 525)).toEqual({ padding: 300, scrollTop: 425 });
  expect(calculateScrollPadding(600, true, 300, 425)).toEqual({ padding: 300, scrollTop: 425 });
});

test("disabling centering removes the extra padding", () => {
  expect(calculateScrollPadding(600, false, 300, 425)).toEqual({ padding: 0, scrollTop: 125 });
});
