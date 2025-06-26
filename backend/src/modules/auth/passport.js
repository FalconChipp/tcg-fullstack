// src/modules/auth/passport.js

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../../models/index.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_OAUTH_CALLBACK || '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ where: { googleId: profile.id } });
        if (!user) {
          // Register on first login
          user = await User.create({
            googleId: profile.id,
            email: profile.emails[0].value,
            username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Date.now(),
            isAdmin: false,
          });
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

export default passport;
