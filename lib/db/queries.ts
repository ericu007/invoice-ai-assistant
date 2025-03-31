import 'server-only';
import { and, asc, desc, eq, gt, gte, inArray, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

import {
  chat,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
} from './schema';
import type { BlockKind } from '@/components/block';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      // userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      // .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: BlockKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      // userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function checkInvoiceDuplicate({
  vendorName,
  invoiceNumber,
  amount,
}: {
  vendorName: string;
  invoiceNumber: string;
  amount: number | string;
}) {
  try {
    // Get all documents of kind 'invoice' with a fresh query
    const invoiceDocs = await db
      .select()
      .from(document)
      .where(eq(document.kind, 'invoice'));
    
    // Normalize the amount for comparison
    const normalizedAmount = typeof amount === 'string' ? amount : amount.toString();
    
    // Check each document's content for duplicates
    for (const doc of invoiceDocs) {
      if (!doc.content) continue;
      
      try {
        const content = JSON.parse(doc.content);
        
        // Handle both array and single object cases
        let invoices = [];
        
        if (content.invoices) {
          // New format with invoices array
          invoices = Array.isArray(content.invoices) ? content.invoices : [content.invoices];
        } else {
          // Old format
          invoices = Array.isArray(content) ? content : [content];
        }
        
        // Check each invoice in the document
        for (const invoice of invoices) {
          // Skip if it doesn't have the required fields
          if (!invoice.vendorName || !invoice.invoiceNumber || invoice.amount === undefined) {
            continue;
          }
          
          // Convert invoice amount to string for comparison
          const invoiceAmount = typeof invoice.amount === 'string' 
            ? invoice.amount 
            : invoice.amount.toString();
            
          // Log potential match details for debugging
          const isVendorMatch = invoice.vendorName.toLowerCase() === vendorName.toLowerCase();
          const isNumberMatch = invoice.invoiceNumber === invoiceNumber;
          const isAmountMatch = invoiceAmount === normalizedAmount;
          
          // Check if this is a match
          if (isVendorMatch && isNumberMatch && isAmountMatch) {
            return true; // Found a duplicate
          }
        }
      } catch (e) {
        // Skip documents with invalid JSON
        console.error('Error parsing document content:', e);
        continue;
      }
    }
    
    console.log('No duplicate invoice found');
    return false; // No duplicate found
  } catch (error) {
    console.error('Failed to check for duplicate invoice across documents', error);
    return false;
  }
}

interface ExistingInvoiceResult {
  exists: boolean;
  id?: string;
  invoice?: any;
}

export async function getExistingInvoiceByDetails({
  vendorName,
  invoiceNumber,
  amount,
}: {
  vendorName: string;
  invoiceNumber: string;
  amount: number | string;
}): Promise<ExistingInvoiceResult> {
  try {
    // Get all documents of kind 'invoice'
    const invoiceDocs = await db
      .select()
      .from(document)
      .where(eq(document.kind, 'invoice'));
    
    // Normalize the amount for comparison
    const normalizedAmount = typeof amount === 'string' ? amount : amount.toString();
    
    // Check each document's content for matching invoices
    for (const doc of invoiceDocs) {
      if (!doc.content) continue;
      
      try {
        const content = JSON.parse(doc.content);
        
        // Handle both array and single object cases
        let invoices = [];
        
        if (content.invoices) {
          // New format with invoices array
          invoices = Array.isArray(content.invoices) ? content.invoices : [content.invoices];
        } else {
          // Old format
          invoices = Array.isArray(content) ? content : [content];
        }
        
        // Check each invoice in the document
        for (const invoice of invoices) {
          // Skip if it doesn't have the required fields
          if (!invoice.vendorName || !invoice.invoiceNumber || invoice.amount === undefined) {
            continue;
          }
          
          // Convert invoice amount to string for comparison
          const invoiceAmount = typeof invoice.amount === 'string' 
            ? invoice.amount 
            : invoice.amount.toString();
              
          // Check if this is a match
          if (
            invoice.vendorName.toLowerCase() === vendorName.toLowerCase() &&
            invoice.invoiceNumber === invoiceNumber &&
            invoiceAmount === normalizedAmount
          ) {
            // Return the document ID so we can reference it
            return { 
              id: doc.id, 
              exists: true,
              invoice
            };
          }
        }
      } catch (e) {
        // Skip documents with invalid JSON
        console.error('Error parsing document content:', e);
        continue;
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Failed to find existing invoice', error);
    return { exists: false };
  }
}

export async function getAllDocumentsByKind({ kind }: { kind: BlockKind }) {
  try {
    return await db
      .select()
      .from(document)
      .where(eq(document.kind, kind))
      .orderBy(desc(document.createdAt));
  } catch (error) {
    console.error(`Failed to get documents of kind ${kind}`, error);
    return [];
  }
}  

export async function deleteDocument({ id }: { id: string }) {
  try {
    return await db.delete(document).where(eq(document.id, id));
  } catch (error) {
    console.error('Failed to delete document from database');
    throw error;
  }
}

export async function updateDocument({
  id,
  title,
  content,
}: {
  id: string;
  title?: string;
  content?: string;
}) {
  try {
    // Create an update object with only the fields that are provided
    const updateValues: any = {};
    
    if (title !== undefined) {
      updateValues.title = title;
    }
    
    if (content !== undefined) {
      updateValues.content = content;
    }
    
    // Only update if there are values to update
    if (Object.keys(updateValues).length > 0) {
      return await db.update(document)
        .set(updateValues)
        .where(eq(document.id, id));
    }
    
    return null;
  } catch (error) {
    console.error('Failed to update document in database');
    throw error;
  }
}