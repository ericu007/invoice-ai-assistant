import { myProvider } from '@/lib/ai/models';
import { invoicePrompt, updateDocumentPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/blocks/server';
import { streamText, streamObject } from 'ai';
import { z } from 'zod';

const calculateTokenUsage = (inputTokens: number, outputTokens: number) => {
  const INPUT_COST_PER_MILLION = 3; // $3 per 1M input tokens
  const OUTPUT_COST_PER_MILLION = 15; // $15 per 1M output tokens
  
  const inputCost = (inputTokens / 1000000) * INPUT_COST_PER_MILLION;
  const outputCost = (outputTokens / 1000000) * OUTPUT_COST_PER_MILLION;
  
  return {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
    estimated_cost: inputCost + outputCost
  };
};

export const invoiceDocumentHandler = createDocumentHandler<'invoice'>({
  kind: 'invoice',
  
  onCreateDocument: async ({ title, dataStream }) => {
    try {
      let draftContent = '';
      let tokenUsage = { input: 0, output: 0 };
  
      const { fullStream } = streamText({
        model: myProvider.languageModel('block-model'),
        system: invoicePrompt,
        prompt: title,
        experimental_providerMetadata: {
          estimated_input_tokens: (count) => {
            tokenUsage.input = count;
          },
          estimated_output_tokens: (count) => {
            tokenUsage.output = count;
          },
        },
      });
  
      let responseText = '';
  
      for await (const chunk of fullStream) {
        if (chunk.type === 'text-delta') {
          responseText += chunk.textDelta;
        }
      }
  
      try {
        let jsonResponse;
        try {
          jsonResponse = JSON.parse(responseText);
        } catch (directParseError) {
        }
        
        const responseWithTokens = {
          ...jsonResponse,
          tokenUsage: calculateTokenUsage(tokenUsage.input, tokenUsage.output)
        };
        
        const jsonData = JSON.stringify(responseWithTokens, null, 2);
        
        dataStream.writeData({
          type: 'invoice-data',
          content: jsonData,
        });
        
        draftContent = jsonData;
        
      } catch (parseError) {
        const errorResult = {
          error: "Failed to process invoice. The AI response couldn't be parsed as valid JSON.",
          rawResponse: responseText.substring(0, 500) + '...',
          tokenUsage: calculateTokenUsage(tokenUsage.input, tokenUsage.output)
        };
        
        dataStream.writeData({
          type: 'invoice-data',
          content: JSON.stringify(errorResult, null, 2),
        });
        
        draftContent = JSON.stringify(errorResult, null, 2);
      }
  
      return draftContent;
    } catch (error) {
      throw error;
    }
  },

  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: myProvider.languageModel('block-model'),
      system: updateDocumentPrompt(document.content, 'invoice'),
      prompt: description,
      schema: z.object({
        customerName: z.string(),
        vendorName: z.string(),
        invoiceNumber: z.string(),
        invoiceDate: z.string(),
        dueDate: z.string().optional(),
        amount: z.number(),
        lineItems: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          amount: z.number()
        })),
        tokenUsage: z.object({
          input: z.number(),
          output: z.number(),
          total: z.number(),
          estimated_cost: z.number()
        }).optional()
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        
        if (object) {
          dataStream.writeData({
            type: 'invoice-data',
            content: JSON.stringify(object, null, 2),
          });

          draftContent = JSON.stringify(object, null, 2);
        }
      }
    }

    return draftContent;
  },
});