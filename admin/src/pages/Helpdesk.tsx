import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, Timestamp, orderBy, addDoc } from "firebase/firestore";

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
    createdAt: any;
  customer: string;
  company: string;
}

export default function Helpdesk() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
    const [openTicketsCount, setOpenTicketsCount] = useState(0);
    const [inProgressTicketsCount, setInProgressTicketsCount] = useState(0);
    const [resolvedTodayCount, setResolvedTodayCount] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
    const [reply, setReply] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchTickets = async () => {
      const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      setTickets(fetchedTickets);
        calculateTicketStatus(fetchedTickets);
    };

    fetchTickets();
  }, []);

  const calculateTicketStatus = (tickets: Ticket[]) => {
      let open = 0;
      let inProgress = 0;
      let resolved = 0;
      const today = new Date();
        today.setHours(0, 0, 0, 0);
      tickets.forEach(ticket => {
          if(ticket.status === "open") open++;
          else if(ticket.status === "in_progress") inProgress++;
          else if(ticket.status === "resolved" && ticket.createdAt?.toDate() >= today) resolved++;
      });

      setOpenTicketsCount(open);
        setInProgressTicketsCount(inProgress);
        setResolvedTodayCount(resolved);
  };

  const handleReply = async () => {
    if (!selectedTicket) return;
      try {
          await addDoc(collection(db, "ticketReplies"), {
            ticketId: selectedTicket.id,
            message: reply,
            createdAt: Timestamp.now(),
            userId: "admin" // TODO: Get current user ID
          });
          toast({
              title: "Odpověď odeslána",
              description: "Vaše odpověď byla úspěšně odeslána zákazníkovi.",
          });
          setIsReplyOpen(false);
          setReply("");
      } catch (error: any) {
          toast({
              variant: "destructive",
              title: "Chyba odeslání",
              description: `Nepodařilo se odeslat odpověď: ${error.message}`,
          });
      }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Otevřené tickety</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{openTicketsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>V řešení</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{inProgressTicketsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vyřešené dnes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{resolvedTodayCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Průměrná doba řešení</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">2.5h</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tickety podpory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Předmět</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priorita</TableHead>
                <TableHead>Vytvořeno</TableHead>
                <TableHead>Zákazník</TableHead>
                <TableHead>Společnost</TableHead>
                <TableHead>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>{ticket.id}</TableCell>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        ticket.status === "open"
                          ? "bg-red-100 text-red-800"
                          : ticket.status === "in_progress"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        ticket.priority === "high"
                          ? "bg-red-100 text-red-800"
                          : ticket.priority === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {ticket.priority}
                    </span>
                  </TableCell>
                  <TableCell>{ticket.createdAt?.toDate().toLocaleString()}</TableCell>
                  <TableCell>{ticket.customer}</TableCell>
                  <TableCell>{ticket.company}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setIsReplyOpen(true);
                      }}
                    >
                      Odpovědět
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odpovědět na ticket</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Ticket: {selectedTicket.subject}
                </p>
                <p className="text-sm text-muted-foreground">
                  Zákazník: {selectedTicket.customer}
                </p>
              </div>
              <Textarea
                placeholder="Napište svoji odpověď..."
                className="min-h-[200px]"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsReplyOpen(false)}>
                  Zrušit
                </Button>
                <Button onClick={handleReply}>Odeslat odpověď</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}