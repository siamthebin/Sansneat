import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from 'stripe';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Stripe Payment Intent
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, currency = 'usd' } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Stripe Secret Key not configured" });
      }

      // Lazy initialize Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

  // OAuth Callback Handler for Sanscounts
  app.get("/auth/callback", (req, res) => {
    const { code } = req.query;
    
    // In a real scenario, you would exchange the code for tokens here.
    // For this demo, we'll just send a success message back to the opener.
    
    res.send(`
      <html>
        <body style="background: #09090b; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; border: 3px solid #ef4444; border-top-color: transparent; border-radius: 50%; animate: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <script>
              const userData = {
                uid: 'sanscounts_' + Math.random().toString(36).substr(2, 9),
                name: 'Sanscounts User',
                email: 'user@sanscounts.com',
                photoURL: 'https://i.postimg.cc/wvXS9k1D/IMG-9128.jpg'
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
