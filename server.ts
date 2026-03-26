console.log("Starting server.ts...");

import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import fs from 'fs';

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    // We don't have a service account key, but we can try to use default credentials
    // or just skip custom token generation if it fails.
  });
  console.log("Firebase Admin initialized.");
} catch (e) {
  console.error("Firebase Admin initialization failed:", e);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  console.log("Initializing startServer()...");
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // API Route for Stripe Payment Intent
    app.post("/api/create-payment-intent", async (req, res) => {
      try {
        const { amount, currency = 'usd', customerId, saveCard, email, name, paymentMethodId } = req.body;

        if (!process.env.STRIPE_SECRET_KEY) {
          return res.status(500).json({ error: "Stripe Secret Key not configured" });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia' as any,
        });

        const params: any = {
          amount: Math.round(amount * 100),
          currency: currency,
          payment_method_types: ['card'],
        };

        let targetCustomerId = customerId;

        if (saveCard && !paymentMethodId) {
          if (!targetCustomerId) {
            const customer = await stripe.customers.create({ email, name });
            targetCustomerId = customer.id;
          }
          params.setup_future_usage = 'off_session';
        }

        if (targetCustomerId) {
          params.customer = targetCustomerId;
        }

        if (paymentMethodId) {
          params.payment_method = paymentMethodId;
          params.confirm = true;
          params.return_url = req.headers.origin ? `${req.headers.origin}/` : 'http://localhost:3000/';
        }

        const paymentIntent = await stripe.paymentIntents.create(params);

        res.json({
          clientSecret: paymentIntent.client_secret,
          customerId: targetCustomerId,
          status: paymentIntent.status,
          requiresAction: paymentIntent.status === 'requires_action'
        });
      } catch (error: any) {
        console.error("Stripe Error:", error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // API Route for Stripe Setup Intent (Saving a card)
    app.post("/api/create-setup-intent", async (req, res) => {
      try {
        const { email, name, customerId } = req.body;

        if (!process.env.STRIPE_SECRET_KEY) {
          return res.status(500).json({ error: "Stripe Secret Key not configured" });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia' as any,
        });

        let targetCustomerId = customerId;

        if (!targetCustomerId) {
          const customer = await stripe.customers.create({ email, name });
          targetCustomerId = customer.id;
        }

        const setupIntent = await stripe.setupIntents.create({
          customer: targetCustomerId,
          payment_method_types: ['card'],
        });

        res.json({
          clientSecret: setupIntent.client_secret,
          customerId: targetCustomerId,
        });
      } catch (error: any) {
        console.error("Stripe Setup Error:", error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // API Route to get saved payment methods
    app.post("/api/get-payment-methods", async (req, res) => {
      try {
        const { customerId } = req.body;

        if (!process.env.STRIPE_SECRET_KEY) {
          return res.status(500).json({ error: "Stripe Secret Key not configured" });
        }

        if (!customerId) {
          return res.json({ paymentMethods: [] });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia' as any,
        });

        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });

        res.json({
          paymentMethods: paymentMethods.data,
        });
      } catch (error: any) {
        console.error("Stripe Get Methods Error:", error.message);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/health", (req, res) => {
      res.json({ status: "ok" });
    });

    // OAuth Callback Handler for Sanscounts
    app.get("/auth/callback", async (req, res) => {
      const { code } = req.query;
      
      // In a real scenario, you would exchange the code for tokens here.
      // For this demo, we'll generate a mock user and a Firebase Custom Token if possible.
      
      const email = 'sloudsan@gmail.com'; // Use the user's email to match the admin rule
      const uid = 'sanscounts_' + Buffer.from(email).toString('hex').substr(0, 20);
      
      let firebaseToken = null;
      try {
        // This will only work if we have service account credentials or are in a supported environment
        firebaseToken = await admin.auth().createCustomToken(uid, { email, email_verified: true });
        console.log("Generated Firebase Custom Token for:", email);
      } catch (e) {
        console.error("Failed to generate custom token:", e);
      }

      res.send(`
        <html>
          <body style="background: #09090b; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <div style="width: 40px; height: 40px; border: 3px solid #ef4444; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
              <script>
                const userData = {
                  uid: '${uid}',
                  name: 'Sanscounts User',
                  email: '${email}',
                  photoURL: 'https://i.postimg.cc/wvXS9k1D/IMG-9128.jpg',
                  firebaseToken: ${firebaseToken ? `'${firebaseToken}'` : 'null'}
                };
                
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'SANSCOUNTS_AUTH_SUCCESS', 
                    payload: userData 
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authenticating with Sanscounts...</p>
            </div>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </body>
        </html>
      `);
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting Vite in middleware mode...");
      try {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("Vite middleware attached.");
      } catch (viteError) {
        console.error("Error creating Vite server:", viteError);
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (serverError) {
    console.error("Critical server error:", serverError);
  }
}

startServer();
