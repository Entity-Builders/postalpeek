import type { EmailOtpTokenPreparationInput } from '@eb-packages/auth';

type MailpitSearchResponse = {
  messages?: Array<{ ID?: string }>;
};

type MailpitMessageResponse = {
  Snippet?: string;
  Text?: string;
  HTML?: string;
};

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1']);

const isLocalhost = () =>
  typeof window !== 'undefined' && LOCALHOST_NAMES.has(window.location.hostname);

const findCode = (message: MailpitMessageResponse) => {
  const searchableText = [
    message.Snippet || '',
    message.Text || '',
    message.HTML || '',
  ].join(' ');

  return searchableText.match(/\b\d{6}\b/)?.[0] || null;
};

export const preparePostalPeekEmailOtpToken = async ({
  email,
  token,
}: EmailOtpTokenPreparationInput): Promise<string> => {
  if (!isLocalhost() || token !== '123456') return token;

  try {
    const searchResponse = await fetch(
      `http://127.0.0.1:54324/api/v1/search?query=to:${encodeURIComponent(email)}&limit=1`,
    );
    if (!searchResponse.ok) return token;

    const searchData = (await searchResponse.json()) as MailpitSearchResponse;
    const latestMessageId = searchData.messages?.[0]?.ID;
    if (!latestMessageId) return token;

    const messageResponse = await fetch(
      `http://127.0.0.1:54324/api/v1/message/${latestMessageId}`,
    );
    if (!messageResponse.ok) return token;

    const messageData = (await messageResponse.json()) as MailpitMessageResponse;
    return findCode(messageData) || token;
  } catch {
    return token;
  }
};
