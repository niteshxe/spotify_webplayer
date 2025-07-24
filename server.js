// server.js
require("dotenv").config(); // Load environment variables from .env file
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path"); // IMPORTANT: Added path module
const axios = require("axios"); // For making HTTP requests to Spotify API
const crypto = require("crypto"); // For generating random strings

const app = express();
app.set("trust proxy", 1); // Enable trust proxy for ngrok HTTPS detection

const PORT = process.env.PORT || 3000; // Use PORT from .env or default to 3000

// --- Spotify API Configuration (read from .env) ---
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const LOCAL_REDIRECT_URI = process.env.REDIRECT_URI; // Read from .env

// Spotify API Endpoints (ALWAYS use HTTPS for Spotify API)
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1"; // Added for API calls

// Scopes needed for both player control and streaming (Web Playback SDK)
const SCOPES =
  "user-read-private user-read-email user-modify-playback-state user-read-playback-state user-read-currently-playing streaming app-remote-control";

// --- Middleware ---
// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public"))); // For serving index.html and dashboard.html
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Read from .env
    resave: false,
    saveUninitialized: true,
    // CRITICAL: Set secure: true if using ngrok (as browser interacts with HTTPS)
    cookie: { secure: process.env.USE_NGROK === "true" }, // Read from .env
  })
);

// --- Helper Functions ---
const generateRandomString = (length) => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.accessToken) {
    // Check for token in session
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }
  next();
};

// --- Routes ---

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  spotifyAuthState = state; // <<< CORRECT: Store state in req.session

  // Determine the redirect_uri to send to Spotify for initial authorization.
  // This MUST be the public ngrok HTTPS URL that Spotify will redirect back to.
  const redirectUriForSpotifyAuth = process.env.REDIRECT_URI;

  console.log("--- Login Redirect Debug ---");
  console.log(
    "Redirect URI sent to Spotify for auth:",
    redirectUriForSpotifyAuth
  );

  res.redirect(
    `${SPOTIFY_AUTH_URL}?${new URLSearchParams({
      response_type: "code",
      redirect_uri: redirectUriForSpotifyAuth,
      scope: SCOPES,
      client_id: CLIENT_ID,
      state: state,
    }).toString()}`
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = spotifyAuthState; // <<< CORRECT: Retrieve stored state from req.session

  console.log("--- Spotify Callback Debug ---");
  console.log("Received code:", code ? "present" : "missing");
  console.log("Received state:", state);
  console.log("Stored state:", storedState);

  if (state === null || state !== storedState) {
    console.error(
      "STATE MISMATCH DETECTED: state from Spotify !== storedState in session"
    );
    return res.redirect(
      "/#" + new URLSearchParams({ error: "state_mismatch" }).toString()
    );
  }

  req.session.spotifyAuthState = null; // Clear the state after successful check

  // This `fullHttpsRedirectUri` should now always match `redirectUriForSpotifyAuth` used above.
  const fullHttpsRedirectUri =
    req.protocol + "://" + req.get("host") + req.originalUrl.split("?")[0];

  console.log("--- Token Exchange Request Debug ---");
  console.log(
    "Calculated full HTTPS Redirect URI for token exchange:",
    fullHttpsRedirectUri
  );
  console.log("Client ID being used:", CLIENT_ID);
  console.log(
    "Client Secret (first 5 chars):",
    CLIENT_SECRET ? CLIENT_SECRET.substring(0, 5) + "..." : "missing"
  );

  const authOptions = {
    url: SPOTIFY_TOKEN_URL,
    method: "post",
    data: new URLSearchParams({
      code: code,
      redirect_uri: fullHttpsRedirectUri,
      grant_type: "authorization_code",
    }).toString(),
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  try {
    const response = await axios(authOptions);
    const { access_token, refresh_token, expires_in } = response.data;

    // Store tokens in session (essential for further API calls)
    req.session.accessToken = access_token; // <<< CORRECT: Store in req.session
    req.session.refreshToken = refresh_token; // <<< CORRECT: Store in req.session
    req.session.expiresIn = Date.now() + expires_in * 1000; // Expiry time in ms

    console.log("Successfully received tokens!");
    console.log("Access Token:", access_token ? "present" : "missing");
    console.log("Refresh Token:", refresh_token ? "present" : "missing");
    console.log("Expires In:", expires_in);
    console.log(
      "Stored Access Token in session:",
      req.session.accessToken.substring(0, 10)
    ); // Verify storage

    // Redirect to a dashboard page
    res.redirect("/dashboard"); // <<< CORRECT: Redirect to the /dashboard route
  } catch (error) {
    console.error("Error during Spotify token exchange:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
      console.error("Data:", error.response.data);
    } else {
      console.error("Message:", error.message);
    }
    res.redirect(
      "/#" + new URLSearchParams({ error: "token_exchange_failed" }).toString()
    );
  }
});

// Dashboard route to serve dashboard.html
app.get("/dashboard", (req, res) => {
  if (!req.session.accessToken) {
    // Check if user is logged in
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "public", "dashboard.html")); // <<< CORRECT: Serve dashboard.html
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to log out." });
    }
    res.clearCookie("connect.sid"); // Clear session cookie
    res.redirect("/");
  });
});

app.get("/get_access_token", async (req, res) => {
  if (!req.session.accessToken || Date.now() >= req.session.expiresIn) {
    if (req.session.refreshToken) {
      const refreshOptions = {
        url: SPOTIFY_TOKEN_URL,
        method: "post",
        data: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: req.session.refreshToken,
        }).toString(),
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
      try {
        const response = await axios(refreshOptions);
        const {
          access_token,
          expires_in,
          refresh_token: new_refresh_token,
        } = response.data;
        req.session.accessToken = access_token;
        req.session.expiresIn = Date.now() + expires_in * 1000;
        if (new_refresh_token) {
          req.session.refreshToken = new_refresh_token;
        }
        return res.json({ access_token });
      } catch (refreshError) {
        console.error(
          "Error refreshing token:",
          refreshError.response
            ? refreshError.response.data
            : refreshError.message
        );
        req.session.destroy(() =>
          res.status(401).json({
            error: "Session expired or refresh failed. Please re-login.",
          })
        );
        return;
      }
    } else {
      req.session.destroy(() =>
        res.status(401).json({ error: "No refresh token. Please re-login." })
      );
      return;
    }
  }
  res.json({ access_token: req.session.accessToken });
});

// --- Spotify API Proxy Endpoints ---
const callSpotifyApi = async (
  req,
  res,
  method,
  endpoint,
  data = null,
  params = null
) => {
  try {
    const accessToken = req.session.accessToken; // <<< Retrieve from req.session
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized: No access token." });
    }

    const config = {
      method: method,
      url: `${SPOTIFY_API_BASE_URL}${endpoint}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    };

    if (data) {
      config.data = data;
    }
    if (params) {
      config.params = params;
    }

    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    console.error(
      `Error calling Spotify API (${endpoint}):`,
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: error.response ? error.response.data : "Internal server error",
      message: error.message,
    });
  }
};

app.get("/api/devices", isAuthenticated, (req, res) => {
  callSpotifyApi(req, res, "get", "/me/player/devices");
});

app.put("/api/play", isAuthenticated, async (req, res) => {
  const { device_id, uris, context_uri } = req.body;
  const accessToken = req.session.accessToken; // <<< Retrieve from req.session

  if (!accessToken) {
    return res.status(401).json({ error: "Unauthorized: No access token." });
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Transfer playback first if device_id is provided
    if (device_id) {
      const transferPayload = {
        device_ids: [device_id],
        play: true,
      };
      const transferResponse = await axios.put(
        `${SPOTIFY_API_BASE_URL}/me/player`,
        transferPayload,
        { headers }
      );
      if (transferResponse.status !== 200 && transferResponse.status !== 204) {
        return res.status(transferResponse.status).json({
          error: "Failed to transfer playback",
          details: transferResponse.data,
        });
      }
    }

    // 2. Start playing the chosen content
    const playPayload = {};
    if (uris) {
      playPayload.uris = uris;
    }
    if (context_uri) {
      playPayload.context_uri = context_uri;
    }

    if (Object.keys(playPayload).length > 0 || !device_id) {
      const playResponse = await axios.put(
        `${SPOTIFY_API_BASE_URL}/me/player/play`,
        playPayload,
        { headers }
      );
      if (playResponse.status !== 200 && playResponse.status !== 204) {
        return res.status(playResponse.status).json({
          error: "Failed to start playback",
          details: playResponse.data,
        });
      }
    }
    res.status(200).json({ message: "Playback initiated" });
  } catch (error) {
    console.error(
      "Error in /api/play:",
      error.response ? error.response.data : error.message
    );
    res.status(error.response ? error.response.status : 500).json({
      error: error.response ? error.response.data : "Internal server error",
      message: error.message,
    });
  }
});

app.put("/api/pause", isAuthenticated, (req, res) => {
  callSpotifyApi(req, res, "put", "/me/player/pause");
});

app.post("/api/next", isAuthenticated, (req, res) => {
  callSpotifyApi(req, res, "post", "/me/player/next");
});

app.post("/api/previous", isAuthenticated, (req, res) => {
  callSpotifyApi(req, res, "post", "/me/player/previous");
});

app.get("/api/search", isAuthenticated, (req, res) => {
  const query = req.query.q;
  const type = req.query.type || "track";
  if (!query) {
    return res.status(400).json({ error: "Search query 'q' is required" });
  }
  callSpotifyApi(req, res, "get", "/search", null, {
    q: query,
    type: type,
    limit: 10,
  });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(
    `Make sure your Spotify Redirect URI in the Dashboard is updated for ngrok if using.`
  );
  console.log(
    `Go to ${
      process.env.USE_NGROK === "true"
        ? "your ngrok HTTPS URL"
        : `http://localhost:${PORT}/`
    } to start.`
  );
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn(
      "\nWARNING: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set in .env."
    );
    console.warn(
      "Please update your .env file with your Spotify app credentials."
    );
    process.exit(1);
  }
});
