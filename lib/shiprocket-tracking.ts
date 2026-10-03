// Pure parser for Shiprocket tracking responses (no imports), so it is unit-testable.
/** Pull status, AWB and courier from either Shiprocket tracking shape. */
export function parseShiprocketTracking(data: any, shipmentId?: string) {
  const t = data?.tracking_data ?? (shipmentId ? data?.[shipmentId]?.tracking_data : undefined);
  const track = t?.shipment_track?.[0];
  const activity = t?.shipment_track_activities?.[0];
  return {
    status: (track?.current_status as string | undefined) ?? (activity?.["sr-status-label"] as string | undefined) ?? (activity?.activity as string | undefined) ?? null,
    awbCode: (track?.awb_code as string | undefined) ?? null,
    courierName: (track?.courier_name as string | undefined) ?? null,
  };
}

