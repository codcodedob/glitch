// pages/api/stripe/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

const WH = process.env.STRIPE_WEBHOOK_SECRET!;

// TODO: wire to your real user store (Firebase/Supabase)
async function setUserAccess(userId: string, data: {
  status: "ACTIVE" | "INACTIVE",
  subscriptionType: string,
  stripeCustomerId?: string | null,
  subEndIso?: string | null,
}) {
  // 🔷 Replace this stub with your DB call
  console.log("setUserAccess", userId, data);
}

function unixToIso(n?: number | null) {
  return typeof n === "number" ? new Date(n * 1000).toISOString() : null;
}
function isActive(sub?: Stripe.Subscription | null) {
  return !!sub && sub.status === "active";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const buf = await readRawBody(req);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, req.headers["stripe-signature"]!, WH);
  } catch (e: any) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const mode = session.mode;
        const userId = (session.metadata?.userId as string | undefined) ?? null;
        const customerId = (typeof session.customer === "string" ? session.customer : session.customer?.id) ?? null;
        if (!userId) break;

        if (mode === "subscription") {
          let sub: Stripe.Subscription | null = null;
          if (typeof session.subscription === "string") {
            sub = await stripe.subscriptions.retrieve(session.subscription);
          } else if (session.subscription) sub = session.subscription;

          await setUserAccess(userId, {
            status: isActive(sub) ? "ACTIVE" : "INACTIVE",
            subscriptionType: "GLITCH",
            stripeCustomerId: customerId,
            subEndIso: unixToIso(sub?.current_period_end ?? null),
          });
        } else {
          await setUserAccess(userId, {
            status: "ACTIVE",
            subscriptionType: "GLITCH-ONEOFF",
            stripeCustomerId: customerId,
            subEndIso: null,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.userId as string | undefined) ?? null;
        if (!userId) break;
        await setUserAccess(userId, {
          status: isActive(sub) ? "ACTIVE" : "INACTIVE",
          subscriptionType: "GLITCH",
          stripeCustomerId: (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ?? null,
          subEndIso: unixToIso(sub.current_period_end),
        });
        break;
      }
    }
  } catch (e) {
    console.error(e);
    return res.status(500).send("Webhook handler failed");
  }

  return res.status(200).send("ok");
}
