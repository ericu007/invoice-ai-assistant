import { Block } from '@/components/create-block';
import {
  CopyIcon,
  DownloadIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
} from '@/components/icons';
import { InvoiceTable } from '@/components/invoice-table';
import { toast } from 'sonner';

interface InvoiceBlockMetadata {
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
    estimated_cost: number;
  };
}

export const invoiceBlock = new Block<'invoice', InvoiceBlockMetadata>({
  kind: 'invoice',
  description: 'Useful for managing invoice data',
  initialize: async () => {},
  onStreamPart: ({ streamPart, setBlock, setMetadata }) => {
    if (streamPart.type === 'invoice-data') {
      try {
        const invoiceData = JSON.parse(streamPart.content as string);
        
        setBlock((draftBlock) => ({
          ...draftBlock,
          content: JSON.stringify(invoiceData, null, 2),
          isVisible: true,
          status: 'streaming',
        }));
        
        if (!Array.isArray(invoiceData) && invoiceData.tokenUsage) {
          setMetadata((metadata) => ({
            ...metadata,
            tokenUsage: invoiceData.tokenUsage,
          }));
        }
      } catch (error) {
        console.error('Error parsing invoice data:', error);
      }
    }
  },
  content: ({
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
    metadata,
    block,
  }) => {
    console.log('Rendering invoice block:', { 
      contentLength: content?.length || 0,
      isCurrentVersion, 
      currentVersionIndex,
      status
    });
    
    const handleSaveContent = (newContent: string, currentVersion: boolean) => {
      console.log('Saving content:', { 
        newContentLength: newContent?.length || 0,
        currentVersion 
      });
      onSaveContent(newContent, currentVersion);
    };

    let tokenUsageFromContent = null;
    try {
      const parsedContent = JSON.parse(content);
      if (parsedContent.tokenUsage) {
        tokenUsageFromContent = parsedContent.tokenUsage;
      }
    } catch (e) {
    }

    return (
      <InvoiceTable
        content={content}
        status={status}
        isCurrentVersion={isCurrentVersion}
        saveContent={handleSaveContent}
        showTokenUsage={true}
        tokenUsage={tokenUsageFromContent || metadata?.tokenUsage}
      />
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        return isCurrentVersion;
      },
    },
    {
      icon: <CopyIcon />,
      description: 'Copy as JSON',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied JSON to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download as CSV',
      onClick: ({ content }) => {
        try {
          let invoices;
          try {
            const parsedContent = JSON.parse(content);
            if (parsedContent.invoices) {
              invoices = parsedContent.invoices;
            } else {
              invoices = parsedContent;
            }
          } catch (e) {
            throw new Error('Invalid JSON content');
          }
          
          const invoiceArray = Array.isArray(invoices) ? invoices : [invoices];
          
          let csv = 'Vendor Name,Customer Name,Invoice Number,Invoice Date,Due Date,Amount\n';
          
          invoiceArray.forEach(invoice => {
            csv += `"${invoice.vendorName}","${invoice.customerName}","${invoice.invoiceNumber}","${invoice.invoiceDate}","${invoice.dueDate}",${invoice.amount}\n`;
          });
          
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.setAttribute('href', url);
          a.setAttribute('download', 'invoices.csv');
          a.click();
          
          toast.success('Downloaded CSV file!');
        } catch (e) {
          toast.error('Failed to download CSV: ' + (e as Error).message);
        }
      },
    },
  ],
  toolbar: [
    {
      description: 'Show all invoices',
      icon: <SparklesIcon />,
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Show me all the invoices in the system.',
        });
      },
    },
    {
      description: 'Process more invoices',
      icon: <SparklesIcon />,
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'I want to process more invoices.',
        });
      },
    },
  ],
});