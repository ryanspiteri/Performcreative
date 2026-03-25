import { describe, expect, it } from "vitest";
import { validateUrl, validateLocalPath, validateVideoInput } from "./services/_shared";

describe("validateUrl", () => {
  it("allows S3 amazonaws.com domains", () => {
    expect(() => validateUrl("https://s3.amazonaws.com/bucket/video.mp4")).not.toThrow();
    expect(() => validateUrl("https://s3.us-east-1.amazonaws.com/bucket/video.mp4")).not.toThrow();
    expect(() => validateUrl("https://s3.ap-southeast-2.amazonaws.com/bucket/video.mp4")).not.toThrow();
    expect(() => validateUrl("https://foreplay-ads.s3.amazonaws.com/video.mp4")).not.toThrow();
  });

  it("allows cdn.foreplay.co domain", () => {
    expect(() => validateUrl("https://cdn.foreplay.co/assets/video.mp4")).not.toThrow();
  });

  it("blocks private IP 127.0.0.1 (loopback)", () => {
    expect(() => validateUrl("http://127.0.0.1/admin")).toThrow("Disallowed internal address");
  });

  it("blocks private IP 10.x (class A private)", () => {
    expect(() => validateUrl("http://10.0.0.1/secret")).toThrow("Disallowed internal address");
  });

  it("blocks private IP 192.168.x (class C private)", () => {
    expect(() => validateUrl("http://192.168.1.1/internal")).toThrow("Disallowed internal address");
  });

  it("blocks localhost", () => {
    expect(() => validateUrl("http://localhost:3000/api")).toThrow("Disallowed internal address");
  });

  it("blocks non-allowlisted domains", () => {
    expect(() => validateUrl("https://evil.com/payload")).toThrow("Domain not in allowlist");
    expect(() => validateUrl("https://example.org/video.mp4")).toThrow("Domain not in allowlist");
  });

  it("rejects malformed URLs", () => {
    expect(() => validateUrl("not-a-url")).toThrow("Invalid URL");
    expect(() => validateUrl("://missing-protocol")).toThrow("Invalid URL");
    expect(() => validateUrl("")).toThrow("Invalid URL");
  });

  it("rejects non-http protocols", () => {
    expect(() => validateUrl("ftp://s3.amazonaws.com/file")).toThrow("Disallowed protocol");
    expect(() => validateUrl("file:///etc/passwd")).toThrow("Disallowed protocol");
    expect(() => validateUrl("javascript:alert(1)")).toThrow("Disallowed protocol");
  });
});

describe("validateLocalPath", () => {
  const basePath = "/media/videos";

  it("blocks '..' traversal sequences", () => {
    expect(() => validateLocalPath("../../etc/passwd", basePath)).toThrow("Path traversal detected");
    expect(() => validateLocalPath("/media/videos/../secrets/key", basePath)).toThrow("Path traversal detected");
  });

  it("blocks paths outside base directory", () => {
    expect(() => validateLocalPath("/other/directory/video.mp4", basePath)).toThrow("Path must be under");
  });

  it("rejects non-video extensions", () => {
    expect(() => validateLocalPath("/media/videos/file.txt", basePath)).toThrow("Unsupported file extension");
    expect(() => validateLocalPath("/media/videos/file.exe", basePath)).toThrow("Unsupported file extension");
    expect(() => validateLocalPath("/media/videos/file.js", basePath)).toThrow("Unsupported file extension");
  });

  it("allows valid video extensions under base path", () => {
    expect(() => validateLocalPath("/media/videos/clip.mp4", basePath)).not.toThrow();
    expect(() => validateLocalPath("/media/videos/clip.mov", basePath)).not.toThrow();
    expect(() => validateLocalPath("/media/videos/clip.avi", basePath)).not.toThrow();
    expect(() => validateLocalPath("/media/videos/clip.mkv", basePath)).not.toThrow();
    expect(() => validateLocalPath("/media/videos/clip.webm", basePath)).not.toThrow();
  });

  it("allows relative paths resolved under base path", () => {
    expect(() => validateLocalPath("subdir/clip.mp4", basePath)).not.toThrow();
  });

  it("requires basePath to be set", () => {
    expect(() => validateLocalPath("/media/videos/clip.mp4", "")).toThrow("LOCAL_MEDIA_BASE_PATH not configured");
  });

  it("rejects empty file path", () => {
    expect(() => validateLocalPath("", basePath)).toThrow("File path is required");
  });
});

describe("validateVideoInput", () => {
  const basePath = "/media/videos";

  it("correctly detects URLs (http/https) and validates them", () => {
    const result = validateVideoInput("https://s3.amazonaws.com/bucket/video.mp4", basePath);
    expect(result.type).toBe("url");
    expect(result.path).toBe("https://s3.amazonaws.com/bucket/video.mp4");
  });

  it("correctly detects http:// URLs", () => {
    const result = validateVideoInput("http://s3.amazonaws.com/bucket/video.mp4", basePath);
    expect(result.type).toBe("url");
  });

  it("correctly detects local paths and validates them", () => {
    const result = validateVideoInput("/media/videos/clip.mp4", basePath);
    expect(result.type).toBe("local");
    expect(result.path).toBe("/media/videos/clip.mp4");
  });

  it("throws for invalid URL domains", () => {
    expect(() => validateVideoInput("https://evil.com/video.mp4", basePath)).toThrow("Domain not in allowlist");
  });

  it("throws for invalid local paths", () => {
    expect(() => validateVideoInput("../../etc/passwd", basePath)).toThrow("Path traversal detected");
  });
});
