import React from "react";
import type { LucideIcon } from "lucide-react";
import PageHeader from "./PageHeader";

interface PublicPageFrameProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  backTo?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export default function PublicPageFrame({
  icon: Icon,
  title,
  subtitle,
  backTo = "/",
  children,
  maxWidthClass = "max-w-6xl",
}: PublicPageFrameProps) {
  return (
    <div className="text-white">
      <PageHeader
        icon={<Icon className="h-5 w-5 text-orange-400" />}
        title={title}
        subtitle={subtitle}
        backTo={backTo}
      />
      <main className={`mx-auto w-full ${maxWidthClass} px-4 py-12 sm:px-6 lg:px-8 lg:py-14`}>
        {children}
      </main>
    </div>
  );
}