import type { Expense, Trip } from "./types.ts";
import { linkFuelExpense } from "./fuel-costs.ts";

/** Keep receipt references and unknown stored fields when changing financial details. */
export function saveExpenseDraft(trip: Trip, draft: Omit<Expense, "id">, id: string,
  editing: boolean, canMarkBillable: boolean, fuelTravelItemId?: string): Trip {
  const existing = trip.expenses.find(expense => expense.id === id);
  if (editing && !existing) throw new Error("Deze uitgave bestaat niet meer. Herlaad de reis.");
  const expense: Expense = { ...existing, ...draft, title: draft.title.trim(), id,
    billable: canMarkBillable ? draft.billable : (existing?.billable ?? false) };
  return { ...trip,
    expenses: editing ? trip.expenses.map(current => current.id === id ? expense : current) : [...trip.expenses, expense],
    travelItems: linkFuelExpense((trip.travelItems ?? []).map(item => editing && item.expenseId === id
      ? { ...item, title: expense.title, date: expense.date, amount: expense.amount, currency: expense.currency }
      : item), id, fuelTravelItemId),
  };
}
