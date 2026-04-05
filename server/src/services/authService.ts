import UserModel from '../models/User.js';

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    tier: string;
  };
}

class AuthService {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    // Validation - name is optional, but if provided must be at least 2 chars
    if (name && name.trim().length > 0 && name.trim().length < 2) {
      const error: any = new Error('Name must be at least 2 characters');
      error.code = 'VALIDATION';
      throw error;
    }

    if (!email || !email.includes('@')) {
      const error: any = new Error('Valid email is required');
      error.code = 'VALIDATION';
      throw error;
    }

    if (!password || password.length < 8) {
      const error: any = new Error('Password must be at least 8 characters');
      error.code = 'VALIDATION';
      throw error;
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      const error: any = new Error('Email already registered');
      error.code = 'EMAIL_EXISTS';
      throw error;
    }

    // Create user
    const newUser = await UserModel.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    return {
      user: {
        id: newUser.id,
        name: newUser.name ?? '',
        email: newUser.email ?? '',
        tier: newUser.internal_tier_key || 'free',
      },
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user
    const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    if (!user.password_hash) {
      throw new Error('Invalid credentials');
    }

    const isValid = await UserModel.comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return {
      user: {
        id: user.id,
        name: user.name ?? '',
        email: user.email ?? '',
        tier: user.internal_tier_key || 'free',
      },
    };
  }
}

export const authService = new AuthService();
