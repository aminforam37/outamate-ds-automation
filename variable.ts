export let customerOrder: string | null = null;

export const setCustomerOrder = (order: string): void => {
  customerOrder = order;
};

export const getCustomerOrder = (): string => {
  if (customerOrder === null) {
    throw new Error(
      'Customer Order is not set. Make sure setCustomerOrder() is called first.'
    );
  }
  console.log('Customer Order:', customerOrder);
  return customerOrder;
};

/**
 * The internal numeric order id (8 digits, as it appears in /orders/<id>/ URLs).
 * This is NOT the same value as customerOrder, which is the 6-digit customer
 * number shown in the grids. The invoice form's Order IDs field works on this
 * numeric id, so it has to be carried separately.
 */
export let researchOrderId: string | null = null;

/** The abstractor the order was assigned to — the invoice form only offers orders
 *  belonging to the selected abstractor, so the invoice spec must pick the same one. */
export let researchAbstractor: string | null = null;

export const setResearchOrder = (orderId: string, abstractor: string): void => {
  researchOrderId = orderId;
  researchAbstractor = abstractor;
};

/** Returns null rather than throwing, so a spec can fall back to any available
 *  order/abstractor when run on its own instead of failing outright. */
export const getResearchOrderId = (): string | null => researchOrderId;
export const getResearchAbstractor = (): string | null => researchAbstractor;