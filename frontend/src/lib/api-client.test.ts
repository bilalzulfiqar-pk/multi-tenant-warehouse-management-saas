import { describe, expect, it } from "vitest";

import { parseApiErrorBody } from "@/lib/api-client";

describe("parseApiErrorBody", () => {
  it("uses the backend business error envelope", () => {
    expect(
      parseApiErrorBody(
        {
          error: {
            code: "validation_error",
            message: "Insufficient stock for this operation.",
            details: {},
          },
        },
        "Fallback",
      ),
    ).toEqual({
      code: "validation_error",
      message: "Insufficient stock for this operation.",
      details: {},
    });
  });

  it("turns DRF field errors into readable messages", () => {
    expect(parseApiErrorBody({ email: ["Enter a valid email address."] }, "Fallback")).toEqual({
      code: "validation_error",
      message: "Enter a valid email address.",
      details: { email: ["Enter a valid email address."] },
    });
  });
});
