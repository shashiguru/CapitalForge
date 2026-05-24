'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { transactionApi, coreStockApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { Transaction, TransactionSummary, TransactionType } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const TYPE_STYLE: Record<string, string> = {
  BUY:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  SELL:     'bg-red-100 text-red-700 border-red-200',
  DIVIDEND: 'bg-blue-100 text-blue-700 border-blue-200',
  FEE:      'bg-orange-100 text-orange-700 border-orange-200',
};

const BUCKET_STYLE: Record<string, string> = {
  CORE:  'bg-blue-100 text-blue-700 border-blue-200',
  DIP:   'bg-amber-100 text-amber-700 border-amber-200',
  CRASH: 'bg-red-100 text-red-700 border-red-200',
};

function Badge({ label, styleClass }: { label: string; styleClass: string }) {
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', styleClass)}>
      {label}
    </span>
  );
}

interface TransactionFormProps {
  isEdit: boolean;
  symbol: string;
  setSymbol: (v: string) => void;
  type: TransactionType;
  setType: (v: TransactionType) => void;
  price: string;
  setPrice: (v: string) => void;
  amountBought: string;
  setAmountBought: (v: string) => void;
  quantity: string;
  setQuantity: (v: string) => void;
  fees: string;
  setFees: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  calcQty: string;
  coreStocks: { symbol: string; displayName: string | null }[];
  editingTransaction?: Transaction | null;
}

function TransactionForm({
  isEdit,
  symbol,
  setSymbol,
  type,
  setType,
  price,
  setPrice,
  amountBought,
  setAmountBought,
  quantity,
  setQuantity,
  fees,
  setFees,
  notes,
  setNotes,
  date,
  setDate,
  calcQty,
  coreStocks,
  editingTransaction,
}: TransactionFormProps) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Symbol</Label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select stock" />
            </SelectTrigger>
            <SelectContent>
              {coreStocks.map((s) => (
                <SelectItem key={s.symbol} value={s.symbol} className="text-sm">
                  {s.symbol}{s.displayName ? ` (${s.displayName})` : ''}
                </SelectItem>
              ))}
              {isEdit && editingTransaction && !coreStocks.some((s) => s.symbol === editingTransaction.symbol) && (
                <SelectItem value={editingTransaction.symbol} className="text-sm">{editingTransaction.symbol}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['BUY', 'SELL', 'DIVIDEND', 'FEE'].map((t) => (
                <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Price ($)</Label>
          <Input className="h-9 text-sm" type="number" step="any" min="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150.00" required />
        </div>
        {isEdit ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity</Label>
            <Input className="h-9 text-sm" type="number" step="any" min="0.000001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10.5" required />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">Amount ($)</Label>
            <Input className="h-9 text-sm" type="number" step="any" min="0" value={amountBought} onChange={(e) => setAmountBought(e.target.value)} placeholder="1500.00" required />
          </div>
        )}
      </div>

      {!isEdit && (
        <div className="space-y-1.5">
          <Label className="text-xs">Quantity (auto)</Label>
          <div className="h-9 flex items-center px-3 rounded-sm border bg-muted/40 text-sm tabular-nums text-muted-foreground">
            {calcQty ? `${calcQty} shares` : 'Enter price and amount'}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Fees (optional)</Label>
          <Input className="h-9 text-sm" type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input className="h-9 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes (optional)</Label>
        <Input className="h-9 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      </div>
    </div>
  );
}

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

  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<TransactionType>('BUY' as TransactionType);
  const [price, setPrice] = useState('');
  const [amountBought, setAmountBought] = useState('');
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
      const [txData, sumData, csData] = await Promise.all([
        transactionApi.getAll(selectedPortfolio.id, filters),
        transactionApi.getSummary(selectedPortfolio.id),
        coreStockApi.getAll(selectedPortfolio.id),
      ]);
      setTransactions(txData);
      setSummary(sumData);
      setCoreStocks(csData);
    } catch { toast.error('Failed to fetch transactions'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedPortfolio, filterSymbol, filterType]);
  useEffect(() => { setPage(1); }, [filterSymbol, filterType]);

  const totalPages = Math.ceil(transactions.length / pageSize) || 1;
  const paginated = transactions.slice((page - 1) * pageSize, page * pageSize);
  const startItem = transactions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, transactions.length);

  const resetForm = () => {
    setSymbol(''); setType('BUY' as TransactionType); setPrice('');
    setAmountBought(''); setQuantity(''); setFees(''); setNotes('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const calcQty = (() => {
    const amt = parseFloat(amountBought), pr = parseFloat(price);
    if (isNaN(amt) || isNaN(pr) || pr <= 0) return '';
    return (amt / pr).toFixed(6).replace(/\.?0+$/, '');
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolio) return;
    const qty = parseFloat(calcQty);
    if (isNaN(qty) || qty <= 0) { toast.error('Enter a valid amount and price'); return; }
    setIsSubmitting(true);
    try {
      await transactionApi.create(selectedPortfolio.id, {
        symbol: symbol.toUpperCase(), type,
        price: parseFloat(price), quantity: qty,
        fees: fees ? parseFloat(fees) : undefined,
        notes: notes || undefined, date,
      });
      toast.success('Transaction created');
      setIsDialogOpen(false); resetForm(); fetchData();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx); setSymbol(tx.symbol);
    setType(tx.type as TransactionType); setPrice(tx.price.toString());
    setQuantity(tx.quantity.toString()); setFees(tx.fees > 0 ? tx.fees.toString() : '');
    setNotes(tx.notes || ''); setDate(format(new Date(tx.date), 'yyyy-MM-dd'));
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    setIsSubmitting(true);
    try {
      await transactionApi.update(editingTransaction.id, {
        symbol: symbol.toUpperCase(), type,
        price: parseFloat(price), quantity: parseFloat(quantity),
        fees: fees ? parseFloat(fees) : undefined,
        notes: notes || undefined, date,
      });
      toast.success('Transaction updated');
      setIsEditDialogOpen(false); setEditingTransaction(null); resetForm(); fetchData();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      await transactionApi.delete(transactionToDelete.id);
      toast.success('Deleted'); setTransactionToDelete(null); fetchData();
    } catch { toast.error('Failed to delete'); }
    finally { setIsDeleting(false); }
  };

  const handleExport = () => {
    if (!transactions.length) return;
    const rows = [
      ['Date', 'Symbol', 'Type', 'Price', 'Quantity', 'Total', 'Fees', 'Bucket', 'Notes'],
      ...transactions.map((tx) => [
        format(new Date(tx.date), 'yyyy-MM-dd'),
        tx.symbol, tx.type,
        tx.price.toFixed(2), tx.quantity.toFixed(6),
        tx.total.toFixed(2), tx.fees.toFixed(2),
        tx.bucketUsed || '', tx.notes || '',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'transactions.csv';
    a.click();
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="label-caps">No portfolio selected</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Transactions"
        showSubtitleOnMobile
        subtitle={
          isLoading
            ? '…'
            : `${transactions.length} records · $${(summary?.totalBuys ?? 0).toLocaleString()} deployed`
        }
        actions={
          <>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleExport}
              aria-label="Export CSV"
              title="Export CSV"
              className="md:size-auto md:h-8 md:px-3"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export CSV</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="icon-sm"
                  aria-label="Add transaction"
                  title="Add transaction"
                  className="md:size-auto md:h-8 md:px-3"
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Add transaction</span>
                </Button>
              </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Transaction</DialogTitle>
                  <DialogDescription>Record a new transaction.</DialogDescription>
                </DialogHeader>
                <TransactionForm
                  isEdit={false}
                  symbol={symbol}
                  setSymbol={setSymbol}
                  type={type}
                  setType={setType}
                  price={price}
                  setPrice={setPrice}
                  amountBought={amountBought}
                  setAmountBought={setAmountBought}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  fees={fees}
                  setFees={setFees}
                  notes={notes}
                  setNotes={setNotes}
                  date={date}
                  setDate={setDate}
                  calcQty={calcQty}
                  coreStocks={coreStocks}
                />
                <DialogFooter className="mt-4">
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      {/* ─── Filters + table ─── */}
      <div className="bg-card border border-border rounded-sm">
        {/* Filters */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-border sm:flex-row sm:items-center sm:gap-3 md:px-5">
          <div className="relative flex-1 sm:max-w-xs">
            <Input
              placeholder="Search symbol, date, notes…"
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value.toUpperCase())}
              className="h-8 text-sm pl-3 bg-transparent border-border"
            />
          </div>
          <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 flex-1 sm:w-32 text-xs bg-transparent">
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
          <Select value="ALL" onValueChange={() => {}}>
            <SelectTrigger className="h-8 flex-1 sm:w-36 text-xs bg-transparent">
              <SelectValue placeholder="All symbols" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All symbols</SelectItem>
              {coreStocks.map((s) => (
                <SelectItem key={s.symbol} value={s.symbol}>{s.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['DATE', 'SYMBOL', 'TYPE', 'PRICE', 'QUANTITY', 'TOTAL', 'BUCKET', ''].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      'py-2.5 px-5 label-caps text-left',
                      ['PRICE', 'QUANTITY', 'TOTAL'].includes(h) && 'text-right'
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={8} className="px-5 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : paginated.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                        No transactions found.
                      </td>
                    </tr>
                  )
                : paginated.map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-5 tabular-nums">
                        {format(new Date(tx.date), 'yyyy-MM-dd')}
                      </td>
                      <td className="py-3 px-5 font-semibold">{tx.symbol}</td>
                      <td className="py-3 px-5">
                        <Badge label={tx.type} styleClass={TYPE_STYLE[tx.type] ?? 'bg-muted text-muted-foreground border-border'} />
                      </td>
                      <td className="py-3 px-5 text-right tabular-nums">${tx.price.toFixed(2)}</td>
                      <td className="py-3 px-5 text-right tabular-nums">{tx.quantity.toFixed(2)}</td>
                      <td className="py-3 px-5 text-right tabular-nums font-semibold">
                        ${tx.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-5">
                        {tx.bucketUsed ? (
                          <Badge label={tx.bucketUsed} styleClass={BUCKET_STYLE[tx.bucketUsed] ?? 'bg-muted text-muted-foreground border-border'} />
                        ) : null}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => handleEdit(tx)}
                          className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {transactions.length > pageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {startItem}–{endItem} of {transactions.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-muted/40 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded hover:bg-muted/40 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={isEditDialogOpen} onOpenChange={(o) => { setIsEditDialogOpen(o); if (!o) { setEditingTransaction(null); resetForm(); } }}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Update transaction details.</DialogDescription>
            </DialogHeader>
            <TransactionForm
              isEdit
              symbol={symbol}
              setSymbol={setSymbol}
              type={type}
              setType={setType}
              price={price}
              setPrice={setPrice}
              amountBought={amountBought}
              setAmountBought={setAmountBought}
              quantity={quantity}
              setQuantity={setQuantity}
              fees={fees}
              setFees={setFees}
              notes={notes}
              setNotes={setNotes}
              date={date}
              setDate={setDate}
              calcQty={calcQty}
              coreStocks={coreStocks}
              editingTransaction={editingTransaction}
            />
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => { setIsEditDialogOpen(false); setEditingTransaction(null); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─── */}
      <Dialog open={!!transactionToDelete} onOpenChange={(o) => !o && setTransactionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
              {transactionToDelete && (
                <span className="block mt-2 font-medium text-foreground">
                  {transactionToDelete.symbol} · {format(new Date(transactionToDelete.date), 'MMM d, yyyy')} · ${transactionToDelete.total.toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionToDelete(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
