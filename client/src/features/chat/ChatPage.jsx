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

  return (
    <main
      style={{
        maxWidth: 700,
        margin: '32px auto',
        padding: 20,
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <h1>Request chat</h1>
      <p>
        Messages refresh every five seconds.
        Showing up to 100 recent messages.
      </p>

      {loadError && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          Could not load messages: {loadError}
        </p>
      )}

      <section
        aria-label="Conversation"
        style={{
          border: '1px solid #ccc',
          borderRadius: 8,
          padding: 16,
          minHeight: 200,
          maxHeight: 400,
          overflowY: 'auto',
          marginBottom: 20
        }}
      >
        {loading && <p>Loading messages…</p>}

        {!loading && !loadError && messages.length === 0 && (
          <p>No messages yet. Start the conversation below.</p>
        )}

        {messages.map((message) => (
          <article
            key={message.id}
            style={{
              borderBottom: '1px solid #eee',
              padding: '12px 0'
            }}
          >
            <strong>
              {message.sender?.name || 'Participant'}
            </strong>

            <p
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere'
              }}
            >
              {message.body}
            </p>

            <small>
              {new Date(message.createdAt).toLocaleString()}
            </small>
          </article>
        ))}
      </section>

      <form onSubmit={handleSend}>
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
          style={{
            display: 'block',
            boxSizing: 'border-box',
            width: '100%',
            marginTop: 8,
            marginBottom: 12,
            padding: 10
          }}
        />

        <button
          type="submit"
          disabled={sending || !body.trim()}
          style={{ padding: '10px 20px' }}
        >
          {sending ? 'Sending…' : 'Send message'}
        </button>

        {sendError && (
          <p role="alert" style={{ color: '#b91c1c' }}>
            Could not send message: {sendError}
          </p>
        )}
      </form>
    </main>
  );
}