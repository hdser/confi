export interface InvoiceData {
  metadata: {
    invoiceNumber: string;
    issueDate?: number;
    dueDate: number;
    status?: string;
    paymentTerms: string;
    currency: string;
  };
  parties: {
    issuer: {
      address: string;
      businessName?: string;
      taxId?: string;
      email?: string;
    };
    client: {
      address: string;
      businessName?: string;
      email?: string;
    };
  };
  lineItems: LineItem[];
  calculations?: {
    subtotal: string;
    totalDiscount: string;
    totalTax: string;
    grandTotal: string;
  };
  payment: {
    tokenContract: string;
    chainId: number;
  };
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: string;
  taxRate: number;
  discount?: number;
  subtotal?: string;
}

export interface PayrollBatch {
  metadata: {
    batchId?: string;
    payPeriodStart: number;
    payPeriodEnd: number;
    payDate: number;
    status?: string;
    frequency: string;
  };
  employees: Employee[];
  summary?: {
    totalEmployees: number;
    totalGrossPay: string;
    totalDeductions: string;
    totalNetPay: string;
  };
}

export interface Employee {
  id: string;
  walletAddress: string;
  personalInfo?: {
    name?: string;
    employeeId?: string;
    department?: string;
    position?: string;
  };
  compensation: {
    hoursWorked?: number;
    hourlyRate?: string;
    baseSalary?: string;
    earnings?: {
      regular: string;
      overtime?: string;
      bonus?: string;
    };
    deductions?: {
      tax?: TaxDeductions;
      benefits?: BenefitDeductions;
    };
    netPay: string;
  };
  paymentInfo: {
    method: string;
    tokenContract: string;
    chainId: number;
  };
}

export interface TaxDeductions {
  federal: string;
  state: string;
  fica: string;
}

export interface BenefitDeductions {
  healthInsurance?: string;
  retirement401k?: string;
  [key: string]: string | undefined;
}

export interface Voucher {
  data: VoucherData;
  signature: string;
  signerAddress: string;
}

export interface VoucherData {
  type: string;
  recipientAddress: string;
  tokenContract: string;
  amount: string;
  taskId: string;
  timestamp: number;
  nonce: string;
}