/**
 * Derive a conversation title from the message array.
 * Uses the first user message longer than 5 characters.
 *
 * @param {Array<{role: string, content?: string}>} messages
 * @returns {string}
 */
export function deriveTitle(messages) {
  if (!messages || !Array.isArray(messages)) return 'New Chat';
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = (msg.content || '').trim();
      if (content.length > 5) return content.slice(0, 100);
    }
  }
  // Fallback to any user message
  const firstUser = messages.find((m) => m.role === 'user');
  return firstUser ? (firstUser.content || 'New Chat').slice(0, 100) : 'New Chat';
}
