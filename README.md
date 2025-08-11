# Automated Email Responder

This is an automated email responder application that uses a local Large Language Model (LLM) to draft intelligent replies based on incoming emails and your personal schedule. The system is built for privacy, automation, and seamless integration with Gmail.

---

## Features

- **Fetch Unread Emails:** Connects securely to your Gmail account to list unread emails.
- **Context-Aware Replies:** Generates email replies based on the content of a selected email and supplementary information like your weekly calendar.
- **Local AI Power:** Utilizes a local instance of the Mistral LLM via the Ollama server for privacy and offline functionality.
- **Direct Reply Sending:** Automatically sends the generated reply to the original sender from your Gmail account without manual intervention.
- **Secure Authentication:** Employs OAuth 2.0 with the Gmail API for secure access to your email data.

---

## Technologies Used

- **Frontend:** React, HTML, CSS (in-line styling)
- **Backend:** Python (Flask)
- **AI/LLM:** Ollama, Mistral
- **APIs:** Gmail API, Ollama REST API

---

## Project Setup

Follow these steps to set up and run the application on your local machine.

### Prerequisites

- **Node.js & npm:** For the React frontend.
- **Python 3.8+ & pip:** For the Flask backend.
- **Ollama:** Installed and running on your machine.
- **Mistral Model:** Download the Mistral model via Ollama.
- **Google Cloud Project:** An active Google Cloud project with the Gmail API enabled and OAuth 2.0 Client ID credentials (Desktop app type) downloaded as `credentials.json`.
- **OAuth Scopes:** Ensure your project is configured for the following scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.modify`
  - `https://www.googleapis.com/auth/gmail.send`
- **Test Users:** Your Gmail account must be added as a "Test User" in the Google Cloud Console's OAuth consent screen.

---

### Backend Setup (Python/Flask)

#### 1. Clone the Repository

```bash
git clone [repository_url]
cd automated_email_responder
```

#### 2. Create and Activate a Virtual Environment

```bash
python -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

#### 3. Install Dependencies

```bash
pip install Flask Flask-Cors ollama google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

#### 4. Add Credentials

- Place your `credentials.json` file in the root of the backend directory (next to `app.py`).

#### 5. Run the Backend Server

```bash
python app.py
```

> **Note:** The first time you run this, you will need to open a browser window and go to [http://127.0.0.1:5000/fetch-email](http://127.0.0.1:5000/fetch-email) to complete the OAuth 2.0 authentication process. This will generate the required `token.json` file.

---

### Frontend Setup (React)

#### 1. Navigate to the Frontend Directory

```bash
cd frontend_email_app
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Run the Frontend Development Server

```bash
npm run dev
```

---

## How to Use the Application

1. **Start the Servers**
   - Ensure both the Flask backend (`http://127.0.0.1:5000`) and the React frontend (`http://localhost:5173`) are running.

2. **Open the Application**
   - Open your browser to [http://localhost:5173/](http://localhost:5173/).

3. **Fetch Emails**
   - Click **"Fetch Unread Emails"** to see a list of recent unread emails in your inbox.

4. **Select an Email**
   - Click on an email in the list to populate the form fields with its content. This action also marks the email as read in Gmail.

5. **Add Calendar Information**
   - Add your weekly calendar information to provide more context.

6. **Generate and Send Reply**
   - Click **"Generate Automated Reply"** to see an AI-drafted response.
   - Click **"Send Reply Now"** to automatically send the email to the original sender.

---

## Running the Mistral Model with Ollama

Before starting the backend, make sure Ollama is running and the Mistral model is downloaded:

```bash
ollama run mistral
```

---

## License

[MIT](LICENSE)
