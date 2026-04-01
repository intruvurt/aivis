import { describe, it, expect } from "vitest";
import { validateUrl } from "./validation";

describe("URL Validation", () => {
  it("should validate correct URLs", () => {
    const result = validateUrl("https://example.com");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.url).toBe("https://example.com");
  });

  it("should add https:// to URLs without protocol", () => {
    const result = validateUrl("example.com");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.url).toBe("https://example.com");
  });

  it("should reject empty URLs", () => {
    const result = validateUrl("");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBeTruthy();
  });

  it("should reject localhost URLs", () => {
    const result = validateUrl("http://localhost:3000");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.toLowerCase()).toContain("local");
  });

  it("should reject private IP ranges", () => {
    const result = validateUrl("http://192.168.1.1");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.toLowerCase()).toContain("private");
  });

  it("should reject invalid URL formats", () => {
    const result = validateUrl("not a url");
    expect(result.valid).toBe(false);
  });

  it("should handle URLs with paths", () => {
    const result = validateUrl("https://example.com/path/to/page");
    expect(result.valid).toBe(true);
  });

  it("should handle URLs with query parameters", () => {
    const result = validateUrl("https://example.com?param=value");
    expect(result.valid).toBe(true);
  });
});
