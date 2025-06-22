// Express + Apollo Server v4 Entry Point
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');
const schema = require('./schema'); // Should export typeDefs and resolvers
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServer } = require('@apollo/server');

const stripe = require('./stripe/stripe');
const { syncModels } = require('./models');
const bodyParser = require('body-parser');
const authHelpers = require('./modules/auth/helpers');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Stripe webhook - must be before express.json()
app.post('/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  // Your Stripe event logic here...
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const tier = await SubscriptionTier.findOne({ where: { code: session.metadata.tierCode } });
    if (userId && tier) {
      await Subscription.create({
        userId,
        tierId: tier.id,
        stripeSubscriptionId: session.subscription,
        active: true,
        validUntil: null,
      });
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const subId = event.data.object.id;
    const subscription = await Subscription.findOne({ where: { stripeSubscriptionId: subId } });
    if (subscription) {
      subscription.active = false;
      await subscription.save();
    }
  }

  res.json({ received: true });
});

// Connect to DB (Sequelize)
db.authenticate()
  .then(async () => {
    console.log('DB connected');
    // Sync all models to create tables if they don't exist
    await syncModels();
    console.log('DB models synced');
    // Now you can start your server
    startServer();
  })
  .catch((err) => console.error('DB connection error:', err));

async function startServer() {
  // Apollo v4 server
  const apolloServer = new ApolloServer({
    schema
  });
  await apolloServer.start();

  // Use Apollo express middleware at /graphql
  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';
        const userPayload = authHelpers.getUserFromToken(token);
        const adminPayload = authHelpers.getAdminFromToken(token);
        return {
          token,
          user: userPayload && userPayload.id ? userPayload : null,
          admin: adminPayload && adminPayload.adminId ? adminPayload : null,
          deviceInfo: req.headers['user-agent'],
          ip: req.ip,
        };
      }
    })
  );

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`🚀 SixByFive TCG backend (Apollo v4) at http://localhost:${port}/graphql`);
  });
}
