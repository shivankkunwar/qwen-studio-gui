// Month totals, remaining credit, cost per app/resource/day/hour and every generation.
// Cached 3 minutes (Modal itemizes cost per hour at best); ?refresh=1 forces a new read.
export default defineEventHandler(async (event) => {
  const force = getQuery(event).refresh === '1'
  try {
    return await modalUsage('full', 180_000, force)
  } catch (err: any) {
    throw createError({ statusCode: 502, statusMessage: err.message })
  }
})
