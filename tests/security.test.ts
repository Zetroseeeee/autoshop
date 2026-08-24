import { describe, expect, it } from "vitest";
import { safeNextPath } from "../lib/auth";
import { isPrivateAddress, verifyPublicUrl, BlockedAddressError } from "../lib/egress";

describe("safeNextPath — open redirect", () => {
  it("keeps genuine same-origin paths", () => {
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("/run?store=asos.com")).toBe("/run?store=asos.com");
  });

  it("rejects control characters browsers strip (tab/CR/LF) that turn into //evil.com", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
    expect(safeNextPath("/\r/evil.com")).toBe("/");
    expect(safeNextPath("/\t//evil.com")).toBe("/");
  });

  it("rejects protocol-relative, absolute and backslash targets", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("does not bounce back to the auth screens", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/signup?x=1")).toBe("/");
  });
});

describe("isPrivateAddress", () => {
  it("flags loopback, RFC1918, link-local and CGNAT", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("flags IPv6 loopback, ULA, link-local and IPv4-mapped private", () => {
    for (const ip of ["::1", "::", "fe80::1", "fd00::1", "fc00::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("verifyPublicUrl", () => {
  const blocked = async (url: string) => {
    await expect(verifyPublicUrl(url), url).rejects.toBeInstanceOf(BlockedAddressError);
  };

  it("blocks internal literals, including cloud metadata", async () => {
    await blocked("http://169.254.169.254/latest/meta-data/");
    await blocked("http://127.0.0.1:3000/api/items");
    await blocked("http://10.0.0.5/admin");
    await blocked("http://[::1]/");
    await blocked("http://192.168.0.1/");
  });

  it("blocks internal-only hostnames", async () => {
    await blocked("http://localhost/");
    await blocked("http://foo.internal/");
    await blocked("http://printer.local/");
    await blocked("http://db.corp/");
  });

  it("blocks non-web schemes and odd ports", async () => {
    await blocked("file:///etc/passwd");
    await blocked("ftp://example.com/x");
    await blocked("http://example.com:22/");
    await blocked("http://example.com:6379/");
  });

  it("allows ordinary store URLs", async () => {
    await expect(verifyPublicUrl("https://www.asos.com/prd/123")).resolves.toMatchObject({ family: expect.any(Number) });
    await expect(verifyPublicUrl("https://www.endclothing.com/gb/x.html")).resolves.toBeTruthy();
  });
});
