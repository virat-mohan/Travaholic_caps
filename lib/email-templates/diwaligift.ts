// Diwali gifting email (Oct 2026): a person wearing the cap, one offer (GIFT10,
// 10% off until the end of 8 Nov IST), order by 1 Nov for Diwali delivery.
// Same look as welcomeback15. Rendered per recipient by lib/email-campaigns.ts.
export type DiwaliSegment = "past" | "incomplete";

export const DIWALI_LINK =
  "https://www.travaholic.in/shop?coupon=GIFT10&utm_source=email&utm_medium=campaign&utm_campaign=diwali_gifting_2026";

export function diwaliCopy(segment: DiwaliSegment) {
  return segment === "incomplete"
    ? {
        eyebrow: "Your cap is still waiting",
        h1: "Give it as a<br>Diwali gift.",
        intro:
          "You were close to taking a Travaholic cap home. This Diwali, give one to someone you love, with a note in your own words at checkout. GIFT10 takes 10% off your order until Diwali.",
      }
    : {
        eyebrow: "For our Travaholics · Diwali",
        h1: "The best trips<br>end at home.",
        intro:
          "This Diwali, give someone the cap that was named after a place they love, with a note in your own words at checkout. GIFT10 takes 10% off your order until Diwali.",
      };
}

export function diwaliSubject(segment: DiwaliSegment, first: string | null) {
  const base = segment === "incomplete" ? "A cap, wrapped for Diwali" : "A Diwali gift with a note in your own words";
  return first ? `${first}, ${base[0].toLowerCase()}${base.slice(1)}` : base;
}

export function renderDiwaliGiftEmail(segment: DiwaliSegment, unsubscribeUrl: string) {
  const c = diwaliCopy(segment);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Travaholic: a Diwali gift</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:#f0eee4;}
  .display{font-family:'Anton',Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
  .sans{font-family:'Inter',Helvetica,Arial,sans-serif;}
  a{color:#101820;}
  @media (max-width:600px){ .pad{padding-left:20px!important;padding-right:20px!important;} .h1{font-size:44px!important;line-height:46px!important;} }
</style>
</head>
<body style="margin:0;padding:0;background:#f0eee4;">
<div style="display:none;max-height:0;overflow:hidden;">GIFT10 takes 10% off until Diwali. Free shipping on prepaid orders. Order by 1 Nov for Diwali delivery.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eee4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#f0eee4;">

  <tr><td style="background:#101820;padding:0;">
    <a href="${DIWALI_LINK}"><img src="https://www.travaholic.in/images/social/postcard-02-jaipur-feed.jpg" width="600" alt="Johari Bazaar, Jaipur: Travaholic Orange" style="display:block;width:100%;height:auto;border:0;"></a>
  </td></tr>
  <tr><td class="pad" style="background:#101820;padding:32px 40px 36px;" align="left">
    <p class="sans" style="margin:0 0 10px;color:#e6c68f;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">${c.eyebrow}</p>
    <h1 class="display h1" style="margin:0;color:#f0eee4;font-size:56px;line-height:58px;font-weight:400;">${c.h1}</h1>
    <p class="sans" style="margin:18px 0 0;color:#f0eee4;opacity:.85;font-size:16px;line-height:25px;">${c.intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
      <td style="border:2px dashed #e6c68f;padding:12px 20px;" class="display"><span style="color:#e6c68f;font-size:26px;letter-spacing:2px;">GIFT10</span></td>
    </tr></table>
    <p class="sans" style="margin:10px 0 26px;color:#f0eee4;opacity:.6;font-size:12px;">Applied when you shop from this email · valid until the end of 8 Nov · one offer per order</p>
    <a href="${DIWALI_LINK}" class="sans" style="display:inline-block;background:#e6c68f;color:#101820;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:2px;text-transform:uppercase;padding:16px 34px;">Choose a gift</a>
  </td></tr>

  <tr><td class="pad" style="padding:36px 40px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(16,24,32,.15);border-bottom:1px solid rgba(16,24,32,.15);">
      <tr>
        <td class="sans" align="center" style="padding:16px 4px;color:#101820;font-size:13px;font-weight:600;">Free shipping<br><span style="font-weight:400;color:#4a4a42;">on prepaid orders</span></td>
        <td class="sans" align="center" style="padding:16px 4px;color:#101820;font-size:13px;font-weight:600;">Order by 1 Nov<br><span style="font-weight:400;color:#4a4a42;">for Diwali delivery</span></td>
        <td class="sans" align="center" style="padding:16px 4px;color:#101820;font-size:13px;font-weight:600;">Buy 3, Get 1 Free<br><span style="font-weight:400;color:#4a4a42;">applied at checkout</span></td>
      </tr>
    </table>
    <p class="sans" style="margin:16px 0 0;color:#4a4a42;font-size:13px;line-height:20px;">One offer per order: whichever saves you more applies, and they do not stack.</p>
  </td></tr>

  <tr><td class="pad sans" align="center" style="padding:28px 40px 32px;color:#4a4a42;font-size:12px;line-height:19px;">
    Travaholic · Stories You Can Wear · <a href="https://www.travaholic.in" style="color:#4a4a42;">travaholic.in</a><br>
    Questions? Reply to this email or <a href="https://wa.me/918800339125" style="color:#4a4a42;">WhatsApp us</a>.<br>
    You're getting this because you've shopped with Travaholic. <a href="${unsubscribeUrl}" style="color:#4a4a42;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;
}
