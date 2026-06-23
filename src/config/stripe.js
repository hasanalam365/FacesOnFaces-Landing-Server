// const Stripe = require("stripe");

// if (!process.env.STRIPE_SECRET_KEY) {
//   throw new Error("❌ STRIPE_SECRET_KEY missing in environment variables");
// }

// //  Live key vs Test key guard
// if (
//   process.env.NODE_ENV === "production" &&
//   process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")
// ) {
//   throw new Error("❌ Test Stripe key used in production!");
// }

// module.exports = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: "2025-05-28.basil", 
// });

const Stripe = require("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("❌ STRIPE_SECRET_KEY missing in environment variables");
}

module.exports = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-05-28.basil",
});