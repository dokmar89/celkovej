import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, addDoc,  getCountFromServer } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface RegistrationRequest {
  id: string;
  companyName: string;
  ico: string;
  dic: string;
  address: string;
  contactPerson: {
    name: string;
    email: string;
    phone: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
}

const Dashboard = () => {
  const [pendingRequests, setPendingRequests] = useState<RegistrationRequest[]>([]);
    const [newRegistrationsCount, setNewRegistrationsCount] = useState(0);
    const [verificationsCount, setVerificationsCount] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchPendingRequests = async () => {
      const q = query(collection(db, "registrationRequests"), where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RegistrationRequest[];
      setPendingRequests(requests);
    };
    const fetchDashboardData = async () => {
        try {
            if (user?.uid) {
                const token = await user.getIdToken();
                const response = await fetch('/api/getDashboardData', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setNewRegistrationsCount(data.data.registrationsCount);
                    setVerificationsCount(data.data.verificationsCount);
                } else {
                  const errorData = await response.json();
                    toast({
                        variant: "destructive",
                        title: "Chyba",
                        description: `Nepodařilo se načíst data dashboardu: ${errorData.error}`,
                    });
                }
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Chyba",
                description: `Nepodařilo se načíst data dashboardu: ${error.message}`,
            });
        }
    };
    
    fetchPendingRequests();
      fetchDashboardData();
  }, [user]);

  const handleApprove = async (request: RegistrationRequest) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Uživatel není přihlášen",
      });
      return;
    }
    try {
      // 1. Vytvoření uživatele pro kontaktní osobu
        const newUser = await addDoc(collection(db, "users"), {
          email: request.contactPerson.email,
          role: "contact",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        
      // 2. Vytvoření společnosti
      const newCompany = await addDoc(collection(db, "companies"), {
        name: request.companyName,
        ico: request.ico,
        dic: request.dic,
        address: request.address,
        contactPersonId: newUser.id,
        status: "active",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // 3. Propojení uživatele a společnosti
      await updateDoc(doc(db, "users", newUser.id), {
          linkedCompanyId: newCompany.id,
      });
      
      // 4. Aktualizace stavu registrace
      await updateDoc(doc(db, "registrationRequests", request.id), {
        status: "approved",
        processedAt: Timestamp.now(),
        reviewedByAdminId: user.uid,
      });

      setPendingRequests(pendingRequests.filter(req => req.id !== request.id));
      toast({
        title: "Žádost schválena",
        description: `Žádost pro ${request.companyName} byla úspěšně schválena.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: `Chyba při schvalování žádosti: ${error.message}`,
      });
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !user) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Žádost nebyla vybrána nebo uživatel není přihlášen",
      });
      return;
    }
    try {
      await updateDoc(doc(db, "registrationRequests", selectedRequest.id), {
        status: "rejected",
        processedAt: Timestamp.now(),
        reviewedByAdminId: user.uid,
      });
      setPendingRequests(pendingRequests.filter(req => req.id !== selectedRequest.id));
      toast({
        title: "Žádost zamítnuta",
        description: `Žádost byla zamítnuta s odůvodněním: ${rejectReason}`,
      });
      setIsRejectOpen(false);
      setRejectReason("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: `Chyba při zamítání žádosti: ${error.message}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nové registrace dnes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newRegistrationsCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ověření dnes</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verificationsCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Příjmy tento měsíc</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24,500 Kč</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Čekající žádosti</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Section */}
      <Card>
        <CardHeader>
          <CardTitle>Čekající žádosti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">{request.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.contactPerson.name}
                    </p>
                  <p className="text-sm text-muted-foreground">Datum: {request.submittedAt?.toDate().toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsDetailsOpen(true);
                    }}
                  >
                    Detail
                  </Button>
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(request)}
                  >
                    Schválit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsRejectOpen(true);
                    }}
                  >
                    Zamítnout
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail žádosti</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Společnost</p>
                  <p>{selectedRequest.companyName}</p>
                </div>
                <div>
                  <p className="font-medium">Kontaktní osoba</p>
                  <p>{selectedRequest.contactPerson.name}</p>
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <p>{selectedRequest.contactPerson.email}</p>
                </div>
                <div>
                  <p className="font-medium">Telefon</p>
                  <p>{selectedRequest.contactPerson.phone}</p>
                </div>
                  <div>
                  <p className="font-medium">Adresa</p>
                  <p>{selectedRequest.address}</p>
                  </div>
                  <div>
                  <p className="font-medium">IČO</p>
                  <p>{selectedRequest.ico}</p>
                  </div>
                    <div>
                    <p className="font-medium">DIČ</p>
                    <p>{selectedRequest.dic}</p>
                  </div>
                <div>
                  <p className="font-medium">Datum podání</p>
                  <p>{selectedRequest.submittedAt?.toDate().toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zamítnutí žádosti</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Zadejte důvod zamítnutí..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Zrušit
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Zamítnout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Graphs Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Registrace za posledních 30 dní</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {/* Graph will go here */}
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Ověření podle metody</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {/* Graph will go here */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;