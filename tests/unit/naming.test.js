import { test } from "node:test";
import assert from "node:assert/strict";
import { detectName, domainLabel, fileNameFor, slugify } from "../../src/shared/naming.js";
import { cleanFontFamily, cleanName, cleanSourceUrl, cleanUrl } from "../../src/shared/sanitize.js";

test("domain label (FR-30)", () => {
  assert.equal(domainLabel("www.stripe.com"), "stripe");
  assert.equal(domainLabel("shop.acme.com"), "acme");
  assert.equal(domainLabel("www.bbc.co.uk"), "bbc");
  assert.equal(domainLabel("example.co.jp"), "example");
  assert.equal(domainLabel("192.168.1.10"), "");
  assert.equal(domainLabel("localhost"), "");
  assert.equal(domainLabel(""), "");
});

test("name detection follows FR-30 order (AC-18)", () => {
  const base = { hostname: "www.acmecorp.com", title: "Home - Acme Corp", ogSiteName: "", applicationName: "" };
  assert.equal(detectName({ ...base, ogSiteName: "ACME", applicationName: "Acme App" }), "ACME");
  assert.equal(detectName({ ...base, applicationName: "Acme App" }), "Acme App");
  assert.equal(detectName(base), "Acme Corp");
  assert.equal(detectName({ ...base, hostname: "stripe.com", title: "Stripe | Financial Infrastructure" }), "Stripe");
  assert.equal(detectName({ ...base, hostname: "www.bbc.co.uk", title: "Home" }), "Bbc");
  // Segment shorter than 3 characters is not matched inside the label.
  assert.equal(detectName({ ...base, hostname: "acme.com", title: "A | B" }), "Acme");
  // "site" inside "Website" is not a match; IP host takes the first segment.
  assert.equal(detectName({ ...base, hostname: "10.0.0.1", title: "Website | Admin" }), "Website");
  assert.equal(detectName({ ...base, hostname: "localhost", title: "" }), "Site");
  assert.equal(detectName({ ...base, hostname: "10.0.0.1", title: "" }), "Site");
  // Em dash separator.
  assert.equal(detectName({ ...base, hostname: "figma.com", title: "Figma \u2014 The Collaborative Interface Design Tool" }), "Figma");
});

test("file names (AC-19)", () => {
  assert.equal(fileNameFor("Acme Corp, Inc.", "acme.com"), "acme-corp-inc_design.md");
  assert.equal(fileNameFor("Café Déjà Vu", "cafe.fr"), "cafe-deja-vu_design.md");
  assert.equal(fileNameFor("株式会社", "example.co.jp"), "example_design.md");
  assert.equal(fileNameFor("", "10.0.0.1"), "site_design.md");
  const long = fileNameFor("word ".repeat(18), "x.com");
  const slug = long.replace("_design.md", "");
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith("-"));
  assert.equal(slugify("--Hello   World--"), "hello-world");
});

test("sanitizers (FR-40)", () => {
  assert.equal(cleanName('Evil"\nname: x'), 'Evil" name: x');
  assert.equal(cleanName("a".repeat(150)).length, 100);
  assert.equal(cleanFontFamily('"Söhne Var"'), "Söhne Var");
  assert.equal(cleanFontFamily("Inter`**<b>\u0000"), "Interb");
  assert.equal(cleanFontFamily("x".repeat(80)).length, 64);
  assert.equal(cleanUrl("/logo.svg", "https://acme.com/a/b"), "https://acme.com/logo.svg");
  assert.equal(cleanUrl("javascript:alert(1)", "https://acme.com"), null);
  assert.equal(cleanUrl("data:image/png;base64,AAA", "https://acme.com"), null);
  assert.equal(cleanSourceUrl("https://u:p@acme.com/p?token=1#x"), "https://acme.com/p");
  assert.equal(cleanSourceUrl("file:///home/me/page.html"), "");
});
