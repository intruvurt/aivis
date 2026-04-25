import passport, { type Profile } from 'passport';
import { Strategy as GoogleStrategy, type VerifyCallback } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? '';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('[OAuth] Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
}
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('[OAuth] GitHub OAuth not configured - set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
}

const CALLBACK_URL = process.env.VITE_API_URL ?? process.env.API_URL ?? 'https://api.aivis.biz';

type OAuthUser = {
  provider: 'google' | 'github';
  id: string;
  email: string;
  name: string;
};

const getEmail = (profile: Profile): string => profile.emails?.[0]?.value ?? '';

export const configureOAuth = (): void => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${CALLBACK_URL}/auth/google/callback`,
      },
      (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        const user: OAuthUser = {
          provider: 'google',
          id: profile.id,
          email: getEmail(profile),
          name: profile.displayName,
        };
        done(null, user);
      }
    )
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: `${CALLBACK_URL}/auth/github/callback`,
      },
      (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        const user: OAuthUser = {
          provider: 'github',
          id: profile.id,
          email: getEmail(profile),
          name: profile.displayName || profile.username || '',
        };
        done(null, user);
      }
    )
  );

  passport.serializeUser((user: Express.User, done: (err: Error | null, id?: unknown) => void) => {
    done(null, user);
  });

  passport.deserializeUser((user: unknown, done: (err: Error | null, user?: Express.User) => void) => {
    done(null, user as Express.User);
  });
};
