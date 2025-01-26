 import { useState, useEffect } from "react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
    import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
    import { db } from "@/lib/firebase";
    import { collection, query, getDocs, Timestamp, where, orderBy } from "firebase/firestore";
    import { jsPDF } from "jspdf";
    import 'jspdf-autotable';
    import { Button } from "@/components/ui/button";
    import { Download } from "lucide-react";
    import { useAuth } from "@/contexts/AuthContext";
    import { useToast } from "@/hooks/use-toast";

    type VerificationMethod = "bankID" | "mojeID" | "ocr" | "facescan" | "repeated";

    interface Verification {
      id: string;
      method: VerificationMethod;
      createdAt: any;
      status: "success" | "failed";
      eshopId: string;
      userId: string;
    }

    interface MethodStats {
        name: string;
        value: number;
    }

    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

    const chartConfig = {
      methods: {
        theme: {
          light: "#8884d8",
          dark: "#8884d8"
        }
      }
    };

    export default function Verifications() {
      const [verifications, setVerifications] = useState<Verification[]>([]);
        const [methodStats, setMethodStats] = useState<MethodStats[]>([]);
        const { user } = useAuth();
        const { toast } = useToast();

      useEffect(() => {
        const fetchVerifications = async () => {
            try {
                if(user?.uid) {
                    const token = await user.getIdToken();
                    const response = await fetch('/api/getVerificationData', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setVerifications(data.data);
                        calculateMethodStats(data.data);
                    } else {
                        const errorData = await response.json();
                        toast({
                            variant: "destructive",
                            title: "Chyba",
                            description: `Nepodařilo se načíst data ověření: ${errorData.error}`,
                        });
                    }
                }
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Chyba",
                    description: `Nepodařilo se načíst data ověření: ${error.message}`,
                });
            }
        };

        fetchVerifications();
      }, [user]);
        
        const calculateMethodStats = (verifications: Verification[]) => {
            const methodCounts: { [key: string]: number } = {};
            verifications.forEach((verification) => {
                if (verification.method) {
                    methodCounts[verification.method] = (methodCounts[verification.method] || 0) + 1;
                }
            });

            const stats: MethodStats[] = Object.keys(methodCounts).map((method) => ({
                name: method,
                value: methodCounts[method],
            }));
            setMethodStats(stats);
        };

        const handleExportCSV = () => {
            const csvContent = "data:text/csv;charset=utf-8,"
                + "Metoda,Datum,Status,Společnost,ID Uživatele\n"
                + verifications.map(verification => {
                    const date = verification.createdAt?.toDate().toLocaleString();
                    return `${verification.method},${date},${verification.status},${verification.eshopId},${verification.userId}`
                }).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "verifications.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        const handleExportPDF = () => {
            const doc = new jsPDF();
            const head = [["Metoda", "Datum", "Status", "Společnost", "ID Uživatele"]];
            const body = verifications.map(verification => {
                const date = verification.createdAt?.toDate().toLocaleString();
              return [verification.method, date, verification.status, verification.eshopId, verification.userId]
            });
            
            (doc as any).autoTable({ head, body });
            doc.save("verifications.pdf");
        };


      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rozdělení metod ověření</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-[300px]" config={chartConfig}>
                  <PieChart>
                    <Pie
                      data={methodStats}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {methodStats.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Počet ověření v čase</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-[300px]" config={chartConfig}>
                  <BarChart data={methodStats}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historie ověření</CardTitle>
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
                    <TableHead>Metoda</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Společnost</TableHead>
                    <TableHead>ID Uživatele</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifications.map((verification) => (
                    <TableRow key={verification.id}>
                      <TableCell className="capitalize">{verification.method}</TableCell>
                      <TableCell>{verification.createdAt?.toDate().toLocaleString()}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            verification.status === "success"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {verification.status}
                        </span>
                      </TableCell>
                      <TableCell>{verification.eshopId}</TableCell>
                      <TableCell>{verification.userId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      );
    }