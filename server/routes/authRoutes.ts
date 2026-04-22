import express from "express";
import { AuthService } from "../services/authService.ts";
import { signUserToken } from "../utils/jwt.ts";

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const user = await AuthService.registerUser({ email, password });
    const token = signUserToken({ userId: user.id, tier: user.tier });

    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, tier: user.tier },
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code?: unknown }).code || "") : "";
    const message = e instanceof Error ? e.message : "Signup failed";
    if (code === "VALIDATION") return res.status(400).json({ error: message });
    if (code === "EMAIL_EXISTS") return res.status(409).json({ error: message });
    return res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const user = await AuthService.authenticate({ email, password });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const token = signUserToken({ userId: user.id, tier: user.tier });
    return res.json({ token, user });
  } catch {
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;
