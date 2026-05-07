export const PROTECTED_ADDRESS_FIELDS = [
  "cep",
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
  "address_base",
  "address_original",
  "match_ok",
  "review_status",
  "review_reason",
  "review_flag",
  "review_address",
] as const;

export type ExistingPayerLike = {
  id: string;
  document_digits: string | null;
  payer_code: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  extra_contacts: Array<{ type: string; value: string }> | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  address_base: string | null;
  address_original: string | null;
  match_ok: boolean | null;
  review_status: string | null;
  review_reason: string | null;
  review_flag: boolean | null;
  review_address: boolean | null;
  needs_review: boolean | null;
};

export type PayerMergeOptions = {
  overwriteAddresses?: boolean;
  overwritePhones?: boolean;
};

export type PayerMergeDecision = {
  addressProtected: boolean;
  phoneProtected: boolean;
  phoneAddedAsSecondary: boolean;
  extraContactsPreserved: boolean;
  emailProtected: boolean;
  needsReview: boolean;
  changedFields: string[];
  notes: string[];
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  document_digits: "CPF",
  payer_code: "Código",
  phone: "Telefone",
  email: "Email",
  address_original: "Endereço original",
  street: "Logradouro",
  number: "Número",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  cep: "CEP",
  address_base: "Endereço base",
  match_ok: "Match endereço",
  review_status: "Status revisão",
  review_reason: "Motivo revisão",
  review_flag: "Flag revisão",
  review_address: "Revisar endereço",
};

function normalizeVal(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim();
}

export function isAddressProtected(
  existing: ExistingPayerLike,
  knownCEPs: Set<string>,
  genericCEPs: Set<string> = new Set(),
): boolean {
  const cepDigits = String(existing.cep || "").replace(/\D/g, "");
  if (!cepDigits) return false;
  if (!knownCEPs.has(cepDigits)) return false;
  if (genericCEPs.has(cepDigits)) return false;
  if (existing.match_ok === false) return false;
  if (existing.review_address === true) return false;
  if (existing.needs_review === true) return false;
  if (existing.review_status === "REVIEW") return false;
  return true;
}

/**
 * Applies the protected merge rules for a payer reimport.
 *
 * Returns the final payload that would be written to the database, plus a
 * decision object describing what was protected, changed, or preserved.
 *
 * Used by both the real import (useOptimizedImport.ts) and the dry-run
 * (Import.tsx) so their behaviour is guaranteed to be identical.
 */
export function applyPayerProtectedMerge(
  csvPayer: Record<string, any>,
  existing: ExistingPayerLike | undefined | null,
  knownCEPs: Set<string>,
  options: PayerMergeOptions,
  runId?: string,
): { payload: Record<string, any>; decision: PayerMergeDecision } {
  const { overwriteAddresses = false, overwritePhones = false } = options;

  const merged: Record<string, any> = { ...csvPayer };
  if (runId !== undefined) merged.run_id = runId;

  const decision: PayerMergeDecision = {
    addressProtected: false,
    phoneProtected: false,
    phoneAddedAsSecondary: false,
    extraContactsPreserved: false,
    emailProtected: false,
    needsReview:
      csvPayer.review_flag === true ||
      csvPayer.review_address === true ||
      csvPayer.review_status === "REVIEW",
    changedFields: [],
    notes: [],
  };

  if (!existing) {
    if (decision.needsReview) decision.notes.push("Linha marcada para revisão.");
    return { payload: merged, decision };
  }

  // Clear temporary review flag for existing payers
  merged.needs_review = false;

  // 1. Address protection
  const addrProtected = !overwriteAddresses && isAddressProtected(existing, knownCEPs);
  if (addrProtected) {
    for (const f of PROTECTED_ADDRESS_FIELDS) {
      delete merged[f];
    }
    merged.needs_review = existing.needs_review ?? false;
    decision.addressProtected = true;
    decision.notes.push("Endereço protegido (CEP validado).");
  }

  // 2. Merge extra_contacts accumulatively — never replace existing contacts
  const csvPhone = csvPayer.phone as string | null | undefined;
  const currentExtras: Array<{ type: string; value: string }> = Array.isArray(existing.extra_contacts)
    ? existing.extra_contacts
    : [];
  const csvExtras: Array<{ type: string; value: string }> = Array.isArray(csvPayer.extra_contacts)
    ? csvPayer.extra_contacts
    : [];

  // Candidate contacts to add: CSV secondary phones + CSV primary phone demoted to secondary
  const candidates = [...csvExtras];
  if (csvPhone && existing.phone && existing.phone.trim() !== "" && csvPhone !== existing.phone) {
    candidates.push({ type: "phone", value: csvPhone });
  }

  const seen = new Set<string>(currentExtras.map((c) => c.value));
  const mergedExtras = [...currentExtras];
  let addedNew = false;
  let csvPrimaryDemoted = false;

  for (const c of candidates) {
    if (!c?.value) continue;
    if (c.value === existing.phone) continue; // never re-add the current primary phone
    if (seen.has(c.value)) continue;
    seen.add(c.value);
    mergedExtras.push(c);
    addedNew = true;
    if (c.value === csvPhone) csvPrimaryDemoted = true;
  }

  merged.extra_contacts = mergedExtras.length > 0 ? mergedExtras : null;

  if (currentExtras.length > 0) {
    decision.extraContactsPreserved = true;
  }
  if (csvPrimaryDemoted) {
    decision.phoneAddedAsSecondary = true;
  }

  // 3. Protected phone — preserve existing primary phone
  if (!overwritePhones && existing.phone && existing.phone.trim() !== "") {
    if (csvPhone && csvPhone !== existing.phone) {
      decision.phoneProtected = true;
      decision.notes.push("Telefone protegido — novo vai para contato secundário.");
    }
    merged.phone = existing.phone;
  } else if (!csvPhone && existing.phone) {
    // CSV brought no phone — keep existing
    merged.phone = existing.phone;
  }

  // 4. Email protection — keep existing email by default
  if (existing.email && existing.email.trim() !== "" && !overwriteAddresses) {
    merged.email = existing.email;
    decision.emailProtected = true;
  }

  // 5. Compute changedFields by comparing merged payload to existing DB values
  const compareKeys = [
    "name",
    "document_digits",
    "payer_code",
    "phone",
    "email",
    "address_original",
    "street",
    "number",
    "neighborhood",
    "city",
    "state",
    "cep",
    "address_base",
    "match_ok",
    "review_status",
    "review_reason",
    "review_flag",
    "review_address",
  ];
  for (const key of compareKeys) {
    if (!(key in merged)) continue; // field was deleted (protected) — DB value unchanged
    if (normalizeVal(merged[key]) !== normalizeVal((existing as any)[key])) {
      decision.changedFields.push(FIELD_LABELS[key] || key);
    }
  }
  if (addedNew) {
    decision.changedFields.push("Contatos extras");
  }

  // Compute final needsReview from what will actually be written
  decision.needsReview = merged.needs_review === true;

  if (decision.changedFields.length > 0) {
    decision.notes.unshift("Cadastro existente será atualizado.");
  }
  if (decision.needsReview) {
    decision.notes.push("Linha marcada para revisão.");
  }

  return { payload: merged, decision };
}
