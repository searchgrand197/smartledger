import type { Bill } from "@/types";
import { api } from "./client";
import { fetchAllPages } from "./pagination";


export const authApi = {
  login: (username: string, password: string) =>
    api.post("/auth/login/", { username, password }),
  me: () => api.get("/auth/me/"),
  portalToken: () => api.post("/auth/portal-token/"),
};

export const dashboardApi = {
  get: () => api.get("/dashboard/"),
};

export const customersApi = {
  list: (params?: Record<string, string>) => api.get("/customers/", { params }),
  listAll: (params?: Record<string, string>) => fetchAllPages("/customers/", params),
  get: (id: number) => api.get(`/customers/${id}/`),
  create: (data: object) => api.post("/customers/", data),
  update: (id: number, data: object) => api.patch(`/customers/${id}/`, data),
  delete: (id: number) => api.delete(`/customers/${id}/`),
  profile: (id: number) => api.get(`/customers/${id}/profile/`),
  ledgerPdf: (id: number) =>
    api.get(`/customers/${id}/ledger/pdf/`, { responseType: "blob", headers: { Accept: "application/pdf" } }),
  partyRates: (id: number) => api.get(`/customers/${id}/rates/`),
  setPartyRate: (id: number, data: { product: number; rate: number }) =>
    api.post(`/customers/${id}/rates/`, data),
  export: () => api.get("/customers/export/", { responseType: "blob" }),
};

export const suppliersApi = {
  list: () => api.get("/suppliers/"),
  get: (id: number) => api.get(`/suppliers/${id}/`),
  create: (data: object) => api.post("/suppliers/", data),
  update: (id: number, data: object) => api.patch(`/suppliers/${id}/`, data),
  profile: (id: number) => api.get(`/suppliers/${id}/profile/`),
};

export const productsApi = {
  list: (params?: Record<string, string>) => api.get("/products/", { params }),
  listAll: (params?: Record<string, string>) => fetchAllPages("/products/", params),
  get: (id: number) => api.get(`/products/${id}/`),
  create: (data: object) => api.post("/products/", data),
  update: (id: number, data: object) => api.patch(`/products/${id}/`, data),
  purchaseHistory: (id: number) => api.get(`/products/${id}/purchase-history/`),
  stockMovements: (params?: Record<string, string>) =>
    api.get("/products/stock-movements/", { params }),
  productStockMovements: (id: number, params?: Record<string, string>) =>
    api.get(`/products/${id}/stock-movements/`, { params }),
  stockAdjust: (id: number, data: { quantity_delta: number; notes?: string }) =>
    api.post(`/products/${id}/stock-adjust/`, data),
  categories: () => api.get("/products/categories/"),
  createCategory: (name: string) => api.post("/products/categories/", { name }),
  delete: (id: number) => api.delete(`/products/${id}/`),
};

export const purchasesApi = {
  list: () => api.get("/purchases/"),
  create: (data: object) => api.post("/purchases/", data),
  payments: () => api.get("/purchases/payments/"),
  createPayment: (data: object) => api.post("/purchases/payments/", data),
};

export const billingApi = {
  list: (params?: Record<string, string>) => api.get("/billing/", { params }),
  listAll: (params?: Record<string, string>) => fetchAllPages<Bill>("/billing/", params),

  create: (data: object) => api.post("/billing/create/", data),
  get: (id: number) => api.get(`/billing/${id}/`),
  update: (id: number, data: object) => api.put(`/billing/${id}/update/`, data),
  cancel: (id: number) => api.post(`/billing/${id}/cancel/`),
  context: (customerId: number, productId?: number) =>
    api.get("/billing/context/", { params: { customer_id: customerId, product_id: productId } }),
  rateHint: (customerId: number, productId: number) =>
    api.get("/billing/rate-hint/", { params: { customer_id: customerId, product_id: productId } }),
  pdf: (id: number) =>
    api.get(`/billing/${id}/pdf/`, { responseType: "blob", headers: { Accept: "application/pdf" } }),
  printData: (id: number) => api.get(`/billing/${id}/print-data/`),
  whatsappStatus: () => api.get("/billing/whatsapp/status/"),
  whatsappDisconnect: () => api.post("/billing/whatsapp/disconnect/"),
  whatsappRestart: () => api.post("/billing/whatsapp/restart/"),
};

export const paymentsApi = {
  list: (params?: Record<string, string>) => api.get("/payments/", { params }),
  get: (id: number) => api.get(`/payments/${id}/`),
  printData: (id: number) => api.get(`/payments/${id}/print-data/`),
  create: (data: object) => api.post("/payments/", data),
  update: (id: number, data: object) => api.patch(`/payments/${id}/`, data),
  delete: (id: number) => api.delete(`/payments/${id}/`),
  dues: () => api.get("/payments/dues/"),
  reminder: (customerId: number) => api.post(`/payments/reminder/${customerId}/`),
};

export const ledgerApi = {
  get: (customerId: number, params?: Record<string, string>) =>
    api.get(`/ledger/customer/${customerId}/`, { params }),
  pdf: (customerId: number) => api.get(`/ledger/customer/${customerId}/pdf/`, { responseType: "blob" }),
  whatsapp: (customerId: number) => api.get(`/ledger/customer/${customerId}/whatsapp/`),
};

export const reportsApi = {
  dailySales: (date?: string) => api.get("/reports/daily-sales/", { params: { date } }),
  customerDues: () => api.get("/reports/customer-dues/"),
  profit: (params?: Record<string, string>) => api.get("/reports/profit/", { params }),
  stock: () => api.get("/reports/stock/"),
  collections: () => api.get("/reports/collections/"),
  purchases: () => api.get("/reports/purchases/"),
  salesReturns: (params?: Record<string, string>) => api.get("/reports/sales-returns/", { params }),
  returnsByProduct: (params?: Record<string, string>) => api.get("/reports/returns-by-product/", { params }),
  returnsByCustomer: (params?: Record<string, string>) => api.get("/reports/returns-by-customer/", { params }),
  returnsByParty: (params?: Record<string, string>) => api.get("/reports/returns-by-party/", { params }),
  refunds: (params?: Record<string, string>) => api.get("/reports/refunds/", { params }),
  creditNotes: (params?: Record<string, string>) => api.get("/reports/credit-notes/", { params }),
};

export const returnsApi = {
  list: (params?: Record<string, string>) => api.get("/returns/", { params }),
  listAll: (params?: Record<string, string>) => fetchAllPages("/returns/", params),
  get: (id: number) => api.get(`/returns/${id}/`),
  create: (data: object) => api.post("/returns/create/", data),
  cancel: (id: number) => api.post(`/returns/${id}/cancel/`),
  eligibility: (billId: number) => api.get(`/returns/bill/${billId}/eligibility/`),
  printData: (id: number) => api.get(`/returns/${id}/print-data/`),
  whatsapp: (id: number) => api.post(`/returns/${id}/whatsapp/`),
};

export const businessApi = {
  settings: () => api.get("/business/settings/"),
  updateSettings: (data: FormData | object) => api.patch("/business/settings/", data),
  dismissSetup: () => api.post("/business/settings/dismiss-setup/"),
};
