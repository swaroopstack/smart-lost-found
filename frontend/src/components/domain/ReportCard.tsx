import { Link } from "react-router-dom";
import { MapPin } from "@phosphor-icons/react";
import type { ReportSummary } from "@/api/types";
import { mediaUrl } from "@/api/client";
import { formatRelative } from "@/lib/format";
import { CategoryIcon } from "./CategoryIcon";
import { ReportStatusBadge, TypeBadge } from "./StatusBadges";

export function ReportCard({ report }: { report: ReportSummary }) {
  const photo = mediaUrl(report.photo_url);

  return (
    <Link
      to={`/reports/${report.id}`}
      className="group surface-card flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-sunken">
        {photo ? (
          <img
            src={photo}
            alt={`Photo attached to the report "${report.title}"`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out-quint group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-soft/25">
            <CategoryIcon
              icon={report.category.icon}
              categoryKey={report.category.key}
              size={40}
              className="text-brand/45"
            />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <TypeBadge type={report.type} size="sm" />
          {report.is_mine && (
            <span className="inline-flex items-center rounded-full border border-line bg-surface/95 px-2 py-0.5 text-2xs font-semibold text-ink">
              Yours
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-fg">
          <CategoryIcon
            icon={report.category.icon}
            categoryKey={report.category.key}
            size={13}
            className="text-brand-strong"
          />
          <span className="font-medium text-ink-soft">{report.category.label}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRelative(report.created_at)}</span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink-strong group-hover:text-brand-strong">
          {report.title}
        </h3>

        {report.public_description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-fg">
            {report.public_description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-fg">
            <MapPin size={13} aria-hidden="true" className="shrink-0" />
            <span className="truncate" title={report.location?.path}>
              {report.location?.name ?? "Location not given"}
            </span>
          </span>
          <ReportStatusBadge status={report.status} size="sm" />
        </div>
      </div>
    </Link>
  );
}
