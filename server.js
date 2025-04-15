// server.js - Tracking Server for Vercel Navigation Experiment
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Configure CORS to allow requests from any origin
app.use(cors({
  origin: '*', // For testing - in production, restrict to your domains
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(bodyParser.json());

// VAPID keys for web push notifications
// In production, use environment variables
const vapidKeys = {
  publicKey: 'BG1NfrHDgwEIxe4ACqecfs0wB0T2v1DaTE45MgzZU4bovjnGKww8eSv-R8r68W_LmV3WTIzccK01C2FCwM55CLQ',
  privateKey: '2HrMeZ2iXu2dzRG0J6XMqNZ6ZpH504RSEou9ZpCxALY'
};

// Configure web-push
webpush.setVapidDetails(
  'mailto:youremail@example.com', // Change to your email
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory store for subscriptions and logs
const subscriptions = [];
const navigationLogs = [];
const subscriptionLogs = [];

// Routes

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Tracking Server is running');
});

// Serve VAPID public key
app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Subscribe to push notifications
app.post('/subscribe', (req, res) => {
  const subscription = req.body.subscription;
  const url = req.body.url || 'unknown';
  const timestamp = req.body.timestamp || new Date().toISOString();
  const userAgent = req.body.userAgent || 'unknown';
  
  if (!subscription) {
    return res.status(400).json({ error: 'Subscription object is required' });
  }
  
  // Store subscription
  subscriptions.push(subscription);
  
  // Log subscription
  const subscriptionLog = {
    endpoint: subscription.endpoint,
    url,
    userAgent,
    timestamp,
    ip: req.ip, // IP address of the client
    headers: req.headers,
  };
  
  subscriptionLogs.push(subscriptionLog);
  console.log('New subscription:', subscriptionLog);
  
  // Send a confirmation notification
  const payload = JSON.stringify({
    title: 'Subscription Successful',
    body: 'You have successfully subscribed to push notifications.',
    tag: 'welcome',
    data: {
      url: url,
      timestamp
    }
  });
  
  webpush.sendNotification(subscription, payload)
    .then(() => {
      console.log('Welcome notification sent successfully');
      res.status(201).json({ 
        success: true, 
        message: 'Subscription successful and welcome notification sent' 
      });
    })
    .catch(error => {
      console.error('Error sending welcome notification:', error);
      res.status(201).json({ 
        success: true, 
        message: 'Subscription successful but welcome notification failed',
        error: error.message
      });
    });
});

// Log navigation events
app.post('/log-navigation', (req, res) => {
  const { 
    url, 
    referrer, 
    userAgent, 
    subscriptionEndpoint, 
    timestamp,
    source 
  } = req.body;
  
  // Create log entry
  const navigationLog = {
    url: url || 'unknown',
    referrer: referrer || 'unknown',
    userAgent: userAgent || req.get('User-Agent') || 'unknown',
    subscriptionEndpoint: subscriptionEndpoint || 'not-subscribed',
    timestamp: timestamp || new Date().toISOString(),
    ip: req.ip, // IP address of the client
    origin: req.headers.origin || 'unknown',
    source: source || 'unknown'
  };
  
  // Store in memory and log to console
  navigationLogs.push(navigationLog);
  console.log('Navigation event:', navigationLog);
  
  res.status(200).json({ success: true });
});

// Send a notification to all subscriptions
app.post('/send-notification', (req, res) => {
  const { title, body, url } = req.body;
  
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  
  if (subscriptions.length === 0) {
    return res.status(404).json({ error: 'No subscriptions found' });
  }
  
  const payload = JSON.stringify({
    title,
    body,
    tag: 'notification',
    data: {
      url: url || '/',
      timestamp: new Date().toISOString()
    }
  });
  
  // Send notifications to all subscriptions
  const sendPromises = subscriptions.map(subscription => {
    return webpush.sendNotification(subscription, payload)
      .catch(error => {
        console.error('Error sending notification:', error);
        return { error: error.message, endpoint: subscription.endpoint };
      });
  });
  
  Promise.all(sendPromises)
    .then(results => {
      res.status(200).json({
        success: true,
        sent: results.filter(result => !result.error).length,
        failed: results.filter(result => result.error).length,
        errors: results.filter(result => result.error)
      });
    });
});

// Get navigation logs
app.get('/navigation-logs', (req, res) => {
  res.json(navigationLogs);
});

// Get subscription logs
app.get('/subscription-logs', (req, res) => {
  res.json(subscriptionLogs);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Tracking Server is running on port ${PORT}`);
});
