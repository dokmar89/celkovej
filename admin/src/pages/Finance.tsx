import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Download } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, Timestamp, where, orderBy, getCountFromServer } from "firebase/firestore";
import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
    id: string;
    createdAt: any;
    type: "credit" | "debit";
    amount: number;
    companyId: string;
    status: "pending" | "completed" | "failed";
    details: any;
}

interface FinanceData {
    name: string;
    income: number;
    expenses: number;
}

const chartConfig = {
  income: {
    theme: {
      light: "#8884d8",
      dark: "#8884d8"
    }
  },
  expenses: {
    theme: {
      light: "#82ca9d",
      dark: "#82ca9d"
    }
  }
};

export default function Finance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
    const [monthlyIncome, setMonthlyIncome] = useState(0);
    const [balance, setBalance] = useState(0);
    const [financeData, setFinanceData] = useState<FinanceData[]>([]);
    const { user } = useAuth();
    const { toast } = useToast();


    useEffect(() => {
        const fetchTransactions = async () => {
            const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedTransactions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Transaction[];
            setTransactions(fetchedTransactions);
            calculateTotals(fetchedTransactions)
        };

      const fetchFinanceData = async () => {
            try {
                if (user?.uid) {
                    const token = await user.getIdToken();
                    const response = await fetch('/api/getFinanceData', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ data: { companyId: user.uid, month: new Date().toISOString() } })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setFinanceData(data.data);
                    } else {
                        const errorData = await response.json();
                        toast({
                            variant: "destructive",
                            title: "Chyba",
                            description: `Nepodařilo se načíst finanční data: ${errorData.error}`,
                        });
                    }
                }
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Chyba",
                    description: `Nepodařilo se načíst finanční data: ${error.message}`,
                });
            }
      }

        fetchTransactions();
        fetchFinanceData();
    }, [user]);

    const calculateTotals = (transactions: Transaction[]) => {
        let totalIncome = 0;
        let monthlyIncome = 0;
        let balance = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        transactions.forEach(transaction => {
            if (transaction.type === "credit") {
                totalIncome += transaction.amount;
                const transactionDate = transaction.createdAt?.toDate();
                if (transactionDate && transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear) {
                    monthlyIncome += transaction.amount;
                }
                balance += transaction.amount;
            } else if (transaction.type === "debit") {
                balance -= transaction.amount;
            }
        });
        setTotalIncome(totalIncome);
        setMonthlyIncome(monthlyIncome);
        setBalance(balance);
    };

        const handleExportCSV = () => {
            const csvContent = "data:text/csv;charset=utf-8," 
                + "Datum,Typ,Částka,Společnost,Status\n"
                + transactions.map(transaction => {
                    const date = transaction.createdAt?.toDate().toLocaleString();
                    return `${date},${transaction.type},${transaction.amount},${transaction.companyId},${transaction.status}`
                }).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "transactions.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    
    const handleExportPDF = () => {
        const doc = new jsPDF();
        const head = [["Datum", "Typ", "Částka", "Společnost", "Status"]];
        const body = transactions.map(transaction => {
            const date = transaction.createdAt?.toDate().toLocaleString();
          return [date, transaction.type, transaction.amount, transaction.companyId, transaction.status]
        });
        
        (doc as any).autoTable({ head, body });
        doc.save("transactions.pdf");
    };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Celkové příjmy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Měsíční příjmy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(monthlyIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Zůstatek</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(balance)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Finanční přehled</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[300px]" config={chartConfig}>
            <LineChart data={financeData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#8884d8" />
              <Line type="monotone" dataKey="expenses" stroke="#82ca9d" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transakce</CardTitle>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Částka</TableHead>
                <TableHead>Společnost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.createdAt?.toDate().toLocaleString()}</TableCell>
                  <TableCell className="capitalize">{transaction.type}</TableCell>
                  <TableCell>
                    <span
                      className={transaction.type === "credit" ? "text-green-600" : "text-red-600"}
                    >
                      {transaction.type === "credit" ? "+" : "-"}
                      {transaction.amount} Kč
                    </span>
                  </TableCell>
                  <TableCell>{transaction.companyId}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        transaction.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : transaction.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}