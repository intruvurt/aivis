import User from "../models/User";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { validationResult } from "express-validator";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRE = "24h";

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User already exists with this email",
        statusCode: 400
      });
    }

    const user = await User.create({
      name,
      email,
      password
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        statusCode: 401
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        statusCode: 401
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Account is deactivated",
        statusCode: 401
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: "Email already in use",
          statusCode: 400
        });
      }
    }
    
    user.name = name || user.name;
    user.email = email || user.email;
    
    await user.save();
    
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
        statusCode: 401
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const deactivateAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.isActive = false;
    await user.save();
    
    res.json({
      success: true,
      message: "Account deactivated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const sendMagicLink = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 400
      });
    }

    const { email } = req.body;

    let user = await User.findOne({ email });
    
    if (!user) {
      user = await User.create({
        name: email.split("@")[0],
        email,
        password: crypto.randomBytes(32).toString("hex"),
        role: "user"
      });
    }

    const magicToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(magicToken).digest("hex");
    
    user.emailMagicToken = hashedToken;
    user.emailMagicTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const magicLink = `${process.env.VITE_API_URL || "http://localhost:3000"}/auth/verify-magic-link?token=${magicToken}&email=${email}`;

    // TODO: Send email with nodemailer
    console.log("Magic link:", magicLink);

    res.json({
      success: true,
      message: "Magic link sent to your email",
      data: {
        magicLink // Remove in production
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const verifyMagicLink = async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        error: "Token and email are required",
        statusCode: 400
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email,
      emailMagicToken: hashedToken,
      emailMagicTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired magic link",
        statusCode: 401
      });
    }

    user.emailMagicToken = undefined;
    user.emailMagicTokenExpires = undefined;
    user.isActive = true;
    await user.save();

    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};

export const oauthCallback = async (req, res) => {
  try {
    const { provider, profile } = req.body;

    if (!provider || !profile) {
      return res.status(400).json({
        success: false,
        error: "Provider and profile are required",
        statusCode: 400
      });
    }

    let user = await User.findOne({
      oauthProvider: provider,
      oauthId: profile.id
    });

    if (!user) {
      user = await User.findOne({ email: profile.email });
      
      if (user) {
        user.oauthProvider = provider;
        user.oauthId = profile.id;
        await user.save();
      } else {
        user = await User.create({
          name: profile.name || profile.displayName || profile.email.split("@")[0],
          email: profile.email,
          password: crypto.randomBytes(32).toString("hex"),
          role: "user",
          oauthProvider: provider,
          oauthId: profile.id,
          isActive: true
        });
      }
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
};
