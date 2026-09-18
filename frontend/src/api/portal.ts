import axios from "axios";

const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

portalClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("customer_portal_token");
  if (token) config.headers["X-Customer-Token"] = token;
  return config;
});

export const portalApi = {
  login: (username: string, password: string) =>
    portalClient.post("/customers/portal/login/", { username, password }),
  dashboard: () => portalClient.get("/customers/portal/dashboard/"),
  customers: (params?: { search?: string }) =>
    portalClient.get("/customers/portal/customers/", { params }),
  createCustomer: (data: object) =>
    portalClient.post("/customers/portal/customers/", data),
  customerDetail: (id: number) =>
    portalClient.get(`/customers/portal/customers/${id}/`),
  updateCustomer: (id: number, data: object) =>
    portalClient.patch(`/customers/portal/customers/${id}/`, data),
  deleteCustomer: (id: number) =>
    portalClient.delete(`/customers/portal/customers/${id}/`),
  customerProfile: (id: number) =>
    portalClient.get(`/customers/portal/customers/${id}/profile/`),
  createCustomerPayment: (data: object) =>
    portalClient.post(`/customers/portal/customers/payments/`, data),
  updateCustomerPayment: (id: number, data: object) =>
    portalClient.patch(`/customers/portal/customers/payments/${id}/`, data),
  deleteCustomerPayment: (id: number) =>
    portalClient.delete(`/customers/portal/customers/payments/${id}/`),
  customerLedgerPdf: (id: number) =>
    portalClient.get(`/customers/portal/customers/${id}/ledger/pdf/`, {
      responseType: "blob",
      headers: { Accept: "application/pdf" },
    }),
  products: (params?: { search?: string; all?: boolean }) =>
    portalClient.get("/customers/portal/products/", { params }),
  createProduct: (data: FormData) =>
    portalClient.post("/customers/portal/products/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateProduct: (id: number, data: FormData) =>
    portalClient.patch(`/customers/portal/products/${id}/`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  categories: () => portalClient.get("/customers/portal/products/categories/"),
  createCategory: (name: string) =>
    portalClient.post("/customers/portal/products/categories/", { name }),
  deleteProduct: (id: number) =>
    portalClient.delete(`/customers/portal/products/${id}/`),
  quickSaleHistory: (search?: string) =>
    portalClient.get("/customers/portal/quick-sales/", {
      params: search ? { search } : {},
    }),
  createSimpleBill: (data: object) =>
    portalClient.post("/customers/portal/billing/simple/create/", data),
  getSimpleBill: (id: number) =>
    portalClient.get(`/customers/portal/billing/${id}/update/`),
  updateSimpleBill: (id: number, data: object) =>
    portalClient.put(`/customers/portal/billing/${id}/update/`, data),
  billPdf: (id: number) =>
    portalClient.get(`/customers/portal/billing/${id}/pdf/`, {
      responseType: "blob",
      headers: { Accept: "application/pdf" },
    }),
  billPrintData: (id: number) => portalClient.get(`/customers/portal/billing/${id}/print-data/`),
  cancelBill: (id: number) => portalClient.post(`/customers/portal/billing/${id}/cancel/`),
  billReturnEligibility: (billId: number) =>
    portalClient.get(`/customers/portal/billing/${billId}/return-eligibility/`),
  createReturn: (data: object) =>
    portalClient.post("/customers/portal/returns/create/", data),
  returnPrintData: (id: number) =>
    portalClient.get(`/customers/portal/returns/${id}/print-data/`),
  getReturn: (id: number) =>
    portalClient.get(`/customers/portal/returns/${id}/`),
  quickSaleReturns: (params?: { search?: string; page?: number; page_size?: number }) =>
    portalClient.get("/customers/portal/returns/", { params }),
  returnWhatsApp: (id: number) =>
    portalClient.post(`/customers/portal/returns/${id}/whatsapp/`),
  whatsappStatus: () => portalClient.get("/customers/portal/whatsapp/status/"),
  ledgerPdf: () =>
    portalClient.get("/customers/portal/ledger/pdf/", {
      responseType: "blob",
      headers: { Accept: "application/pdf" },
    }),
  sendReminder: (id: number) =>
    portalClient.post(`/customers/portal/customers/${id}/reminder/`),
};
