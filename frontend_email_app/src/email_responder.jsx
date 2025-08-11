// frontend_email_app/src/EmailResponder.jsx
import React, { useState } from 'react';

function EmailResponder() {
  const [emailContent, setEmailContent] = useState('');
  const [calendarInfo, setCalendarInfo] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchedEmailInfo, setFetchedEmailInfo] = useState(null); // Stores info of the *selected* email
  const [isSending, setIsSending] = useState(false);
  const [unreadEmails, setUnreadEmails] = useState([]); // ✨ NEW STATE: To hold list of unread emails ✨

  const handleFetchEmail = async () => {
    setLoading(true);
    setError(null);
    setFetchedEmailInfo(null); // Clear any previously selected email
    setEmailContent('');
    setReply('');
    setUnreadEmails([]); // Clear previous list

    try {
      const response = await fetch('http://127.0.0.1:5000/fetch-email'); // Now returns a list
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'success' && data.emails.length > 0) {
        setUnreadEmails(data.emails); // Populate the list of unread emails
      } else {
        setError(data.message || "No unread emails found.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✨ NEW FUNCTION: To select an email from the list and fetch its full content ✨
  const handleEmailSelect = async (emailId) => {
    setLoading(true);
    setError(null);
    setEmailContent(''); // Clear previous content
    setReply(''); // Clear previous reply
    setFetchedEmailInfo(null); // Clear previous fetched info

    try {
      // Call the new backend endpoint to get full content and mark as read
      const response = await fetch(`http://127.0.0.1:5000/get-email-content/${emailId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'success') {
        setEmailContent(data.body);
        setFetchedEmailInfo({
            id: emailId,
            sender: data.sender_name, // Store parsed name for display
            sender_full: data.sender_full, // Store full string for sending 'to'
            subject: data.subject
        });
        setUnreadEmails([]); // Clear the list once an email is selected
        alert('Email content loaded and marked as read!');
      } else {
        setError(data.message || "Could not load email content.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReply('');

    try {
      const response = await fetch('http://127.0.0.1:5000/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_content: emailContent, calendar_info: calendarInfo }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setReply(data.reply);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    setIsSending(true);
    setError(null);

    // Use fetchedEmailInfo.sender_full for the 'to' address for accuracy
    if (!reply || !fetchedEmailInfo?.sender_full || !fetchedEmailInfo?.subject) {
      setError("Cannot send reply: Missing generated reply or original email info (sender/subject).");
      setIsSending(false);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: fetchedEmailInfo.sender_full, // ✨ Use full sender string for 'to' ✨
          subject: `Re: ${fetchedEmailInfo.subject}`,
          body: reply,
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        alert('Email sent successfully!');
        setReply('');
        setEmailContent('');
        setCalendarInfo('');
        setFetchedEmailInfo(null);
      } else {
        setError(data.message || "Failed to send email.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.container}>
        <h2 style={styles.sectionTitle}>1. Fetch Incoming Emails</h2>
        <button
          onClick={handleFetchEmail}
          disabled={loading || isSending}
          style={{
            ...styles.button,
            backgroundColor: styles.buttonColors.fetch,
            ...(loading || isSending ? styles.buttonDisabled : {}),
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = styles.buttonHoverColors.fetch)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = styles.buttonColors.fetch)}
        >
          {loading ? 'Fetching Emails...' : 'Fetch Unread Emails'}
        </button>

        {/* ✨ NEW: Display list of unread emails if available ✨ */}
        {unreadEmails.length > 0 && (
          <div style={styles.emailListContainer}>
            <h3 style={styles.listTitle}>Select an Email to Process:</h3>
            <ul style={styles.ul}>
              {unreadEmails.map((email) => (
                <li key={email.id} style={styles.li} onClick={() => handleEmailSelect(email.id)}>
                  <p style={styles.emailListItemText}><strong>From:</strong> {email.sender}</p>
                  <p style={styles.emailListItemText}><strong>Subject:</strong> {email.subject || '[No Subject]'}</p>
                  <p style={styles.emailListItemSnippet}>{email.snippet}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Render the form only if an email is selected or if no unread emails are found */}
        {(!unreadEmails.length > 0 && fetchedEmailInfo) && (
          <>
            <h2 style={styles.sectionTitle}>2. Review & Augment</h2>
            <div style={styles.infoBox}>
              <p style={styles.infoText}><strong>Selected From:</strong> {fetchedEmailInfo.sender}</p>
              <p style={styles.infoText}><strong>Selected Subject:</strong> {fetchedEmailInfo.subject || '[No Subject]'}</p>
            </div>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Email Content:</label>
              <textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                style={styles.textarea}
                required
              />
              <label style={styles.label}>Your Weekly Calendar Info:</label>
              <textarea
                value={calendarInfo}
                onChange={(e) => setCalendarInfo(e.target.value)}
                style={styles.textarea}
              />
              <button
                type="submit"
                disabled={loading || isSending}
                style={{
                  ...styles.button,
                  backgroundColor: styles.buttonColors.generate,
                  ...(loading || isSending ? styles.buttonDisabled : {}),
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = styles.buttonHoverColors.generate)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = styles.buttonColors.generate)}
              >
                {loading ? 'Generating Reply...' : 'Generate Automated Reply'}
              </button>
            </form>
          </>
        )}
        
        {error && <div style={styles.error}>{error}</div>}

        {reply && (
          <div style={styles.replySection}>
            <h2 style={styles.sectionTitle}>3. Generated Reply</h2>
            <textarea value={reply} readOnly style={styles.replyBox} />
            <button
              onClick={handleSendReply}
              disabled={isSending || loading}
              style={{
                ...styles.button,
                backgroundColor: styles.buttonColors.send,
                ...(isSending || loading ? styles.buttonDisabled : {}),
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = styles.buttonHoverColors.send)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = styles.buttonColors.send)}
            >
              {isSending ? 'Sending...' : 'Send Reply Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ✨ UPDATED STYLES FOR LIST AND SELECTION ✨
const styles = {
  pageWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#eef3f7',
    padding: '20px',
    fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    boxSizing: 'border-box',
  },
  container: {
    width: '90%',
    maxWidth: '900px',
    backgroundColor: '#ffffff',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: '1.8em',
    borderBottom: '2px solid #e0e0e0',
    paddingBottom: '15px',
    marginBottom: '30px',
    color: '#2c3e50',
    fontWeight: '700',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  label: {
    fontWeight: '600',
    marginBottom: '8px',
    color: '#34495e',
    fontSize: '1.05em',
  },
  textarea: {
    padding: '15px',
    fontSize: '1em',
    borderRadius: '10px',
    border: '1px solid #d0d0d0',
    resize: 'vertical',
    minHeight: '120px',
    width: '100%',
    boxSizing: 'border-box',
  },
  replyBox: {
    padding: '15px',
    fontFamily: 'monospace',
    fontSize: '1em',
    border: '1px solid #a9d9ff',
    backgroundColor: '#eaf6ff',
    borderRadius: '10px',
    width: '100%',
    minHeight: '180px',
    marginBottom: '25px',
    boxSizing: 'border-box',
  },
  button: {
    padding: '14px 28px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.1s ease',
    display: 'block',
    width: 'fit-content',
    margin: '20px auto 0 auto',
    fontSize: '1.05em',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#a0a0a0 !important',
    boxShadow: 'none',
    transform: 'none',
  },
  buttonColors: {
    fetch: '#3498db',
    generate: '#2ecc71',
    send: '#f1c40f',
  },
  buttonHoverColors: {
    fetch: '#2980b9',
    generate: '#27ae60',
    send: '#e0b40e',
  },
  error: {
    color: '#c0392b',
    backgroundColor: '#ffe6e6',
    padding: '18px',
    borderRadius: '10px',
    marginTop: '25px',
    fontWeight: 'bold',
    textAlign: 'center',
    border: '1px solid #c0392b',
  },
  infoBox: {
    backgroundColor: '#f0faff',
    padding: '18px',
    borderRadius: '10px',
    border: '1px solid #d9edff',
    marginBottom: '25px',
    color: '#34495e',
    fontSize: '1em',
    lineHeight: '1.6',
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  infoText: {
    margin: '0 0 5px 0',
  },
  replySection: {
    marginTop: '40px',
    borderTop: '2px solid #e0e0e0',
    paddingTop: '30px',
    textAlign: 'left',
  },
  // ✨ NEW STYLES FOR EMAIL LIST ✨
  emailListContainer: {
    marginTop: '30px',
    marginBottom: '30px',
    backgroundColor: '#fdfdff',
    border: '1px solid #e9e9f0',
    borderRadius: '10px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
    padding: '20px',
  },
  listTitle: {
    fontSize: '1.4em',
    color: '#34495e',
    marginBottom: '15px',
    textAlign: 'center',
    fontWeight: '600',
  },
  ul: {
    listStyle: 'none',
    padding: '0',
    margin: '0',
  },
  li: {
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '10px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      transform: 'translateY(-2px)',
    },
  },
  emailListItemText: {
    margin: '0 0 4px 0',
    color: '#444',
  },
  emailListItemSnippet: {
    fontSize: '0.9em',
    color: '#777',
    fontStyle: 'italic',
    marginTop: '8px',
    borderTop: '1px dashed #eee',
    paddingTop: '5px',
  },
};

export default EmailResponder;