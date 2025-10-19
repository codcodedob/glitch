"use client";
import { loadStripe } from "@stripe/stripe-js";
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutButton({ priceId }: { priceId: string }) {
  const handleClick = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const { url } = await res.json();
    window.location.href = url;
  };
  return (
    <button
      onClick={handleClick}
      className="rounded-xl border border-fuchsia-700 bg-fuchsia-800 px-4 py-2 font-semibold text-white hover:bg-fuchsia-700"
    >
      Buy Glitch Pass – $1
    </button>
  );
}
