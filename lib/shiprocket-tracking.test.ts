import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShiprocketTracking } from "./shiprocket-tracking.ts";

const track = { shipment_track: [{ current_status: "Delivered", awb_code: "AWB1", courier_name: "Delhivery" }] };

test("reads the top-level tracking_data shape (track by AWB)", () => {
  assert.deepEqual(parseShiprocketTracking({ tracking_data: track }), { status: "Delivered", awbCode: "AWB1", courierName: "Delhivery" });
});
test("reads the shipment-id keyed shape", () => {
  assert.equal(parseShiprocketTracking({ "123": { tracking_data: track } }, "123").status, "Delivered");
});
test("falls back to the latest activity label", () => {
  const d = { tracking_data: { shipment_track: [{}], shipment_track_activities: [{ "sr-status-label": "IN TRANSIT" }] } };
  assert.equal(parseShiprocketTracking(d).status, "IN TRANSIT");
});
test("null when Shiprocket has nothing", () => {
  assert.equal(parseShiprocketTracking({}).status, null);
});
