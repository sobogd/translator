import Stripe from "stripe";
import { PLANS, type PlanId } from "./plans";

const PRODUCT_NAME = "IQ Translate";

// One Stripe account is shared with the other sobogd apps (iq-rest), and Stripe
// fans every event out to every webhook endpoint of the account. Everything we
// create carries this tag so our webhook can tell our own events from iq-rest's
// instead of guessing from the customer email (the same person can be a
// customer in both products).
export const APP_TAG = "iq-translate";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

let productId: string | null = null;

async function getOrCreateProductId(): Promise<string> {
  if (productId) return productId;
  const stripe = getStripe();
  const found = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}' AND active:'true'`,
  });
  if (found.data[0]) {
    productId = found.data[0].id;
    return productId;
  }
  const created = await stripe.products.create({ name: PRODUCT_NAME, metadata: { app: APP_TAG } });
  productId = created.id;
  return productId;
}

// Prices are created on demand (never hand-configured in the Stripe
// Dashboard). The idempotency key means repeat calls for the same plan
// reuse the same Price object instead of minting duplicates.
export async function getOrCreatePriceId(planId: PlanId): Promise<string> {
  const plan = PLANS[planId];
  const stripe = getStripe();
  const product = await getOrCreateProductId();
  const unitAmount = Math.round(plan.priceMonthly * 100);

  const existing = await stripe.prices.list({ product, active: true, limit: 100 });
  const match = existing.data.find(
    (p) => p.unit_amount === unitAmount && p.currency === "usd" && p.recurring?.interval === "month",
  );
  if (match) return match.id;

  const created = await stripe.prices.create(
    {
      currency: "usd",
      product,
      unit_amount: unitAmount,
      recurring: { interval: "month" },
      metadata: { plan: planId, app: APP_TAG },
    },
    { idempotencyKey: `price:usd:${unitAmount}:month:${planId}` },
  );
  return created.id;
}

export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "INACTIVE";
  }
}
