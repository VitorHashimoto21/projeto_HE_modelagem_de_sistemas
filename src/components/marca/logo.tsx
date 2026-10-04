import Image from "next/image";

/** Logo oficial (IDENTIDADE_VISUAL.md). `negativo`: para fundos escuros da marca. */
export function Logo({ negativo = false, className = "h-10 w-auto" }: { negativo?: boolean; className?: string }) {
  if (negativo) {
    return <Image src="/marca/he-logo-horizontal-negativo.svg" alt="Health Enterprise" width={220} height={48} priority className={className} />;
  }
  return (
    <>
      <Image src="/marca/he-logo-horizontal.svg" alt="Health Enterprise" width={220} height={48} priority className={`${className} dark:hidden`} />
      <Image src="/marca/he-logo-horizontal-negativo.svg" alt="Health Enterprise" width={220} height={48} priority className={`${className} hidden dark:block`} />
    </>
  );
}
