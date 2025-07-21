// Hikvision API client using the exact curl approach that works
import { spawn } from 'child_process';
import crypto from 'crypto';

export interface HikvisionCurlResponse {
  success: boolean;
  data?: { AcsEvent?: { InfoList?: Array<{ employeeNoString?: string; time: string; eventType?: string; majorEventType?: number; subEventType?: number; name?: string }> } };
  error?: string;
}

interface DigestAuthParams {
  username: string;
  password: string;
  realm: string;
  nonce: string;
  uri: string;
  method: string;
  qop?: string;
  nc?: string;
  cnonce?: string;
  opaque?: string;
}

// Helper functions for digest authentication
function parseWWWAuthenticate(authHeader: string): Partial<DigestAuthParams> {
  const authParams: Partial<DigestAuthParams> = {};
  
  // Remove 'Digest ' prefix
  const authString = authHeader.replace(/^Digest /, '');
  
  // Parse key-value pairs
  const regex = /(\w+)=["']?([^,"']+)["']?/g;
  let match;
  
  while ((match = regex.exec(authString)) !== null) {
    const key = match[1] as keyof DigestAuthParams;
    (authParams as Record<string, string>)[key] = match[2];
  }
  
  return authParams;
}

function generateDigestAuth(params: DigestAuthParams): string {
  // Generate HA1
  const ha1 = crypto
    .createHash('md5')
    .update(`${params.username}:${params.realm}:${params.password}`)
    .digest('hex');

  // Generate HA2
  const ha2 = crypto
    .createHash('md5')
    .update(`${params.method}:${params.uri}`)
    .digest('hex');

  // Generate response
  let response: string;
  if (params.qop === 'auth') {
    const nc = params.nc || '00000001';
    const cnonce = params.cnonce || crypto.randomBytes(8).toString('hex');
    
    response = crypto
      .createHash('md5')
      .update(`${ha1}:${params.nonce}:${nc}:${cnonce}:${params.qop}:${ha2}`)
      .digest('hex');
  } else {
    response = crypto
      .createHash('md5')
      .update(`${ha1}:${params.nonce}:${ha2}`)
      .digest('hex');
  }

  // Build authorization header
  let authHeader = `Digest username="${params.username}", realm="${params.realm}", nonce="${params.nonce}", uri="${params.uri}", response="${response}"`;
  
  if (params.qop) {
    const nc = params.nc || '00000001';
    const cnonce = params.cnonce || crypto.randomBytes(8).toString('hex');
    authHeader += `, qop=${params.qop}, nc=${nc}, cnonce="${cnonce}"`;
  }
  
  if (params.opaque) {
    authHeader += `, opaque="${params.opaque}"`;
  }

  return authHeader;
}

// Helper function for digest authentication
async function performDigestAuth(
  url: string, 
  requestBody: any, 
  username: string, 
  password: string, 
  authHeader: string
): Promise<HikvisionCurlResponse> {
  try {
    // Parse digest challenge
    const authParams = parseWWWAuthenticate(authHeader);
    
    // Generate digest authentication for the exact URI
    const digestAuth = generateDigestAuth({
      username,
      password,
      realm: authParams.realm || '',
      nonce: authParams.nonce || '',
      uri: '/ISAPI/AccessControl/AcsEvent?format=json',
      method: 'POST',
      qop: authParams.qop,
      opaque: authParams.opaque
    });

    console.log('[Hikvision Fetch] Making authenticated request with digest...');
    
    // Make authenticated request
    const authenticatedResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': digestAuth
      },
      body: JSON.stringify(requestBody)
    });

    if (!authenticatedResponse.ok) {
      const errorText = await authenticatedResponse.text();
      console.error('[Hikvision Fetch] Digest authenticated request failed:', 
        authenticatedResponse.status, authenticatedResponse.statusText);
      console.error('[Hikvision Fetch] Error response body:', errorText);
      return { 
        success: false, 
        error: `Digest auth failed: HTTP ${authenticatedResponse.status}: ${errorText}` 
      };
    }

    const data = await authenticatedResponse.json();
    console.log('[Hikvision Fetch] Successfully retrieved attendance data with digest auth');
    return { success: true, data };
    
  } catch (error) {
    console.error('[Hikvision Fetch] Error in digest authentication:', error);
    return { 
      success: false, 
      error: `Digest auth error: ${(error as Error).message}` 
    };
  }
}

export async function pullHikvisionDataWithCurl(startDate: Date, endDate: Date): Promise<HikvisionCurlResponse> {
  return new Promise((resolve) => {
    try {
      // Format dates for Hikvision API (use local time without timezone offset)
      const formatHikvisionDate = (date: Date, isEndDate = false) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEndDate ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}`;
      };

      const requestBody = {
        AcsEventCond: {
          searchID: "today",
          searchResultPosition: 0,
          maxResults: 20000, // Increased from 5000 to ensure we get all logs
          major: 5,
          minor: 38,
          startTime: formatHikvisionDate(startDate),
          endTime: formatHikvisionDate(endDate, true)
        }
      };

      console.log('[Hikvision Curl] Using curl to pull data with parameters:', {
        startTime: requestBody.AcsEventCond.startTime,
        endTime: requestBody.AcsEventCond.endTime
      });

      // Get credentials from environment or use defaults
      const hikvisionUrl = process.env.HIKVISION_URL || 'http://solid-metals.ddns.net:8080';
      const hikvisionUsername = process.env.HIKVISION_USERNAME || 'admin';
      const hikvisionPassword = process.env.HIKVISION_PASSWORD || '192837465@S';
      const credentials = `${hikvisionUsername}:${hikvisionPassword}`;
      const fullUrl = `${hikvisionUrl}/ISAPI/AccessControl/AcsEvent?format=json`;

      // Prepare curl command exactly as provided
      const curlArgs = [
        '--digest',
        '-u', credentials,
        '--location', fullUrl,
        '--header', 'Content-Type: application/json',
        '--data', JSON.stringify(requestBody),
        '--silent', // Suppress progress meter
        '--show-error' // Show error messages
      ];

      console.log('[Hikvision Curl] Executing curl command...');

      const curl = spawn('curl', curlArgs);
      let responseData = '';
      let errorData = '';

      curl.stdout.on('data', (data) => {
        responseData += data.toString();
      });

      curl.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      curl.on('close', (code) => {
        console.log('[Hikvision Curl] curl process exited with code:', code);

        if (code === 0) {
          try {
            if (responseData.trim()) {
              const jsonData = JSON.parse(responseData);
              console.log('[Hikvision Curl] Successfully parsed response data');
              resolve({ success: true, data: jsonData });
            } else {
              console.error('[Hikvision Curl] Empty response from server');
              resolve({ success: false, error: 'Empty response from server' });
            }
          } catch (parseError) {
            console.error('[Hikvision Curl] Failed to parse JSON response:', parseError);
            console.error('[Hikvision Curl] Raw response:', responseData);
            resolve({ success: false, error: `JSON parse error: ${parseError}` });
          }
        } else {
          console.error('[Hikvision Curl] curl command failed with code:', code);
          console.error('[Hikvision Curl] Error output:', errorData);
          resolve({ success: false, error: `curl failed with exit code ${code}: ${errorData}` });
        }
      });

      curl.on('error', (error) => {
        console.error('[Hikvision Curl] Failed to start curl process:', error);
        resolve({ success: false, error: `Failed to start curl: ${error.message}` });
      });

    } catch (error) {
      console.error('[Hikvision Curl] Error setting up curl request:', error);
      resolve({ success: false, error: `Setup error: ${(error as Error).message}` });
    }
  });
}

// Alternative fetch-based approach with better digest auth handling
export async function pullHikvisionDataWithFetch(startDate: Date, endDate: Date): Promise<HikvisionCurlResponse> {
  try {
    console.log('[Hikvision Fetch] Attempting fetch with improved digest auth...');

    // Format dates for Hikvision API (use local time without timezone offset)
    const formatHikvisionDate = (date: Date, isEndDate = false) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const time = isEndDate ? '23:59:59' : '00:00:00';
      return `${year}-${month}-${day}T${time}`;
    };

    const requestBody = {
      AcsEventCond: {
        searchID: "today",
        searchResultPosition: 0,
        maxResults: 20000, // Increased from 5000 to ensure we get all logs
        major: 5,
        minor: 38,
        startTime: formatHikvisionDate(startDate),
        endTime: formatHikvisionDate(endDate, true)
      }
    };

    const hikvisionUrl = process.env.HIKVISION_URL || 'http://solid-metals.ddns.net:8080';
    const hikvisionUsername = process.env.HIKVISION_USERNAME || 'admin';
    const hikvisionPassword = process.env.HIKVISION_PASSWORD || '192837465@S';
    const url = `${hikvisionUrl}/ISAPI/AccessControl/AcsEvent?format=json`;
    
    console.log('[Hikvision Fetch] Request parameters:', {
      url,
      startTime: requestBody.AcsEventCond.startTime,
      endTime: requestBody.AcsEventCond.endTime
    });

    // Try with basic auth first (some servers accept this)
    const basicAuth = Buffer.from(`${hikvisionUsername}:${hikvisionPassword}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
        'User-Agent': 'curl/7.68.0', // Mimic curl user agent
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Hikvision Fetch] Successfully retrieved data with basic auth');
      return { success: true, data };
    }

    // If basic auth fails, try to handle digest authentication
    if (response.status === 401) {
      console.log('[Hikvision Fetch] Basic auth failed, trying digest authentication...');
      const authHeader = response.headers.get('WWW-Authenticate');
      console.log('[Hikvision Fetch] Auth header:', authHeader);
      
      if (authHeader && authHeader.includes('Digest')) {
        // Try digest authentication using the helper functions
        try {
          const digestResult = await performDigestAuth(url, requestBody, hikvisionUsername, hikvisionPassword, authHeader);
          if (digestResult.success) {
            return digestResult;
          }
        } catch (digestError) {
          console.error('[Hikvision Fetch] Digest auth failed:', digestError);
        }
      }
    }

    const errorText = await response.text();
    console.error('[Hikvision Fetch] Request failed:', response.status, response.statusText);
    console.error('[Hikvision Fetch] Response body:', errorText);
    
    return { 
      success: false, 
      error: `HTTP ${response.status}: ${response.statusText} - ${errorText}` 
    };

  } catch (error) {
    console.error('[Hikvision Fetch] Network error:', error);
    return { 
      success: false, 
      error: `Network error: ${(error as Error).message}` 
    };
  }
} 