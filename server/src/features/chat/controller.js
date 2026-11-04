const service = require('./service');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleServiceError(res, error) {
  const errors = {
    NOT_FOUND: [404, 'Request not found'],
    FORBIDDEN: [403, 'You cannot access this chat'],
    EMPTY_MESSAGE: [400, 'Message cannot be empty'],
    MESSAGE_TOO_LONG: [400, 'Message cannot exceed 2000 characters']
  };

  const [status, message] =
    errors[error] || [500, 'Unable to process chat'];

  return res.status(status).json({ error: message });
}

async function getMessages(req, res) {
  const { requestId } = req.params;

  if (!UUID_PATTERN.test(requestId || '')) {
    return res.status(400).json({ error: 'Invalid request ID' });
  }

  try {
    const result = await service.getMessages(
      requestId,
      req.user.id
    );

    if (result.error) {
      return handleServiceError(res, result.error);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to load chat messages:', error);
    return res.status(500).json({
      error: 'Unable to load messages'
    });
  }
}

async function sendMessage(req, res) {
  const { requestId } = req.params;

  if (!UUID_PATTERN.test(requestId || '')) {
    return res.status(400).json({ error: 'Invalid request ID' });
  }

  try {
    const result = await service.sendMessage(
      requestId,
      req.user.id,
      req.body && req.body.body
    );

    if (result.error) {
      return handleServiceError(res, result.error);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Failed to send chat message:', error);
    return res.status(500).json({
      error: 'Unable to send message'
    });
  }
}

module.exports = { getMessages, sendMessage };