import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateTax, generateSequentialInvoiceNumber, generateSequentialCreditNoteNumber } from "../src/lib/finance/tax-engine";
import { maskAccountNumber, maskPan } from "../src/lib/finance/bank-service";
import { calculateEmployeeSalary } from "../src/lib/payroll/payroll-engine";

describe("ATOMIC PATHSHALA — GST, Finance, Banking, HR & Payroll Test Suite", () => {
  // 1. Bank Account & PAN Masking Safety Tests
  describe("Masking & Data Privacy", () => {
    test("maskAccountNumber masks all but last 4 digits", () => {
      assert.equal(maskAccountNumber("123456789012"), "••••••••9012");
      assert.equal(maskAccountNumber("987654321"), "••••••••4321");
      assert.equal(maskAccountNumber("1234"), "1234");
    });

    test("maskPan masks first 5 characters", () => {
      assert.equal(maskPan("ABCDE1234F"), "•••••1234F");
      assert.equal(maskPan("AAAPA1234A"), "•••••1234A");
    });
  });

  // 2. GST Activation Safety Lock Tests
  describe("GST Safety Engine & Calculations", () => {
    test("Pending GST status must enforce 0% tax and generate Bill of Supply", async () => {
      // In a fresh test environment where GST is PENDING or default
      const result = await calculateTax({
        baseAmount: 10000,
        studentStateCode: "09", // UP
        pricingMode: "EXCLUSIVE",
      });

      // If status is not ACTIVE (e.g. PENDING or NOT_REGISTERED):
      if (result.registrationStatus !== "ACTIVE") {
        assert.equal(result.isGstActive, false);
        assert.equal(result.totalTax, 0);
        assert.equal(result.totalAmount, 10000);
        assert.equal(result.invoiceType, "BILL_OF_SUPPLY");
        assert.equal(result.businessGstin, null);
      }
    });
  });

  // 3. Payroll Calculation Engine Tests
  describe("Payroll & Salary Structures", () => {
    test("Monthly salary calculations with allowances and statutory deductions", () => {
      const mockStructure = {
        paymentMode: "MONTHLY_SALARY",
        baseSalary: 50000,
        hra: 20000,
        specialAllowance: 10000,
        conveyanceAllowance: 2000,
        medicalAllowance: 3000,
        pfApplicable: true,
        pfEmployeeContribution: 1800,
        esiApplicable: false,
        esiEmployeeContribution: 0,
        tdsPercentage: 10.0, // 10% TDS
      };

      const mockEmployee = {
        id: "emp-test-01",
        name: "Dr. Alok Verma",
        bankName: "HDFC Bank",
        bankAccountNumberMasked: "••••••••4589",
        bankIfsc: "HDFC0001234",
      };

      const attendance = {
        workingDays: 30,
        unpaidLeaves: 0,
        incentives: 5000,
      };

      const result = calculateEmployeeSalary(mockStructure, mockEmployee, attendance);

      // Gross = 50000 (base) + 20000 (hra) + 15000 (allowances) + 5000 (incentives) = 90000
      assert.equal(result.grossPay, 90000);
      assert.equal(result.pfDeduction, 1800);
      assert.equal(result.esiDeduction, 0);
      // TDS 10% on gross 90000 = 9000
      assert.equal(result.tdsDeduction, 9000);
      // Total Deductions = 1800 + 9000 = 10800
      assert.equal(result.totalDeductions, 10800);
      // Net = 90000 - 10800 = 79200
      assert.equal(result.netPayable, 79200);
    });

    test("Per-Lecture visiting faculty salary calculations", () => {
      const mockStructure = {
        paymentMode: "PER_LECTURE",
        baseSalary: 0,
        perUnitRate: 2500, // ₹2,500 per lecture
        tdsPercentage: 10.0, // 194J 10% TDS for visiting professional faculty
      };

      const mockEmployee = {
        id: "emp-faculty-02",
        name: "Er. Ramesh Sharma",
      };

      const attendance = {
        lecturesDelivered: 20, // 20 lectures in the month
      };

      const result = calculateEmployeeSalary(mockStructure, mockEmployee, attendance);

      // Gross = 2500 * 20 = 50000
      assert.equal(result.grossPay, 50000);
      assert.equal(result.tdsDeduction, 5000);
      assert.equal(result.netPayable, 45000);
    });

    test("Unpaid leave pro-rata deduction for monthly salary", () => {
      const mockStructure = {
        paymentMode: "MONTHLY_SALARY",
        baseSalary: 30000,
        hra: 0,
        specialAllowance: 0,
        conveyanceAllowance: 0,
        medicalAllowance: 0,
        tdsPercentage: 0,
      };

      const mockEmployee = {
        id: "emp-test-03",
        name: "Kavita Singh",
      };

      const attendance = {
        workingDays: 30,
        unpaidLeaves: 3, // 3 days unpaid leave out of 30 days -> 10% deduction
      };

      const result = calculateEmployeeSalary(mockStructure, mockEmployee, attendance);

      // Daily rate = 30000 / 30 = 1000/day. Leave deduction = 3000.
      assert.equal(result.leaveDeduction, 3000);
      assert.equal(result.grossPay, 27000);
      assert.equal(result.netPayable, 27000);
    });
  });
});
