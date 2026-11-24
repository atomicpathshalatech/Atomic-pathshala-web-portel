import { prisma } from "@/lib/prisma";

export interface CalculatePayrollInput {
  payrollMonth: string; // "YYYY-MM" e.g. "2026-11"
  preparedById: string;
  notes?: string;
}

export interface EmployeeSalaryCalculation {
  employeeId: string;
  paymentMode: string;
  basePay: number;
  hra: number;
  allowances: number;
  incentives: number;
  grossPay: number;
  pfDeduction: number;
  esiDeduction: number;
  tdsDeduction: number;
  leaveDeduction: number;
  totalDeductions: number;
  netPayable: number;
  workingDays: number;
  presentDays: number;
  unpaidLeaves: number;
  lecturesDelivered: number;
  hoursDelivered: number;
  bankName: string | null;
  bankAccountNumberMasked: string | null;
  bankIfsc: string | null;
}

/**
 * Calculates monthly or lecture-based salary for an employee according to their active SalaryStructure.
 */
export function calculateEmployeeSalary(
  structure: any,
  employee: any,
  attendanceInput?: {
    workingDays?: number;
    presentDays?: number;
    unpaidLeaves?: number;
    lecturesDelivered?: number;
    hoursDelivered?: number;
    incentives?: number;
  }
): EmployeeSalaryCalculation {
  const workingDays = attendanceInput?.workingDays ?? 30;
  const unpaidLeaves = attendanceInput?.unpaidLeaves ?? 0;
  const presentDays = Math.max(0, workingDays - unpaidLeaves);
  const lectures = attendanceInput?.lecturesDelivered ?? 0;
  const hours = attendanceInput?.hoursDelivered ?? 0;
  const incentives = attendanceInput?.incentives ?? 0;

  const paymentMode = structure?.paymentMode || "MONTHLY_SALARY";
  const baseSalary = Number(structure?.baseSalary || 0);
  const hra = Number(structure?.hra || 0);
  const specialAllowance = Number(structure?.specialAllowance || 0);
  const conveyance = Number(structure?.conveyanceAllowance || 0);
  const medical = Number(structure?.medicalAllowance || 0);
  const perUnitRate = Number(structure?.perUnitRate || 0);

  let basePay = 0;
  let allowances = specialAllowance + conveyance + medical;
  let leaveDeduction = 0;

  if (paymentMode === "MONTHLY_SALARY") {
    basePay = baseSalary;
    // Unpaid leave pro-rata deduction
    if (unpaidLeaves > 0 && workingDays > 0) {
      const perDayRate = (baseSalary + hra + allowances) / workingDays;
      leaveDeduction = Math.round(perDayRate * unpaidLeaves * 100) / 100;
    }
  } else if (paymentMode === "PER_LECTURE") {
    basePay = Math.round(perUnitRate * lectures * 100) / 100;
  } else if (paymentMode === "PER_HOUR") {
    basePay = Math.round(perUnitRate * hours * 100) / 100;
  } else if (paymentMode === "FIXED_CONTRACT") {
    basePay = baseSalary;
  } else {
    basePay = baseSalary;
  }

  const grossPay = Math.max(
    0,
    Math.round((basePay + hra + allowances + incentives - leaveDeduction) * 100) / 100
  );

  // Statutory Deductions (Configurable via SalaryStructure)
  const pfDeduction = structure?.pfApplicable
    ? Number(structure?.pfEmployeeContribution || 0)
    : 0;

  const esiDeduction = structure?.esiApplicable
    ? Number(structure?.esiEmployeeContribution || 0)
    : 0;

  const tdsPercentage = Number(structure?.tdsPercentage || 0);
  const tdsDeduction =
    tdsPercentage > 0
      ? Math.round((grossPay * (tdsPercentage / 100)) * 100) / 100
      : 0;

  const totalDeductions = Math.round(
    (pfDeduction + esiDeduction + tdsDeduction) * 100
  ) / 100;

  const netPayable = Math.max(0, Math.round((grossPay - totalDeductions) * 100) / 100);

  return {
    employeeId: employee.id,
    paymentMode,
    basePay,
    hra,
    allowances,
    incentives,
    grossPay,
    pfDeduction,
    esiDeduction,
    tdsDeduction,
    leaveDeduction,
    totalDeductions,
    netPayable,
    workingDays,
    presentDays,
    unpaidLeaves,
    lecturesDelivered: lectures,
    hoursDelivered: hours,
    bankName: employee.bankName || null,
    bankAccountNumberMasked: employee.bankAccountNumberMasked || null,
    bankIfsc: employee.bankIfsc || null,
  };
}

/**
 * Creates or re-calculates a monthly payroll run for all active employees.
 * Guarantees duplicate run prevention via unique index and checks.
 */
export async function createOrCalculatePayrollRun(input: CalculatePayrollInput) {
  const { payrollMonth, preparedById, notes } = input;

  // Validate format YYYY-MM
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollMonth)) {
    throw new Error("Invalid payroll month format. Must be YYYY-MM (e.g. 2026-11)");
  }

  // Check if an existing run is already PAID or APPROVED
  const existingRun = await prisma.payrollRun.findUnique({
    where: { payrollMonth },
    include: { items: true },
  });

  if (existingRun && (existingRun.status === "PAID" || existingRun.status === "APPROVED")) {
    throw new Error(`Payroll for ${payrollMonth} is already ${existingRun.status} and cannot be modified.`);
  }

  // Fetch all active employees with their active salary structures
  const activeEmployees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: {
      salaryStructures: {
        where: { isActive: true },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  if (activeEmployees.length === 0) {
    throw new Error("No active employees found to run payroll.");
  }

  // Delete existing draft items if re-calculating
  if (existingRun) {
    await prisma.payrollItem.deleteMany({
      where: { payrollRunId: existingRun.id },
    });
  }

  const itemsToCreate = [];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  const cleanMonth = payrollMonth.replace("-", ""); // e.g. "202611"

  for (let i = 0; i < activeEmployees.length; i++) {
    const emp = activeEmployees[i];
    const structure = emp.salaryStructures[0] || null;

    const calc = calculateEmployeeSalary(structure, emp);
    totalGross += calc.grossPay;
    totalDeductions += calc.totalDeductions;
    totalNet += calc.netPayable;

    const payslipNumber = `PS-${cleanMonth}-${String(i + 1).padStart(4, "0")}`;

    itemsToCreate.push({
      employeeId: emp.id,
      payslipNumber,
      paymentMode: calc.paymentMode,
      workingDays: calc.workingDays,
      presentDays: calc.presentDays,
      unpaidLeaves: calc.unpaidLeaves,
      lecturesDelivered: calc.lecturesDelivered,
      hoursDelivered: calc.hoursDelivered,
      basePay: calc.basePay,
      hra: calc.hra,
      allowances: calc.allowances,
      incentives: calc.incentives,
      grossPay: calc.grossPay,
      pfDeduction: calc.pfDeduction,
      esiDeduction: calc.esiDeduction,
      tdsDeduction: calc.tdsDeduction,
      leaveDeduction: calc.leaveDeduction,
      totalDeductions: calc.totalDeductions,
      netPayable: calc.netPayable,
      bankName: calc.bankName,
      bankAccountNumberMasked: calc.bankAccountNumberMasked,
      bankIfsc: calc.bankIfsc,
      payoutStatus: "PENDING",
    });
  }

  let payrollRun;
  if (existingRun) {
    payrollRun = await prisma.payrollRun.update({
      where: { id: existingRun.id },
      data: {
        status: "CALCULATED",
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalEmployees: itemsToCreate.length,
        preparedById,
        preparedAt: new Date(),
        notes,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: {
          include: {
            employee: {
              select: {
                employeeId: true,
                name: true,
                designation: true,
                department: true,
              },
            },
          },
        },
      },
    });
  } else {
    payrollRun = await prisma.payrollRun.create({
      data: {
        payrollMonth,
        title: `Payroll ${payrollMonth}`,
        status: "CALCULATED",
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalEmployees: itemsToCreate.length,
        preparedById,
        preparedAt: new Date(),
        notes,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: {
          include: {
            employee: {
              select: {
                employeeId: true,
                name: true,
                designation: true,
                department: true,
              },
            },
          },
        },
      },
    });
  }

  return payrollRun;
}
