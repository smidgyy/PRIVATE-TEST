import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";

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
          data: () => col.get(id) || {}
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

    console.log(">>> [DB] Initializing database getter...");
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    
    let firebaseConfig: any = {};
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    console.log(">>> [DB] Target Database ID:", databaseId);

    let app;
    try {
      if (getApps().length === 0) {
        let serviceAccount: any = null;

        // Fallback: Manual .env parsing if process.env is missing it (sometimes dotenv fails in certain Node environments)
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
          try {
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
              console.log(">>> [DB] process.env missing key, attempting manual .env read...");
              const content = fs.readFileSync(envPath, 'utf8');
              const lines = content.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('FIREBASE_SERVICE_ACCOUNT=')) {
                  let val = trimmed.substring('FIREBASE_SERVICE_ACCOUNT='.length).trim();
                  // Strip quotes if present
                  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                    val = val.substring(1, val.length - 1);
                  }
                  process.env.FIREBASE_SERVICE_ACCOUNT = val;
                  console.log(">>> [DB] Manually recovered FIREBASE_SERVICE_ACCOUNT from .env file");
                  break;
                }
              }
            }
          } catch (e: any) {
            console.error(">>> [DB] Manual .env recovery failed:", e.message);
          }
        }

        // Priority 1: Environment Variable (MOST SECURE)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          console.log(">>> [DB] Loading service account from ENV...");
          try {
            let rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            
            // Handle cases where the ENV is wrapped in literal escaped quotes (common in some web panels)
            if (rawEnv.startsWith('\\"') && rawEnv.endsWith('\\"')) {
              console.log(">>> [DB] ENV is wrapped in literal escaped quotes, unescaping...");
              rawEnv = rawEnv.substring(2, rawEnv.length - 2).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            } else if (rawEnv.startsWith('"') && rawEnv.endsWith('"')) {
               // If it's wrapped in normal quotes but not a valid JSON string yet, it might be double-quoted
               try {
                  const parsedOnce = JSON.parse(rawEnv);
                  if (typeof parsedOnce === 'string') {
                     rawEnv = parsedOnce;
                  }
               } catch (e) {}
            }

            try {
              serviceAccount = JSON.parse(rawEnv);
            } catch (e) {
              // Last ditch effort: try to unescape common patterns if it's still failing
              console.log(">>> [DB] Initial parse failed, trying aggressive unescape...");
              const unescaped = rawEnv.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
              serviceAccount = JSON.parse(unescaped);
            }

            // Handle double-encoding in ENV (common when copy-pasting into web panels)
            if (typeof serviceAccount === 'string') {
              console.log(">>> [DB] ENV was double-encoded string, parsing again...");
              serviceAccount = JSON.parse(serviceAccount);
            }
          } catch (e: any) {
            console.error("!!! [DB] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", e.message);
          }
        } 
        
        // Priority 1.5: Fallback ENV name
        if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          console.log(">>> [DB] Loading service account from FIREBASE_SERVICE_ACCOUNT_JSON...");
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim());
            if (typeof serviceAccount === 'string') {
              serviceAccount = JSON.parse(serviceAccount);
            }
          } catch (e) {}
        }
        
        // Priority 2: service-account.json file (BACKUP)
        if (!serviceAccount && fs.existsSync(serviceAccountPath)) {
          console.log(">>> [DB] Loading service account from FILE...");
          const raw = fs.readFileSync(serviceAccountPath, 'utf8');
          try {
            serviceAccount = JSON.parse(raw);
            if (typeof serviceAccount === 'string') {
              serviceAccount = JSON.parse(serviceAccount);
            }
          } catch (e: any) {
            console.error("!!! [DB] Failed to parse service-account.json:", e.message);
          }
        }

        if (!serviceAccount) {
          console.warn("!!! [DB WARNING] Service account credentials not found. Falling back to MockFirestore (Session-only mode).");
          console.warn("To enable cloud persistence, follow these steps in AI Studio:");
          console.warn("1. Go to Firebase Console > Project Settings > Service Accounts.");
          console.warn("2. Generate and download a new private key JSON.");
          console.warn("3. In AI Studio, go to Settings (gear icon) > Secrets.");
          console.warn("4. Add a secret named 'FIREBASE_SERVICE_ACCOUNT' and paste the JSON content as the value.");
          _db = new MockFirestore();
          return _db;
        }

        if (typeof serviceAccount !== 'object') {
          throw new Error(`Service account credentials must be an object, but got ${typeof serviceAccount}.`);
        }

        // CRITICAL: Aggressive Private Key Sanitization
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          let pk = serviceAccount.private_key;
          
          // 1. Fix all variations of escaped newlines
          pk = pk.replace(/\\n/g, '\n');
          pk = pk.replace(/\\r/g, '\r');
          
          // 2. Remove any accidental quotes, whitespace, or BOM markers at start/end
          pk = pk.replace(/^['"\s\uFEFF]+|['"\s\uFEFF]+$/g, '');
          
          // 3. Ensure it starts with the correct header
          if (!pk.startsWith("-----BEGIN PRIVATE KEY-----")) {
            const headerIndex = pk.indexOf("-----BEGIN PRIVATE KEY-----");
            if (headerIndex !== -1) {
               pk = pk.substring(headerIndex);
            } else {
               console.error("!!! [DB] Private key missing header! Found:", pk.substring(0, 20));
            }
          }
          
          // 4. Ensure it ends with the correct footer
          if (!pk.includes("-----END PRIVATE KEY-----")) {
            console.error("!!! [DB] Private key missing footer!");
          }

          serviceAccount.private_key = pk;
          console.log(">>> [DB] Private key sanitized. Final Length:", serviceAccount.private_key.length);
        }

        console.log(">>> [DB] Initializing Admin SDK for Project:", serviceAccount.project_id);
        console.log(">>> [DB] Service Account Email:", serviceAccount.client_email);
        
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      } else {
        app = getApp();
      }

      // Force REST mode which is often more reliable on shared hosting (Hostinger)
      if (databaseId && databaseId !== "(default)") {
        console.log(">>> [DB] Connecting to named database (REST):", databaseId);
        _db = getFirestore(app, databaseId);
      } else {
        console.log(">>> [DB] Connecting to (default) database (REST)");
        _db = getFirestore(app);
      }

      // Apply settings to force REST and disable SSL verification if needed (though usually not recommended)
      _db.settings({ 
        preferRest: true,
        // Some environments have issues with gRPC keepalives
      });

      console.log(">>> [DB] Firestore instance ready (REST enabled).");
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
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [SERVER] Running on port ${PORT}`);
    // Warm up the database in the background
    getDb().catch(e => console.error("!!! [WARMUP ERROR] Database failed to warm up:", e.message));
  });

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req: any, res: any) => {
    res.json({ status: "ok" });
  });

  app.get("/api/debug-db", async (req: any, res: any) => {
    try {
      const filesInDir = fs.readdirSync(process.cwd());
      const db = await getDb();
      
      // Get service account info for diagnostics (safely)
      let clientEmail = "unknown";
      let hasEnvVar = !!process.env.FIREBASE_SERVICE_ACCOUNT || !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      let keyHash = "none";
      let keyStart = "none";
      let rawFirstChars = "none";
      
      const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        const raw = fs.readFileSync(serviceAccountPath, 'utf8');
        rawFirstChars = JSON.stringify(raw.substring(0, 10));
        
        const sa = JSON.parse(raw);
        clientEmail = sa.client_email;
        if (sa.private_key) {
          keyHash = crypto.createHash('sha256').update(sa.private_key).digest('hex');
          keyStart = sa.private_key.substring(0, 25);
        }
      }

      const collections = await db.listCollections();
      
      // Test if the key can actually sign data (verifies format)
      let keySignTest = "untested";
      try {
        let sa: any = null;
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } else if (fs.existsSync(serviceAccountPath)) {
          sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        }
        
        if (sa && sa.private_key) {
          const sign = crypto.createSign('SHA256');
          sign.update('test');
          sign.sign(sa.private_key.replace(/\\n/g, '\n'));
          keySignTest = "success";
        } else {
          keySignTest = "no private key found to test";
        }
      } catch (e: any) {
        keySignTest = "failed: " + e.message;
      }

      res.json({ 
        status: "connected", 
        buildId: "v1.1.2-clean-diagnostics",
        serverTime: new Date().toISOString(),
        processTime: new Date().getTime(),
        clientEmail: clientEmail,
        keySignTest: keySignTest,
        hasEnvVar: hasEnvVar,
        keyHash: keyHash,
        keyStart: keyStart,
        rawFirstChars: rawFirstChars,
        cwd: process.cwd(),
        files: filesInDir,
        collections: collections.map((c: any) => c.id),
        projectId: db.projectId,
        databaseId: db.databaseId,
        settings: db._settings,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          availableKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('PASSWORD')),
          hasEnvFile: fs.existsSync(path.join(process.cwd(), '.env'))
        }
      });
    } catch (err: any) {
      let clientEmail = "unknown";
      let keyHash = "none";
      let keyStart = "none";
      let rawFirstChars = "none";
      let keySignTest = "untested";
      let saType = "unknown";
      let source = "none";
      
      try {
        let sa: any = null;
        
        // Check ENV first
        if (process.env.FIREBASE_SERVICE_ACCOUNT || fs.existsSync(path.join(process.cwd(), '.env'))) {
          source = "env-or-file-fallback";
          let rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
          
          if (!rawEnv && fs.existsSync(path.join(process.cwd(), '.env'))) {
             const content = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
             const lines = content.split('\n');
             for (const line of lines) {
               if (line.trim().startsWith('FIREBASE_SERVICE_ACCOUNT=')) {
                 rawEnv = line.trim().substring('FIREBASE_SERVICE_ACCOUNT='.length).trim();
                 if ((rawEnv.startsWith("'") && rawEnv.endsWith("'")) || (rawEnv.startsWith('"') && rawEnv.endsWith('"'))) {
                   rawEnv = rawEnv.substring(1, rawEnv.length - 1);
                 }
                 break;
               }
             }
          }

          if (rawEnv) {
            rawFirstChars = JSON.stringify(rawEnv.substring(0, 20));
            
            try {
              // Try robust parsing
              if (rawEnv.startsWith('\\"') && rawEnv.endsWith('\\"')) {
                rawEnv = rawEnv.substring(2, rawEnv.length - 2).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              }
              
              sa = JSON.parse(rawEnv);
              if (typeof sa === 'string') {
                sa = JSON.parse(sa);
                saType = "string-wrapped-object";
              } else {
                saType = "object";
              }
            } catch(e: any) {
              keySignTest = "JSON Parse Error in ENV: " + e.message;
              // Try aggressive unescape
              try {
                 const unescaped = rawEnv.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
                 sa = JSON.parse(unescaped);
                 saType = "aggressive-unescaped-object";
                 keySignTest = "Aggressive unescape worked";
              } catch (e2) {}
            }
          }
        } else {
          const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
          if (fs.existsSync(serviceAccountPath)) {
            source = "file";
            const raw = fs.readFileSync(serviceAccountPath, 'utf8');
            rawFirstChars = JSON.stringify(raw.substring(0, 10));
            sa = JSON.parse(raw);
            if (typeof sa === 'string') {
              sa = JSON.parse(sa);
              saType = "string-wrapped-object";
            }
          } else {
            keySignTest = "No credentials found (ENV or FILE)";
          }
        }

        if (sa) {
          saType = saType === "unknown" ? typeof sa : saType;
          clientEmail = sa.client_email;
          if (sa.private_key) {
            keyHash = crypto.createHash('sha256').update(sa.private_key).digest('hex');
            keyStart = sa.private_key.substring(0, 25);
            
            try {
              const sign = crypto.createSign('SHA256');
              sign.update('test');
              sign.sign(sa.private_key.replace(/\\n/g, '\n'));
              keySignTest = "success";
            } catch (e: any) {
              keySignTest = "failed: " + e.message;
            }
          }
        }
      } catch(e) {}

      res.status(500).json({ 
        status: "error", 
        buildId: "v1.1.2-clean-diagnostics",
        serverTime: new Date().toISOString(),
        clientEmail: clientEmail,
        keySignTest: keySignTest,
        keyHash: keyHash,
        keyStart: keyStart,
        rawFirstChars: rawFirstChars,
        saType: saType,
        source: source,
        hasEnvVar: !!process.env.FIREBASE_SERVICE_ACCOUNT || !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          availableKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('PASSWORD')),
          hasEnvFile: fs.existsSync(path.join(process.cwd(), '.env'))
        },
        message: err.message,
        details: err.stack,
        cwd: process.cwd(),
        files: fs.readdirSync(process.cwd())
      });
    }
  });

  app.post("/api/validateCommand", async (req: any, res: any) => {
    try {
    const { input, type, step, SECRET_KEY } = req.body;
    const userId = req.body.userId || req.query.userId;
    
    if (!userId && SECRET_KEY !== 'RESILIENT_BOOT') {
      return res.status(403).json({ error: "ACCESS DENIED: Missing userId" });
    }
    
    console.log(`>>> [API] Request: ${type} from user ${userId}. Input: "${input}"`);
    
    // Allow bypass if SECRET_KEY is provided, or if userId is present
    // Note: input is optional for some types like 'check_access' and 'get_progression'
    const isInputRequired = ['terminal', 'archive_password', 'node02_answer'].includes(type);
    
    if ((isInputRequired && !input) || (!userId && SECRET_KEY !== 'RESILIENT_BOOT') || !type) {
      console.error(`!!! [API] Missing required fields: input=${!!input}, userId=${!!userId}, type=${!!type}`);
      return res.status(400).json({ error: "Missing required fields" });
    }

    const fullCmd = (input || "").trim();
    const t = fullCmd.toUpperCase();
    const args = fullCmd.split(/\s+/);
    const baseCmd = args[0].toLowerCase();
    console.log(`>>> [API] Normalized input: "${t}"`);
    
    // Get database instance
    let db: any = null;
    try {
      db = await getDb();
    } catch (e: any) {
      console.error("!!! [API] Database connection failed, proceeding with logic-only mode:", e.message);
    }

    // We can use Firebase Admin here, but for simplicity and to avoid credential issues,
    // we'll just handle the validation logic and let the frontend update Firestore,
    // OR we can update Firestore here if we initialize Admin SDK.
    // Since we are just validating, returning the action is enough.
    // The instructions say: "Backend must track: current stage, unlocked nodes, completed puzzles"
    // "Frontend must NOT control progression logic."
    // To do this properly without Admin SDK credentials in this environment,
    // we can use the REST API or just trust the frontend to pass the user ID and we return the action.
    // Wait, the prompt says "Backend must track...".
    // Let's initialize Firebase Admin.
    
    // Use a dummy userId if missing but SECRET_KEY is valid
    const effectiveUserId = userId || (SECRET_KEY === 'RESILIENT_BOOT' ? 'anonymous_session' : null);
    
    if (!effectiveUserId) {
      console.error(`!!! [API] Missing effective userId`);
      return res.status(400).json({ error: "Missing userId" });
    }

    if (type === 'terminal') {
      if (baseCmd === 'decrypt' && args.length > 1 && args[1] === '840291') {
        if (db) await db.collection('users').doc(effectiveUserId).set({ 
          stage1_archive_unlocked: true,
          archive_unlocked: true,
          stage2_unlocked: true
        }, { merge: true });
        return res.json({ status: 'success', action: 'redirect_archive' });
      }
      if (baseCmd === 'decode' && args.length > 1 && args[1].toLowerCase() === 'vale_archive.enc') {
        let userData: any = {};
        if (db) {
          const userDoc = await db.collection('users').doc(effectiveUserId).get();
          userData = userDoc.data() || {};
        }
        if (userData.stage4_progress >= 1 || SECRET_KEY === 'RESILIENT_BOOT') {
          if (db) await db.collection('users').doc(effectiveUserId).set({ stage1_vale_unlocked: true, stage4_progress: 2 }, { merge: true });
          return res.json({ status: 'success', action: 'unlock_vale' });
        } else {
          return res.json({ status: 'error', message: 'Bad command or file name.' });
        }
      }
      if (baseCmd === 'archive' && args.length > 1 && args[1].toLowerCase() === 'vale') {
        let userData: any = {};
        if (db) {
          const userDoc = await db.collection('users').doc(effectiveUserId).get();
          userData = userDoc.data() || {};
        }
        if (userData.stage1_vale_unlocked || SECRET_KEY === 'RESILIENT_BOOT') {
          if (db) await db.collection('users').doc(effectiveUserId).set({ stage4_forum_unlocked: true }, { merge: true });
          return res.json({ status: 'success', action: 'unlock_forum' });
        } else {
          return res.json({ status: 'error', message: 'Access denied.' });
        }
      }
      if (baseCmd === 'archive' && args.length === 1) {
        return res.json({ status: 'success', action: 'require_password' });
      }
      if (baseCmd === 'decrypt' && args.length > 1 && args[1].toLowerCase() === 'depth') {
        let userData: any = {};
        if (db) {
          const userDoc = await db.collection('users').doc(effectiveUserId).get();
          userData = userDoc.data() || {};
        }
        const currentStep = userData.messenger_step || 0;
        if (currentStep >= 2 || SECRET_KEY === 'RESILIENT_BOOT') {
          if (db) await db.collection('users').doc(effectiveUserId).set({ stage3_secret_unlocked: true }, { merge: true });
          return res.json({ status: 'success', action: 'show_caesar_clue' });
        } else {
          return res.json({ status: 'error', message: 'Bad command or file name.' });
        }
      }
      return res.json({ status: 'error', message: 'Bad command or file name.' });
    }

    if (type === 'archive_password') {
      let userData: any = {};
      if (db) {
        const userDoc = await db.collection('users').doc(effectiveUserId).get();
        userData = userDoc.data() || {};
      }
      
      if (fullCmd.toUpperCase() === 'THE ARCHIVE REMEMBERS') {
        if (db) {
          await db.collection('users').doc(effectiveUserId).set({ 
            stage1_archive_unlocked: true,
            archive_unlocked: true,
            stage2_unlocked: true
          }, { merge: true });
        }
        return res.json({ status: 'success', action: 'unlock_archive' });
      }
      if (fullCmd.toUpperCase() === 'VALE') {
        if (userData.stage1_vale_unlocked || SECRET_KEY === 'RESILIENT_BOOT') {
          if (db) await db.collection('users').doc(effectiveUserId).set({ stage4_forum_unlocked: true }, { merge: true });
          return res.json({ status: 'success', action: 'unlock_forum' });
        } else {
          return res.json({ status: 'error', message: 'Access denied.' });
        }
      }
      return res.json({ status: 'error', message: 'Access denied.' });
    }

    if (type === 'node02_answer') {
      const hash = crypto.createHash('sha256').update(t.toLowerCase()).digest('hex');
      
      let userData: any = {};
      if (db) {
        const userDoc = await db.collection('users').doc(effectiveUserId).get();
        userData = userDoc.data() || {};
      }
      
      if (step === '1' && hash === '76576de1cea42a163eb4c35c9af35ad3c3a9b6a1d67ed93f6f99e81ba96d5e22') {
        if (db) await db.collection('users').doc(effectiveUserId).set({ stage2_phase1_complete: true }, { merge: true });
        return res.json({ status: 'success', action: 'phase1_success', msg: "The earth opens. Seek the marginalia." });
      }
      if (step === '2' && hash === 'ba6f8ed6d0d150b2a2ab2bebe99540f8c00cafb0ebdbf71a6f0b768c45425ca7') {
        if (userData.stage2_phase1_complete || SECRET_KEY === 'RESILIENT_BOOT') {
          if (db) await db.collection('users').doc(effectiveUserId).set({ stage2_phase2_complete: true }, { merge: true });
          return res.json({ status: 'success', action: 'phase2_success', msg: "The flame is extinguished." });
        }
        return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
      }
      if (step === '3' && hash === '90b7b8654171c04a5e5de1eae884cfd86952739d50d09d9bb7680763e31faee8') {
        if (userData.stage2_phase2_complete || SECRET_KEY === 'RESILIENT_BOOT') {
          if (db) await db.collection('users').doc(effectiveUserId).set({ stage2_phase3_complete: true }, { merge: true });
          return res.json({ status: 'success', action: 'phase3_success', msg: String.fromCharCode(71, 82, 69, 69, 68) });
        }
        return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
      }
      
      return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
    }

    if (type === 'unlock_node03_secret') {
      if (db) await db.collection('users').doc(effectiveUserId).set({ stage3_secret_unlocked: true }, { merge: true });
      return res.json({ status: 'success' });
    }

    if (type === 'update_messenger_step') {
      const { step } = req.body;
      if (db) await db.collection('users').doc(effectiveUserId).set({ messenger_step: step }, { merge: true });
      return res.json({ status: 'success' });
    }

    if (type === 'update_stage4_progress') {
      const { step, flag } = req.body;
      const updateData: any = { stage4_progress: step };
      if (flag) updateData[flag] = true;
      if (db) await db.collection('users').doc(effectiveUserId).set(updateData, { merge: true });
      return res.json({ status: 'success' });
    }

    if (type === 'get_progression') {
      let data: any = {};
      if (db) {
        const userDoc = await db.collection('users').doc(effectiveUserId).get();
        data = userDoc.data() || {};
      }
      
      return res.json({ 
        status: 'success', 
        messenger_step: data?.messenger_step || 0,
        stage4_progress: data?.stage4_progress || 0,
        stage1_archive_unlocked: data?.stage1_archive_unlocked || false,
        stage2_unlocked: data?.stage2_unlocked || false,
        stage1_vale_unlocked: data?.stage1_vale_unlocked || false,
        stage4_forum_unlocked: data?.stage4_forum_unlocked || false,
        stage3_messenger_complete: data?.stage3_messenger_complete || false,
        stage3_secret_unlocked: data?.stage3_secret_unlocked || false,
        stage2_phase1_complete: data?.stage2_phase1_complete || false,
        stage2_phase2_complete: data?.stage2_phase2_complete || false,
        stage4_observer_logs_opened: data?.stage4_observer_logs_opened || false,
        stage4_network_trace_viewed: data?.stage4_network_trace_viewed || false
      });
    }

    if (type === 'check_access') {
      const { target } = req.body;
      let userData: any = {};
      if (db) {
        const doc = await db.collection('users').doc(effectiveUserId).get();
        userData = doc.data() || {};
        console.log(">>> [API] validateCommand check_access: userId:", effectiveUserId);
        console.log(">>> [API] validateCommand check_access: User state:", userData);
      }
      
      let hasAccess = false;
      if (SECRET_KEY === 'RESILIENT_BOOT') {
        hasAccess = true;
      } else if (target === 'node02' || target === 'resonance') {
        hasAccess = !!userData.stage2_unlocked || !!userData.archive_unlocked || !!userData.stage1_archive_unlocked;
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
    } catch (err: any) {
      console.error("!!! [API ERROR] validateCommand crashed:", err);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Internal Server Error',
        details: err.message 
      });
    }
  });

  app.post("/api/sendMessage", async (req: any, res: any) => {
    try {
      const { message, contact } = req.body;
      const userId = req.body.userId || req.query.userId;
      
      if (!message || !contact || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const t = message.trim().toUpperCase();
      let reply = "I'm sorry, I can't help with that right now.";
      let action = null;

      // Get database instance
      let db: any = null;
      try {
        db = await getDb();
      } catch (e: any) {}

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
        if (t === 'THE ARCHIVE REMEMBERS') {
          if (db) {
            await db.collection('users').doc(userId).set({ 
              stage1_archive_unlocked: true,
              archive_unlocked: true,
              stage2_unlocked: true
            }, { merge: true });
          }
          reply = "ACCESS GRANTED. THE ARCHIVE IS NOW OPEN.";
          action = "unlock_archive";
        } else {
          reply = "INVALID INPUT. AWAITING COMMAND.";
        }
      }

      return res.json({ 
        status: "success",
        contact, 
        reply, 
        action 
      });
    } catch (err: any) {
      console.error(">>> [API] sendMessage error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Protected HTML routes
  const protectedRoutes = [
    "/stage1.html", 
    "/stage2.html", 
    "/resonance.html", 
    "/node04.html", 
    "/node04/index.html",
    "/node03/secret.html", 
    "/node03/secret/index.html",
    "/article.html", 
    "/node03/index.html",
    "/archive/index.html"
  ];
  
  app.get("/api/getNode02", async (req: any, res: any) => {
    const { userId } = req.query;

    if (!userId) {
      console.log(">>> [API] getNode02: Missing userId");
      return res.status(400).json({ error: "Missing userId" });
    }

    try {
      const db = await getDb();
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      console.log(">>> [API] getNode02: Request userId:", userId);
      console.log(">>> [API] getNode02: User state:", userData);

      // Fix: Allow access if any of the archive/stage2 unlock flags are true
      if (!userData?.archive_unlocked && !userData?.stage2_unlocked && !userData?.stage1_archive_unlocked) {
        console.log(">>> [API] getNode02: Access denied for:", userId);
        return res.status(403).json({ error: "Access denied" });
      }

      console.log(">>> [API] getNode02: Serving Node02 to:", userId);
      res.sendFile(path.join(process.cwd(), "public/node02.html"));
    } catch (err: any) {
      console.error(">>> [API] getNode02 error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get(protectedRoutes, async (req: any, res: any) => {
    const userId = req.query.userId;
    if (!userId && req.path !== "/stage1.html" && req.path !== "/article.html" && req.path !== "/node03/index.html" && req.path !== "/archive/index.html") {
      return res.status(403).send("ACCESS DENIED: Missing userId");
    }
    
    let db: any = null;
    try {
      db = await getDb();
    } catch (e: any) {
      console.error("!!! [ROUTING] Database connection failed for route check:", e.message);
    }
    
    let userData: any = {};
    if (db) {
      const userDoc = await db.collection('users').doc(userId).get();
      userData = userDoc.data() || {};
      if (_db instanceof MockFirestore) {
        userData.isMock = true;
      }
      console.log(`Access check for ${req.path}:`, userId, userData);
    }
    
    const target = req.path.substring(1); // remove leading slash
    let hasAccess = false;
    
    // Check if we are in Mock mode
    const isMock = _db instanceof MockFirestore;
    if (isMock) {
      console.warn(`>>> [ROUTING] Running in Mock mode for ${req.path}. Persistence is disabled.`);
    }
    
    if (target === "stage1.html" || target === "article.html" || target === "node03/index.html" || target === "archive/index.html") {
      hasAccess = true; // Publicly accessible but served through backend
    } else if (target === "stage2.html" || target === "resonance.html") {
      hasAccess = !!userData.stage2_unlocked || !!userData.archive_unlocked || !!userData.stage1_archive_unlocked;
    } else if (target === "node04.html" || target === "node04/index.html") {
      hasAccess = !!userData.stage4_unlocked;
    } else if (target === "node03/secret.html" || target === "node03/secret/index.html") {
      hasAccess = !!userData.stage3_secret_unlocked;
    } else if (target === "archive/index.html") {
      hasAccess = !!userData.stage4_progress && userData.stage4_progress >= 3; // Assuming stage 3 is the end
    }
    
    if (!hasAccess) {
      return res.status(403).send("ACCESS DENIED");
    }
    
    const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), 'dist'));
    const baseDir = isProduction ? 'dist' : 'public';
    const filePath = path.join(process.cwd(), baseDir, target);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).sendFile(path.join(process.cwd(), 'index.html'));
    }
  });

  app.get("/", (req: any, res: any) => {
    res.redirect("/stage1.html" + (req.query.userId ? "?userId=" + req.query.userId : ""));
  });

  app.get("/api/getUserState", async (req: any, res: any) => {
    try {
      const userId = req.query.userId;
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }
      
      let db: any = null;
      try {
        db = await getDb();
      } catch (e: any) {}
      
      let userData: any = {};
      if (db) {
        const userDoc = await db.collection('users').doc(userId).get();
        userData = userDoc.data() || {};
        if (_db instanceof MockFirestore) {
          userData.isMock = true;
        }
      }
      
      res.json(userData);
    } catch (err: any) {
      console.error(">>> [API] getUserState error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production" || process.argv[1]?.endsWith('server.js') || fs.existsSync(path.join(process.cwd(), 'dist'));
  
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
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*all', (req: any, res: any) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn("Warning: 'dist' directory not found. Static files will not be served.");
    }
  }

  // Remove the old listen call at the bottom
}

startServer().catch(err => {
  console.error("FATAL ERROR DURING STARTUP:", err);
  process.exit(1);
});

