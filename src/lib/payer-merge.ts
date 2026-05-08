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
  changeDetails: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
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

function normalizeTextComparable(v: unknown): string | null {
  const normalized = normalizeVal(v);
  if (!normalized) return null;
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasDiacritics(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.normalize("NFD") !== value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasReplacementChar(value: unknown): boolean {
  return typeof value === "string" && value.includes(String.fromCharCode(0xfffd));
}

const TEXT_FIELDS_TO_GUARD = [
  "name",
  "email",
  "address_original",
  "street",
  "neighborhood",
  "city",
  "state",
  "address_base",
  "review_status",
  "review_reason",
];

const ADDRESS_REVIEW_FIELDS = [
  "match_ok",
  "review_status",
  "review_reason",
  "review_flag",
  "review_address",
];

function hasAnyExistingAddress(existing: ExistingPayerLike): boolean {
  return Boolean(
    normalizeVal(existing.address_original) ||
      normalizeVal(existing.address_base) ||
      normalizeVal(existing.street) ||
      normalizeVal(existing.cep),
  );
}

function getCepDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function hasAnyAddressPayload(payload: Record<string, any>, existing?: ExistingPayerLike | null): boolean {
  return Boolean(
    normalizeVal(payload.address_original) ||
      normalizeVal(payload.address_base) ||
      normalizeVal(payload.street) ||
      normalizeVal(existing?.address_original) ||
      normalizeVal(existing?.address_base) ||
      normalizeVal(existing?.street),
  );
}

function markAddressReview(payload: Record<string, any>, reason: string, existing?: ExistingPayerLike | null) {
  payload.match_ok = false;
  payload.review_address = true;
  payload.review_flag = true;
  payload.review_status = "REVIEW";
  payload.review_reason = existing?.review_reason || reason;
  payload.needs_review = true;
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
    changeDetails: [],
    notes: [],
  };

  if (!existing) {
    const cepDigits = getCepDigits(merged.cep);
    if (!hasAnyAddressPayload(merged)) {
      markAddressReview(merged, "SEM_ENDERECO");
      decision.needsReview = true;
      decision.notes.push("Linha marcada para revisão: pagador sem endereço.");
    } else if (!cepDigits || !knownCEPs.has(cepDigits)) {
      markAddressReview(merged, "CEP_NAO_VALIDADO_BASE");
      decision.needsReview = true;
      decision.notes.push("Linha marcada para revisão: CEP ausente ou fora da base de CEPs.");
    }
    if (decision.needsReview) decision.notes.push("Linha marcada para revisão.");
    return { payload: merged, decision };
  }

  // Clear temporary review flag for existing payers
  merged.needs_review = false;

  const ignoredEncodingFields: string[] = [];
  for (const key of TEXT_FIELDS_TO_GUARD) {
    if (hasReplacementChar(merged[key])) {
      delete merged[key];
      ignoredEncodingFields.push(FIELD_LABELS[key] || key);
    }
  }
  if (ignoredEncodingFields.length > 0) {
    decision.notes.push(`Campos ignorados por texto com encoding inválido: ${ignoredEncodingFields.join(", ")}.`);
  }

  if (typeof merged.name === "string") {
    merged.name = removeDiacritics(merged.name);
  }

  if (typeof existing.name === "string" && hasDiacritics(existing.name)) {
    merged.name = removeDiacritics(existing.name);
    decision.notes.push("Nome será padronizado sem acento/caractere especial.");
  } else if (
    normalizeTextComparable(existing.name) &&
    normalizeTextComparable(existing.name) === normalizeTextComparable(merged.name)
  ) {
    if (!hasDiacritics(existing.name)) {
      delete merged.name;
      decision.notes.push("Nome preservado: diferença apenas de acento/caractere especial.");
    }
  }

  const incomingAddressReviewDowngrade =
    existing.match_ok === true &&
    merged.match_ok === false &&
    merged.review_address === true &&
    !merged.review_status &&
    !merged.review_reason;
  const incomingRawAddressWithoutMatch =
    !hasAnyExistingAddress(existing) &&
    normalizeVal(merged.address_original) &&
    merged.match_ok === false &&
    merged.review_address === true &&
    !merged.review_status &&
    !merged.review_reason;

  if (!overwriteAddresses && (incomingAddressReviewDowngrade || incomingRawAddressWithoutMatch)) {
    for (const field of ADDRESS_REVIEW_FIELDS) {
      delete merged[field];
    }
    decision.notes.push(
      incomingRawAddressWithoutMatch
        ? "Endereço original do CSV será preenchido e ficará em revisão até passar pelo match de endereços."
        : "Status de match do endereço preservado: CSV não trouxe resultado de match/revisão explícito.",
    );
  }

  // 1. Address protection
  const existingCepValidated = knownCEPs.has(getCepDigits(existing.cep));
  let addrProtected = !overwriteAddresses && isAddressProtected(existing, knownCEPs);
  const shouldClearReviewBecauseCurrentCepIsValid =
    !overwriteAddresses &&
    !addrProtected &&
    existingCepValidated &&
    (existing.review_status === "REVIEW" ||
      existing.review_address === true ||
      existing.review_flag === true ||
      existing.needs_review === true ||
      existing.match_ok === false);

  if (shouldClearReviewBecauseCurrentCepIsValid) {
    for (const f of PROTECTED_ADDRESS_FIELDS) {
      delete merged[f];
    }
    merged.match_ok = true;
    merged.review_status = null;
    merged.review_reason = null;
    merged.review_flag = false;
    merged.review_address = false;
    merged.needs_review = false;
    addrProtected = true;
    decision.addressProtected = true;
    decision.notes.push("Revisão de endereço será limpa: CEP atual já existe na base de CEPs.");
  }

  if (addrProtected) {
    for (const f of PROTECTED_ADDRESS_FIELDS) {
      delete merged[f];
    }
    if (shouldClearReviewBecauseCurrentCepIsValid) {
      merged.match_ok = true;
      merged.review_status = null;
      merged.review_reason = null;
      merged.review_flag = false;
      merged.review_address = false;
      merged.needs_review = false;
    } else {
      merged.needs_review = existing.needs_review ?? false;
    }
    decision.addressProtected = true;
    if (!shouldClearReviewBecauseCurrentCepIsValid) {
      decision.notes.push("Endereço protegido (CEP validado).");
    }
  }

  if (!addrProtected && !overwriteAddresses) {
    const finalCep = "cep" in merged ? getCepDigits(merged.cep) : getCepDigits(existing.cep);
    if (!hasAnyAddressPayload(merged, existing)) {
      markAddressReview(merged, "SEM_ENDERECO", existing);
      decision.notes.push("Linha marcada para revisão: pagador sem endereço.");
    } else if (!finalCep || !knownCEPs.has(finalCep)) {
      markAddressReview(merged, "CEP_NAO_VALIDADO_BASE", existing);
      decision.notes.push("Linha marcada para revisão: CEP ausente ou fora da base de CEPs.");
    }
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
      const field = FIELD_LABELS[key] || key;
      decision.changedFields.push(field);
      decision.changeDetails.push({
        field,
        oldValue: (existing as any)[key],
        newValue: merged[key],
      });
    }
  }
  if (addedNew) {
    decision.changedFields.push("Contatos extras");
    decision.changeDetails.push({
      field: "Contatos extras",
      oldValue: currentExtras,
      newValue: mergedExtras,
    });
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
