import { convert, type Rates } from "./services.ts";
import type { Expense, Trip } from "./types.ts";

export type FinancialParticipant = { id: string; name: string };
export type Balance = { id: string; name: string; paid: number; owes: number; net: number };
export type Transfer = { from: string; fromId: string; to: string; toId: string; amount: number };

export const ownerParticipantId = (ownerId?: string) => `owner:${ownerId || "legacy"}`;
export const memberParticipantId = (memberId: string) => `member:${memberId}`;

export function participantsOf(trip: Trip, owner: FinancialParticipant): FinancialParticipant[] {
  const participants = [
    owner,
    ...(trip.members ?? []).map((member) => ({
      id: memberParticipantId(member.id),
      name: member.name,
    })),
  ];
  return Array.from(
    new Map(participants.filter((item) => item.name).map((item) => [item.id, item])).values(),
  );
}

/** Resolve both stable participant keys and legacy name-based expense values. */
export function resolveParticipantId(value: string, participants: FinancialParticipant[]): string {
  if (participants.some((participant) => participant.id === value)) return value;
  return participants.find((participant) => participant.name === value)?.id ?? value;
}

export function participantName(value: string, participants: FinancialParticipant[]): string {
  const id = resolveParticipantId(value, participants);
  return participants.find((participant) => participant.id === id)?.name ?? value;
}

export function normalizeExpenseParticipants(
  expense: Expense,
  participants: FinancialParticipant[],
): Expense {
  return {
    ...expense,
    paidBy: resolveParticipantId(expense.paidBy, participants),
    ...(expense.splitWith?.length
      ? {
          splitWith: Array.from(
            new Set(expense.splitWith.map((value) => resolveParticipantId(value, participants))),
          ),
        }
      : {}),
  };
}

export function balances(
  trip: Trip,
  participants: FinancialParticipant[],
  base: string,
  rates: Rates,
): Balance[] {
  const ids = participants.map((participant) => participant.id);
  const paid = new Map<string, number>();
  const owes = new Map<string, number>();
  ids.forEach((id) => {
    paid.set(id, 0);
    owes.set(id, 0);
  });

  const shareOf = (expense: Expense) => {
    const involved = expense.splitWith?.length
      ? expense.splitWith
          .map((value) => resolveParticipantId(value, participants))
          .filter((id) => ids.includes(id))
      : ids;
    return involved.length ? Array.from(new Set(involved)) : ids;
  };

  for (const expense of trip.expenses) {
    const amount = convert(expense.amount, expense.currency, base, rates);
    const payerId = resolveParticipantId(expense.paidBy, participants);
    if (ids.includes(payerId)) paid.set(payerId, (paid.get(payerId) ?? 0) + amount);
    const involved = shareOf(expense);
    const each = amount / involved.length;
    involved.forEach((id) => owes.set(id, (owes.get(id) ?? 0) + each));
  }

  return participants.map((participant) => {
    const paidAmount = paid.get(participant.id) ?? 0;
    const owedAmount = owes.get(participant.id) ?? 0;
    return {
      ...participant,
      paid: paidAmount,
      owes: owedAmount,
      net: paidAmount - owedAmount,
    };
  });
}

/** Minimaal aantal overboekingen om iedereen gelijk te zetten. */
export function settle(list: Balance[]): Transfer[] {
  const debtors = list
    .filter((balance) => balance.net < -0.01)
    .map((balance) => ({ id: balance.id, name: balance.name, amount: -balance.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = list
    .filter((balance) => balance.net > 0.01)
    .map((balance) => ({ id: balance.id, name: balance.name, amount: balance.net }))
    .sort((a, b) => b.amount - a.amount);

  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0.01) out.push({ from: debtor.name, fromId: debtor.id, to: creditor.name, toId: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }
  return out;
}
