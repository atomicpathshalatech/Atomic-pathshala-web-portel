import { ATOMIC_OPS_NAV_GROUPS, TeamNavGroup, TeamNavSubItem } from "./team-nav-departments";

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

  let matchedGroup: TeamNavGroup | null = null;
  let matchedItem: TeamNavSubItem | null = null;

  for (const group of ATOMIC_OPS_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === pathname) {
        matchedGroup = group;
        matchedItem = item;
        break;
      }
      if (item.href !== "/team" && item.href !== "/" && pathname.startsWith(`${item.href}/`)) {
        matchedGroup = group;
        matchedItem = item;
        break;
      }
    }
    if (matchedItem) break;
  }

  if (matchedGroup && matchedGroup.id !== "workspace") {
    crumbs.push({ label: matchedGroup.title.charAt(0) + matchedGroup.title.slice(1).toLowerCase() });
  }

  if (matchedItem) {
    const isExact = matchedItem.href === pathname;
    crumbs.push({
      label: matchedItem.label,
      href: isExact ? undefined : matchedItem.href,
      isCurrent: isExact,
    });

    if (!isExact && pathname.startsWith(matchedItem.href)) {
      const remainder = pathname.slice(matchedItem.href.length).replace(/^\//, "");
      if (remainder) {
        const segments = remainder.split("/");
        segments.forEach((seg, i) => {
          const isLast = i === segments.length - 1;
          const formatted =
            seg === "new"
              ? "Create New"
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
