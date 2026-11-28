import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { COMMON_UI_TEXT } from "@/shared/i18n/catalog/common";

interface ComingSoonProps {
  title: string;
  description: string;
  features: string[];
  note?: ReactNode;
}

export default function ComingSoon({ title, description, features, note }: ComingSoonProps) {
  return (
    <div className="space-y-4">
      <div className="card px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-foreground-950">{title}</h2>
          <Badge className="border-amber-200 bg-amber-50 text-amber-700">
            <i className="ri-time-line" /> {COMMON_UI_TEXT.comingSoonBadge}
          </Badge>
        </div>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-6 text-foreground-600">{description}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-3 py-2.5"
            >
              <i className="ri-checkbox-blank-circle-line mt-0.5 text-[12px] text-foreground-400" />
              <span className="text-[11.5px] leading-5 text-foreground-600">{feature}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-background-200 bg-background-50 px-3.5 py-2.5 text-[11px] leading-5 text-foreground-500">
          {COMMON_UI_TEXT.comingSoonNotice}
        </p>
        {note}
      </div>
    </div>
  );
}