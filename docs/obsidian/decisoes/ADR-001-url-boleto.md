# ADR-001: Usar view_url como link principal do boleto

**Data:** 2026-03
**Status:** Aceito

---

## Contexto

A tabela `payer_boleto_links` possui dois campos de URL:
- `drive_url` — link direto para o arquivo no Google Drive
- `view_url` — link de visualização (mais amigável, sem forçar download imediato)

Ao implementar o botão "Enviar link" nas pendências de download, precisamos decidir qual URL enviar via WhatsApp.

## Decisão

Usar `view_url` como preferência, com fallback para `drive_url`:
```ts
boleto_url: (row.view_url || row.drive_url) || null
```

## Consequências

- O aluno recebe um link que abre o boleto para visualizar antes de baixar
- Se `view_url` não estiver preenchido para um boleto, o `drive_url` é usado automaticamente
- O botão "Enviar link" só aparece se houver alguma URL disponível (`boleto_url !== null`)
