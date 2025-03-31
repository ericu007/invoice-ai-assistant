'use server';

import { generateText, type Message } from 'ai';
import { cookies } from 'next/headers';

import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
  deleteDocument, 
  saveDocument,
  updateDocument,
  getDocumentById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/models';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: message.content,
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function updateInvoiceDirectly(id: string, content: string) {
  'use server';
  try {
    await updateDocument({
      id,
      content,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to update invoice:', error);
    return { success: false, error };
  }
}

export async function deleteInvoiceDirectly(id: string) {
  'use server';
  try {
    await deleteDocument({ id });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const verifyDeleted = await getDocumentById({ id });
    if (verifyDeleted) {
      console.error('Document still exists after deletion attempt:', id);
      return { success: false, error: 'Document deletion did not complete' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to delete invoice:', error);
    return { success: false, error };
  }
}