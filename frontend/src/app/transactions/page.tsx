'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { transactionApi, coreStockApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Pencil, Loader2, ArrowUpRight, ArrowDownRight, Coins, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction, TransactionSummary, TransactionType } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const getTypeColor = (type: TransactionType | string) => {
  switch (type) {
    case 'BUY':
      return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
    case 'SELL':
      return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
    case 'DIVIDEND':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
    case 'FEE':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300';
  }
};

const getTypeIcon = (type: TransactionType | string) => {
  switch (type) {
    case 'BUY':
      return <ArrowDownRight className="h-4 w-4 text-green-500" />;
    case 'SELL':
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    case 'DIVIDEND':
      return <Coins className="h-4 w-4 text-blue-500" />;
    case 'FEE':
      return <DollarSign className="h-4 w-4 text-orange-500" />;
    default:
      return null;
  }
};

export default function TransactionsPage() {
  const { selectedPortfolio } = usePortfolio();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [coreStocks, setCoreStocks] = useState<{ symbol: string; displayName: string | null }[]>([]);

  // Filter state
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form state
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<TransactionType>('BUY' as TransactionType);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [fees, setFees] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchData = async () => {
    if (!selectedPortfolio) return;

    setIsLoading(true);
    try {
      const filters: any = {};
      if (filterSymbol) filters.symbol = filterSymbol;
      if (filterType && filterType !== 'ALL') filters.type = filterType;

      const [transactionsData, summaryData, coreStocksData] = await Promise.all([
        transactionApi.getAll(selectedPortfolio.id, filters),
        transactionApi.getSummary(selectedPortfolio.id),
        coreStockApi.getAll(selectedPortfolio.id),
      ]);
      setTransactions(transactionsData);
      setSummary(summaryData);
      setCoreStocks(coreStocksData);
    } catch (error) {
      toast.error('Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPortfolio, filterSymbol, filterType]);

  useEffect(() => {
    setPage(1);
  }, [filterSymbol, filterType]);

  const totalPages = Math.ceil(transactions.length / pageSize) || 1;
  const paginatedTransactions = transactions.slice((page - 1) * pageSize, page * pageSize);
  const startItem = transactions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, transactions.length);

  const resetForm = () => {
    setSymbol('');
    setType('BUY' as TransactionType);
    setPrice('');
    setQuantity('');
    setFees('');
    setNotes('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolio) return;

    setIsSubmitting(true);
    try {
      await transactionApi.create(selectedPortfolio.id, {
        symbol: symbol.toUpperCase(),
        type,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        fees: fees ? parseFloat(fees) : undefined,
        notes: notes || undefined,
        date,
      });
      toast.success('Transaction created');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setSymbol(tx.symbol);
    setType(tx.type as TransactionType);
    setPrice(tx.price.toString());
    setQuantity(tx.quantity.toString());
    setFees(tx.fees > 0 ? tx.fees.toString() : '');
    setNotes(tx.notes || '');
    setDate(format(new Date(tx.date), 'yyyy-MM-dd'));
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    setIsSubmitting(true);
    try {
      await transactionApi.update(editingTransaction.id, {
        symbol: symbol.toUpperCase(),
        type,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        fees: fees ? parseFloat(fees) : undefined,
        notes: notes || undefined,
        date,
      });
      toast.success('Transaction updated');
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (tx: Transaction) => {
    setTransactionToDelete(tx);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    try {
      await transactionApi.delete(transactionToDelete.id);
      toast.success('Transaction deleted');
      setTransactionToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>Select a portfolio to view transactions.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="text-muted-foreground">View and manage your transaction history</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Transaction</DialogTitle>
                  <DialogDescription>Record a new transaction in your portfolio.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="symbol">Symbol</Label>
                      <Select value={symbol} onValueChange={setSymbol}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stock" />
                        </SelectTrigger>
                        <SelectContent>
                          {coreStocks.map((s) => (
                            <SelectItem key={s.symbol} value={s.symbol}>
                              {s.symbol} {s.displayName ? `(${s.displayName})` : ''}
                            </SelectItem>
                          ))}
                          {coreStocks.length === 0 && (
                            <SelectItem value="" disabled>
                              No core stocks — add allocations first
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="type">Type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BUY">Buy</SelectItem>
                          <SelectItem value="SELL">Sell</SelectItem>
                          <SelectItem value="DIVIDEND">Dividend</SelectItem>
                          <SelectItem value="FEE">Fee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="150.00"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.000001"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="10"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="fees">Fees (optional)</Label>
                      <Input
                        id="fees"
                        type="number"
                        step="0.01"
                        value={fees}
                        onChange={(e) => setFees(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Transaction Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setEditingTransaction(null); resetForm(); } }}>
            <DialogContent>
              <form onSubmit={handleEditSubmit}>
                <DialogHeader>
                  <DialogTitle>Edit Transaction</DialogTitle>
                  <DialogDescription>Update the transaction details.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-symbol">Symbol</Label>
                      <Select value={symbol} onValueChange={setSymbol}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stock" />
                        </SelectTrigger>
                        <SelectContent>
                          {coreStocks.map((s) => (
                            <SelectItem key={s.symbol} value={s.symbol}>
                              {s.symbol} {s.displayName ? `(${s.displayName})` : ''}
                            </SelectItem>
                          ))}
                          {editingTransaction && !coreStocks.some((s) => s.symbol === editingTransaction.symbol) && (
                            <SelectItem value={editingTransaction.symbol}>{editingTransaction.symbol}</SelectItem>
                          )}
                          {coreStocks.length === 0 && !editingTransaction && (
                            <SelectItem value="" disabled>
                              No core stocks — add allocations first
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-type">Type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BUY">Buy</SelectItem>
                          <SelectItem value="SELL">Sell</SelectItem>
                          <SelectItem value="DIVIDEND">Dividend</SelectItem>
                          <SelectItem value="FEE">Fee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-price">Price</Label>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="150.00"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-quantity">Quantity</Label>
                      <Input
                        id="edit-quantity"
                        type="number"
                        step="0.000001"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="10"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fees">Fees (optional)</Label>
                      <Input
                        id="edit-fees"
                        type="number"
                        step="0.01"
                        value={fees}
                        onChange={(e) => setFees(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-date">Date</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-notes">Notes (optional)</Label>
                    <Input
                      id="edit-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingTransaction(null); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Transaction</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this transaction?
                  {transactionToDelete && (
                    <span className="block mt-2 font-medium text-foreground">
                      {transactionToDelete.symbol} — {format(new Date(transactionToDelete.date), 'MMM d, yyyy')} — ${transactionToDelete.total.toLocaleString()}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransactionToDelete(null)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                  {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Buys</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-green-500">${summary?.totalBuys.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sells</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-red-500">${summary?.totalSells.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Invested</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">${summary?.netInvested.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Dividends</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-blue-500">${summary?.totalDividends.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>{summary?.transactionCount || 0} transactions</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Filter by symbol"
                  value={filterSymbol}
                  onChange={(e) => setFilterSymbol(e.target.value.toUpperCase())}
                  className="w-32"
                />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All types</SelectItem>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                    <SelectItem value="DIVIDEND">Dividend</SelectItem>
                    <SelectItem value="FEE">Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found.
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(new Date(tx.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(tx.type)}
                          <Badge className={getTypeColor(tx.type)}>{tx.type}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{tx.symbol}</TableCell>
                      <TableCell>${tx.price.toFixed(2)}</TableCell>
                      <TableCell>{tx.quantity.toFixed(4)}</TableCell>
                      <TableCell className="font-medium">${tx.total.toLocaleString()}</TableCell>
                      <TableCell>{tx.fees > 0 ? `$${tx.fees.toFixed(2)}` : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tx)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(tx)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-2 py-4 border-t">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startItem}-{endItem} of {transactions.length}
                  </p>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
