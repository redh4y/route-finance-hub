import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, User, BookOpen, MapPin, Hash } from "lucide-react";

export default function StudentProfile() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem("student_id");
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    if (!studentId) { navigate("/presenca/login"); return; }
    supabase.from("students").select("*, transport_routes(name)").eq("id", studentId).single()
      .then(({ data }) => setStudent(data));
  }, [studentId, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/presenca")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold">Meu Perfil</h1>
      </header>
      <div className="p-4">
        <Card>
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full">
              <User className="h-10 w-10 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {student ? (
              <>
                <div className="text-center">
                  <h2 className="text-lg font-bold">{student.name}</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <div><p className="text-muted-foreground text-xs">Matrícula</p><p className="font-medium">{student.registration}</p></div>
                  </div>
                  {student.course && (
                    <div className="flex items-center gap-3 text-sm">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <div><p className="text-muted-foreground text-xs">Curso</p><p className="font-medium">{student.course}</p></div>
                    </div>
                  )}
                  {student.transport_routes && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div><p className="text-muted-foreground text-xs">Rota</p><p className="font-medium">{student.transport_routes.name}</p></div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">Carregando...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
