import type { Prisma, StockReason } from "@prisma/client";

type Opts = { note?: string | null; actor?: string | null };

/** Records a stock change that has already been applied, with the balance after it. */
export async function logMovement(tx: Prisma.TransactionClient, variantId: string, delta: number, reason: StockReason, opts: Opts = {}) {
  if (!delta) return;
  const v = await tx.variant.findUnique({ where: { id: variantId }, select: { stock: true } });
  if (!v) return;
  await tx.stockMovement.create({
    data: { variantId, delta, balance: v.stock, reason, note: opts.note ?? null, actor: opts.actor ?? null },
  });
}

/** Sets or adds stock and logs it in one step. Returns the new stock. */
export async function changeStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  change: { set?: number; add?: number },
  reason: StockReason,
  opts: Opts = {},
) {
  const before = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
  const next = change.set !== undefined ? change.set : Math.max(0, before.stock + (change.add ?? 0));
  await tx.variant.update({ where: { id: variantId }, data: { stock: next } });
  await logMovement(tx, variantId, next - before.stock, reason, opts);
  return next;
}
