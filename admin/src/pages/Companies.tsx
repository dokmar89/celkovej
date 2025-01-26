import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  ico: string;
  dic: string;
    address: string;
    contactPersonId: string;
  status: "active" | "suspended";
}
interface User {
  id: string;
  email: string;
  linkedCompanyId: string;
  role: "admin" | "contact";
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

  useEffect(() => {
    const fetchCompanies = async () => {
        try {
            if(user?.uid) {
                const token = await user.getIdToken();
                const response = await fetch('/api/getAllCompanies', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setCompanies(data.data);
                } else {
                    const errorData = await response.json();
                    toast({
                        variant: "destructive",
                        title: "Chyba",
                        description: `Nepodařilo se načíst společnosti: ${errorData.error}`,
                    });
                }
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Chyba",
                description: `Nepodařilo se načíst společnosti: ${error.message}`,
            });
        }
    };
    
    const fetchUsers = async () => {
      const q = query(collection(db, "users"));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(fetchedUsers);
    };

    fetchCompanies();
      fetchUsers();
  }, [user]);
    
    const getContactPerson = (company: Company) => {
        const contactPerson = users.find(user => user.id === company.contactPersonId);
        return contactPerson ? contactPerson.email : "Neznámý";
    };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Společnosti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Vyhledat společnost..."
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>IČO</TableHead>
                  <TableHead>DIČ</TableHead>
                <TableHead>Kontaktní osoba</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>{company.name}</TableCell>
                  <TableCell>{company.ico}</TableCell>
                    <TableCell>{company.dic}</TableCell>
                    <TableCell>{getContactPerson(company)}</TableCell>
                  <TableCell>
                    {company.status === "active" ? "Aktivní" : "Neaktivní"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedCompany(company);
                        setIsDetailsOpen(true);
                      }}
                    >
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail společnosti</DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Základní informace</h3>
                  <p>Název: {selectedCompany.name}</p>
                  <p>IČO: {selectedCompany.ico}</p>
                    <p>DIČ: {selectedCompany.dic}</p>
                    <p>Adresa: {selectedCompany.address}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Kontaktní údaje</h3>
                    <p>Email: {getContactPerson(selectedCompany)}</p>
                </div>
              </div>
                <div>
                <h3 className="font-semibold">Historie ověření</h3>
                {/* Add verification history table here */}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}