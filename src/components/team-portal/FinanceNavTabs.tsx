"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface FinanceTab {
  href: string;
  label: string;
  icon: string;
}

const TABS: FinanceTab[] = [
  { href: "/team/finance/overview", label: "Finance Overview", icon: "account_balance" },
  { href: "/team/commerce/orders", label: "Orders & Payments (GST)", icon: "receipt_long" },
  { href: "/team/finance/expenses", label: "Expenses", icon: "receipt" },
  { href: "/team/finance/settings", label: "GST & Bank Settings", icon: "tune" },
  { href: "/team/hr/payroll", label: "Payroll & Salaries", icon: "payments" },
  { href: "/team/finance", label: "Subscriptions", icon: "workspace_premium" },
];

export function FinanceNavTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-outline-variant/20 bg-surface-container-lowest/50 backdrop-blur-sm -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 pt-2 mb-6">
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40"
              }`}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
