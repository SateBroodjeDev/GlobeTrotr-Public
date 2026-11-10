import { convert, type Rates } from "./services.ts";
import type { Expense, TransportMode, TravelItem } from "./types.ts";

const OWN_FUEL_MODES = new Set(["car", "motorcycle", "camper"]);

export function transportModeUsesOwnFuel(mode?: TransportMode) {
  return Boolean(mode && OWN_FUEL_MODES.has(mode));
}

export function transportUsesOwnFuel(travelItem: TravelItem) {
  const mode = travelItem.details?.transportMode;
  if (mode) return transportModeUsesOwnFuel(mode);
  return (
    Number(travelItem.details?.consumptionPer100Km ?? 0) > 0 ||
    Number(travelItem.details?.fuelPricePerLiter ?? 0) > 0
  );
}

export function fuelEstimateFor(travelItem: TravelItem) {
  if (!transportUsesOwnFuel(travelItem)) return 0;
  const details = travelItem.details;
  return (
    (Number(details?.distanceKm ?? 0) *
      Number(details?.consumptionPer100Km ?? 0) *
      Number(details?.fuelPricePerLiter ?? 0)) /
    100
  );
}

export function hasActualFuelExpenses(travelItem: TravelItem, expenses: Expense[]) {
  const existingExpenseIds = new Set(expenses.map((expense) => expense.id));
  return Boolean(
    travelItem.details?.fuelActualExpenseIds?.some((expenseId) =>
      existingExpenseIds.has(expenseId),
    ),
  );
}

export function remainingFuelEstimate(
  travelItems: TravelItem[],
  expenses: Expense[],
  baseCurrency: string,
  rates: Rates,
) {
  return travelItems
    .filter(
      (travelItem) =>
        travelItem.type === "transport" && !hasActualFuelExpenses(travelItem, expenses),
    )
    .reduce(
      (total, travelItem) =>
        total +
        convert(
          fuelEstimateFor(travelItem),
          travelItem.details?.fuelCurrency ?? travelItem.currency ?? baseCurrency,
          baseCurrency,
          rates,
        ),
      0,
    );
}

export function fuelTravelItemIdForExpense(travelItems: TravelItem[], expenseId: string) {
  return travelItems.find((travelItem) =>
    travelItem.details?.fuelActualExpenseIds?.includes(expenseId),
  )?.id;
}

export function linkFuelExpense(
  travelItems: TravelItem[],
  expenseId: string,
  selectedTravelItemId?: string,
) {
  return travelItems.map((travelItem) => {
    const currentIds = travelItem.details?.fuelActualExpenseIds ?? [];
    const nextIds = currentIds.filter((id) => id !== expenseId);
    if (travelItem.id === selectedTravelItemId) nextIds.push(expenseId);

    if (
      nextIds.length === currentIds.length &&
      nextIds.every((id, index) => id === currentIds[index])
    ) {
      return travelItem;
    }

    const details = { ...travelItem.details };
    if (nextIds.length) details.fuelActualExpenseIds = nextIds;
    else delete details.fuelActualExpenseIds;
    return { ...travelItem, details };
  });
}
