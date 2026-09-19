import { NextRequest } from "next/server"
import { clearSession } from "@/lib/server/session"
import { jsonResponse, optionsResponse, rejectDisallowedOrigin } from "@/lib/cors"

export const runtime = "nodejs"

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request)
}

export async function POST(request: NextRequest) {
  const originError = rejectDisallowedOrigin(request)
  if (originError) return originError
  const response = jsonResponse(request, { status: "missing" })
  clearSession(response)
  return response
}
