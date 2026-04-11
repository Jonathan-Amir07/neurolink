const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || '/auth/google/callback',
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    // Safely parse profile information
    const newUser = {
      googleId: profile.id,
      displayName: profile.displayName || 'Google User',
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : '',
      image: profile.photos && profile.photos[0] ? profile.photos[0].value : ''
    };

    if (!newUser.email) {
      console.error('[Passport] No email found in Google profile');
      return done(new Error('Email is required for authentication but was not provided by Google.'));
    }

    try {
      // Check database connection state before querying
      if (mongoose.connection.readyState !== 1) {
          console.error('[Passport] Database is not connected. Current state:', mongoose.connection.readyState);
          return done(new Error('Database connection is not stable. Please try again in a few seconds.'));
      }

      console.log(`[Passport] Attempting login for: ${newUser.email}`);
      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        console.log(`[Passport] Found existing user: ${user._id}`);
        return done(null, user);
      }
      user = await User.create(newUser);
      console.log(`[Passport] Created new user: ${user._id}`);
      done(null, user);
    } catch (err) {
      console.error('[Passport] Database error during login:', err.message);
      if (err.name === 'MongooseError' || err.message.includes('buffering')) {
          return done(new Error('The database is taking too long to respond. This is usually a network or IP whitelist issue.'));
      }
      done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
