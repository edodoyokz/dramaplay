export const BOOTSTRAP_PROVIDERS = ["wetv", "moviebox"] as const;
export type BootstrapProvider = (typeof BOOTSTRAP_PROVIDERS)[number];

export function parseBootstrapArgs(args: string[]) {
  const passIndex = args.indexOf("--passes");
  const delayIndex = args.indexOf("--delay-ms");
  const providers = args.filter(
    (arg, index) =>
      !arg.startsWith("--") &&
      (passIndex < 0 || index !== passIndex + 1) &&
      (delayIndex < 0 || index !== delayIndex + 1),
  );
  const selected = providers.length ? providers : [...BOOTSTRAP_PROVIDERS];
  if (selected.some((code) => !BOOTSTRAP_PROVIDERS.includes(code as BootstrapProvider))) {
    throw new Error("bootstrap only supports wetv and moviebox");
  }
  const integer = (value: string | undefined, fallback: number, allowZero = false) => {
    const n = Number(value);
    return Number.isInteger(n) && (allowZero ? n >= 0 : n > 0) ? n : fallback;
  };
  return {
    providers: selected as BootstrapProvider[],
    maxPasses: integer(args[passIndex + 1], 20),
    delayMs: integer(args[delayIndex + 1], 3000, true),
  };
}

export function shouldContinueBootstrap(input: {
  episodeNew: number;
  pass: number;
  maxPasses: number;
}) {
  return input.episodeNew > 0 && input.pass < input.maxPasses;
}
