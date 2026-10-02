import { test } from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_TEMPLATE, firstNameOrThere, renderSupportBody, isTemplateUsable } from "./support-template.ts";

test("support_followup is a one-variable UTILITY template", () => {
  assert.equal(SUPPORT_TEMPLATE.name, "support_followup");
  assert.equal(SUPPORT_TEMPLATE.category, "UTILITY");
  assert.equal(SUPPORT_TEMPLATE.body.match(/\{\{\d\}\}/g)?.length, 1);
  assert.ok(SUPPORT_TEMPLATE.body.includes("Reply here and we'll take it from there."));
});
test("first name from conversation, then customer, else 'there'", () => {
  assert.equal(firstNameOrThere("riya sharma", "X"), "Riya");
  assert.equal(firstNameOrThere(null, "Anun Dhawan"), "Anun");
  assert.equal(firstNameOrThere(null, "  "), "there");
  assert.equal(firstNameOrThere("+91 98765", undefined), "there");
});
test("rendered body fills the name", () => {
  assert.ok(renderSupportBody("Riya").startsWith("Hi Riya, this is Travaholic"));
});
test("only approved UTILITY rows are usable", () => {
  assert.ok(isTemplateUsable({ status: "APPROVED", category: "UTILITY" }));
  assert.ok(!isTemplateUsable({ status: "pending", category: "UTILITY" }));
  assert.ok(!isTemplateUsable({ status: "approved", category: "MARKETING" }));
  assert.ok(!isTemplateUsable(null));
});
