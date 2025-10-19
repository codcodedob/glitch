import type { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "micro";
import { stripe } from "@/lib/stripe";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const sig = req.headers["stripe-signature"] as string;
  const buf = await buffer(req);
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  try {
    const event = stripe.webhooks.constructEvent(buf, sig, secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      // TODO: mark user as paid
      console.log("Checkout complete:", session.id);
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
