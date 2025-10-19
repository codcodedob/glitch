// pages/api/stripe/session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
const stripe = key ? new Stripe(key, { apiVersion: "2025-09-30.clover" }) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    const session_id = String(req.query.session_id || "");
    if (!session_id) return res.status(400).json({ ok: false, error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription", "line_items.data.price.product"],
    });

    const line_items = (session.line_items?.data ?? []).map((li) => ({
      id: li.id!,
      description:
        (typeof li.description === "string" && li.description) ||
        (typeof li.price?.product !== "string" ? (li.price?.product as Stripe.Product)?.name : null) ||
        null,
      quantity: li.quantity ?? null,
      amount_subtotal: li.amount_subtotal ?? null,
    }));

    return res.status(200).json({
      ok: true,
      session: {
        id: session.id,
        customer_email: session.customer_details?.email ?? null,
        payment_status: session.payment_status,
        mode: session.mode as "payment" | "subscription",
        subscription_status:
          session.mode === "subscription" && typeof session.subscription !== "string"
            ? (session.subscription as Stripe.Subscription).status
            : null,
        currency: session.currency ?? null,
        amount_total: session.amount_total ?? null,
        line_items,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Failed to retrieve session" });
  }
}
