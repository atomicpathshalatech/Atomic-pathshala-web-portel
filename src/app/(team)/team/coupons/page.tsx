import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { CouponManager } from "@/components/team-portal/CouponManager";

export const metadata: Metadata = {
  title: "Coupons",
};

export default async function CouponsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.COUPON_READ);
  if (!canRead) redirect("/team");

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Coupon Management</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {coupons.length} coupon{coupons.length === 1 ? "" : "s"} created.
        </p>
      </div>

      <CouponManager
        initialCoupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          plan: c.plan,
          maxRedemptions: c.maxRedemptions,
          redeemedCount: c.redeemedCount,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
