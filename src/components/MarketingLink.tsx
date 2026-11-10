import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useLocale } from "@/lib/locale";
import { localizedMarketingPath } from "@/lib/marketing-locale";

/** Existing router navigation, with language-specific public destinations. */
export function MarketingLink({ to, ...props }: ComponentProps<typeof Link>) {
  const { locale } = useLocale();
  const target = typeof to === "string" ? localizedMarketingPath(to, locale) : to;
  return <Link {...props} to={target as typeof to} />;
}
