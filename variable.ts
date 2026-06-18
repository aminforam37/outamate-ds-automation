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