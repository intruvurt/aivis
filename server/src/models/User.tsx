<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: String,
      default: "default",
      index: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    role: {
      type: String,
      enum: ["user", "admin", "auditor"],
      default: "user"
    },
    emailMagicToken: {
      type: String
    },
    emailMagicTokenExpires: {
      type: Date
    },
    oauthProvider: {
      type: String,
      enum: ["google", "github", null],
      default: null
    },
    oauthId: {
      type: String
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    isActive: {
      type: Boolean,
      default: true
    },
    tier: {
      type: String,
      enum: ["Free", "Jump Start", "Pro", "Agency"],
      default: "Free"
    },
    /**
     * Internal tier key (matches Stripe lookup keys)
     * More granular than the display tier above
     */
    internalTierKey: {
      type: String,
      enum: ["free", "pro", "business", "enterprise", "whitelabel", "buyout"],
      default: "free",
      index: true,
    },
    /**
     * Stripe subscription tracking
     */
    stripeCustomerId: {
      type: String,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
    },
    /**
     * Usage limits (populated from tier config on upgrade)
     */
    auditsPerMonth: {
      type: Number,
      default: 10,
    },
    projectsMax: {
      type: Number,
      default: 1,
    },
    /**
     * Special flags for premium tiers
     */
    sourceCodeAccess: {
      type: Boolean,
      default: false,
    },
    whiteLabel: {
      type: Boolean,
      default: false,
    },
    customDomain: {
      type: String,
      trim: true,
    },
    /**
     * Tier change tracking
     */
    tierUpdatedAt: {
      type: Date,
    },
    buyoutCompletedAt: {
      type: Date,
    },
    usageCount: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if user has access to a feature based on tier
 */
userSchema.methods.hasFeature = function(feature) {
  const tierFeatures = {
    free: ['basic_analysis'],
    pro: ['basic_analysis', 'advanced_analysis', 'export'],
    business: ['basic_analysis', 'advanced_analysis', 'export', 'api_access', 'team'],
    enterprise: ['basic_analysis', 'advanced_analysis', 'export', 'api_access', 'team', 'sla', 'priority_support'],
    whitelabel: ['basic_analysis', 'advanced_analysis', 'export', 'api_access', 'team', 'white_label', 'custom_domain'],
    buyout: ['all'],
  };
  
  const features = tierFeatures[this.internalTierKey] || tierFeatures.free;
  return features.includes('all') || features.includes(feature);
};

const User = mongoose.model("User", userSchema);

export default User;
=======
// Neon DB migration complete. No mongoose code remains.
>>>>>>> Stashed changes
=======
// Neon DB migration complete. No mongoose code remains.
>>>>>>> Stashed changes
=======
// Neon DB migration complete. No mongoose code remains.
>>>>>>> Stashed changes
