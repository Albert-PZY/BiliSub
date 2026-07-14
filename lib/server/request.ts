export { MAX_SUBTITLE_PAGES, MAX_VIDEO_SOURCES } from "@/lib/limits"

const MAX_INPUT_LENGTH = 2_000

export function normalizeStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((item) => String(item ?? "").trim().slice(0, MAX_INPUT_LENGTH))
    .filter(Boolean)

  return [...new Set(normalized)].slice(0, limit)
}

export function exceedsArrayLimit(value: unknown, limit: number): boolean {
  return Array.isArray(value) && value.length > limit
}

export async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  task: (input: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(inputs.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await task(inputs[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), inputs.length) }, () => worker()),
  )
  return results
}
