import {
    type Message,
    createDataStreamResponse,
    smoothStream,
    streamText,
  } from 'ai';
  
  import { auth } from '@/app/(auth)/auth';
  import { myProvider } from '@/lib/ai/models';
  import { systemPrompt } from '@/lib/ai/prompts';
  import {
    deleteChatById,
    getChatById,
    saveChat,
    saveMessages,
  } from '@/lib/db/queries';
  import {
    generateUUID,
    getMostRecentUserMessage,
    sanitizeResponseMessages,
  } from '@/lib/utils';
  
  import { generateTitleFromUserMessage } from '../../actions';
  import { createDocument } from '@/lib/ai/tools/create-document';
  import { updateDocument } from '@/lib/ai/tools/update-document';
  import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
  import { getWeather } from '@/lib/ai/tools/get-weather';
  import { processInvoice, displayExistingInvoice } from '@/lib/ai/tools/process-invoice';
  
  export const maxDuration = 60;
  
  export async function POST(request: Request) {
    const {
      id,
      messages,
      selectedChatModel,
    }: { id: string; messages: Array<Message>; selectedChatModel: string } =
      await request.json();
  
    const session = await auth();
  
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
  
    const userMessage = getMostRecentUserMessage(messages);
  
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }
  
    const chat = await getChatById({ id });
  
    if (!chat) {
      const title = await generateTitleFromUserMessage({ message: userMessage });
      await saveChat({ id, userId: session.user.id, title });
    }
  
    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });
  
    const workingMessages = [...messages];
  
    const activeTools = selectedChatModel === 'chat-model-reasoning'
    ? []
    : [
        'getWeather',
        'createDocument',
        'updateDocument',
        'requestSuggestions',
        'processInvoice',
        'displayExistingInvoice',
      ];
  
    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages: workingMessages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  'processInvoice',
                  'displayExistingInvoice',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            processInvoice: processInvoice({ session, dataStream }),
            displayExistingInvoice: displayExistingInvoice({ dataStream }),
          },
          onFinish: async ({ response, reasoning }) => {
            if (session.user?.id) {
              try {
                if (reasoning && Array.isArray(reasoning)) {
                  const duplicateInvoiceStep = reasoning.find(step => 
                    step.type === 'tool' && 
                    step.tool === 'processInvoice' && 
                    step.result && 
                    typeof step.result === 'object' &&
                    'isDuplicate' in step.result && 
                    step.result.isDuplicate === true
                  );
                  
                  if (duplicateInvoiceStep && duplicateInvoiceStep.result) {
                    const resultWithTyping = duplicateInvoiceStep.result as any;
                    
                    if ('existingInvoiceId' in resultWithTyping && resultWithTyping.existingInvoiceId) {
                    }
                  }
                }
                
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });
  
                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
              } catch (error) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'stream-text',
          },
        });
  
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occured!';
      },
    });
  }
  
  export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
  
    if (!id) {
      return new Response('Not Found', { status: 404 });
    }
  
    const session = await auth();
  
    if (!session || !session.user) {
      return new Response('Unauthorized', { status: 401 });
    }
  
    try {
      const chat = await getChatById({ id });
  
      await deleteChatById({ id });
  
      return new Response('Chat deleted', { status: 200 });
    } catch (error) {
      return new Response('An error occurred while processing your request', {
        status: 500,
      });
    }
  }
