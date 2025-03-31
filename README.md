# Invoice Processing System Documentation

## AI Model Usage
This system uses Claude 3.5 Sonnet as the default AI model for invoice processing. 

## Running locally

You will need to use the environment variables [defined in `.env.local`](.env.local) to run Next.js AI Chatbot. 

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000/).

## Overview
This document outlines the functions and tools created/updated for the invoice processing system. The system allows company admins to upload vendor invoices and use an AI agent to automatically extract, validate, and manage invoice information.

## Core Components

### 1. Invoice Processing Tool (`lib/ai/tools/process-invoice.ts`)
```typescript
export const processInvoice = ({ session, dataStream }: ProcessInvoiceProps)
```
- **Purpose**: Main tool for processing invoice documents
- **Features**:
  - Extracts key invoice information using AI
  - Detects duplicate invoices
  - Tracks token usage
  - Handles errors gracefully
- **Key Functions**:
  - `checkInvoiceDuplicate`: Checks for existing invoices
  - `getExistingInvoiceByDetails`: Retrieves existing invoice details
  - `streamText`: Processes invoice content using AI

### 2. Display Invoice Tool (`lib/ai/tools/process-invoice.ts`)
```typescript
export const displayExistingInvoice = ({ dataStream }: { dataStream: DataStreamWriter })
```
- **Purpose**: Displays existing processed invoices
- **Features**:
  - Shows all invoices or specific invoice by ID
  - Handles missing invoice cases
  - Streams data to UI

### 3. Invoice Table Component (`components/invoice-table.tsx`)
```typescript
export const InvoiceTable: React.FC<InvoiceTableProps>
```
- **Purpose**: UI component for displaying and managing invoices
- **Features**:
  - Sortable columns (date, amount, vendor)
  - Inline editing
  - Delete functionality
  - Token usage display
- **Key Functions**:
  - `handleSort`: Manages table sorting
  - `saveEdits`: Saves invoice updates
  - `handleDelete`: Removes invoices
  - `prepareContentForSave`: Prepares data for storage

### 4. Invoice Block Components

#### Client Component (`blocks/invoice/client.tsx`)
```typescript
export const InvoiceBlock: React.FC<InvoiceBlockProps>
```
- **Purpose**: Client-side invoice block rendering
- **Features**:
  - Renders invoice table
  - Handles user interactions
  - Manages invoice state

#### Server Component (`blocks/invoice/server.ts`)
```typescript
export const invoiceDocumentHandler
```
- **Purpose**: Server-side invoice processing
- **Features**:
  - Handles document creation
  - Manages document updates
  - Processes invoice data

### 5. Database Functions (`lib/db/queries.ts`)
```typescript
// Key functions for invoice management
export const checkInvoiceDuplicate
export const getExistingInvoiceByDetails
export const getAllDocumentsByKind
```
- **Purpose**: Database operations for invoices
- **Features**:
  - Duplicate checking
  - Invoice retrieval
  - Document management

### 6. Actions (`app/(chat)/actions.ts`)
```typescript
export async function updateInvoiceDirectly
export async function deleteInvoiceDirectly
```
- **Purpose**: Server actions for invoice management
- **Features**:
  - Direct invoice updates
  - Invoice deletion
  - Error handling

## Data Structures

### Invoice Data Interface
```typescript
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
```

### Line Item Interface
```typescript
interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
```

## Key Features Implemented

1. **Invoice Processing**
   - AI-powered extraction of invoice details
   - Validation of invoice data
   - Duplicate detection
   - Token usage tracking

2. **User Interface**
   - Sortable invoice table
   - Inline editing capabilities
   - Delete functionality
   - Token usage display

3. **Data Management**
   - Database storage
   - Duplicate prevention
   - Real-time updates
   - Error handling

4. **Integration**
   - Chat interface integration
   - File upload handling
   - Data streaming
   - Real-time updates

