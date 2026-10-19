<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Application diagnostics

HTTP route handlers have a global two-minute timeout. A handler that exceeds
the limit returns `504 Gateway Timeout`; this bounds how long the client waits
but does not cancel a database operation that is already running.
Each HTTP request is logged on arrival and completion with its start timestamp,
method, path, response status, duration, request query/body, and response body.
Sensitive fields such as passwords, tokens, cookies, secrets, email addresses,
and phone numbers are redacted, and payloads are bounded to avoid oversized
log entries.

## Access-token authorization

Protected routes authorize using the user ID and role in the signed access
token instead of querying the user collection on every request. Existing
access tokens without a role claim must be replaced by signing in again. Role
changes take effect when a new access token is issued.

## Inventory

Product list and single-product read routes accept a `select` query parameter
to return only requested public fields. For example,
`GET /products?select=title,price` and
`GET /products/<productId>?select=title,price` return only those fields.
Comma-separated selections are validated against the product response
allowlist; MongoDB operators, nested paths, and internal fields are rejected
with `400 Bad Request`.

Product stock is stored in the inventory collection rather than on product
documents. On startup, the application migrates valid legacy `stock` values
from existing products into inventory and removes the old field. The migration
preserves existing inventory records if it is run again.
Product `availabilityStatus` is derived from inventory quantity (`In Stock`
when quantity is above zero, otherwise `Out of Stock`) and is no longer stored
on product documents or accepted in product create/update requests.

Every account can buy by default. Creating a business enables the additional
seller capability without removing buyer access. Businesses are owned through
`Business.ownerId`; login and `GET /auth/me` derive the owner's business list
from that relationship. Create a business with one or more address IDs already
owned by the current user:

```http
POST /businesses
Content-Type: application/json

{
  "businessName": "Rahul Fresh Store",
  "addressIds": ["<owner address MongoDB _id>"]
}
```

Business creation sets `sellerEnabled` on the account. The access JWT already
issued before business creation does not gain the new claim; call
`POST /auth/refresh` with the refresh token (or sign in again) before using
seller-only routes.

The catalog `Product` is shared; a business offer is represented by an
inventory record keyed by product and business, with that business's INR price,
stock, and reserved quantity. A business owner may offer any catalog product.
List offers (including the business name and its configured service addresses)
with `GET /products/:productId/offers`. Create and update offers as the owner:

```http
POST /inventory
Content-Type: application/json

{
  "productId": "<product MongoDB _id>",
  "businessId": "<owned business MongoDB _id>",
  "unitPrice": 54.00,
  "quantity": 54
}
```

`PATCH /inventory/:productId?businessId=<businessId>` updates the offer's stock
and optional price; `DELETE` on that URL removes the offer. Stock available to
buyers is `quantity - reservedQuantity`. A catalog product cannot be deleted
while any business has an offer for it. Legacy inventory without a business
association is preserved, but must be re-listed under a business to be
available as a buyer-selectable offer.

Cart entries identify both product and business, so the same product can be
added from different sellers. Send `businessId` in
`PUT /carts/me/products/:productId`; cart responses include the business name,
seller-specific price, and item totals. Adding to a cart checks current offer
stock but does not reserve it.
Business service addresses must remain owned by the business owner and cannot
be deleted while referenced by a business. Remove an address from the
business's configured address list first.

### Orders, payments, and sales

`GET /orders/delivery-windows?timeZone=Asia/Kolkata` returns hourly windows
whose starts are at least two hours in the future. Checkout verifies the
selected address and that every seller's configured service addresses share
the buyer's country and either city or state. Each seller delivery is separate
under the order, but uses the single selected one-hour delivery window.

`POST /orders` accepts the buyer's `addressId`, `deliveryWindowStart`, and
`timeZone`. It revalidates cart products, offer prices, and stock; reserves
each offer; snapshots the buyer address, business, and item details; and
creates the corresponding seller deliveries and payment record. On simulated
success, stock reservations are committed and the cart is cleared. On
simulated failure, reservations are released and the failed order/payment are
retained. This flow uses MongoDB transactions; the database must run as a
replica set or a transaction-capable sharded cluster.

Payments are fake and never move real funds. Set
`FAKE_PAYMENT_RESULT=simulated_succeeded` (default) or
`FAKE_PAYMENT_RESULT=simulated_failed` to exercise both outcomes. The fake
gateway is disabled when `NODE_ENV=production`.

Buyers can read their own orders with `GET /orders/me` and
`GET /orders/:orderId`; payment records are available through
`GET /payments/me` and `GET /payments/:paymentId`. Sellers can use
`GET /seller/sales` for gross confirmed sales by business and product,
quantities sold, order counts, and the order/payment IDs behind those totals.
Amounts are INR and simulated; gross sales are not profit or a payout amount.
Real payment capture, refunds, seller payouts, order editing, rescheduling,
buyer order cancellation, and seller capacity/slot booking are not implemented
by this MVP.

## Addresses

Authenticated users can manage their own addresses using `GET /addresses`,
`GET /addresses/:id`, `POST /addresses`, `PATCH /addresses/:id`, and
`DELETE /addresses/:id`. Address reads and mutations are scoped to the current
user; other users' addresses return `404`. The server generates `_id`,
`createdAt`, and `updatedAt`. Address responses include the owning `userId`,
which is always derived from the authenticated user, never accepted from the
request body. `metadata.isVerified` is server-controlled.

To remember a selected address, send
`PATCH /users/latest-address` with `{ "addressId": "<address MongoDB _id>" }`.
The endpoint requires authentication, confirms that the address belongs to
the current user, and updates `users.latestSelectedAddressId`; clients cannot
select another user's address. This field defaults to `null`, and missing
values on existing user records are backfilled to `null` at application
startup. Login and `GET /auth/me` responses include
`latestSelectedAddress: { id, formattedAddress }` when that address still
exists and belongs to the user; otherwise, the populated field is `null`.
The address ID is available within this object and is not duplicated as a
top-level response field.

Create an address with a formatted address and optional Google Places fields:

```json
{
  "googlePlaceId": "ChIJ2eLE1mOWmwARsY5ptr4Jw80",
  "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
  "components": {
    "streetNumber": "1600",
    "route": "Amphitheatre Pkwy",
    "city": "Mountain View",
    "state": "CA",
    "postalCode": "94043",
    "country": "US"
  },
  "location": {
    "type": "Point",
    "coordinates": [-122.0842499, 37.4220656]
  },
  "metadata": {
    "rawUserInput": "googlehq"
  }
}
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
