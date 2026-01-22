const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting coordinates from:', url);

    let finalUrl = url;

    // If it's a shortened URL, resolve it
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
        });
        finalUrl = response.url;
        console.log('Resolved URL:', finalUrl);
      } catch (e) {
        // Try GET if HEAD fails
        try {
          const response = await fetch(url, {
            redirect: 'follow',
          });
          finalUrl = response.url;
          console.log('Resolved URL (GET):', finalUrl);
        } catch (e2) {
          console.error('Failed to resolve short URL:', e2);
        }
      }
    }

    // Extract coordinates from various Google Maps URL formats
    let latitude: number | null = null;
    let longitude: number | null = null;

    // Pattern 1: @lat,lng in URL (most common after redirect)
    const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const atMatch = finalUrl.match(atPattern);
    if (atMatch) {
      latitude = parseFloat(atMatch[1]);
      longitude = parseFloat(atMatch[2]);
      console.log('Found coordinates via @ pattern:', latitude, longitude);
    }

    // Pattern 2: ?q=lat,lng or &q=lat,lng
    if (!latitude || !longitude) {
      const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const qMatch = finalUrl.match(qPattern);
      if (qMatch) {
        latitude = parseFloat(qMatch[1]);
        longitude = parseFloat(qMatch[2]);
        console.log('Found coordinates via q= pattern:', latitude, longitude);
      }
    }

    // Pattern 3: /place/.../@lat,lng
    if (!latitude || !longitude) {
      const placePattern = /\/place\/[^/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const placeMatch = finalUrl.match(placePattern);
      if (placeMatch) {
        latitude = parseFloat(placeMatch[1]);
        longitude = parseFloat(placeMatch[2]);
        console.log('Found coordinates via place pattern:', latitude, longitude);
      }
    }

    // Pattern 4: !3d and !4d parameters (embedded maps)
    if (!latitude || !longitude) {
      const dataPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
      const dataMatch = finalUrl.match(dataPattern);
      if (dataMatch) {
        latitude = parseFloat(dataMatch[1]);
        longitude = parseFloat(dataMatch[2]);
        console.log('Found coordinates via !3d!4d pattern:', latitude, longitude);
      }
    }

    // Pattern 5: ll= parameter
    if (!latitude || !longitude) {
      const llPattern = /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const llMatch = finalUrl.match(llPattern);
      if (llMatch) {
        latitude = parseFloat(llMatch[1]);
        longitude = parseFloat(llMatch[2]);
        console.log('Found coordinates via ll= pattern:', latitude, longitude);
      }
    }

    // Pattern 6: DMS format in URL (e.g., 19°09'33.8"S)
    if (!latitude || !longitude) {
      // This pattern is less common in URLs but may appear in some formats
      const dmsPattern = /(\d+)°(\d+)'([\d.]+)"([NS])\s*(\d+)°(\d+)'([\d.]+)"([EW])/;
      const dmsMatch = finalUrl.match(dmsPattern);
      if (dmsMatch) {
        const latDeg = parseInt(dmsMatch[1]);
        const latMin = parseInt(dmsMatch[2]);
        const latSec = parseFloat(dmsMatch[3]);
        const latDir = dmsMatch[4];
        
        const lngDeg = parseInt(dmsMatch[5]);
        const lngMin = parseInt(dmsMatch[6]);
        const lngSec = parseFloat(dmsMatch[7]);
        const lngDir = dmsMatch[8];
        
        latitude = (latDeg + latMin / 60 + latSec / 3600) * (latDir === 'S' ? -1 : 1);
        longitude = (lngDeg + lngMin / 60 + lngSec / 3600) * (lngDir === 'W' ? -1 : 1);
        console.log('Found coordinates via DMS pattern:', latitude, longitude);
      }
    }

    // Validate coordinates
    if (latitude !== null && longitude !== null) {
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid coordinates range' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Round to 6 decimal places (about 0.1m precision)
      latitude = Math.round(latitude * 1000000) / 1000000;
      longitude = Math.round(longitude * 1000000) / 1000000;

      return new Response(
        JSON.stringify({ 
          success: true, 
          latitude, 
          longitude,
          resolvedUrl: finalUrl 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Could not extract coordinates from URL' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting coordinates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract coordinates';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
