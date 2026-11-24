import { google } from 'googleapis'

// These must be set in your .env.local
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI

export function getGoogleOAuthClient() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('Missing Google OAuth environment variables')
  }

  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  )
}

export function getGoogleAuthUrl(state?: string) {
  const oauth2Client = getGoogleOAuthClient()

  // Generate a url that asks permissions for Google Docs and Drive
  const scopes = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
  ]

  return oauth2Client.generateAuthUrl({
    // 'offline' gets refresh_token
    access_type: 'offline',
    prompt: 'consent', // Force consent to ensure refresh token is provided
    scope: scopes,
    state: state || undefined,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getGoogleOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export function getDocsClient(refreshToken: string) {
  const oauth2Client = getGoogleOAuthClient()
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return google.docs({ version: 'v1', auth: oauth2Client })
}

export function getDriveClient(refreshToken: string) {
  const oauth2Client = getGoogleOAuthClient()
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2Client })
}
