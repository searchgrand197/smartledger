/** Sentinel id for the "create this product" row in sale search. */
export const QUICK_ADD_PRODUCT_ID = -9999;

const QUICK_ADD_LABEL = /^\+ Add "(.*)" as new product$/;

/** Turn a nested "+ Add \"…\" as new product" label back into the typed name. */
export function unwrapQuickAddName(value: string): string {
  let name = (value || "").trim();
  for (let i = 0; i < 8; i += 1) {
    const match = name.match(QUICK_ADD_LABEL);
    if (!match) break;
    name = match[1].trim();
  }
  return name;
}

export function quickAddMenuLabel(name: string): string {
  return `+ Add "${unwrapQuickAddName(name)}" as new product`;
}

/** Selecting the create-product row must not copy its menu label into the search box. */
export function shouldIgnoreProductSearchChange(reason: string): boolean {
  return reason === "reset" || reason === "selectOption";
}
