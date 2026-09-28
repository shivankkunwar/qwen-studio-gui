// GPU workers up right now, with uptime and cost so far. Polled every few seconds by /usage.
export default defineEventHandler(async () => {
  try {
    return await modalUsage('live', 4_000)
  } catch (err: any) {
    throw createError({ statusCode: 502, statusMessage: err.message })
  }
})
