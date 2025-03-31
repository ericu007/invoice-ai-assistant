import { generateUUID } from '@/lib/utils';
import { type DataStreamWriter, tool, streamText } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { documentHandlersByBlockKind } from '@/lib/blocks/server';
import { checkInvoiceDuplicate, getAllDocumentsByKind, getExistingInvoiceByDetails } from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/models';
import { invoicePrompt } from '@/lib/ai/prompts';

interface ProcessInvoiceProps {
  session: Session;
  dataStream: DataStreamWriter;
}

interface InvoiceData {
  customerName: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

interface ProcessInvoiceResult {
  id: string;
  title: string;
  kind: 'invoice';
  content: string;
  isDuplicate?: boolean;
  isError?: boolean;
  invoiceDetails?: InvoiceData;
  existingInvoiceId?: string;
}

export const processInvoice = ({ session, dataStream }: ProcessInvoiceProps) =>
  tool({
    description:
      'Process an invoice document to extract key information like vendor, customer, amount, and line items.',
    parameters: z.object({
      invoiceContent: z.string().describe('The content of the invoice to process'),
      existingBlockId: z.string().optional().describe('ID of an existing invoice block to update instead of creating a new one')
    }),
    execute: async ({ invoiceContent, existingBlockId }): Promise<ProcessInvoiceResult> => {
      try {
        let tokenUsage = { input: 0, output: 0 };
        let responseText = '';
        let extractedInvoice: any = null;
        
        const { fullStream } = streamText({
          model: myProvider.languageModel('block-model'),
          system: invoicePrompt,
          prompt: invoiceContent,
          onFinish: ({ usage }) => {
            if (usage) {
              tokenUsage.input = usage.promptTokens || 0;
              tokenUsage.output = usage.completionTokens || 0;
            }
          }
        });
        
        for await (const chunk of fullStream) {
          if (chunk.type === 'text-delta') {
            responseText += chunk.textDelta;
          }
        }
        
        try {
          try {
            extractedInvoice = JSON.parse(responseText);
          } catch (directParseError) {
          }
          
          if ('error' in extractedInvoice) {
            return {
              id: existingBlockId || generateUUID(),
              title: 'Invalid Invoice',
              kind: 'invoice',
              content: extractedInvoice.error,
              isError: true
            };
          }
          
          const isDuplicateInvoice = await checkInvoiceDuplicate({
            vendorName: extractedInvoice.vendorName,
            invoiceNumber: extractedInvoice.invoiceNumber,
            amount: extractedInvoice.amount
          });
          
          if (isDuplicateInvoice) {
            const existingInvoice = await getExistingInvoiceByDetails({
              vendorName: extractedInvoice.vendorName,
              invoiceNumber: extractedInvoice.invoiceNumber,
              amount: extractedInvoice.amount
            });
            
            const id = existingInvoice.exists && existingInvoice.id 
              ? existingInvoice.id 
              : (existingBlockId || generateUUID());
            
            return {
              id,
              title: 'Duplicate Invoice',
              kind: 'invoice',
              content: `Duplicate invoice detected: ${extractedInvoice.invoiceNumber} from ${extractedInvoice.vendorName} for $${extractedInvoice.amount}`,
              isDuplicate: true,
              invoiceDetails: extractedInvoice,
              existingInvoiceId: existingInvoice.exists && existingInvoice.id ? existingInvoice.id : undefined
            };
          }
        } catch (error) {
          return {
            id: existingBlockId || generateUUID(),
            title: 'Invoice Processing Error',
            kind: 'invoice',
            content: 'Failed to parse invoice data. Please check the document format.',
            isError: true
          };
        }
        
        const id = generateUUID();
        
        const title = `Invoice: ${extractedInvoice.vendorName} - ${extractedInvoice.invoiceNumber}`;

        extractedInvoice.documentId = id;

        extractedInvoice.tokenUsage = {
          input: tokenUsage.input,
          output: tokenUsage.output,
          total: tokenUsage.input + tokenUsage.output,
          estimated_cost: (tokenUsage.input / 1000000 * 3) + (tokenUsage.output / 1000000 * 15)
        };
        
        const documentHandler = documentHandlersByBlockKind.find(
          (handler) => handler.kind === 'invoice',
        );

        if (!documentHandler) {
          const error = 'No document handler found for invoice blocks';
          throw new Error(error);
        }
        
        try {
          const draftContent = await documentHandler.onCreateDocument({
            id,
            title: invoiceContent,
            dataStream: {
              writeData: () => {},
            } as any,
            session,
          });
        } catch (error) {
        }
        
        const invoiceDocuments = await getAllDocumentsByKind({ kind: 'invoice' });
        
        if (!invoiceDocuments || invoiceDocuments.length === 0) {
          return {
            id,
            title,
            kind: 'invoice',
            content: 'Error: Failed to retrieve invoices after processing.',
            isError: true
          };
        }
        
        const allInvoices = [];
        
        for (const doc of invoiceDocuments) {
          if (doc.content) {
            try {
              const invoice = JSON.parse(doc.content);
              if (!('error' in invoice)) {
                invoice.documentId = invoice.documentId || doc.id;
                allInvoices.push(invoice);
              }
            } catch (e) {
            }
          }
        }
        
        dataStream.writeData({
          type: 'kind',
          content: 'invoice',
        });

        dataStream.writeData({
          type: 'id',
          content: id,
        });

        dataStream.writeData({
          type: 'title',
          content: 'All Invoices',
        });

        dataStream.writeData({
          type: 'clear',
          content: '',
        });
        
        dataStream.writeData({
          type: 'invoice-data',
          content: JSON.stringify({
            invoices: allInvoices,
            tokenUsage: {
              input: Math.max(tokenUsage.input, 1),
              output: Math.max(tokenUsage.output, 1),
              total: Math.max(tokenUsage.input + tokenUsage.output, 1),
              estimated_cost: Math.max((tokenUsage.input / 1000000 * 3) + (tokenUsage.output / 1000000 * 15), 0.0001)
            }
          }, null, 2),
        });
        
        dataStream.writeData({ type: 'finish', content: '' });

        return {
          id,
          title: 'All Invoices',
          kind: 'invoice',
          content: 'The invoice has been processed and is now visible with all other invoices in the invoice block.',
          invoiceDetails: extractedInvoice
        };
      } catch (error) {
        throw error;
      }
    },
  });

export const displayExistingInvoice = ({ dataStream }: { dataStream: DataStreamWriter }) =>
  tool({
    description:
      'Display an existing invoice that has already been processed in the system.',
    parameters: z.object({
      invoiceId: z.string().optional().describe('The ID of the existing invoice to display. If not provided, shows all invoices.'),
    }),
    execute: async ({ invoiceId }) => {
      try {
        const invoiceDocuments = await getAllDocumentsByKind({ kind: 'invoice' });
        
        if (!invoiceDocuments || invoiceDocuments.length === 0) {
          return {
            error: "No invoices found in the system.",
          };
        }
        
        if (invoiceId) {
          const document = invoiceDocuments.find(doc => doc.id === invoiceId);
          
          if (!document || !document.content) {
            return {
              error: "Could not find the requested invoice.",
            };
          }
          
          dataStream.writeData({
            type: 'kind',
            content: 'invoice',
          });

          dataStream.writeData({
            type: 'id',
            content: document.id,
          });

          dataStream.writeData({
            type: 'title',
            content: document.title,
          });
          
          dataStream.writeData({
            type: 'invoice-data',
            content: document.content,
          });
        } 
        else {
          const allInvoices = [];
          
          for (const doc of invoiceDocuments) {
            if (doc.content) {
              try {
                const invoice = JSON.parse(doc.content);
                if (invoice.invoices) {
                  const invoicesArray = Array.isArray(invoice.invoices) ? invoice.invoices : [invoice.invoices];
                  for (const inv of invoicesArray) {
                    if (!('error' in inv)) {
                      inv.documentId = inv.documentId || doc.id;
                      allInvoices.push(inv);
                    }
                  }
                } 
                else if (!('error' in invoice)) {
                  invoice.documentId = invoice.documentId || doc.id;
                  allInvoices.push(invoice);
                }
              } catch (e) {
              }
            }
          }
          
          if (allInvoices.length === 0) {
            return {
              error: "No valid invoices found in the system.",
            };
          }
          
          const recentDoc = invoiceDocuments[0];
          
          dataStream.writeData({
            type: 'kind',
            content: 'invoice',
          });

          dataStream.writeData({
            type: 'id',
            content: recentDoc.id,
          });

          dataStream.writeData({
            type: 'title',
            content: 'All Invoices',
          });
          
          dataStream.writeData({
            type: 'invoice-data',
            content: JSON.stringify({
              invoices: allInvoices,
              tokenUsage: {
                input: 0,
                output: 0,
                total: 0,
                estimated_cost: 0
              }
            }, null, 2),
          });
        }

        dataStream.writeData({ type: 'finish', content: '' });
        
        return {
          id: invoiceId || invoiceDocuments[0].id,
          title: 'Invoice Collection',
          kind: 'invoice',
          content: 'The invoice data is now displayed in the invoice block.',
        };
      } catch (error) {
        throw error;
      }
    },
  });