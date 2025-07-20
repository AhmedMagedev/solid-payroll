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
    this.baseUrl = baseUrl || process.env.HIKVISION_URL || 'http://solid-metals.ddns.net:8080';
    this.username = username || process.env.HIKVISION_USERNAME || 'admin';
    this.password = password || process.env.HIKVISION_PASSWORD || '192837465@S';
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
      console.log('[Hikvision Client] Pulling attendance data...');
      
      const uri = '/ISAPI/AccessControl/AcsEvent?format=json';
      const url = `${this.baseUrl}${uri}`;
      
      // Format dates for Hikvision API (they expect +03:00 timezone)
      const formatHikvisionDate = (date: Date, isEndDate = false) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEndDate ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}+03:00`;
      };

      const requestBody = {
        AcsEventCond: {
          searchID: "1",
          searchResultPosition: 0,
          maxResults: 100,
          major: 0,
          minor: 0,
          startTime: formatHikvisionDate(startDate),
          endTime: formatHikvisionDate(endDate, true)
        }
      };

      console.log('[Hikvision Client] Request parameters:', {
        startTime: requestBody.AcsEventCond.startTime,
        endTime: requestBody.AcsEventCond.endTime,
        url
      });

      // First request to get the digest challenge
      const initialResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (initialResponse.status === 401) {
        // Parse WWW-Authenticate header
        const authHeader = initialResponse.headers.get('WWW-Authenticate');
        if (!authHeader || !authHeader.startsWith('Digest')) {
          throw new Error('Server did not return a Digest challenge');
        }

        console.log('[Hikvision Client] Received digest challenge, authenticating...');
        
        const authParams = this.parseWWWAuthenticate(authHeader);
        
        // Generate digest authentication
        const digestAuth = this.generateDigestAuth({
          username: this.username,
          password: this.password,
          realm: authParams.realm || '',
          nonce: authParams.nonce || '',
          uri,
          method: 'POST',
          qop: authParams.qop,
          opaque: authParams.opaque
        });

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
          console.error('[Hikvision Client] Authenticated request failed:', 
            authenticatedResponse.status, authenticatedResponse.statusText);
          return null;
        }

        const data = await authenticatedResponse.json();
        console.log('[Hikvision Client] Successfully retrieved attendance data');
        return data;

      } else if (initialResponse.ok) {
        // No authentication required
        const data = await initialResponse.json();
        console.log('[Hikvision Client] Successfully retrieved attendance data (no auth required)');
        return data;
      } else {
        console.error('[Hikvision Client] Initial request failed:', 
          initialResponse.status, initialResponse.statusText);
        return null;
      }

    } catch (error) {
      console.error('[Hikvision Client] Error pulling attendance data:', error);
      return null;
    }
  }
}

export default HikvisionClient; 