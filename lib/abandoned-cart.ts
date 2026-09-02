import { getSupabaseServerClient } from "@/lib/supabase";
import { sendAbandonedCartWhatsApp } from "@/lib/whatsapp-notify";
import { sendAbandonedCartEmail } from "@/lib/email";

type CartSession = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  items: { name: string; quantity: number }[] | null;
  retargeted_at: string | null;
};

/** Sends the abandoned-cart nudge (WhatsApp + email) for exactly one session, and stamps retargeted_at on success. Shared by the sweep cron and the manual per-session admin action. */
export async function retargetOneSession(session: CartSession) {
  const [whatsappSent, emailSent] = await Promise.all([
    session.customer_phone
      ? sendAbandonedCartWhatsApp({
          id: session.id,
          customer_name: session.customer_name,
          customer_phone: session.customer_phone,
          items: session.items ?? [],
        })
      : Promise.resolve(false),
    sendAbandonedCartEmail({
      customer_name: session.customer_name,
      customer_email: session.customer_email,
      items: session.items ?? [],
    }),
  ]);

  if (whatsappSent || emailSent) {
    const supabase = getSupabaseServerClient();
    await supabase.from("cart_sessions").update({ retargeted_at: new Date().toISOString() }).eq("id", session.id);
  }

  return { whatsappSent, emailSent };
}
