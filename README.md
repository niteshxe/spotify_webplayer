# spotify_webplayer

This is a web-based Spotify player and remote control application built with Node.js and Express, utilizing the Spotify Web API and Web Playback SDK.

## Getting Started

Follow these steps to set up and run the application locally, or prepare it for deployment.

### Prerequisites

* Node.js (LTS recommended)
* npm (Node Package Manager)
* A Spotify Developer account and a registered application (with `Client ID` and `Client Secret`).
* A Spotify Premium account (required for Web Playback SDK functionality).
* `ngrok` (for local development to expose your local server to the internet).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/niteshxe/spotify_webplayer.git](https://github.com/niteshxe/spotify_webplayer.git)
    cd spotify_webplayer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Environment Variables (`.env`)

This application uses environment variables for sensitive credentials and configuration. You **must** create a file named `.env` in the root directory of your project (the same level as `server.js` and `package.json`).

**Important:** The `.env` file should **never** be committed to Git (it's listed in `.gitignore`).

Here's an example of what your `.env` file should contain. **Replace the placeholder values with your actual Spotify credentials and a strong session secret.**

```env
CLIENT_ID="YOUR_SPOTIFY_CLIENT_ID"
CLIENT_SECRET="YOUR_SPOTIFY_CLIENT_SECRET"
REDIRECT_URI="YOUR_REDIRECT_URI_FOR_LOCAL_DEV_OR_HOSTED_APP"
PORT=3000
USE_NGROK="true" # Set to "true" for local ngrok development
SESSION_SECRET='YOUR_VERY_LONG_RANDOM_STRING_HERE_FOR_SESSION_SECURITY'

```

### `.env` File Documentation

This document explains the environment variables used by your Node.js Spotify Web Player application. These variables are stored in a `.env` file (which should **never** be committed to version control like Git) and are loaded into your application's environment at runtime.

**File Location:** `/.env` (in the root directory of your project)

---

#### 1. `CLIENT_ID`
* **Description:** Your unique client ID provided by Spotify when you registered your application. This ID is used to identify your application when making requests to the Spotify API.
* **Value:** `"4b55475ee8e940b8ead0ba0c7823"`
* **Purpose:** Essential for Spotify API authentication.

#### 2. `CLIENT_SECRET`
* **Description:** Your client secret key, also provided by Spotify. This secret should be kept strictly confidential as it's used to verify your application's identity with Spotify's servers.
* **Value:** `"8e5dc84029032f458ab10ad19"`
* **Purpose:** Essential for secure Spotify API authentication.

#### 3. `REDIRECT_URI`
* **Description:** The URL that Spotify will redirect the user's browser back to after they authorize (or deny) your application. This URL **must** exactly match one of the Redirect URIs configured in your Spotify Developer Dashboard for your application.
* **Value:** `"https://e230b1b49d9.ngrok-free.app/callback"`
* **Purpose:** A critical part of the OAuth 2.0 authorization flow. For local development with `ngrok`, this will be your current `ngrok` forwarding URL followed by `/callback`. When hosted, it will be your application's public domain followed by `/callback`.

#### 4. `PORT`
* **Description:** The port number on which your Node.js server will listen for incoming HTTP requests.
* **Value:** `3000`
* **Purpose:** Defines the network port for your local development server. When deploying to a hosting provider, this variable is often overridden by the hosting environment, so your `server.js` should be set up to use `process.env.PORT || 3000`.

#### 5. `USE_NGROK`
* **Description:** A flag to indicate whether your application is currently running through `ngrok`. This can be used in your `server.js` logic to conditionally adjust redirect URIs or logging.
* **Value:** `"true"`
* **Purpose:** For development environments where `ngrok` is used to expose a local server to the internet.

#### 6. `SESSION_SECRET`
* **Description:** A long, random string used by `express-session` to sign the session ID cookie. This helps prevent tampering with session cookies. It is crucial that this value is unique and kept secret.
* **Value:** `'YOUR_VERY_LONG_RANDOM_STRING_HERE_FOR_SESSION_SECURITY'`
* **Purpose:** Provides security for user sessions, protecting against session hijacking and tampering. You must change this to a strong, random string before deployment or any serious use.
