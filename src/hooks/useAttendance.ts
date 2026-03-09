import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export function useTodayTrips(routeId?: string) {
  return useQuery({
    queryKey: ["trips-today", routeId],
    queryFn: async () => {
      let q = supabase
        .from("trips")
        .select("*, transport_routes(*), bus_assignments(*, transport_buses(*))")
        .eq("date", today())
        .eq("active", true);
      if (routeId) q = q.eq("route_id", routeId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useStudentAttendanceToday(studentId?: string) {
  return useQuery({
    queryKey: ["attendance-today", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*, transport_buses(*)")
        .eq("student_id", studentId)
        .eq("date", today());
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
    refetchInterval: 15000,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      student_id: string;
      bus_id: string;
      trip_id: string;
      trip_type: string;
      method: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      evidence?: Record<string, unknown>;
    }) => {
      // Check duplicate
      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", payload.student_id)
        .eq("date", today())
        .eq("trip_type", payload.trip_type)
        .maybeSingle();
      if (existing) throw new Error("Você já confirmou presença nesta viagem hoje.");

      const { data, error } = await supabase.from("attendance" as any).insert({
        student_id: payload.student_id,
        bus_id: payload.bus_id,
        trip_id: payload.trip_id,
        date: today(),
        trip_type: payload.trip_type,
        method: payload.method,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        status: "confirmed",
        evidence: payload.evidence || {},
      } as any).select().single();
      if (error) throw error;

      // Audit event
      await supabase.from("attendance_events").insert({
        attendance_id: data.id,
        event_type: "CHECK_IN",
        payload: { method: payload.method, timestamp: new Date().toISOString() },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Presença registrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance-monitor"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useAttendanceHistory(studentId?: string) {
  return useQuery({
    queryKey: ["attendance-history", studentId],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("*, transport_buses(*), trips(*, transport_routes(*))")
        .order("date", { ascending: false })
        .order("check_in_time", { ascending: false })
        .limit(100);
      if (studentId) q = q.eq("student_id", studentId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: studentId === undefined || !!studentId,
  });
}

export function useAttendanceMonitor(date?: string) {
  const d = date || today();
  return useQuery({
    queryKey: ["attendance-monitor", d],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, students(*), transport_buses(*), trips(*, transport_routes(*))")
        .eq("date", d);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, transport_routes(*)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTransportBuses() {
  return useQuery({
    queryKey: ["transport-buses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_buses")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTransportRoutes() {
  return useQuery({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_routes")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
