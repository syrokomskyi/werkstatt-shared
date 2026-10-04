import { describe, expect, test } from "vitest";
import { applyTaskListA11y } from "../task-list-a11y.ts";

describe("applyTaskListA11y", () => {
  test("hides micromark-style disabled checkbox", () => {
    const html = '<ul><li><input checked="" disabled="" type="checkbox"> Done item</li></ul>';
    expect(applyTaskListA11y(html)).toBe(
      '<ul><li><input checked="" disabled="" type="checkbox" aria-hidden="true"> Done item</li></ul>',
    );
  });

  test("hides remark-style disabled checkbox (checked and unchecked)", () => {
    const html =
      '<li><input type="checkbox" disabled checked> Done</li>' +
      '<li><input type="checkbox" disabled> Todo</li>';
    expect(applyTaskListA11y(html)).toBe(
      '<li><input type="checkbox" disabled checked aria-hidden="true"> Done</li>' +
        '<li><input type="checkbox" disabled aria-hidden="true"> Todo</li>',
    );
  });

  test("leaves enabled checkboxes untouched", () => {
    const html = '<input type="checkbox" name="consent" required>';
    expect(applyTaskListA11y(html)).toBe(html);
  });

  test("leaves non-checkbox disabled inputs untouched", () => {
    const html = '<input type="text" disabled value="x">';
    expect(applyTaskListA11y(html)).toBe(html);
  });

  test("is idempotent — already-hidden checkbox unchanged", () => {
    const html = '<input type="checkbox" disabled aria-hidden="true">';
    expect(applyTaskListA11y(html)).toBe(html);
  });

  test("handles self-closing input syntax", () => {
    const html = '<input type="checkbox" disabled />';
    expect(applyTaskListA11y(html)).toBe('<input type="checkbox" disabled aria-hidden="true" />');
  });

  test("passes through html without task lists", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    expect(applyTaskListA11y(html)).toBe(html);
  });
});
