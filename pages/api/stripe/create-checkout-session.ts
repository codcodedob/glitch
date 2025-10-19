// pages/api/stripe/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { priceId, userId, mode = "subscription" } = req.body as {
    priceId: string; userId: string; mode?: "payment" | "subscription";
  };

  const success_url = `${process.env.APP_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url  = `${process.env.APP_BASE_URL}/?checkout=cancelled`;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url,
    cancel_url,
    metadata: { userId },
  };

  if (mode === "subscription") {
    params.subscription_data = { metadata: { userId } };
  }

  const session = await stripe.checkout.sessions.create(params);
  return res.status(200).json({ id: session.id, url: session.url });
}
