import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from 'stripe';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Stripe with secret key from environment
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

  app.use(express.json());

  // API Route for Stripe Payment Intent
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, currency = 'usd' } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Stripe Secret Key not configured" });
      }

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency: currency,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Stripe Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
