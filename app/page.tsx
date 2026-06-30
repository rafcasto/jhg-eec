import { cookies } from "next/headers";
import { readConfig } from "@/lib/abConfig";
import { resolveVariant } from "@/lib/abAssign";
import LandingPage from "./components/LandingPage";
import StickVariant from "./components/StickVariant";

export const dynamic = "force-dynamic"; // variant is decided per request

const VARIANT_COOKIE = "jhg_eec_variant";

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const config = await readConfig();
  const cookieStore = cookies();
  const existing = cookieStore.get(VARIANT_COOKIE)?.value;

  // Allow forcing a variant for previews: ?variant=A or ?variant=B
  const forced =
    searchParams.variant === "A" || searchParams.variant === "B"
      ? (searchParams.variant as "A" | "B")
      : undefined;

  const { key } = forced
    ? { key: forced }
    : resolveVariant(config, existing);

  const variant = config.variants[key];
  const showBadge = searchParams.debug === "1";

  return (
    <>
      {!forced && <StickVariant variant={key} />}
      <LandingPage variant={variant} showBadge={showBadge} />
    </>
  );
}
