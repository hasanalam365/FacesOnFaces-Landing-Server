// config/gocardless.js
const gocardlessModule = require("gocardless-nodejs");
const { Environments } = require("gocardless-nodejs/constants");

// Depending on the installed version, gocardless-nodejs is compiled either
// as a plain CJS function export (older versions) or as a TS "export default"
// that ends up under `.default` when required with plain `require()`
// (newer versions). Handle both so this doesn't break on upgrade.
const gocardlessFactory =
  typeof gocardlessModule === "function"
    ? gocardlessModule
    : gocardlessModule.default;

if (typeof gocardlessFactory !== "function") {
  throw new Error(
    "Could not resolve the gocardless-nodejs client factory — check your installed version of the package."
  );
}

const client = gocardlessFactory(
  process.env.GOCARDLESS_ACCESS_TOKEN,
  process.env.GOCARDLESS_ENVIRONMENT === "live"
    ? Environments.Live
    : Environments.Sandbox,
  { raiseOnIdempotencyConflict: true }
);

module.exports = client;