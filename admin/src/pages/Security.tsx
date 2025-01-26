import { useState, useEffect } from "react";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
    import { ChartContainer } from "@/components/ui/chart";
    import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
    import { db } from "@/lib/firebase";
    import { collection, query, getDocs, Timestamp, where, orderBy, getCountFromServer } from "firebase/firestore";
    import { useAuth } from "@/contexts/AuthContext";
    import { useToast } from "@/hooks/use-toast";

    interface SecurityEvent {
        id: string;
        timestamp: any;
        type: "login_attempt" | "password_change" | "api_access" | "verification_attempt";
        description: string;
        severity: "info" | "warning" | "critical";
        source: string;
    }

    interface EventStats {
        name: string;
        count: number;
    }

    const chartConfig = {
      events: {
        theme: {
          light: "#8884d8",
          dark: "#8884d8"
        }
      }
    };

    export default function Security() {
      const [events, setEvents] = useState<SecurityEvent[]>([]);
        const [eventStats, setEventStats] = useState<EventStats[]>([]);
        const [criticalCount, setCriticalCount] = useState(0);
        const [warningCount, setWarningCount] = useState(0);
        const [infoCount, setInfoCount] = useState(0);
        const { user } = useAuth();
        const { toast } = useToast();


        useEffect(() => {
            const fetchSecurityEvents = async () => {
                try {
                    if(user?.uid) {
                        const token = await user.getIdToken();
                        const response = await fetch('/api/getSecurityEvents', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                        });
                        if (response.ok) {
                            const data = await response.json();
                            setEvents(data.data);
                            calculateSeverityCounts(data.data);
                            calculateEventStats(data.data);
                        } else {
                            const errorData = await response.json();
                            toast({
                                variant: "destructive",
                                title: "Chyba",
                                description: `Nepodařilo se načíst bezpečnostní události: ${errorData.error}`,
                            });
                        }
                    }
                } catch (error: any) {
                    toast({
                        variant: "destructive",
                        title: "Chyba",
                        description: `Nepodařilo se načíst bezpečnostní události: ${error.message}`,
                    });
                }
            };
                fetchSecurityEvents();
        }, [user]);

        const calculateSeverityCounts = (events: SecurityEvent[]) => {
            let critical = 0;
            let warning = 0;
            let info = 0;

            events.forEach(event => {
                if (event.severity === "critical") critical++;
                else if (event.severity === "warning") warning++;
                else if (event.severity === "info") info++;
            });

            setCriticalCount(critical);
            setWarningCount(warning);
            setInfoCount(info);
        };

        const calculateEventStats = (events: SecurityEvent[]) => {
            const eventTypeCounts: { [key: string]: number } = {};
            events.forEach((event) => {
                if (event.type) {
                    eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;
                }
            });
            const stats: EventStats[] = Object.keys(eventTypeCounts).map((type) => ({
                name: type.replace("_", " "),
                count: eventTypeCounts[type],
            }));
            setEventStats(stats);
        };


      return (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Kritické události</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Varování</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">{warningCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Informační události</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{infoCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Přehled bezpečnostních událostí</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer className="h-[300px]" config={chartConfig}>
                <BarChart data={eventStats}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bezpečnostní události</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Popis</TableHead>
                    <TableHead>Závažnost</TableHead>
                    <TableHead>Zdroj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.timestamp?.toDate().toLocaleString()}</TableCell>
                      <TableCell className="capitalize">
                        {event.type.replace("_", " ")}
                      </TableCell>
                      <TableCell>{event.description}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            event.severity === "critical"
                              ? "bg-red-100 text-red-800"
                              : event.severity === "warning"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {event.severity}
                        </span>
                      </TableCell>
                      <TableCell>{event.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      );
    }