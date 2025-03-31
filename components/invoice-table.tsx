'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { updateInvoiceDirectly, deleteInvoiceDirectly } from '@/app/(chat)/actions';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  customerName: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  lineItems: LineItem[];
  documentId?: string; 
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
    estimated_cost: number;
  };
}

type InvoiceTableProps = {
  content: string;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  status?: string;
  isCurrentVersion: boolean;
  showTokenUsage?: boolean;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
    estimated_cost: number;
  };
};

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  content,
  saveContent,
  status = 'complete',
  isCurrentVersion = true,
  showTokenUsage = false,
  tokenUsage,
}) => {
  const parsedInvoiceData = useMemo(() => {
    try {
      const parsedData = JSON.parse(content);
      
      if (parsedData.invoices) {
        return Array.isArray(parsedData.invoices) ? parsedData.invoices : [parsedData.invoices];
      }
      
      return Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch (e) {
      return [];
    }
  }, [content]);

  const [invoiceData, setInvoiceData] = useState<InvoiceData[]>([]);

  useEffect(() => {
    setInvoiceData(parsedInvoiceData);
  }, [parsedInvoiceData]);

  const [sortField, setSortField] = useState<'invoiceDate' | 'amount' | 'vendorName'>('invoiceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editableInvoice, setEditableInvoice] = useState<InvoiceData | null>(null);

  const sortedInvoices = useMemo(() => {
    return [...invoiceData].sort((a, b) => {
      if (sortField === 'amount') {
        return sortDirection === 'asc'
          ? a.amount - b.amount
          : b.amount - a.amount;
      } else if (sortField === 'invoiceDate') {
        return sortDirection === 'asc'
          ? new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
          : new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
      } else {
        return sortDirection === 'asc'
          ? a.vendorName.localeCompare(b.vendorName)
          : b.vendorName.localeCompare(a.vendorName);
      }
    });
  }, [invoiceData, sortField, sortDirection]);

  const handleSort = (field: 'invoiceDate' | 'amount' | 'vendorName') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const startEditing = (invoice: InvoiceData) => {
    setEditableInvoice({ ...invoice });
  };

  const prepareContentForSave = (updatedInvoices: InvoiceData[]) => {
    let tokenUsageToKeep;
    try {
      const parsedContent = JSON.parse(content);
      tokenUsageToKeep = parsedContent.tokenUsage;
    } catch (e) {
      tokenUsageToKeep = tokenUsage || { 
        input: 0, 
        output: 0, 
        total: 0, 
        estimated_cost: 0 
      };
    }
    
    return JSON.stringify({
      invoices: updatedInvoices,
      tokenUsage: tokenUsageToKeep
    }, null, 2);
  };

  const saveEdits = async (updatedInvoice: InvoiceData) => {
    if (!updatedInvoice.documentId) {
      toast.error('Cannot update: Missing document ID');
      return;
    }

    try {
      const result = await updateInvoiceDirectly(
        updatedInvoice.documentId, 
        JSON.stringify(updatedInvoice)
      );
      
      if (!result.success) {
        throw new Error('Database update failed');
      }
      
      const updatedInvoices = invoiceData.map(inv => 
        inv.documentId === updatedInvoice.documentId ? updatedInvoice : inv
      );
      
      setInvoiceData(updatedInvoices);
      
      const updatedContent = prepareContentForSave(updatedInvoices);
      saveContent(updatedContent, isCurrentVersion);
      
      setEditableInvoice(null);
      toast.success('Invoice updated successfully!');
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice');
    }
  };

  const cancelEdits = () => {
    setEditableInvoice(null);
  };

  const handleDelete = async (invoice: InvoiceData) => {
    if (!invoice.documentId) {
      toast.error('Cannot delete: Missing document ID');
      return;
    }

    try {
      const result = await deleteInvoiceDirectly(invoice.documentId);
      
      if (!result.success) {
        throw new Error('Database delete failed');
      }
      
      const updatedInvoices = invoiceData.filter(
        inv => inv.documentId !== invoice.documentId
      );
      
      setInvoiceData(updatedInvoices);
      
      const updatedContent = prepareContentForSave(updatedInvoices);
      saveContent(updatedContent, isCurrentVersion);
      
      toast.success('Invoice deleted successfully!');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice from database');
    }
  };

  if (status === 'loading') {
    return <div className="p-4">Loading invoice data...</div>;
  }

  const hasError = invoiceData.length === 1 && 'error' in invoiceData[0];
  if (hasError) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{invoiceData[0].error}</p>
        </div>
      </div>
    );
  }

  if (invoiceData.length === 0 && content) {
    return <div className="p-4 text-red-500">Invalid invoice data</div>;
  }

  if (editableInvoice) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold">Edit Invoice</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Customer Name</label>
            <input
              type="text"
              value={editableInvoice.customerName}
              onChange={(e) =>
                setEditableInvoice({
                  ...editableInvoice,
                  customerName: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium">Vendor Name</label>
            <input
              type="text"
              value={editableInvoice.vendorName}
              onChange={(e) =>
                setEditableInvoice({
                  ...editableInvoice,
                  vendorName: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium">Invoice Number</label>
            <input
              type="text"
              value={editableInvoice.invoiceNumber}
              onChange={(e) =>
                setEditableInvoice({
                  ...editableInvoice,
                  invoiceNumber: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium">Amount</label>
            <input
              type="number"
              value={editableInvoice.amount}
              onChange={(e) =>
                setEditableInvoice({
                  ...editableInvoice,
                  amount: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium">Invoice Date</label>
            <input
              type="date"
              value={editableInvoice.invoiceDate}
              onChange={(e) =>
                setEditableInvoice({
                  ...editableInvoice,
                  invoiceDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium">Due Date</label>
            <input
              type="date"
              value={editableInvoice.dueDate}
              onChange={(e) =>
                setEditableInvoice({
                  ...editableInvoice,
                  dueDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold mt-4">Line Items</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Quantity</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Unit Price</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {editableInvoice.lineItems.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const updatedLineItems = [...editableInvoice.lineItems];
                        updatedLineItems[index].description = e.target.value;
                        setEditableInvoice({
                          ...editableInvoice,
                          lineItems: updatedLineItems,
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const updatedLineItems = [...editableInvoice.lineItems];
                        updatedLineItems[index].quantity = parseFloat(e.target.value);
                        updatedLineItems[index].amount = 
                          updatedLineItems[index].quantity * updatedLineItems[index].unitPrice;
                        setEditableInvoice({
                          ...editableInvoice,
                          lineItems: updatedLineItems,
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const updatedLineItems = [...editableInvoice.lineItems];
                        updatedLineItems[index].unitPrice = parseFloat(e.target.value);
                        updatedLineItems[index].amount = 
                          updatedLineItems[index].quantity * updatedLineItems[index].unitPrice;
                        setEditableInvoice({
                          ...editableInvoice,
                          lineItems: updatedLineItems,
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </td>
                  <td className="px-4 py-2">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex space-x-2 mt-4">
          <button 
            onClick={() => saveEdits(editableInvoice)} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save Changes
          </button>
          <button 
            onClick={cancelEdits}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {showTokenUsage && tokenUsage && (
        <div className="mb-4 p-2 bg-gray-100 rounded text-sm">
          <h3 className="font-medium">Token Usage:</h3>
          <div>Input: {tokenUsage.input}</div>
          <div>Output: {tokenUsage.output}</div>
          <div>Total: {tokenUsage.total}</div>
          <div>Estimated Cost: ${tokenUsage.estimated_cost.toFixed(4)}</div>
        </div>
      )}

      {sortedInvoices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No invoices found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th 
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('vendorName')}
                >
                  Vendor Name
                  {sortField === 'vendorName' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">Customer Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Invoice #</th>
                <th 
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('invoiceDate')}
                >
                  Invoice Date
                  {sortField === 'invoiceDate' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">Due Date</th>
                <th 
                  className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('amount')}
                >
                  Amount
                  {sortField === 'amount' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                {isCurrentVersion && (
                  <th className="px-4 py-2 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedInvoices.map((invoice, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{invoice.vendorName}</td>
                  <td className="px-4 py-2">{invoice.customerName}</td>
                  <td className="px-4 py-2">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-2">{invoice.invoiceDate}</td>
                  <td className="px-4 py-2">{invoice.dueDate}</td>
                  <td className="px-4 py-2">${typeof invoice.amount === 'number' ? invoice.amount.toFixed(2) : invoice.amount}</td>
                  {isCurrentVersion && (
                    <td className="px-4 py-2">
                      <div className="flex space-x-2">
                        <button 
                          className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          onClick={() => startEditing(invoice)}
                        >
                          Edit
                        </button>
                        <button 
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          onClick={() => handleDelete(invoice)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};