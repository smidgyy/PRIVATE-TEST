import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import session from "express-session";
import { rateLimit } from "express-rate-limit";
import hpp from "hpp";

// Load environment variables safely
try {
  dotenv.config();
} catch (e) {
  console.error(">>> [BOOT] Failed to load .env file:", e);
}
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

console.log(">>> [BOOT] Server process started at:", new Date().toISOString());
console.log(">>> [BOOT] Node Version:", process.version);
console.log(">>> [BOOT] Current Directory:", process.cwd());

// Lazy database getter to prevent startup crashes
let _db: any = null;

// Mock Firestore for session-only mode when credentials are missing
class MockFirestore {
  private storage: Map<string, Map<string, any>> = new Map();

  collection(name: string) {
    if (!this.storage.has(name)) {
      this.storage.set(name, new Map());
    }
    const col = this.storage.get(name)!;
    return {
      doc: (id: string) => ({
        get: async () => ({
          exists: col.has(id),
          data: () => col.get(id)
        }),
        set: async (data: any, options?: { merge?: boolean }) => {
          const existing = col.get(id) || {};
          if (options?.merge) {
            col.set(id, { ...existing, ...data });
          } else {
            col.set(id, data);
          }
          return { id };
        },
        update: async (data: any) => {
          const existing = col.get(id) || {};
          col.set(id, { ...existing, ...data });
          return { id };
        },
        delete: async () => {
          col.delete(id);
          return { id };
        }
      })
    };
  }

  settings() {}
}

async function getDb() {
  try {
    if (_db) return _db;

    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    
    let firebaseConfig: any = {};
    try {
      if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.warn(">>> [DB] Failed to parse firebase-applet-config.json, using defaults.");
    }

    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    console.log(">>> [DB] Target Database ID:", databaseId);

    let app;
    try {
      if (getApps().length === 0) {
        let serviceAccount: any = null;

        // 1. Try to load from ENV
        const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (saEnv) {
          console.log(">>> [DB] Attempting to load service account from ENV...");
          try {
            let rawEnv = saEnv.trim();
            
            // Handle cases where the ENV is wrapped in literal escaped quotes
            if (rawEnv.startsWith('\\"') && rawEnv.endsWith('\\"')) {
              rawEnv = rawEnv.substring(2, rawEnv.length - 2).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            } else if (rawEnv.startsWith('"') && rawEnv.endsWith('"')) {
               try {
                  const parsedOnce = JSON.parse(rawEnv);
                  if (typeof parsedOnce === 'string') rawEnv = parsedOnce;
               } catch (e) {}
            }

            try {
              serviceAccount = JSON.parse(rawEnv);
            } catch (e) {
              // Aggressive unescape for common copy-paste issues
              const unescaped = rawEnv.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
              serviceAccount = JSON.parse(unescaped);
            }

            if (typeof serviceAccount === 'string') {
              serviceAccount = JSON.parse(serviceAccount);
            }
          } catch (e: any) {
            console.error("!!! [DB] Failed to parse service account from ENV:", e.message);
          }
        } 
        
        // 2. Try to load from FILE if ENV failed
        if (!serviceAccount && fs.existsSync(serviceAccountPath)) {
          console.log(">>> [DB] Attempting to load service account from FILE...");
          try {
            const raw = fs.readFileSync(serviceAccountPath, 'utf8');
            serviceAccount = JSON.parse(raw);
            if (typeof serviceAccount === 'string') {
              serviceAccount = JSON.parse(serviceAccount);
            }
          } catch (e: any) {
            console.error("!!! [DB] Failed to parse service-account.json:", e.message);
          }
        }

        if (!serviceAccount || typeof serviceAccount !== 'object') {
          console.warn("!!! [DB WARNING] Service account credentials not found or invalid. Falling back to MockFirestore.");
          _db = new MockFirestore();
          return _db;
        }

        // CRITICAL: Aggressive Private Key Sanitization
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          let pk = serviceAccount.private_key;
          pk = pk.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
          pk = pk.replace(/^['"\s\uFEFF]+|['"\s\uFEFF]+$/g, '');
          
          if (!pk.startsWith("-----BEGIN PRIVATE KEY-----")) {
            const headerIndex = pk.indexOf("-----BEGIN PRIVATE KEY-----");
            if (headerIndex !== -1) pk = pk.substring(headerIndex);
          }
          
          serviceAccount.private_key = pk;
        }

        console.log(">>> [DB] Initializing Admin SDK for Project:", serviceAccount.project_id);
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      } else {
        app = getApp();
      }

      if (databaseId && databaseId !== "(default)") {
        console.log(">>> [DB] Connecting to named database (REST):", databaseId);
        _db = getFirestore(app, databaseId);
      } else {
        console.log(">>> [DB] Connecting to (default) database (REST)");
        _db = getFirestore(app);
      }

      // _db.settings({ preferRest: true }); // Removed invalid setting for firebase-admin
      console.log(">>> [DB] Firestore instance ready.");
      return _db;
    } catch (e: any) {
      console.error("!!! [DB] Admin SDK initialization failed, falling back to MockFirestore:", e.message);
      _db = new MockFirestore();
      return _db;
    }
  } catch (err: any) {
    console.error("!!! [DB FATAL]", err.message);
    _db = new MockFirestore();
    return _db;
  }
}

// Global error handling
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  const app = express();
  
  // Hostinger and most VPS providers provide the port via process.env.PORT
  const PORT = Number(process.env.PORT) || 3000;
  
  // 1. LISTEN IMMEDIATELY to satisfy Hostinger
  console.log("SERVER STARTING...");
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("SERVER RUNNING");
    console.log(`>>> [SERVER] Running on port ${PORT}`);
    // Warm up the database in the background
    getDb().catch(e => console.error("!!! [WARMUP ERROR] Database failed to warm up:", e.message));
  });

  const allowedOrigins = [
    "https://auroraos.fun",
    "http://localhost:3000",
    "http://localhost:5173"
  ];

  app.use(cors({
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list or is a .run.app domain
      const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".run.app");
      
      if (!isAllowed) {
        console.warn(`>>> [CORS] Origin check: ${origin} | isAllowed: ${isAllowed}`);
        return callback(new Error("Not allowed by CORS"));
      }
      return callback(null, true);
    },
    credentials: true
  }));
  app.use(express.json());
  app.use(hpp()); // Step 2: Reject duplicate or polluted parameters

  app.set('trust proxy', 1); // Trust first proxy (Hostinger/Cloud Run)

  // Step 6: Add basic rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
  });

  const strictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
  });

  // Apply rate limiting to sensitive API routes
  app.use("/api/validateCommand", strictLimiter);
  app.use("/api/getContent", limiter);
  app.use("/api/sendMessage", strictLimiter);

  if (!process.env.SESSION_SECRET) {
    console.error("FATAL ERROR: SESSION_SECRET is missing.");
    process.exit(1);
  }

  // Step 1: Implement server-managed session
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: true, // Required for SameSite=None
      sameSite: 'none', // Required for iframe context
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Middleware to ensure userId is in session
  app.use(async (req: any, res: any, next: any) => {
    try {
      if (!req.session) {
        console.error(">>> [SERVER] req.session is undefined. Check session middleware configuration.");
        return next();
      }
      if (!req.session.userId) {
        req.session.userId = "user_" + crypto.randomBytes(8).toString("hex");
        console.log(`>>> [SESSION] Initialized new userId: ${req.session.userId} for session: ${req.sessionID}`);
      }
      next();
    } catch (err) {
      console.error(">>> [SERVER] Session middleware error:", err);
      next();
    }
  });
  
  // JSON Parsing Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      console.error(">>> [SERVER] JSON Parse Error:", err.message);
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    next(err);
  });

  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), 'dist'));
  const baseDir = isProduction ? 'dist' : 'public';

  const protectedRoutes = [
    "/stage1.html", 
    "/stage2.html", 
    "/resonance.html", 
    "/node02.html",
    "/node04.html", 
    "/node04/index.html",
    "/node03/secret.html", 
    "/node03/secret/index.html",
    "/article.html", 
    "/node03/index.html",
    "/archive/index.html"
  ];

  const LOCKED_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>ACCESS RESTRICTED</title>
    <style>
        body { 
            background: #000; 
            color: #f00; 
            font-family: 'Courier New', Courier, monospace; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0;
            text-transform: uppercase;
            overflow: hidden;
            text-align: center;
        }
        .box { 
            border: 1px solid #f00; 
            padding: 40px; 
            text-align: center; 
            box-shadow: 0 0 20px rgba(255,0,0,0.2);
            background: rgba(20, 0, 0, 0.8);
            position: relative;
        }
        .box::before {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: repeating-linear-gradient(0deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px);
            pointer-events: none;
        }
        h1 { font-size: 1.5rem; margin: 0 0 15px 0; letter-spacing: 2px; }
        p { font-size: 1rem; margin: 0; opacity: 0.8; }
        .glitch { animation: glitch 1s linear infinite; }
        @keyframes glitch {
            2%, 64% { transform: translate(2px,0) skew(0deg); }
            4%, 60% { transform: translate(-2px,0) skew(0deg); }
            62% { transform: translate(0,0) skew(5deg); }
        }
    </style>
</head>
<body>
    <div class="box glitch">
        <h1>ARCHIVE ACCESS DENIED</h1>
        <p>Node authentication required.</p>
    </div>
</body>
</html>`;

  // 1. FIRST: STATIC FILES (MANDATORY - MUST BE FIRST)
  // We wrap express.static to ensure it handles assets but skips protected HTML routes
  app.use((req: any, res: any, next: any) => {
    try {
      // 0. API BYPASS: Never serve API routes as static files
      if (req.path.startsWith("/api")) {
        return next();
      }
      
      let normalizedPath = path.posix.normalize(req.path);
      if (normalizedPath.endsWith('/')) {
        normalizedPath += 'index.html';
      } else if (!normalizedPath.includes('.')) {
        if (protectedRoutes.includes(normalizedPath + '/index.html')) {
          normalizedPath += '/index.html';
        }
      }
      
      // If it's a protected HTML route, skip static serving so it hits the protection logic later
      if (protectedRoutes.includes(normalizedPath)) {
        return next();
      }
      
      // Force MIME types for critical assets if needed, though express.static usually handles this
      if (req.path.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
      if (req.path.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
      
      console.log(`>>> [STATIC] Attempting to serve: ${req.path} from ${baseDir}`);
      return express.static(baseDir)(req, res, next);
    } catch (err) {
      console.error("STATIC FILE MIDDLEWARE ERROR:", err);
      next();
    }
  });

  // 2. SECOND: API ROUTES
  // (API routes are defined below and will be reached if static serving falls through)

  async function getOrCreateUserData(userId: string) {
    try {
      if (!userId) {
        console.error(">>> [DB] getOrCreateUserData: No userId provided");
        return null;
      }
      const db = await getDb();
      if (!db) {
        console.error(">>> [DB] getOrCreateUserData: Database unavailable");
        throw new Error("Database unavailable");
      }
      
      console.log(`>>> [DB] Fetching userData for: ${userId}`);
      
      // Add timeout to prevent hanging
      const userDocPromise = db.collection("users").doc(userId).get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore timeout")), 5000)
      );
      
      const userDoc: any = await Promise.race([userDocPromise, timeoutPromise]);
      let userData = userDoc.data();
      
      if (!userData) {
        console.log(`>>> [DB] Initializing new user session: ${userId}`);
        userData = {
          userId,
          createdAt: new Date().toISOString(),
          stage: 1,
          stage4_progress: 0
        };
        await db.collection("users").doc(userId).set(userData);
      }
      return userData;
    } catch (error) {
      console.error(`>>> [DB] Error in getOrCreateUserData for ${userId}:`, error);
      throw error;
    }
  }

  // API Routes
  app.get("/api/health", (req: any, res: any) => {
    try {
      console.log("HIT: GET /api/health");
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error in /api/health:", error);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });

  app.post("/api/init", async (req: any, res: any) => {
    try {
      console.log(">>> [API] HIT: POST /api/init");
      const userId = req.session?.userId;
      console.log(">>> [API] /api/init: userId from session:", userId);
      if (!userId) {
        console.error(">>> [API] /api/init: Missing userId in session. Session ID:", req.sessionID);
        return res.status(401).json({ status: "error", message: "Unauthorized: Session missing" });
      }
      
      console.log(">>> [API] /api/init: Calling getOrCreateUserData");
      const userData = await getOrCreateUserData(userId);
      console.log(">>> [API] /api/init: userData received:", !!userData);
      if (!userData) {
        console.error(">>> [API] /api/init: Failed to get or create userData for:", userId);
        return res.status(500).json({ status: "error", message: "Failed to initialize user data" });
      }
      
      console.log(">>> [API] /api/init: SUCCESS");
      res.json({ status: "success", state: userData });
    } catch (error: any) {
      console.error("!!! [API] Error in /api/init:", error.message, error.stack);
      res.status(500).json({ status: "error", message: "Internal Server Error: " + error.message });
    }
  });

  app.post("/api/resetProgress", async (req: any, res: any) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

      const db = await getDb();
      await db.collection("users").doc(userId).set({
        userId,
        stage: 1,
        node02_step: 1,
        messenger_step: 0,
        stage4_progress: 0,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error in /api/resetProgress:", error);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });

  app.get("/api/userState", async (req: any, res: any) => {
    try {
      console.log(">>> [API] HIT: GET /api/userState");
      const userId = req.session?.userId;
      console.log(">>> [API] /api/userState: userId from session:", userId);
      if (!userId) {
        console.error(">>> [API] /api/userState: Missing userId in session. Session ID:", req.sessionID);
        return res.status(401).json({ status: "error", message: "Unauthorized" });
      }

      const db = await getDb();
      if (!db) {
        console.error(">>> [API] /api/userState: Database unavailable");
        return res.status(500).json({ status: "error", message: "Database unavailable" });
      }
      
      console.log(`>>> [API] /api/userState: Fetching data for ${userId}`);
      
      // Add timeout to prevent hanging
      const userDocPromise = db.collection("users").doc(userId).get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore timeout")), 5000)
      );
      
      const userDoc: any = await Promise.race([userDocPromise, timeoutPromise]);
      const userData = userDoc.data() || { stage: 1, node02_step: 1 };

      console.log(">>> [API] /api/userState: SUCCESS");
      res.json({
        currentStage: userData.stage || 1,
        node02_step: userData.node02_step || 1,
        messenger_step: userData.messenger_step || 0,
        stage1_vale_unlocked: !!userData.stage1_vale_unlocked,
        stage2_unlocked: !!userData.stage2_unlocked,
        stage3_greed: !!userData.stage3_greed,
        stage3_death: !!userData.stage3_death,
        stage3_money: !!userData.stage3_money,
        stage3_gold: !!userData.stage3_gold,
        stage3_ground: !!userData.stage3_ground,
        stage3_messenger_complete: !!userData.stage3_messenger_complete,
        stage4_unlocked: !!userData.stage4_unlocked,
        stage4_forum_unlocked: !!userData.stage4_forum_unlocked,
        stage4_observer_logs_opened: !!userData.stage4_observer_logs_opened,
        stage4_network_trace_viewed: !!userData.stage4_network_trace_viewed,
        stage4_complete: !!userData.stage4_complete,
        stage4_progress: userData.stage4_progress || 0,
        aurora_archive_unlocked: !!userData.aurora_archive_unlocked,
        stage2_phase1_complete: !!userData.stage2_phase1_complete,
        stage2_phase2_complete: !!userData.stage2_phase2_complete,
        stage2_phase3_complete: !!userData.stage2_phase3_complete
      });
    } catch (error: any) {
      console.error("!!! [API] Error in /api/userState:", error.message, error.stack);
      res.status(500).json({ status: "error", message: "Internal Server Error: " + error.message });
    }
  });

  app.get("/api/getNode02", async (req: any, res: any) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

      const db = await getDb();
      if (!db) return res.status(500).json({ status: "error", message: "Database unavailable" });
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data() || {};

      const hasAccess = !!userData.stage2_unlocked;
      
      if (!hasAccess) {
        return res.status(403).json({ status: "error", message: "ACCESS DENIED: Signal alignment required." });
      }

      const filePath = path.join(process.cwd(), baseDir, "node02.html");
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ status: "error", message: "Node 02 content not found" });
      }
    } catch (error) {
      console.error("Error in /api/getNode02:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/getArticle", async (req: any, res: any) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

      const db = await getDb();
      if (!db) return res.status(500).json({ status: "error", message: "Database unavailable" });
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data() || {};

      const hasAccess = !!userData.stage2_phase1_complete;
      
      if (!hasAccess) {
        return res.status(403).json({ status: "error", message: "ACCESS DENIED: Archive records locked." });
      }

      const filePath = path.join(process.cwd(), baseDir, "article.html");
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ status: "error", message: "Article content not found" });
      }
    } catch (error) {
      console.error("Error in /api/getArticle:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Removed /api/debug-db for security hardening

const ALLOWED_COMMAND_TYPES = [
  'terminal',
  'archive_password',
  'node02_answer',
  'unlock_node03_secret',
  'get_progression',
  'check_access',
  'ground'
];

function validateUserId(userId: any): string | null {
  if (!userId || typeof userId !== 'string' || userId.length < 5 || userId.length > 128) {
    return null;
  }
  // Basic alphanumeric check for userId to prevent injection or malformed IDs
  if (!/^[a-zA-Z0-9_\-]+$/.test(userId)) {
    return null;
  }
  return userId;
}

  app.post("/api/validateCommand", async (req: any, res: any) => {
    try {
      const { input, type } = req.body; // Ignore extra fields like 'step'
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Unauthorized" });
      }
      
      if (!type || !ALLOWED_COMMAND_TYPES.includes(type)) {
        console.log(`>>> [API] validateCommand: Rejected unknown command type: ${type}`);
        return res.status(400).json({ status: "error", message: "Invalid command type" });
      }

      console.log(`>>> [API] Request: ${type} from user ${userId}. Input: "${input}"`);
      
      const isInputRequired = ['terminal', 'archive_password', 'node02_answer'].includes(type);
      if (isInputRequired && !input) {
        return res.status(400).json({ status: "error", message: "Missing required field: input" });
      }

      if (input !== undefined && typeof input !== 'string') {
        return res.status(400).json({ status: "error", message: "Invalid input type" });
      }

      const fullCmd = (input || "").trim();
      const t = fullCmd.toUpperCase();
      const args = fullCmd.split(/\s+/);
      const baseCmd = args[0].toLowerCase();
      
      const db = await getDb();
      if (!db) return res.status(500).json({ status: "error", message: "Database unavailable" });
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      const currentStage = userData.stage || 1;

      if (type === 'ground') {
        const userData = await db.collection('users').doc(userId).get().then((doc: any) => doc.data() || {});
        if (userData.stage3_ground) return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
        const currentStep = userData.messenger_step || 0;
        if (currentStep < 4) return res.json({ status: 'error', message: 'COMMAND INVALID' });
        
        await db.collection('users').doc(userId).update({ 
          stage3_ground: true,
          stage: 4,
          stage4_unlocked: true,
          stage4_progress: 1
        });
        return res.json({ status: 'success', action: 'unlock_stage4' });
      }

      if (type === 'terminal') {
        if (fullCmd.toLowerCase() === 'decode_vale_archive') {
          if (currentStage < 4 || !userData.stage3_ground) {
            return res.json({ status: 'error', message: 'ACCESS DENIED: Required progression not detected.' });
          }
          
          if (userData.stage1_vale_unlocked) {
            return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
          }
          
          await db.collection('users').doc(userId).update({ 
            stage1_vale_unlocked: true, 
            stage4_progress: Math.max(userData.stage4_progress || 0, 2) 
          });
          
          return res.json({ 
            status: 'success', 
            reply: 'Vale archive decryption sequence initiated... Success. /vale/ directory unlocked.',
            action: 'unlock_vale'
          });
        }
        if (baseCmd === 'decrypt' && args.length > 1 && args[1] === '840291') {
          if (currentStage < 4) return res.json({ status: 'error', message: 'ACCESS DENIED' });
          return res.json({ 
            status: 'success', 
            reply: 'Network trace 840291 verified. External relay active.' 
          });
        }
        if (baseCmd === 'archive_entry' && args.length > 1 && args[1].toUpperCase() === 'K7-4419') {
          if (!userData.stage4_forum_unlocked) {
            return res.json({ status: 'error', message: 'ACCESS DENIED: Forum authentication required.' });
          }
          if (userData.stage4_complete) {
            return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
          }
          if (db) await db.collection('users').doc(userId).update({ 
            stage4_complete: true,
            stage4_progress: 7
          });
          return res.json({ 
            status: 'success', 
            reply: 'Archive entry K7-4419 accepted. Finalizing subject record... Access granted to /archive_entry.html',
            action: 'open_final_archive_page'
          });
        }
        if (baseCmd === 'archive' && args.length > 1 && args[1].toLowerCase() === 'vale') {
          if (!userData.stage1_vale_unlocked) {
            return res.json({ status: 'error', message: 'ACCESS DENIED: Vale archive decryption required.' });
          }
          if (userData.stage4_forum_unlocked) {
            return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
          }
          if (db) await db.collection('users').doc(userId).update({ stage4_forum_unlocked: true });
          return res.json({ status: 'success', action: 'unlock_forum' });
        }
        if (baseCmd === 'archive' && args.length === 1) {
          if (currentStage > 1) return res.json({ status: 'error', message: 'COMMAND INVALID' });
          return res.json({ status: 'success', action: 'require_password' });
        }
        if (baseCmd === 'decrypt' && args.length > 1 && args[1].toLowerCase() === 'depth') {
          if (currentStage !== 3) return res.json({ status: 'error', message: 'ACCESS DENIED' });
          const currentStep = userData.messenger_step || 0;
          if (currentStep < 2) {
            return res.json({ status: 'error', message: 'COMMAND INVALID: Sequence incomplete.' });
          }
          if (userData.stage3_secret_unlocked) {
            return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
          }
          if (db) await db.collection('users').doc(userId).update({ stage3_secret_unlocked: true });
          return res.json({ 
            status: 'success', 
            reply: 'Fragment decrypted. Algorithm: Caesar. Key: THE ARCHIVE REMEMBERS',
            action: 'show_caesar_clue' 
          });
        }
        if (baseCmd === 'ground') {
          if (userData.stage3_ground) return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
          const currentStep = userData.messenger_step || 0;
          if (currentStep < 4) return res.json({ status: 'error', message: 'COMMAND INVALID' });
          
          await db.collection('users').doc(userId).update({ 
            stage3_ground: true,
            stage: 4,
            stage4_unlocked: true,
            stage4_progress: 1
          });
          return res.json({ 
            status: 'success', 
            reply: 'The pattern is complete. Power returns to the ground. Stage 4 Unlocked.',
            action: 'unlock_stage4' 
          });
        }
        return res.json({ status: 'error', message: 'Bad command or file name.' });
      }

      if (type === 'archive_password') {
        if (currentStage > 1 && fullCmd.toUpperCase() === 'THE ARCHIVE REMEMBERS') {
          return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
        }

        if (fullCmd.toUpperCase() === 'THE ARCHIVE REMEMBERS') {
          await db.collection('users').doc(userId).update({ 
            stage2_unlocked: true,
            stage: 2
          });
          return res.json({ status: 'success', action: 'unlock_archive' });
        }
        if (fullCmd.toUpperCase() === 'VALE') {
          if (userData.stage1_vale_unlocked) {
            if (userData.stage4_forum_unlocked) return res.json({ status: 'error', message: 'COMMAND ALREADY USED' });
            await db.collection('users').doc(userId).update({ stage4_forum_unlocked: true });
            return res.json({ status: 'success', action: 'unlock_forum' });
          } else {
            return res.json({ status: 'error', message: 'Access denied.' });
          }
        }
        return res.json({ status: 'error', message: 'Access denied.' });
      }

      if (type === 'node02_answer') {
        if (currentStage !== 2) return res.json({ status: 'error', message: 'ACCESS DENIED' });

        const hash = crypto.createHash('sha256').update(t.toLowerCase()).digest('hex');
        
        // Allow answers to be retried even if already complete
        if (hash === '76576de1cea42a163eb4c35c9af35ad3c3a9b6a1d67ed93f6f99e81ba96d5e22') {
          if (!userData.stage2_phase1_complete) {
            await db.collection('users').doc(userId).update({ stage2_phase1_complete: true });
          }
          return res.json({ status: 'success', success: true, action: 'open_article', msg: "The earth opens. Seek the marginalia." });
        }
        
        if (hash === 'ba6f8ed6d0d150b2a2ab2bebe99540f8c00cafb0ebdbf71a6f0b768c45425ca7') {
          if (!userData.stage2_phase1_complete) return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
          if (!userData.stage2_phase2_complete) {
            await db.collection('users').doc(userId).update({ stage2_phase2_complete: true });
          }
          return res.json({ status: 'success', success: true, action: 'phase2_success', msg: "The flame is extinguished." });
        }
        
        if (hash === '90b7b8654171c04a5e5de1eae884cfd86952739d50d09d9bb7680763e31faee8') {
          if (!userData.stage2_phase2_complete) return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
          if (!userData.stage2_phase3_complete) {
            await db.collection('users').doc(userId).update({ 
              stage2_phase3_complete: true,
              stage: 3 
            });
          }
          return res.json({ status: 'success', success: true, action: 'phase3_success', msg: String.fromCharCode(71, 82, 69, 69, 68) });
        }
        
        return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
      }

      if (type === 'unlock_node03_secret') {
        if (!userData.stage2_phase3_complete) {
          return res.status(403).json({ error: "ACCESS DENIED: Phase 3 not complete." });
        }
        await db.collection('users').doc(userId).update({ 
          stage3_secret_unlocked: true,
          stage: Math.max(userData.stage || 1, 3)
        });
        return res.json({ status: 'success', message: 'The spark has ignited. Node 03 access granted.' });
      }

      if (type === 'get_progression') {
        return res.json({ 
          status: 'success', 
          messenger_step: userData?.messenger_step || 0,
          stage4_progress: userData?.stage4_progress || 0,
          stage2_unlocked: userData?.stage2_unlocked || false,
          stage1_vale_unlocked: userData?.stage1_vale_unlocked || false,
          stage4_forum_unlocked: userData?.stage4_forum_unlocked || false,
          stage3_messenger_complete: userData?.stage3_messenger_complete || false,
          stage3_secret_unlocked: userData?.stage3_secret_unlocked || false,
          stage2_phase1_complete: userData?.stage2_phase1_complete || false,
          stage2_phase2_complete: userData?.stage2_phase2_complete || false,
          stage4_observer_logs_opened: userData?.stage4_observer_logs_opened || false,
          stage4_network_trace_viewed: userData?.stage4_network_trace_viewed || false
        });
      }

    if (type === 'check_access') {
      const { target } = req.body;
      if (!target || typeof target !== 'string') {
        return res.status(400).json({ error: "Invalid target" });
      }
      
      let hasAccess = false;
      if (target === 'node02' || target === 'resonance') {
        hasAccess = !!userData.stage2_unlocked;
      } else if (target === 'node03_secret') {
        hasAccess = !!userData.stage3_secret_unlocked;
      } else if (target === 'node04') {
        hasAccess = !!userData.stage4_unlocked;
      } else if (target === 'observer-folder') {
        hasAccess = (userData.stage4_progress || 0) >= 1;
      } else if (target === 'vale-folder') {
        hasAccess = (userData.stage4_progress || 0) >= 2;
      } else if (target === 'forum') {
        hasAccess = !!userData.stage4_forum_unlocked;
      }
      
      if (hasAccess) {
        return res.json({ status: 'success' });
      } else {
        return res.json({ status: 'error', message: 'Access denied' });
      }
    }

    return res.status(400).json({ error: "Invalid type" });
    } catch (err) {
      console.error("VALIDATE COMMAND ERROR:", err);
      // ALWAYS return JSON (NOT HTML)
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/sendMessage", async (req: any, res: any) => {
    try {
      const { message, contact } = req.body;
      const userId = req.session?.userId;
      
      if (!message || !contact || !userId) {
        return res.status(400).json({ status: "error", message: "Missing or invalid required fields" });
      }

      if (typeof message !== 'string' || typeof contact !== 'string') {
        return res.status(400).json({ status: "error", message: "Invalid input type" });
      }

      let normalized = message.trim().toLowerCase();
      if (normalized === "depth") normalized = "death";

      const db = await getDb();
      if (!db) return res.status(500).json({ status: "error", message: "Database unavailable" });
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      
      const currentStep = userData.messenger_step || 0;
      const currentStage = userData.stage || 1;

      // FIX: Stage 3 specific overrides with immediate return
      if (contact === 'archive') {
        const input = normalized;

        // Handle the first command explicitly to allow progression from Stage 1
        if (input === "the archive remembers") {
          if (currentStage > 1) {
            return res.json({ status: "success", contact, reply: "COMMAND ALREADY USED", action: null });
          }
          await db.collection('users').doc(userId).set({ 
            stage2_unlocked: true,
            stage: 2
          }, { merge: true });
          return res.json({ 
            status: "success", 
            contact, 
            reply: "ACCESS GRANTED. THE ARCHIVE IS NOW OPEN.", 
            action: "unlock_archive" 
          });
        }

        if (currentStage < 3) {
          return res.json({ status: "error", reply: "ACCESS DENIED: Signal alignment required." });
        }

        if (input === "greed") {
          if (userData.stage3_greed) return res.json({ status: "error", reply: "COMMAND ALREADY USED" });
          if (currentStep !== 0) return res.json({ status: "error", reply: "COMMAND INVALID" });
          
          await db.collection("users").doc(userId).set({
            stage3_greed: true,
            messenger_step: 1
          }, { merge: true });
          
          return res.json({
            status: "success",
            reply: `So you solved Vale’s second lock.

Greed was only the beginning.

Greed leaves traces.

Vale tried to erase one of them.

Check the trash.`,
            action: "unlock_recycle_fragment"
          });
        }

        if (input === "death") {
          if (userData.stage3_death) return res.json({ status: "error", reply: "COMMAND ALREADY USED" });
          if (currentStep !== 1) return res.json({ status: "error", reply: "COMMAND INVALID" });

          await db.collection("users").doc(userId).set({
            stage3_death: true,
            messenger_step: 2
          }, { merge: true });
          
          return res.json({
            status: "success",
            reply: `Correct.

Vale encrypted the next fragment.

He knew someone would follow.

Not out of curiosity — but obsession.

Use the terminal.`,
            action: "unlock_terminal_fragment"
          });
        }

        if (input === "money") {
          if (userData.stage3_money) return res.json({ status: "error", reply: "COMMAND ALREADY USED" });
          if (currentStep !== 2) return res.json({ status: "error", reply: "COMMAND INVALID" });

          await db.collection("users").doc(userId).set({
            stage3_money: true,
            messenger_step: 3
          }, { merge: true });
          
          return res.json({
            status: "success",
            reply: `The mask of exchange.

Vale was obsessed with the value we place on things.

He left a trace in the system logs.

Check fragment_3.log.`,
            action: "unlock_fragment_3"
          });
        }

        if (input === "gold") {
          if (userData.stage3_gold) return res.json({ status: "error", reply: "COMMAND ALREADY USED" });
          if (currentStep !== 3) return res.json({ status: "error", reply: "COMMAND INVALID" });

          await db.collection("users").doc(userId).set({
            stage3_gold: true,
            messenger_step: 4
          }, { merge: true });
          
          return res.json({
            status: "success",
            reply: `The final ambition.

Power is the only currency that doesn't depreciate.

But power has a frequency.

Listen to the system's pulse.`,
            action: "unlock_fragment_4"
          });
        }

        if (input === "ground") {
          if (userData.stage3_ground) return res.json({ status: "error", reply: "COMMAND ALREADY USED" });
          if (currentStep !== 4) return res.json({ status: "error", reply: "COMMAND INVALID" });

          await db.collection("users").doc(userId).set({
            stage3_ground: true,
            stage: 4,
            stage4_unlocked: true,
            stage4_progress: 1
          }, { merge: true });
          
          return res.json({
            status: "success",
            reply: `The pattern is complete.

Greed becomes wealth.
Wealth becomes power.
Power returns to the ground.

Vale reached this point.

But he went further.

And whatever he found...

it changed everything.

Stage 4 unlocked. Messenger updated.`,
            action: "unlock_stage4"
          });
        }
      }

      const t = message.trim().toUpperCase();
      let reply = "I'm sorry, I can't help with that right now.";
      let action = null;

      if (contact === 'unknown') {
        const unknownReplies = [
          "You weren't supposed to find this.",
          "It sees you now.",
          "Why are you still here?",
          "You should leave.",
          "You don't understand what you've done.",
          "Aurora is waking up.",
          "The Architect left for a reason.",
          "You're just another ghost in the machine.",
          "The silence was better."
        ];
        reply = unknownReplies[Math.floor(Math.random() * unknownReplies.length)];
      } else if (contact === 'elias') {
        const eliasReplies = [
          "Check the logs again.",
          "Something is missing.",
          "The system isn't behaving normally.",
          "This shouldn't be happening.",
          "Look deeper.",
          "The resonance is getting stronger.",
          "Node 02 is the key.",
          "Don't trust the archive.",
          "They're watching us."
        ];
        reply = eliasReplies[Math.floor(Math.random() * eliasReplies.length)];
      } else if (contact === 'archive') {
        reply = "INVALID INPUT. AWAITING COMMAND.";
      }

      return res.json({ 
        status: "success",
        contact, 
        reply, 
        action 
      });
    } catch (err: any) {
      console.error(">>> [API] sendMessage error:", err.message);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });

  // Content Security: Secure content retrieval endpoint
  app.post('/api/getContent', async (req: any, res: any) => {
    try {
      const { target } = req.body;
      const userId = req.session?.userId;

      if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });
      if (!target || typeof target !== 'string') return res.status(400).json({ status: "error", message: "Invalid or missing target" });

      const db = await getDb();
      if (!db) return res.status(500).json({ status: "error", message: "Database unavailable" });
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData) {
        return res.status(403).json({ status: "error", message: "ACCESS DENIED: No progression found" });
      }

      // Progression update logic based on content access - STRICT ORDER
      if (target === 'network-trace' && userData.stage4_unlocked) {
        // Must have unlocked Vale archive (progress 2) before seeing network trace (progress 3)
        if ((userData.stage4_progress || 0) === 2) {
          await db.collection('users').doc(userId).update({
            stage4_progress: 3,
            stage4_network_trace_viewed: true
          });
          userData.stage4_progress = 3;
          userData.stage4_network_trace_viewed = true;
        }
      }

      if (['observer-log-01', 'observer-log-02', 'observer-log-03'].includes(target) && userData.stage4_unlocked) {
        // Observer logs are available once stage 4 is unlocked
        if (!userData.stage4_observer_logs_opened) {
          await db.collection('users').doc(userId).update({
            stage4_observer_logs_opened: true
          });
          userData.stage4_observer_logs_opened = true;
        }
      }

      const contentMap: { [key: string]: { content: string, title?: string, access: boolean } } = {
        'recycle_fragment': {
          access: userData.stage3_greed || false,
          content: `<p>[FRAGMENT RECOVERY LOG]</p><p>Source: Recycle Bin</p><p>Status: Fragment moved to deleted_user.log</p><p>Trace: 0x8829 -> 0x445A</p>`
        },
        'terminal_fragment': {
          access: userData.stage3_death || false,
          content: `<p>[FRAGMENT RECOVERED]</p><p>Subject: DEATH</p><p>The final state. Not an end, but a transition. The data doesn't disappear; it just changes form. We are all just sequences waiting to be overwritten.</p><p>Aurora isn't a savior. It's a reaper.</p><p>-- END OF LOG --</p>`
        },
        'fragment3': {
          access: userData.stage3_money || false,
          content: `<p>[FRAGMENT RECOVERY LOG - 03]</p><p>Source: Node 03 Archive</p><p>Status: Partially Decrypted</p><p>The Sun's Tears... they aren't just a metaphor. It's a frequency. A relay. The ledger entry #13151405 was just the beginning. The real value is hidden in the casefiles. The subject's obsession holds the key.</p><p>Relay Frequency: [CORRUPTED]</p>`
        },
        'fragment4': {
          access: userData.stage3_gold || false,
          content: `<p>[FRAGMENT RECOVERY LOG - 04]</p><p>Source: Node 03 Archive</p><p>Status: Decrypted</p><p>The rhythm of the machine... it's not just noise. It's a transmission. The second pulse holds the key. Look closely at the second transmission in the music player. The rhythm will reveal the final frequency.</p><p>Hint: [CORRUPTED]</p>`
        },
        'observer-log-01': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('U1lTVEVNIE9CU0VSVkVSIExPRzxicj48YnI+VGltZXN0YW1wOiAwNDoxMjozMTxicj5Ob2RlIGFjY2VzcyByZWNvcmRlZC48YnI+PGJyPlVzZXIgY2xhc3NpZmljYXRpb246IEludmVzdGlnYXRvcjxicj5QYXR0ZXJuIG1hdGNoOiBWQUxFPGJyPjxicj5Nb25pdG9yaW5nIGVzY2FsYXRpb24gZW5hYmxlZC48YnI+PGJyPkZyYWdtZW50OiBkZWNvZGVf', 'base64').toString()
        },
        'observer-log-02': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('U1lTVEVNIE9CU0VSVkVSIExPRzxicj48YnI+VGltZXN0YW1wOiAwNDoxNTowMjxicj5TdWJqZWN0IGJlaGF2aW9yIGFub21hbG91cy48YnI+PGJyPkZyYWdtZW50OiB2YWxlXw==', 'base64').toString()
        },
        'observer-log-03': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('U1lTVEVNIE9CU0VSVkVSIExPRzxicj48YnI+VGltZXN0YW1wOiAwNDoxODo0NDxicj5BcmNoaXZlIGludGVncml0eSBjb21wcm9taXNlZC48YnI+PGJyPkZyYWdtZW50OiBhcmNoaXZl', 'base64').toString()
        },
        'journal-day01': {
          access: userData.stage4_unlocked || false,
          title: 'VALE INVESTIGATION LOG',
          content: '<div class="journal-date">Day 01</div><p>Started investigating the archive system today. It\'s more complex than I thought. The architecture seems to have layers of hidden nodes.</p><p>Node 03 required multiple encoding layers. Someone intentionally hid the internal structure.</p>'
        },
        'journal-day03': {
          access: userData.stage4_unlocked || false,
          title: 'VALE INVESTIGATION LOG',
          content: '<div class="journal-date">Day 03</div><p>There are references to something called "Subjects". A storage system should not track subjects.</p><p>Something about this Archive feels wrong. The system is fighting back. Every time I access a node, the encryption keys rotate.</p>'
        },
        'journal-day05': {
          access: userData.stage4_unlocked || false,
          title: 'VALE INVESTIGATION LOG',
          content: '<div class="journal-date">Day 05</div><p>Noticed anomalies. Someone else was here before me. There are traces of a previous investigator, but their logs were scrubbed.</p><p>Node 04 is heavily restricted. Whatever is stored there is clearly important.</p>'
        },
        'journal-day09': {
          access: userData.stage4_unlocked || false,
          title: 'VALE INVESTIGATION LOG',
          content: '<div class="journal-date">Day 09</div><p>The anomalies are increasing. Fragments of deleted conversations are appearing in the terminal buffer. \'archivist404040\'... who is that?</p><p>Something inside the system noticed me. New log files appeared automatically. The Archive might be monitoring investigators.</p>'
        },
        'journal-day12': {
          access: userData.stage4_unlocked || false,
          title: 'VALE INVESTIGATION LOG',
          content: '<div class="journal-date">Day 12</div><p>The logs now reference my name. I never entered it anywhere. The system shouldn\'t know who I am.</p><p>I\'m not the only one being tracked. There\'s a whole list of us. We\'re all part of the archive now. We\'re the data.</p>'
        },
        'journal-day16': {
          access: userData.stage4_unlocked || false,
          title: 'VALE INVESTIGATION LOG',
          content: '<div class="journal-date">Day 16</div><p>The Archive isn\'t storage. It\'s an observer. Investigators who go too deep become entries.</p><p>If anyone finds this... look me up in the archive. The forum holds the final piece. Good luck, investigator.</p>'
        },
        'terminal-dump': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('W1NZU10gQ09OTkVDVElPTiBURVJNSU5BVEVEPGJyPltTWVNdIEZPUkNFRCBESVNDT05ORUNUPGJyPltTWVNdIEFSQ0hJVkUgTE9DSyBJTklUSUFURUQ=', 'base64').toString()
        },
        'network-trace': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('VFJBQ0UgUk9VVEU6PGJyPjxicj42MTcyNjM2ODY5NzY2NTNBMkYyRjY2NkY3MjE1NkQ=', 'base64').toString() + '<br><br>' + Buffer.from('TkVUV09SSyBUUkFDRSBMT0cgLSBOT0RFXzA0X09VVEJPVU5EPGJyPi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLTxicj5QQUNLRVRfSUQ6IDB4ODgyOTxicj5TT1VSQ0U6IElOVEVSTkFMX05PREVfMDQ8YnI+REVTVElOQVRJT046IEVYVEVSTkFMX0FSQ0hJVklTVF9SRUxBWTxicj5QQVlMT0FEIChIRVgpOjxicj40MyA0ZiA0ZSA1NCA0MSA0MyA1NCAyMCA0MSA1MiA0MyA0OCA0OSA1NiA0OSA1MyA1NCAyMCA0NiA0ZiA1MiAyMCA0MyA0ZiA0NCA0NSAzYSAyMCAzOCAzNCAzMCAzMiAzOSAzMTxicj4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS08YnI+VFJBQ0UgQ09NUExFVEUu', 'base64').toString()
        },
        'memory-scan-log': {
          access: userData.stage4_unlocked || false,
          content: 'Memory block recovery successful.<br><br>Recovered archive fragment:<br>' + Buffer.from('Tk9ERV8wMw==', 'base64').toString()
        },
        'resonance': {
          access: userData.stage4_unlocked || false,
          title: Buffer.from('Tk9ERV8wMw==', 'base64').toString(),
          content: ''
        },
        'vale-photo-data': {
          access: userData.stage1_vale_photo_unlocked || false,
          content: 'Coordinates: 42.3601° N, 71.0589° W | Fragment: 0x445A'
        },
        'forum': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('PGRpdiBzdHlsZT0iY29sb3I6IzBjMDtmb250LWZhbWlseTptb25vc3BhY2U7cGFkZGluZzozMHB4O2JhY2tncm91bmQ6IzA1MDUwNTtoZWlnaHQ6MTAwJTtvdmVyZmxvdy15OmF1dG87Ym94LXNpemluZzpib3JkZXItYm94OyI+CiAgPGRpdiBzdHlsZT0iYm9yZGVyOiAxcHggc29saWQgIzBjMDsgcGFkZGluZzogMjBweDsgbWF4LXdpZHRoOiA4MDBweDsgbWFyZ2luOiAwIGF1dG87IGJhY2tncm91bmQ6ICMwMDA7Ij4KICAgIDxoMiBzdHlsZT0ibWFyZ2luLXRvcDogMDsgbGV0dGVyLXNwYWNpbmc6IDFweDsgY29sb3I6ICMwZjA7Ij5JTlRFUk5BTCBBUkNISVZFIEZPUlVNIFtSRUFELU9OTFldPC9oMj4KICAgIDxkaXYgc3R5bGU9ImJvcmRlci1ib3R0b206IDFweCBkYXNoZWQgIzBjMDsgcGFkZGluZy1ib3R0b206IDE1cHg7IG1hcmdpbi1ib3R0b206IDIwcHg7IGxpbmUtaGVpZ2h0OiAxLjY7Ij4KICAgICAgPHAgc3R5bGU9Im1hcmdpbjogNXB4IDA7Ij48c3Ryb25nPlRvcGljOjwvc3Ryb25nPiBUaGUgQW5vbWFseTwvcD4KICAgICAgPHAgc3R5bGU9Im1hcmdpbjogNXB4IDA7Ij48c3Ryb25nPkF1dGhvcjo8L3N0cm9uZz4gYXJjaGl2aXN0NDA0MDQwPC9wPgogICAgICA8cCBzdHlsZT0ibWFyZ2luOiA1cHggMDsiPjxzdHJvbmc+RGF0ZTo8L3N0cm9uZz4gMTk5OC0wNC0xMiAwMzoxNCBBTTwvcD4KICAgIDwvZGl2PgogICAgPGRpdiBzdHlsZT0ibGluZS1oZWlnaHQ6IDEuODsgZm9udC1zaXplOiAxNXB4OyI+CiAgICAgIDxwPkkndmUgZm91bmQgc29tZXRoaW5nIGluIHRoZSBsb2dzLiBJdCdzIG5vdCBqdXN0IGRhdGEgY29ycnVwdGlvbi4gSXQncyBsb29raW5nIGJhY2sgYXQgdXMuPC9wPgogICAgICA8cD5JJ3ZlIGhpZGRlbiB0aGUgZmluYWwga2V5IGluIHRoZSBzeXN0ZW0gbmV0d29yayB0cmFjZS4gSWYgYW55b25lIGZpbmRzIHRoaXMsIHlvdSBrbm93IHdoZXJlIHRvIHJlYWNoIG1lLiBMb29rIGF0IG5ldHdvcmtfdHJhY2Uuc3lzLjwvcD4KICAgICAgPHAgPkV4dGVybmFsIGNvbnRhY3QgcHJvdG9jb2wgaW5pdGlhdGVkLiBUaGV5IGFyZSB3YXRjaGluZyB0aGUgbmV0d29yay48L3A+CiAgICA8L2Rpdj4KICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6IDMwcHg7IGJvcmRlci10b3A6IDFweCBkYXNoZWQgIzBjMDsgcGFkZGluZy10b3A6IDE1cHg7Ij4KICAgICAgPHAgc3R5bGU9Im1hcmdpbjogMDsiPltFbmQgb2YgdGhyZWFkXTwvcD4KICAgIDwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4=', 'base64').toString()
        },
        'records': {
          access: userData.stage4_unlocked || false,
          content: Buffer.from('PGRpdiBzdHlsZT0iY29sb3I6IzBmMDtmb250LWZhbWlseTptb25vc3BhY2U7cGFkZGluZzoyMHB4O2JhY2tncm91bmQ6IzAwMDtoZWlnaHQ6MTAwJTtvdmVyZmxvdy15OmF1dG87Ij4KICA8aDI+QVJDSElWRSBSRUNPUkRTIFtSRVNUT1JFRF08L2gyPgogIDxociBzdHlsZT0iYm9yZGVyLWNvbG9yOiMwZjA7Ij4KICA8cD48c3Ryb25nPlN0YXR1czo8L3N0cm9uZz4gQUxMIFNZU1RFTVMgTk9NSU5BTDwvcD4KICA8cD48c3Ryb25nPk1lc3NhZ2U6PC9zdHJvbmc+IFRoZSBhcmNoaXZlIGhhcyBiZWVuIGZ1bGx5IHJlc3RvcmVkLjwvcD4KICA8cD5UaGFuayB5b3UgZm9yIHlvdXIgYXNzaXN0YW5jZSwgSW52ZXN0aWdhdG9yLjwvcD4KICA8YnI+CiAgPHAgc3R5bGU9ImNvbG9yOiNmZmY7dGV4dC1zaGFkb3c6MCAwIDVweCAjZmZmOyI+VEhFIEVORC48L3A+CjwvZGl2Pg==', 'base64').toString()
        }
      };

      const item = contentMap[target];
      if (item && item.access) {
        return res.json({ status: "success", content: item.content, title: item.title });
      } else {
        return res.status(403).json({ status: "error", message: "Access denied" });
      }
    } catch (err: any) {
      console.error(">>> [API] getContent error:", err.message);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });


  // 3. THIRD: PROTECTED ROUTES LOGIC (MANDATORY)
  app.use(async (req: any, res: any, next: any) => {
    try {
      let normalizedPath = path.posix.normalize(req.path);
      if (normalizedPath.endsWith('/')) {
        normalizedPath += 'index.html';
      } else if (!normalizedPath.includes('.')) {
        if (protectedRoutes.includes(normalizedPath + '/index.html')) {
          normalizedPath += '/index.html';
        }
      }

      if (!protectedRoutes.includes(normalizedPath)) {
        return next();
      }

      // BYPASS API + ASSETS (MANDATORY)
      if (
        normalizedPath.startsWith("/api") ||
        normalizedPath.includes(".js") ||
        normalizedPath.includes(".css") ||
        normalizedPath.includes(".png") ||
        normalizedPath.includes(".jpg") ||
        normalizedPath.includes(".svg") ||
        normalizedPath.includes(".woff2") ||
        normalizedPath.includes(".mp3")
      ) {
        return next();
      }

      // ONLY handle HTML
      if (!normalizedPath.endsWith(".html")) return next();

      const userId = req.session?.userId;
      
      if (!userId) {
        console.log(`>>> [AUTH] Protected route access denied: Missing userId in session for ${normalizedPath}`);
        return res.status(403).send(LOCKED_HTML);
      }

      const userData = await getOrCreateUserData(userId);
      if (!userData) {
        return res.status(403).send(LOCKED_HTML);
      }
      
      const target = normalizedPath.substring(1); // remove leading slash
      let hasAccess = false;
      
      // Check if we are in Mock mode
      const isMock = _db instanceof MockFirestore;
      
      if (target === "stage1.html") {
        hasAccess = true; 
      } else if (target === "article.html") {
        hasAccess = !!userData?.stage2_phase1_complete;
      } else if (target === "resonance.html") {
        hasAccess = !!userData?.stage2_phase2_complete;
      } else if (target === "stage2.html" || target === "node02.html") {
        hasAccess = !!userData?.stage2_unlocked;
      } else if (target === "node04.html" || target === "node04/index.html") {
        if ((userData.stage || 1) < 4) return res.send(LOCKED_HTML);
        hasAccess = !!userData?.stage4_unlocked;
      } else if (target === "node03/secret.html" || target === "node03/secret/index.html") {
        if ((userData.stage || 1) < 3) return res.send(LOCKED_HTML);
        hasAccess = !!userData?.stage3_secret_unlocked;
      } else if (target === "archive/index.html") {
        if ((userData.stage || 1) < 4) return res.send(LOCKED_HTML);
        hasAccess = (!!userData?.stage4_progress && userData?.stage4_progress >= 3); 
      } else if (target === "node03/index.html") {
        if ((userData.stage || 1) < 3) return res.send(LOCKED_HTML);
        hasAccess = !!userData?.stage2_phase3_complete;
      }
      
      if (!hasAccess) {
        // For HTML routes, return the locked page instead of 403
        return res.send(LOCKED_HTML);
      }
      
      // If stage2.html is requested, we can serve node02.html directly if they have access
      const actualTarget = target === "stage2.html" ? "node02.html" : target;
      const filePath = path.join(process.cwd(), baseDir, actualTarget);
      
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).sendFile(path.join(process.cwd(), 'index.html'));
      }
    } catch (err) {
      console.error("PROTECTED ROUTE ERROR:", err);
      // ALWAYS send response to prevent 503
      return res.status(500).json({ status: "error", message: "Server Error" });
    }
  });

  // Vite middleware for development (MOVED TO END)
  if (!isProduction) {
    console.log("Starting Vite in development mode...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to start Vite:", e);
    }
  } else {
    console.log("Starting in production mode...");
  }

  // 404 Handler for API routes (MANDATORY)
  app.use("/api", (req: any, res: any) => {
    console.warn(`>>> [API] 404: ${req.method} ${req.path}`);
    res.status(404).json({ status: "error", message: "API endpoint not found" });
  });

  // 4. LAST: CATCH-ALL (FALLBACK HANDLER)
  app.get(/.*/, (req: any, res: any) => {
    try {
      // Only handle HTML navigation, not assets or API
      if (req.path.includes('.') || req.path.startsWith('/api/')) return res.status(404).end();
      
      if (isProduction) {
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      } else {
        res.redirect("/stage1.html");
      }
    } catch (error: any) {
      console.error("Catch-all error:", error.stack || error);
      res.status(500).json({ status: "error", message: "Server Error" });
    }
  });

  // 5. GLOBAL ERROR HANDLER (CRITICAL)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("!!! [SERVER FATAL ERROR]", err.stack || err);
    if (res.headersSent) {
      return next(err);
    }
    // Always return JSON for API errors
    if (req.path.startsWith("/api")) {
      return res.status(500).json({ status: "error", message: "Internal Server Error: " + (err.message || "Unknown error") });
    }
    // For HTML routes, return a simple error page
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  });
}

startServer().catch(err => {
  console.error("FATAL ERROR DURING STARTUP:", err);
  // process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.stack || err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

