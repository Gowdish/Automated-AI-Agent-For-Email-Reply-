// frontend_email_app/src/App.jsx
import React from 'react';
import EmailResponder from './email_responder'; // Import the new component

function App() {
  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
      <h1>Automated Email Responder</h1>
      <p>Leveraging local AI (Mistral via Ollama) to draft replies based on your week's plan.</p>
      <EmailResponder /> {/* Render the component */}
    </div>
  );
}

export default App;