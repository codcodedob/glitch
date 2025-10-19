import * as functions from "firebase-functions/v2/https";
import Stripe from "stripe";
import * as admin from "firebase-admin";
import { PLAN_BY_PRICE } from "./stripePlansLocal"; // duplicate map here or import from shared

admin.initializeApp();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-09-30.clover" });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// helper: update your users collection
async function upsertUserById(
  userId: string,
  patch: Partial<{
    stripeCustomerId: string;
    subscriptionType: string;
    status: string;
    subEndIso: string | null;
    trialUsed: boolean;
    updatedAt: string;
  }>
) {
  const ref = admin.firestore().collection("users").doc(userId);
  await ref.set(
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export const stripeWebhook = functions.onRequest(
  { secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  async (req, res) => {
    let evt: Stripe.Event;

    try {
      const sig = req.headers["stripe-signature"] as string;
      evt = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (evt.type) {
        case "checkout.session.completed": {
          const session = evt.data.object as Stripe.Checkout.Session;
          const userId = (session.metadata?.userId as string) || "";
          const customerId = session.customer as string | null;
          const email = session.customer_details?.email || session.customer_email || null;

          // We don’t set plan here because the subscription object arrives in a separate event.
          if (userId) {
            await upsertUserById(userId, {
              stripeCustomerId: customerId || "",
              status: "ACTIVE",
              trialUsed: true,
            });
          } else if (email) {
            // OPTIONAL: if you keep users keyed by email
            // const snap = await admin.firestore().collection("users").where("email", "==", email).limit(1).get();
            // if (!snap.empty) await upsertUserById(snap.docs[0].id, { stripeCustomerId: customerId || "" });
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = evt.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const priceId = (sub.items?.data?.[0]?.price?.id) || "";
          const plan = PLAN_BY_PRICE[priceId];
          const status = (sub.status || "active").toUpperCase(); // "ACTIVE" / "CANCELED" etc.
          const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

          // find user by customerId
          const snap = await admin.firestore().collection("users")
            .where("stripeCustomerId", "==", customerId)
            .limit(1).get();

          if (!snap.empty) {
            await upsertUserById(snap.docs[0].id, {
              subscriptionType: plan || "GLITCH", // default if price map missing
              status,
              subEndIso: periodEnd,
            });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = evt.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;

          const snap = await admin.firestore().collection("users")
            .where("stripeCustomerId", "==", customerId)
            .limit(1).get();

          if (!snap.empty) {
            await upsertUserById(snap.docs[0].id, {
              status: "CANCELED",
            });
          }
          break;
        }

        default:
          // ignore
          break;
      }

      return res.json({ received: true });
    } catch (e: any) {
      console.error("Webhook handler error", e);
      return res.status(500).json({ error: "webhook handler failed" });
    }
  }
);
