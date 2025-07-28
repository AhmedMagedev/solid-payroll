import crypto from 'crypto';

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

interface HikvisionAttendanceEvent {
  employeeNoString?: string;
  time: string;
  eventType?: string;
  majorEventType?: number;
  subEventType?: number;
  name?: string;
}

interface HikvisionResponse {
  AcsEvent?: {
    InfoList?: HikvisionAttendanceEvent[];
  };
}

class HikvisionClient {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(baseUrl?: string, username?: string, password?: string) {
    const rawBaseUrl = baseUrl || process.env.HIKVISION_URL || '';
    
    // Clean up the base URL - remove quotes and ensure no trailing slash or duplicate endpoints
    this.baseUrl = rawBaseUrl
      .replace(/['"]/g, '') // Remove any quotes
      .replace(/\/+$/, '') // Remove trailing slashes
      .replace(/\/ISAPI.*$/, ''); // Remove any existing API endpoint path
      
    this.username = (username || process.env.HIKVISION_USERNAME || '').replace(/['"]/g, '');
    this.password = (password || process.env.HIKVISION_PASSWORD || '').replace(/['"]/g, '');
    
    // Validate required configuration
    if (!this.baseUrl || !this.username || !this.password) {
      throw new Error(`Missing Hikvision configuration: URL=${!!this.baseUrl}, Username=${!!this.username}, Password=${!!this.password}`);
    }
  }

  private parseWWWAuthenticate(authHeader: string): Partial<DigestAuthParams> {
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

  private generateDigestAuth(params: DigestAuthParams): string {
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

  async pullAttendanceData(startDate: Date, endDate: Date): Promise<HikvisionResponse | null> {
    try {
      console.log('[Hikvision Client] Pulling attendance data using curl-like approach...');
      
      const url = `${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`;
      
      // Format dates for Hikvision API (use dates as-is without timezone adjustment)
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

      console.log('[Hikvision Client] Cleaned URL components:', {
        baseUrl: this.baseUrl,
        fullUrl: url,
        username: this.username ? `${this.username.slice(0, 3)}***` : 'empty'
      });
      
      console.log('[Hikvision Client] Request parameters:', {
        startTime: requestBody.AcsEventCond.startTime,
        endTime: requestBody.AcsEventCond.endTime,
        url,
        username: this.username ? `${this.username.slice(0, 3)}***` : 'empty'
      });

      // Use basic auth with digest challenge handling
      // This approach mirrors the working curl command
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      
      console.log('[Hikvision Client] Making request with Basic Auth (will be challenged for Digest)...');
      
      // Make the request - if it requires digest auth, the server will challenge us
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (response.status === 401) {
        console.log('[Hikvision Client] Received 401, attempting digest authentication...');
        
        const authHeader = response.headers.get('WWW-Authenticate');
        if (!authHeader) {
          console.error('[Hikvision Client] No WWW-Authenticate header in 401 response');
          return null;
        }

        console.log('[Hikvision Client] Auth header:', authHeader);
        
        if (authHeader.includes('Digest')) {
          // Parse digest challenge
          const authParams = this.parseWWWAuthenticate(authHeader);
          
          // Generate digest authentication for the exact URI
          const digestAuth = this.generateDigestAuth({
            username: this.username,
            password: this.password,
            realm: authParams.realm || '',
            nonce: authParams.nonce || '',
            uri: '/ISAPI/AccessControl/AcsEvent?format=json',
            method: 'POST',
            qop: authParams.qop,
            opaque: authParams.opaque
          });

          console.log('[Hikvision Client] Making authenticated request with digest...');
          
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
            console.error('[Hikvision Client] Digest authenticated request failed:', 
              authenticatedResponse.status, authenticatedResponse.statusText);
            // Try to read response body for more details
            const errorText = await authenticatedResponse.text();
            console.error('[Hikvision Client] Error response body:', errorText);
            return null;
          }

          const data = await authenticatedResponse.json();
          console.log('[Hikvision Client] Successfully retrieved attendance data with digest auth');
          return data;
        } else {
          console.error('[Hikvision Client] Server requires authentication but no Digest challenge found');
          return null;
        }
      } else if (response.ok) {
        // Request succeeded with basic auth or no auth
        const data = await response.json();
        console.log('[Hikvision Client] Successfully retrieved attendance data');
        return data;
      } else {
        console.error('[Hikvision Client] Request failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[Hikvision Client] Error response body:', errorText);
        return null;
      }

    } catch (error) {
      console.error('[Hikvision Client] Error pulling attendance data:', error);
      return null;
    }
  }
}

export default HikvisionClient; 