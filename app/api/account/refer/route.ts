import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import { getOrCreateReferralCode } from "@/lib/referrals";
import { getSetting } from "@/lib/settings";
import { sendReferralInviteEmail } from "@/lib/email";
import { sendReferralInviteWhatsApp } from "@/lib/whatsapp-notify";
import { getBrandProfile } from "@/lib/brand";

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const friendName = String(body?.friendName ?? "").trim();
  const friendPhone = String(body?.friendPhone ?? "").trim();
  const friendEmail = String(body?.friendEmail ?? "").trim();

  if (!friendName || (!friendPhone && !friendEmail)) {
    return NextResponse.json({ error: "Enter a name and a phone number or email" }, { status: 400 });
  }

  try {
    const referralCode = await getOrCreateReferralCode(customer.id);
    const discountSetting = await getSetting("REFERRAL_DISCOUNT_RUPEES");
    const discountRupees = discountSetting ? Number(discountSetting) : 200;

    let emailSent = false;
    let whatsappSent = false;

    if (friendEmail) {
      emailSent = await sendReferralInviteEmail(
        friendEmail,
        friendName,
        customer.name,
        referralCode,
        discountRupees
      );
    }
    if (friendPhone) {
      const brand = await getBrandProfile();
      const referralUrl = `${brand.siteUrl.replace(/\/$/, "")}/?ref=${referralCode}`;
      whatsappSent = await sendReferralInviteWhatsApp(
        friendPhone,
        friendName,
        customer.name ?? "A friend",
        referralUrl
      );
    }

    if (!emailSent && !whatsappSent) {
      return NextResponse.json(
        { error: "Could not send the invite — check the email/phone and try again" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, emailSent, whatsappSent });
  } catch (err) {
    console.error("Failed to send referral invite", err);
    return NextResponse.json({ error: "Could not send the invite" }, { status: 500 });
  }
}
