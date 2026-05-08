import { describe, expect, it } from "vitest";

import { formatQuantity, titleCase } from "@/lib/utils";

describe("formatQuantity", () => {
  it("renders decimal quantities with three places", () => {
    expect(formatQuantity("5")).toBe("5.000");
    expect(formatQuantity("1234.5")).toBe("1,234.500");
  });

  it("handles invalid quantities defensively", () => {
    expect(formatQuantity("not-a-number")).toBe("0.000");
  });
});

describe("titleCase", () => {
  it("renders movement codes for display", () => {
    expect(titleCase("stock_in")).toBe("Stock In");
  });
});
