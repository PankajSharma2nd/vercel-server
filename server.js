// server.js - Web Push Notification Server
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS - this is crucial for GitHub Pages to communicate with your server
app.use(cors({
  origin: '*', // For testing, allow all origins
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Use body parser for JSON requests
app.use(bodyParser.json());

// VAPID keys provided by you
const vapidKeys = {
  publicKey: 'BG1NfrHDgwEIxe4ACqecfs0wB0T2v1DaTE45MgzZU4bovjnGKww8eSv-R8r68W_LmV3WTIzccK01C2FCwM55CLQ',
  privateKey: '2HrMeZ2iXu2dzRG0J6XMqNZ6ZpH504RSEou9ZpCxALY'
};

// Configure web-push with your VAPID keys
webpush.setVapidDetails(
  'mailto:test@example.com', // Change to your email
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory store for subscriptions (would use a database in production)
const subscriptions = [];

// Create a subscription log to track who subscribes
const logSubscription = (subscription, origin) => {
  const logEntry = {
    endpoint: subscription.endpoint,
    origin: origin,
    timestamp: new Date().toISOString()
  };
  
  subscriptions.push(logEntry);
  console.log('New subscription:', logEntry);
  
  // Log to a file as well
  try {
    const logPath = path.join(__dirname, 'subscription_log.json');
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      const data = fs.readFileSync(logPath, 'utf8');
      logs = JSON.parse(data);
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
  
  return logEntry;
};

// Routes
// Serve the VAPID public key
app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
  const subscription = req.body.subscription;
  const origin = req.headers.origin || req.body.origin || 'unknown';
  
  if (!subscription) {
    return res.status(400).json({ error: 'Subscription object is required' });
  }
  
  const logEntry = logSubscription(subscription, origin);
  
  // Send a test notification immediately for confirmation
  const payload = JSON.stringify({
    title: 'Subscription Successful',
    body: 'You have successfully subscribed to push notifications.',
    tag: 'welcome',
    url: origin,
    timestamp: new Date().toISOString()
  });
  
  webpush.sendNotification(subscription, payload)
    .then(() => {
      console.log('Test notification sent successfully');
      res.status(201).json({ 
        success: true, 
        message: 'Subscription successful and test notification sent' 
      });
    })
    .catch(error => {
      console.error('Error sending test notification:', error);
      res.status(201).json({ 
        success: true, 
        message: 'Subscription successful but test notification failed',
        error: error.message
      });
    });
});

// Send a notification to a specific subscription
app.post('/send-notification', (req, res) => {
  const { subscription, title, body, tag, url } = req.body;
  
  if (!subscription) {
    return res.status(400).json({ error: 'Subscription object is required' });
  }
  
  const payload = JSON.stringify({
    title: title || 'New Notification',
    body: body || 'You have a new notification.',
    tag: tag || 'default',
    url: url || '/',
    timestamp: new Date().toISOString()
  });
  
  webpush.sendNotification(subscription, payload)
    .then(() => {
      console.log('Notification sent successfully');
      res.status(200).json({ success: true });
    })
    .catch(error => {
      console.error('Error sending notification:', error);
      res.status(500).json({ 
        error: 'Failed to send notification', 
        details: error.message 
      });
    });
});

// Endpoint to log navigation events
app.post('/log-navigation', (req, res) => {
  const { url, referrer, userAgent, subscriptionEndpoint } = req.body;
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || 'unknown';
  
  const logEntry = {
    url,
    referrer,
    userAgent,
    subscriptionEndpoint,
    origin,
    timestamp
  };
  
  console.log('Navigation event:', logEntry);
  
  // Log to a file
  try {
    const logPath = path.join(__dirname, 'navigation_log.json');
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      const data = fs.readFileSync(logPath, 'utf8');
      logs = JSON.parse(data);
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error writing to log file:', error);
    res.status(500).json({ error: 'Failed to log navigation' });
  }
});

// Get all subscriptions (for testing only - would require authentication in production)
app.get('/subscriptions', (req, res) => {
  res.json(subscriptions);
});

// Get navigation logs (for testing only - would require authentication in production)
app.get('/navigation-logs', (req, res) => {
  try {
    const logPath = path.join(__dirname, 'navigation_log.json');
    
    if (!fs.existsSync(logPath)) {
      return res.json([]);
    }
    
    const data = fs.readFileSync(logPath, 'utf8');
    const logs = JSON.parse(data);
    res.json(logs);
  } catch (error) {
    console.error('Error reading log file:', error);
    res.status(500).json({ error: 'Failed to retrieve navigation logs' });
  }
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('Push Notification Server is running');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
