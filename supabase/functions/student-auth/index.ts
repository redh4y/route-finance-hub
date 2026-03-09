import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body.action as string;

    /* ── Register: match CPF against payers ──────────────────────── */
    if (action === "register") {
      const cpfDigits = (body.cpf as string || "").replace(/\D/g, "").padStart(11, "0");
      if (cpfDigits.length < 11) {
        return json({ ok: false, error: "CPF inválido." }, 400);
      }

      // Find payer
      const { data: payer, error: pErr } = await sb
        .from("payers")
        .select("id, name, status, document_digits, route, default_route")
        .eq("document_digits", cpfDigits)
        .maybeSingle();

      if (pErr || !payer) {
        return json({ ok: false, error: "CPF não encontrado na base de dados. Verifique se você está cadastrado no transporte." });
      }

      if (payer.status !== "ATIVO") {
        return json({ ok: false, error: "Seu cadastro no transporte está inativado. Procure a coordenação para regularizar sua situação.", inactive: true });
      }

      // Check existing student linked to this payer
      const { data: existingStudent } = await sb
        .from("students")
        .select("id, registration, active, name")
        .eq("payer_id", payer.id)
        .maybeSingle();

      if (existingStudent) {
        if (!existingStudent.active) {
          return json({ ok: false, error: "Seu cadastro de presença está inativado. Procure a coordenação.", inactive: true });
        }
        // Already registered
        return json({
          ok: true,
          already_registered: true,
          student: {
            id: existingStudent.id,
            name: payer.name,
            registration: existingStudent.registration,
          },
        });
      }

      // Create student
      const reg = `CPF-${cpfDigits.slice(-6)}`;
      const { data: newStudent, error: insertErr } = await sb
        .from("students")
        .insert({
          name: payer.name,
          registration: reg,
          phone_e164: cpfDigits,
          payer_id: payer.id,
          active: true,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      return json({
        ok: true,
        already_registered: false,
        student: {
          id: newStudent.id,
          name: payer.name,
          registration: reg,
        },
      });
    }

    /* ── Login: verify student + payer status ────────────────────── */
    if (action === "login") {
      const registration = (body.registration as string || "").trim();
      if (!registration) return json({ ok: false, error: "Matrícula não informada." }, 400);

      const { data: student, error: sErr } = await sb
        .from("students")
        .select("id, name, active, payer_id, registration")
        .eq("registration", registration)
        .maybeSingle();

      if (sErr || !student) {
        return json({ ok: false, error: "Matrícula não encontrada." });
      }

      if (!student.active) {
        return json({ ok: false, error: "Seu cadastro está inativado. Procure a coordenação.", inactive: true });
      }

      // Check payer status
      if (student.payer_id) {
        const { data: payer } = await sb
          .from("payers")
          .select("status")
          .eq("id", student.payer_id)
          .maybeSingle();

        if (payer && payer.status !== "ATIVO") {
          await sb.from("students").update({ active: false }).eq("id", student.id);
          return json({ ok: false, error: "Seu cadastro foi inativado. Procure a coordenação para regularizar.", inactive: true });
        }
      }

      return json({
        ok: true,
        student: {
          id: student.id,
          name: student.name,
          registration: student.registration,
        },
      });
    }

    /* ── Check status (for dashboard) ───────────────────────────── */
    if (action === "check_status") {
      const studentId = body.studentId as string;
      if (!studentId) return json({ ok: false, error: "ID não informado." }, 400);

      const { data: student } = await sb
        .from("students")
        .select("id, active, payer_id")
        .eq("id", studentId)
        .maybeSingle();

      if (!student || !student.active) {
        return json({ ok: false, blocked: true, error: "Cadastro inativado." });
      }

      if (student.payer_id) {
        const { data: payer } = await sb
          .from("payers")
          .select("status")
          .eq("id", student.payer_id)
          .maybeSingle();

        if (payer && payer.status !== "ATIVO") {
          await sb.from("students").update({ active: false }).eq("id", student.id);
          return json({ ok: false, blocked: true, error: "Cadastro inativado pelo sistema." });
        }
      }

      return json({ ok: true, blocked: false });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("student-auth error:", msg);
    return json({ ok: false, error: msg }, 500);
  }
});
