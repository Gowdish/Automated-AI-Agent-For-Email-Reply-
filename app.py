# app.py
import email.message # Keep this import for sending
from flask import Flask, request, jsonify
from flask_cors import CORS
import ollama
import os
import json
import base64
import re # NEW: Import for regular expressions to extract sender name

# For Gmail API
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import load_dotenv
app = Flask(__name__)
CORS(app)
load_dotenv.load_dotenv()
# --- Gmail API Configuration ---
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify', # Needed for marking as read
          'https://www.googleapis.com/auth/gmail.send']   # Needed for sending
CREDENTIALS_FILE = os.getenv('GMAIL_CREDENTIALS_FILE')
TOKEN_FILE = os.getenv('GMAIL_TOKEN_FILE')

def get_gmail_service():
    # ... (This function remains EXACTLY the same as in the last update) ...
    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
            print("Loaded credentials from token.json.")
        except Exception as e:
            print(f"Error loading token.json: {e}. Will re-authenticate.")
            os.remove(TOKEN_FILE)
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            try:
                creds.refresh(Request())
                print("Token refreshed successfully.")
            except Exception as e:
                print(f"Error refreshing token: {e}. Will re-authenticate.")
                if os.path.exists(TOKEN_FILE):
                    os.remove(TOKEN_FILE)
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            print("No valid token found or token expired/invalid. Initiating new authentication flow...")
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
            print(f"Authentication token saved to {TOKEN_FILE}")

    try:
        service = build('gmail', 'v1', credentials=creds)
        print("Gmail API service initialized successfully.")
        return service
    except HttpError as error:
        print(f"An HTTP error occurred initializing Gmail API service: {error}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred initializing Gmail API service: {e}", exc_info=True)
        return None

def base64_decode_safe(data):
    # ... (This function remains EXACTLY the same as in the last update) ...
    if not data:
        return ""
    try:
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        return base64.urlsafe_b64decode(data).decode('utf-8', errors='replace')
    except Exception as e:
        print(f"Error decoding base64 data: {e} with data (first 50 chars): {data[:50]}...")
        return ""

def get_email_body(msg_payload):
    # ... (This function remains EXACTLY the same as in the last update) ...
    body_plain_text = ""
    html_content = ""

    if 'body' in msg_payload and msg_payload['body'].get('data'):
        if msg_payload['mimeType'] == 'text/plain':
            return base64_decode_safe(msg_payload['body']['data'])
        elif msg_payload['mimeType'] == 'text/html':
            html_content = base64_decode_safe(msg_payload['body']['data'])
            return f"HTML Content (simplified): {html_content[:500]}..."

    if 'parts' in msg_payload:
        for part in msg_payload['parts']:
            if part['mimeType'] == 'text/plain':
                decoded_part = base64_decode_safe(part['body'].get('data', ''))
                if decoded_part:
                    return decoded_part
            elif part['mimeType'] == 'text/html':
                decoded_html_part = base64_decode_safe(part['body'].get('data', ''))
                if decoded_html_part:
                    html_content = decoded_html_part

            if 'parts' in part:
                nested_body = get_email_body(part)
                if nested_body:
                    if not nested_body.startswith("HTML Content (simplified):"):
                        return nested_body
                    elif not html_content:
                        html_content = nested_body

    return body_plain_text if body_plain_text else (html_content if html_content else "")


# ✨ NEW HELPER FUNCTION: Extracts name from sender string ✨
def extract_sender_name(sender_string):
    """
    Extracts the name from an email sender string like 'Name <email@example.com>' or 'email@example.com'.
    """
    match = re.match(r'^(.*?)\s*<([^>]+)>$', sender_string)
    if match:
        name = match.group(1).strip()
        # Remove quotes if present, e.g., "John Doe" -> John Doe
        if name.startswith('"') and name.endswith('"'):
            name = name[1:-1]
        return name if name else match.group(2) # Return name if exists, else email
    return sender_string # Return original string if no match (e.g., just email)


# ✨ MODIFIED: Fetches multiple unread emails, no longer marks as read here ✨
def fetch_unread_emails_gmail():
    """
    Fetches a list of unread emails using Gmail API, up to maxResults.
    Returns a list of dictionaries: [{'id': ..., 'sender': ..., 'subject': ..., 'snippet': ...}]
    """
    service = get_gmail_service()
    if not service:
        print("Gmail service object is None. Cannot fetch emails.")
        return []

    emails_list = []
    try:
        print("Searching for unread emails (max 10 results)...")
        results = service.users().messages().list(userId='me', q='is:unread', maxResults=10).execute()
        messages = results.get('messages', [])

        if not messages:
            print("No unread emails found via Gmail API. The 'messages' list was empty.")
            return []

        for message_obj in messages:
            msg_id = message_obj['id']
            # Fetch full message payload to get headers and snippet
            msg = service.users().messages().get(userId='me', id=msg_id, format='full', fields='payload,snippet').execute()
            
            message_data = msg['payload']
            headers = message_data['headers']

            sender_full = next((header['value'] for header in headers if header['name'] == 'From'), 'Unknown Sender')
            sender_name = extract_sender_name(sender_full) # Use the new helper
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), 'No Subject')
            snippet = msg.get('snippet', 'No snippet available.') # Get snippet from top level msg object

            emails_list.append({
                'id': msg_id,
                'sender': sender_name,
                'sender_full': sender_full, # Keep full sender for reply 'to' field
                'subject': subject,
                'snippet': snippet
            })
            print(f"Found unread email: ID={msg_id}, From='{sender_name}', Subject='{subject}'")

        print(f"Successfully fetched {len(emails_list)} unread emails.")
        return emails_list

    except HttpError as error:
        print(f"Gmail API HTTP Error during fetch: Status={error.resp.status}, Content={error.content.decode()}")
        if error.resp.status == 403 and "Insufficient Permission" in error.content.decode():
             print("ERROR: Insufficient Permission. Ensure 'gmail.readonly' or broader scope is correctly granted!")
        return []
    except Exception as e:
        print(f"An unexpected error occurred during email list fetch: {e}", exc_info=True)
        return []

# --- Functions for Sending Email (NO CHANGES HERE) ---
def create_message(sender, to, subject, message_text):
    # ... (remains the same) ...
    message = email.message.EmailMessage()
    message.set_content(message_text)
    message['to'] = to
    message['from'] = sender
    message['subject'] = subject
    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {'raw': encoded_message}

def send_message(service, user_id, message):
    # ... (remains the same) ...
    try:
        sent_message = service.users().messages().send(userId=user_id, body=message).execute()
        print(f"Message Id: {sent_message['id']} sent successfully.")
        return sent_message
    except HttpError as error:
        print(f"An error occurred sending email: {error}")
        print(f"Error details: {error.content.decode()}", exc_info=True)
        return None
    except Exception as e:
        print(f"An unexpected error occurred during email send: {e}", exc_info=True)
        return None

# ✨ MODIFIED: fetch_email now returns a list ✨
@app.route('/fetch-email', methods=['GET'])
def api_fetch_email():
    print("API CALL: Attempting to fetch list of unread emails via Gmail API...")
    emails_data = fetch_unread_emails_gmail() # Call the new function
    if emails_data:
        return jsonify({
            "status": "success",
            "emails": emails_data
        }), 200
    else:
        message = "No unread emails found or an error occurred during fetch. Check backend console for details."
        return jsonify({
            "status": "no_email",
            "message": message
        }), 200

# ✨ NEW: Endpoint to get full email content by ID and mark as read ✨
@app.route('/get-email-content/<email_id>', methods=['GET'])
def api_get_email_content(email_id):
    service = get_gmail_service()
    if not service:
        return jsonify({"message": "Gmail service not available."}), 500
    
    try:
        msg = service.users().messages().get(userId='me', id=email_id, format='full').execute()
        sender_full = next((header['value'] for header in msg['payload']['headers'] if header['name'] == 'From'), 'Unknown Sender')
        sender_name = extract_sender_name(sender_full)
        subject = next((header['value'] for header in msg['payload']['headers'] if header['name'] == 'Subject'), 'No Subject')
        body_plain_text = get_email_body(msg['payload'])

        # Mark the email as seen (read) when its content is fetched
        print(f"Attempting to mark email ID {email_id} as read...")
        service.users().messages().modify(
            userId='me',
            id=email_id,
            body={'removeLabelIds': ['UNREAD']} # This requires 'gmail.modify' scope
        ).execute()
        print(f"Successfully marked email ID {email_id} as read.")

        return jsonify({
            "status": "success",
            "sender_name": sender_name,
            "sender_full": sender_full,
            "subject": subject,
            "body": body_plain_text
        }), 200
    except HttpError as error:
        print(f"Gmail API HTTP Error fetching content or marking read for {email_id}: Status={error.resp.status}, Content={error.content.decode()}")
        return jsonify({"message": f"Error fetching email content or marking as read: {error.content.decode()}"}), 500
    except Exception as e:
        print(f"An unexpected error occurred getting email content: {e}", exc_info=True)
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500


@app.route('/generate-reply', methods=['POST'])
def generate_reply():
    # ... (This route remains the same as in the last update) ...
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    email_content = data.get('email_content')
    calendar_info = data.get('calendar_info')
    rag_data = data.get('rag_data', '')

    if not email_content:
        return jsonify({"error": "Missing 'email_content' in request"}), 400

    print(f"Received email content for reply: {email_content[:50]}...")
    print(f"Received calendar info for reply: {calendar_info}")

    prompt = f"""You are an intelligent email assistant. Based on the following information, draft a concise and polite email reply.

    --- Incoming Email Content ---
    {email_content}

    --- Your Calendar Info for the Week ---
    {calendar_info if calendar_info else 'No specific calendar events provided.'}

    --- Management/Contextual Data ---
    {rag_data if rag_data else 'No specific contextual data provided.'}

    --- Instructions for Reply ---
    - Acknowledge receipt.
    - If a meeting is requested, briefly mention your general availability based on calendar info or suggest checking back soon. (We'll make this smarter later).
    - If an information request, indicate you'll review or direct to relevant info. (RAG will enhance this).
    - Keep it professional and helpful.
    - Start directly with the reply content, no salutations or sign-offs needed from you.

    Draft the email reply:
    """

    try:
        response = ollama.chat(
            model='mistral',
            messages=[
                {'role': 'user', 'content': prompt}
            ],
            options={
                "temperature": 0.3,
                "num_predict": 200
            }
        )
        generated_text = response['message']['content'].strip()
        print("Generated reply successfully.")

        return jsonify({"reply": generated_text}), 200

    except Exception as e:
        print(f"Error calling Ollama: {e}", exc_info=True)
        return jsonify({"error": "Could not generate reply from LLM.", "details": str(e)}), 500

@app.route('/send-reply', methods=['POST'])
def api_send_reply():
    # ... (This route remains the same as in the last update) ...
    if not request.is_json:
        return jsonify({"message": "Request must be JSON"}), 400

    data = request.get_json()
    to_email = data.get('to')
    subject = data.get('subject')
    body = data.get('body')

    if not all([to_email, subject, body]):
        return jsonify({"message": "Missing 'to', 'subject', or 'body' in request"}), 400

    service = get_gmail_service()
    if not service:
        return jsonify({"message": "Gmail service not available. Cannot send email."}), 500

    try:
        sender_profile = service.users().getProfile(userId='me').execute()
        sender_email = sender_profile.get('emailAddress')
        if not sender_email:
            print("Could not retrieve sender's email address from authenticated user profile.")
            return jsonify({"message": "Could not determine sender email."}), 500

        print(f"Preparing to send email from: {sender_email} to: {to_email}, Subject: {subject[:50]}...")
        message = create_message(sender_email, to_email, subject, body)
        sent_message = send_message(service, 'me', message)

        if sent_message:
            return jsonify({"status": "success", "message_id": sent_message['id']}), 200
        else:
            return jsonify({"message": "Failed to send email via Gmail API."}), 500
    except Exception as e:
        print(f"Error during email sending process: {e}", exc_info=True)
        return jsonify({"message": f"An error occurred during email sending: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)