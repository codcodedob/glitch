// pages/api/stripe/create-portal-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

type Body = {
  customerId: string; // you must store & pass the Stripe customer id for the signed-in user
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { customerId } = req.body as Body;
  if (!customerId) return res.status(400).json({ error: "Missing customerId" });

  try {
    const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/billing`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error("create-portal-session failed:", e);
    return res.status(500).json({ error: "Portal session failed" });
  }
}
