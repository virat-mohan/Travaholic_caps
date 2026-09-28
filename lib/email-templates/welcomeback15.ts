// "Welcome back" win-back email for past customers (Sept 2026) — the
// Postcards from India look, 15% off with WELCOMEBACK15 for 24 hours from
// each recipient's send. Rendered per recipient by lib/email-campaigns.ts.
export function renderWelcomeBack15Email(endsLabel: string, unsubscribeUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Travaholic: 15% off for 24 hours</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:#f0eee4;}
  .display{font-family:'Anton',Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
  .sans{font-family:'Inter',Helvetica,Arial,sans-serif;}
  a{color:#101820;}
  @media (max-width:600px){ .col{display:block!important;width:100%!important;} .pad{padding-left:20px!important;padding-right:20px!important;} .h1{font-size:44px!important;line-height:46px!important;} }
</style>
</head>
<body style="margin:0;padding:0;background:#f0eee4;">
<div style="display:none;max-height:0;overflow:hidden;">15% off everything for the next 24 hours. Free shipping on prepaid orders.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eee4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#f0eee4;">

  <!-- Hero -->
  <tr><td style="background:#101820;padding:0;">
    <a href="https://www.travaholic.in/shop?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15"><img src="https://www.travaholic.in/images/social/tv-05oct.jpg" width="600" alt="Bandstand, Mumbai: City Slicker Black" style="display:block;width:100%;height:auto;border:0;"></a>
  </td></tr>
  <tr><td class="pad" style="background:#101820;padding:32px 40px 36px;" align="left">
    <p class="sans" style="margin:0 0 10px;color:#e6c68f;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">For our Travaholics · 24 hours only</p>
    <h1 class="display h1" style="margin:0;color:#f0eee4;font-size:56px;line-height:58px;font-weight:400;">Your next story<br>is 15% off.</h1>
    <p class="sans" style="margin:18px 0 0;color:#f0eee4;opacity:.85;font-size:16px;line-height:25px;">It's been a while. New chapters have landed, and for the next 24 hours you get 15% off every cap. Free shipping on every prepaid order, and Buy 3, Get 1 Free still applies.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
      <td style="border:2px dashed #e6c68f;padding:12px 20px;" class="display"><span style="color:#e6c68f;font-size:26px;letter-spacing:2px;">WELCOMEBACK15</span></td>
    </tr></table>
    <p class="sans" style="margin:10px 0 26px;color:#f0eee4;opacity:.6;font-size:12px;">Applied automatically when you shop from this email · ends ${endsLabel}</p>
    <a href="https://www.travaholic.in/shop?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15" class="sans" style="display:inline-block;background:#e6c68f;color:#101820;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:2px;text-transform:uppercase;padding:16px 34px;">Shop the collection</a>
  </td></tr>

  <!-- Section title -->
  <tr><td class="pad" style="padding:40px 40px 16px;">
    <p class="sans" style="margin:0 0 6px;color:#4a4a42;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">Postcards from India</p>
    <h2 class="display" style="margin:0;color:#101820;font-size:34px;line-height:38px;font-weight:400;">Stories you can wear</h2>
  </td></tr>

  <!-- Product grid -->
  <tr><td class="pad" style="padding:0 34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="col" width="50%" valign="top" style="padding:6px;">
          <a href="https://www.travaholic.in/chapter/travaholic-orange?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15" style="text-decoration:none;"><img src="https://www.travaholic.in/images/social/tv-09oct.jpg" width="260" alt="Travaholic Orange" style="display:block;width:100%;height:auto;border:0;">
          <p class="display" style="margin:10px 0 2px;color:#101820;font-size:20px;">Travaholic Orange</p>
          <p class="sans" style="margin:0;color:#4a4a42;font-size:13px;">Johari Bazaar, Jaipur · <s>₹1,399</s> <b style="color:#101820;">₹1,189</b></p></a>
        </td>
        <td class="col" width="50%" valign="top" style="padding:6px;">
          <a href="https://www.travaholic.in/chapter/travaholic-sky?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15" style="text-decoration:none;"><img src="https://www.travaholic.in/images/social/tv-16oct.jpg" width="260" alt="Travaholic Sky" style="display:block;width:100%;height:auto;border:0;">
          <p class="display" style="margin:10px 0 2px;color:#101820;font-size:20px;">Travaholic Sky</p>
          <p class="sans" style="margin:0;color:#4a4a42;font-size:13px;">Chandratal, Spiti · <s>₹1,399</s> <b style="color:#101820;">₹1,189</b></p></a>
        </td>
      </tr>
      <tr>
        <td class="col" width="50%" valign="top" style="padding:16px 6px 6px;">
          <a href="https://www.travaholic.in/chapter/junglee?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15" style="text-decoration:none;"><img src="https://www.travaholic.in/images/email/junglee-product-v1.jpg" width="260" alt="Junglee" style="display:block;width:100%;height:auto;border:0;">
          <p class="display" style="margin:10px 0 2px;color:#101820;font-size:20px;">Junglee</p>
          <p class="sans" style="margin:0;color:#4a4a42;font-size:13px;">Our joint bestseller · <s>₹1,399</s> <b style="color:#101820;">₹1,189</b></p></a>
        </td>
        <td class="col" width="50%" valign="top" style="padding:16px 6px 6px;">
          <a href="https://www.travaholic.in/chapter/dunes-maroon?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15" style="text-decoration:none;"><img src="https://www.travaholic.in/images/social/tv-23oct.jpg" width="260" alt="Dunes Maroon" style="display:block;width:100%;height:auto;border:0;">
          <p class="display" style="margin:10px 0 2px;color:#101820;font-size:20px;">Dunes Maroon</p>
          <p class="sans" style="margin:0;color:#4a4a42;font-size:13px;">Sam Dunes, Jaisalmer · <s>₹1,399</s> <b style="color:#101820;">₹1,189</b></p></a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Perks strip -->
  <tr><td class="pad" style="padding:36px 40px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(16,24,32,.15);border-bottom:1px solid rgba(16,24,32,.15);">
      <tr>
        <td class="sans" align="center" style="padding:16px 4px;color:#101820;font-size:13px;font-weight:600;">Free shipping<br><span style="font-weight:400;color:#4a4a42;">on prepaid orders</span></td>
        <td class="sans" align="center" style="padding:16px 4px;color:#101820;font-size:13px;font-weight:600;">Buy 3, Get 1 Free<br><span style="font-weight:400;color:#4a4a42;">applied at checkout</span></td>
        <td class="sans" align="center" style="padding:16px 4px;color:#101820;font-size:13px;font-weight:600;">15% off<br><span style="font-weight:400;color:#4a4a42;">for 24 hours</span></td>
      </tr>
    </table>
  </td></tr>

  <!-- Final CTA -->
  <tr><td align="center" style="padding:28px 40px 40px;">
    <a href="https://www.travaholic.in/shop?coupon=WELCOMEBACK15&utm_source=email&utm_medium=campaign&utm_campaign=welcomeback15" class="sans" style="display:inline-block;background:#101820;color:#f0eee4;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:2px;text-transform:uppercase;padding:16px 34px;">Pick your chapter</a>
  </td></tr>

  <!-- Footer -->
  <tr><td class="pad sans" align="center" style="padding:0 40px 32px;color:#4a4a42;font-size:12px;line-height:19px;">
    Travaholic · Stories You Can Wear · <a href="https://www.travaholic.in" style="color:#4a4a42;">travaholic.in</a><br>
    Questions? Reply to this email or <a href="https://wa.me/918800339125" style="color:#4a4a42;">WhatsApp us</a>.<br>
    You're getting this because you've ordered from Travaholic. <a href="${unsubscribeUrl}" style="color:#4a4a42;">Unsubscribe</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;
}
