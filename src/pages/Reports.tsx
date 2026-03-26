import { useTrialBalance } from "@/hooks/useInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { FileText } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function Reports() {
  const { data: accounts, isLoading } = useTrialBalance();

  const entries = accounts ? Object.entries(accounts) : [];
  const totalDebit = entries.reduce((s, [, v]) => s + v.debit, 0);
  const totalCredit = entries.reduce((s, [, v]) => s + v.credit, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Financial Reports</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Trial Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="mb-2 h-10 w-10" />
              <p>No ledger entries yet</p>
              <p className="text-sm">Process a sale or purchase to generate entries.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([name, vals]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{fmt(vals.debit)}</TableCell>
                    <TableCell className="text-right">{fmt(vals.credit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{fmt(totalDebit)}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(totalCredit)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    {Math.abs(totalDebit - totalCredit) < 0.01 ? (
                      <span className="text-success font-medium">✓ Balanced</span>
                    ) : (
                      <span className="text-destructive font-medium">⚠ Imbalanced by {fmt(Math.abs(totalDebit - totalCredit))}</span>
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
