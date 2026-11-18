import { ATOMIC_OPS_DEPARTMENTS, TeamNavDepartment, TeamNavSubItem } from "./team-nav-departments";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export function getBreadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: "Atomic OPS", href: "/team" }];

  if (pathname === "/team") {
    return [{ label: "Atomic OPS", isCurrent: true }];
  }

  // Find department & item
  let matchedDept: TeamNavDepartment | null = null;
  let matchedItem: TeamNavSubItem | null = null;

  for (const dept of ATOMIC_OPS_DEPARTMENTS) {
    for (const item of dept.items) {
      if (item.href === pathname) {
        matchedDept = dept;
        matchedItem = item;
        break;
      }
      if (item.href !== "/team" && item.href !== "/" && pathname.startsWith(`${item.href}/`)) {
        matchedDept = dept;
        matchedItem = item;
        break;
      }
    }
    if (matchedItem) break;
  }

  if (matchedDept && matchedDept.id !== "overview") {
    crumbs.push({ label: matchedDept.title });
  }

  if (matchedItem) {
    const isExact = matchedItem.href === pathname;
    crumbs.push({
      label: matchedItem.label,
      href: isExact ? undefined : matchedItem.href,
      isCurrent: isExact,
    });

    // Check if there is a sub-path like /new, /[id], /reports, etc.
    if (!isExact && pathname.startsWith(matchedItem.href)) {
      const remainder = pathname.slice(matchedItem.href.length).replace(/^\//, "");
      if (remainder) {
        const segments = remainder.split("/");
        segments.forEach((seg, i) => {
          const isLast = i === segments.length - 1;
          const formatted =
            seg === "new"
              ? "Create New"
              : seg === "redesign"
              ? "Redesign Studio"
              : seg === "atomic"
              ? "Atomic Bank"
              : seg === "reports"
              ? "Reports"
              : seg.length > 20
              ? `${seg.slice(0, 10)}...`
              : seg.replace(/-/g, " ");

          crumbs.push({
            label: formatted.charAt(0).toUpperCase() + formatted.slice(1),
            isCurrent: isLast,
          });
        });
      }
    }
  } else {
    // Fallback: split pathname
    const segments = pathname.replace(/^\/team\/?/, "").split("/").filter(Boolean);
    segments.forEach((seg, i) => {
      const isLast = i === segments.length - 1;
      crumbs.push({
        label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
        isCurrent: isLast,
      });
    });
  }

  return crumbs;
}
