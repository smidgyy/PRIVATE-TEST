import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
let adminConfig: any = {
  databaseId: firebaseConfig.firestoreDatabaseId
};

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  adminConfig.credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  admin.initializeApp(adminConfig);
} else if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  adminConfig.credential = admin.credential.cert(serviceAccount);
  admin.initializeApp(adminConfig);
} else {
  admin.initializeApp(adminConfig);
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/validateCommand", async (req, res) => {
    const { input, userId, type, step } = req.body;
    if (!input || !userId || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const fullCmd = input.trim();
    const args = fullCmd.split(/\s+/);
    const baseCmd = args[0].toLowerCase();

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
    
    if (type === 'terminal') {
      if (baseCmd === 'decrypt' && args.length > 1 && args[1] === '840291') {
        await db.collection('users').doc(userId).set({ stage1_archive_unlocked: true }, { merge: true });
        return res.json({ status: 'success', action: 'redirect_archive' });
      }
      if (baseCmd === 'decode' && args.length > 1 && args[1].toLowerCase() === 'vale_archive.enc') {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        if (userData.stage4_progress >= 1) {
          await db.collection('users').doc(userId).set({ stage1_vale_unlocked: true, stage4_progress: 2 }, { merge: true });
          return res.json({ status: 'success', action: 'unlock_vale' });
        } else {
          return res.json({ status: 'error', message: 'Bad command or file name.' });
        }
      }
      if (baseCmd === 'archive' && args.length > 1 && args[1].toLowerCase() === 'vale') {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        if (userData.stage1_vale_unlocked) {
          await db.collection('users').doc(userId).set({ stage4_forum_unlocked: true }, { merge: true });
          return res.json({ status: 'success', action: 'unlock_forum' });
        } else {
          return res.json({ status: 'error', message: 'Access denied.' });
        }
      }
      if (baseCmd === 'archive' && args.length === 1) {
        return res.json({ status: 'success', action: 'require_password' });
      }
      if (baseCmd === 'decrypt' && args.length > 1 && args[1].toLowerCase() === 'depth') {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        const currentStep = userData.messenger_step || 0;
        if (currentStep >= 2) {
          await db.collection('users').doc(userId).set({ stage3_secret_unlocked: true }, { merge: true });
          return res.json({ status: 'success', action: 'show_caesar_clue' });
        } else {
          return res.json({ status: 'error', message: 'Bad command or file name.' });
        }
      }
      return res.json({ status: 'error', message: 'Bad command or file name.' });
    }

    if (type === 'archive_password') {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      
      if (fullCmd.toUpperCase() === 'THE ARCHIVE REMEMBERS') {
        await db.collection('users').doc(userId).set({ stage1_archive_unlocked: true }, { merge: true });
        return res.json({ status: 'success', action: 'unlock_archive' });
      }
      if (fullCmd.toUpperCase() === 'VALE') {
        if (userData.stage1_vale_unlocked) {
          await db.collection('users').doc(userId).set({ stage4_forum_unlocked: true }, { merge: true });
          return res.json({ status: 'success', action: 'unlock_forum' });
        } else {
          return res.json({ status: 'error', message: 'Access denied.' });
        }
      }
      return res.json({ status: 'error', message: 'Access denied.' });
    }

    if (type === 'messenger') {
      const t = fullCmd.toUpperCase();
      const answers = ["GREED", "DEPTH", "MONEY", "GOLD", "CROWN"];
      
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      const currentStep = userData.messenger_step || 0;
      
      if (currentStep >= 0 && currentStep < answers.length) {
        if (t === answers[currentStep]) {
          const replies = [
            "So you solved Vale’s second lock.<br><br>Greed was only the beginning.<br><br>Greed leaves traces.<br><br>Vale tried to erase one of them.<br><br>Check the trash.",
            "Correct.<br><br>Vale encrypted the next fragment.<br><br>Use the terminal.",
            "No.<br><br>Money is only the mask.<br><br>Look deeper.",
            "Closer.<br><br>Vale didn’t follow wealth.<br><br>He followed power.<br><br>Listen.",
            "You are beginning to see the pattern.<br><br>Greed becomes wealth.<br><br>Wealth becomes power.<br><br>Vale reached this point.<br><br>But he went further."
          ];
          
          if (currentStep === 4) {
            await db.collection('users').doc(userId).set({ stage3_messenger_complete: true, messenger_step: 5, stage4_unlocked: true }, { merge: true });
            return res.json({ 
              status: 'success', 
              reply: replies[currentStep], 
              action: 'complete_messenger',
              unknownMsg: "I was wondering when you would reach this point.<br><br>Vale reached Node04 as well.<br><br>He stopped responding shortly after.<br><br>Be careful what you uncover."
            });
          }
          
          await db.collection('users').doc(userId).set({ messenger_step: currentStep + 1 }, { merge: true });
          return res.json({ status: 'success', reply: replies[currentStep], nextStep: currentStep + 1 });
        }
      }
      return res.json({ status: 'error', message: 'INVALID RESPONSE' });
    }

    if (type === 'node02_answer') {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(fullCmd.toLowerCase()).digest('hex');
      
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};
      
      if (step === '1' && hash === '76576de1cea42a163eb4c35c9af35ad3c3a9b6a1d67ed93f6f99e81ba96d5e22') {
        await db.collection('users').doc(userId).set({ stage2_phase1_complete: true }, { merge: true });
        return res.json({ status: 'success', action: 'phase1_success', msg: "The earth opens. Seek the marginalia." });
      }
      if (step === '2' && hash === 'ba6f8ed6d0d150b2a2ab2bebe99540f8c00cafb0ebdbf71a6f0b768c45425ca7') {
        if (!userData.stage2_phase1_complete) return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
        await db.collection('users').doc(userId).set({ stage2_phase2_complete: true }, { merge: true });
        return res.json({ status: 'success', action: 'phase2_success', msg: "The flame is extinguished." });
      }
      if (step === '3' && hash === '90b7b8654171c04a5e5de1eae884cfd86952739d50d09d9bb7680763e31faee8') {
        if (!userData.stage2_phase2_complete) return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
        await db.collection('users').doc(userId).set({ stage2_phase3_complete: true }, { merge: true });
        return res.json({ status: 'success', action: 'phase3_success', msg: String.fromCharCode(71, 82, 69, 69, 68) });
      }
      
      return res.json({ status: 'error', message: 'Incorrect. The truth eludes you.' });
    }

    if (type === 'unlock_node03_secret') {
      await db.collection('users').doc(userId).set({ stage3_secret_unlocked: true }, { merge: true });
      return res.json({ status: 'success' });
    }

    if (type === 'update_messenger_step') {
      const { step } = req.body;
      await db.collection('users').doc(userId).set({ messenger_step: step }, { merge: true });
      return res.json({ status: 'success' });
    }

    if (type === 'update_stage4_progress') {
      const { step, flag } = req.body;
      const updateData: any = { stage4_progress: step };
      if (flag) updateData[flag] = true;
      await db.collection('users').doc(userId).set(updateData, { merge: true });
      return res.json({ status: 'success' });
    }

    if (type === 'get_progression') {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.json({ status: 'success', messenger_step: 0, stage4_progress: 0 });
      }
      const data = userDoc.data();
      return res.json({ 
        status: 'success', 
        messenger_step: data?.messenger_step || 0,
        stage4_progress: data?.stage4_progress || 0,
        stage1_archive_unlocked: data?.stage1_archive_unlocked || false,
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
      const doc = await db.collection('users').doc(userId).get();
      const data = doc.data() || {};
      
      let hasAccess = false;
      if (target === 'node02' || target === 'resonance') {
        hasAccess = !!data.stage1_archive_unlocked;
      } else if (target === 'node03_secret') {
        hasAccess = !!data.stage3_secret_unlocked;
      } else if (target === 'node04') {
        hasAccess = !!data.stage4_unlocked;
      } else if (target === 'observer-folder') {
        hasAccess = (data.stage4_progress || 0) >= 1;
      } else if (target === 'vale-folder') {
        hasAccess = (data.stage4_progress || 0) >= 2;
      } else if (target === 'forum') {
        hasAccess = !!data.stage4_forum_unlocked;
      }
      
      if (hasAccess) {
        return res.json({ status: 'success' });
      } else {
        return res.json({ status: 'error', message: 'Access denied' });
      }
    }

    return res.status(400).json({ error: "Invalid type" });
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

