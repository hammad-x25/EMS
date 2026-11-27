import { describe, expect, it } from "vitest";
import { parseApiError } from "@/lib/form-errors";

describe("parseApiError", () => {
  it("extracts structured Zod fieldErrors and formErrors", () => {
    const parsed = parseApiError({
      error: {
        code: "VALIDATION_ERROR",
        message: "The submitted data is invalid",
        details: {
          formErrors: ["Schedule window is invalid"],
          fieldErrors: {
            email: ["Enter a valid email", "Email must be lowercase"],
            password: ["Password too short"],
          },
        },
      },
    });

    expect(parsed).toEqual({
      code: "VALIDATION_ERROR",
      message: "The submitted data is invalid",
      formErrors: ["Schedule window is invalid"],
      fieldErrors: {
        email: "Enter a valid email",
        password: "Password too short",
      },
    });
  });

  it("falls back safely on empty or non-object payloads", () => {
    expect(parseApiError(null, "Fallback message")).toEqual({
      message: "Fallback message",
      fieldErrors: {},
      formErrors: [],
    });
  });
});
