export async function retryPlay(
  play: () => Promise<unknown>,
  attempts = 4,
  delayMs = 350,
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await play();
      return true;
    } catch {
      if (i === attempts - 1) return false;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
