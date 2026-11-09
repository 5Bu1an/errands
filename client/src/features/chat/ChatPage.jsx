import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

export default function ChatPage() {
  const { requestId } = useParams();
  const token = localStorage.getItem('accessToken');

  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    let active = true;
    let timer;

    setMessages([]);
    setBody('');
    setLoading(true);
    setLoadError('');
    setSendError('');

    async function refresh() {
      try {
        const result = await api(
          `/chat/${requestId}/messages`,
          { token }
        );

        if (active) {
          setMessages(result.messages);
          setLoadError('');
        }
      } catch (error) {
        if (active) {
          setLoadError(error.message);
        }
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(refresh, 5000);
        }
      }
    }

    refresh();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [requestId, token]);

  async function handleSend(event) {
    event.preventDefault();

    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError('');

    try {
      await api(`/chat/${requestId}/messages`, {
        method: 'POST',
        token,
        body: { body: text }
      });

      setBody('');
      // The next automatic refresh displays the saved message.
    } catch (error) {
      setSendError(error.message);
    } finally {
      setSending(false);
    }
  }

  const currentUserId = localStorage.getItem('userId');

  return (
    <main className="page page-narrow">
      <h1>Request chat</h1>
      <p className="subtitle" style={{ marginBottom: 16 }}>
        Sort out pickup details here. Messages refresh every five seconds.
      </p>

      {loadError && (
        <p role="alert" className="error">Could not load messages: {loadError}</p>
      )}

      <section aria-label="Conversation" className="card">
        {loading && <p className="meta">Loading messages…</p>}

        {!loading && !loadError && messages.length === 0 && (
          <p className="meta">No messages yet. Start the conversation below.</p>
        )}

        <div className="chat-box">
          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <article key={message.id} className={`bubble${mine ? ' mine' : ''}`}>
                {!mine && <strong style={{ fontSize: 13 }}>{message.sender?.name || 'Participant'}</strong>}
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</div>
                <small style={{ opacity: 0.7 }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
              </article>
            );
          })}
        </div>
      </section>

      <form onSubmit={handleSend} className="card">
        <label htmlFor="chat-message">Your message</label>
        <textarea
          id="chat-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={3}
          required
          disabled={sending}
          placeholder="Type a message..."
          style={{ marginTop: 6, marginBottom: 12 }}
        />

        <button type="submit" className="btn" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send message'}
        </button>

        {sendError && (
          <p role="alert" className="error">Could not send message: {sendError}</p>
        )}
      </form>
    </main>
  );
}
