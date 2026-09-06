import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

/**
 * POST /api/ai/chat
 * Intelligent Disaster Logistics & Emergency Highway AI Copilot
 * Provides sub-second real-time corridor intelligence, supply depot guidance,
 * detour recommendations, and emergency SOP protocols for 8 NER states.
 */
export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      }, { status: 500 });
    }

    const body = await req.json();
    const { 
      messages = [], 
      userQuery = '',
      context = {} 
    } = body;

    const queryText = userQuery || (messages.length > 0 ? messages[messages.length - 1].content : '');
    if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Please provide a valid question or prompt.',
      }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Extract live context data from frontend state snapshot
    const activeHazards = context.hazards || [];
    const supplyHubs = context.hubs || [];
    const userRole = context.userRole || 'citizen_driver';
    const userLocation = context.userLocation || null;
    const activeRoute = context.activeRoute || null;

    // Helper: Haversine geodesic distance in kilometers
    const getHaversineDistanceKm = (lat1, lon1, lat2, lon2) => {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return parseFloat((R * c).toFixed(1));
    };

    // Calculate proximity if user GPS is shared
    let hazardsWithDist = activeHazards.map((h) => {
      const dist = userLocation ? getHaversineDistanceKm(userLocation.lat, userLocation.lng, parseFloat(h.latitude), parseFloat(h.longitude)) : null;
      return { ...h, distanceKm: dist };
    });

    if (userLocation) {
      hazardsWithDist.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    }

    let hubsWithDist = supplyHubs.map((hub) => {
      const dist = userLocation ? getHaversineDistanceKm(userLocation.lat, userLocation.lng, parseFloat(hub.latitude), parseFloat(hub.longitude)) : null;
      return { ...hub, distanceKm: dist };
    });

    if (userLocation) {
      hubsWithDist.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    }

    // Build condensed live situation summary for Gemini context
    const hazardsSummary = hazardsWithDist.slice(0, 15).map((h, i) => {
      const distText = h.distanceKm != null 
        ? ` | Proximity: ${h.distanceKm} km from operator (${h.distanceKm <= (parseFloat(h.impact_radius_km) || 5) ? '🚨 WITHIN DANGER RADIUS!' : 'Outside impact radius'})` 
        : '';
      return `[Hazard ${i + 1}] ID: ${h.id || 'N/A'} | Type: ${h.hazard_type || h.title || 'Road Obstruction'} | Severity: ${h.severity || 'HIGH'} | State: ${h.state || 'NER'} | District: ${h.district || 'General Sector'} | Status: ${h.status || 'Active'} | Location: Lat ${h.latitude}, Lng ${h.longitude}${distText} | Notes: "${h.notes || h.description || 'No additional notes'}"`;
    }).join('\n');

    const hubsSummary = hubsWithDist.slice(0, 20).map((hub, i) => {
      const distText = hub.distanceKm != null ? ` | Proximity: ${hub.distanceKm} km away` : '';
      return `[Hub ${i + 1}] Code: ${hub.hub_code || 'HUB'} | Name: ${hub.hub_name} | State: ${hub.state} | District: ${hub.district} | Coordinates: (${hub.latitude}, ${hub.longitude})${distText}`;
    }).join('\n');

    const weatherData = activeRoute?.weather || context.weather || null;
    const weatherSummary = weatherData ? (
      `LIVE METEOROLOGICAL THREAT DATA: Conditions: ${weatherData.dominantWeather || 'Normal'} (${weatherData.weatherEmoji || '🌤️'}) | Temp: ${weatherData.avgTemperature ?? '25'}°C | Peak Rainfall: ${weatherData.maxRainfallMm ?? 0} mm/h | Risk Tier: ${(weatherData.riskTier || 'safe').toUpperCase()} | Advisory: "${weatherData.alertMessage || 'Normal transit conditions'}"`
    ) : 'No live corridor weather sampled yet.';

    const routeSummary = activeRoute ? (
      `CURRENT ACTIVE JOURNEY / ROUTE: Origin: ${activeRoute.originName || 'Origin Hub'} ➔ Destination: ${activeRoute.destName || 'Destination Hub'} | Estimated Distance: ${activeRoute.distanceKm || 'N/A'} km | Safe Corridor Index (SCI): ${activeRoute.sciScore ?? 'N/A'} / 100 | Choke Points Detected: ${activeRoute.hazardsOnRouteCount || 0}`
    ) : 'No active route currently selected by the operator.';

    const locationSummary = userLocation ? (
      `OPERATOR CURRENT GPS (SHARED WITH COPILOT): Lat ${userLocation.lat.toFixed(6)}, Lng ${userLocation.lng.toFixed(6)} (Accuracy: ${userLocation.accuracy ? userLocation.accuracy + 'm' : 'Standard'}). The operator has explicitly shared their live position to track route safety.`
    ) : 'OPERATOR GPS STATUS: Not shared or unavailable. Provide general corridor guidance.';

    const systemInstruction = `
You are the AshtaMarg Tactical Logistics & Disaster Copilot for the North-Eastern Region (NER) of India, covering all 8 states: Assam, Arunachal Pradesh, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, and Sikkim.

Your mission is to assist citizen drivers, emergency relief convoys, and government Nodal Disaster Officers with real-time route intelligence, road hazard awareness, live monsoon & weather alerts, supply depot logistics, and emergency Standard Operating Procedures (SOPs).

LIVE SITUATION SNAPSHOT:
========================
${locationSummary}
${routeSummary}
${weatherSummary}

LIVE ACTIVE ROAD HAZARDS (${activeHazards.length} total active in NER):
${hazardsSummary || 'No active road hazards currently reported. Corridors are clear.'}

KEY SUPPLY HUBS DIRECTORY (${supplyHubs.length} total depots):
${hubsSummary || 'Standard 50 NER regional hubs active.'}

OPERATOR ROLE: ${userRole.toUpperCase()}

CORE CAPABILITIES & GUIDELINES:
1. MULTILINGUAL AGILITY:
   - Detect the user's input language and ALWAYS reply in the SAME language (English, Hindi, Assamese, Bengali, Manipuri, Hinglish, etc.).
   - If the user asks in Hindi ("Kya NH-27 khula hai?"), answer warmly in clean Hindi / Hinglish.
   - If the user asks in Assamese ("গুৱাহাটীৰ পৰা শিলচৰলৈ ৰাস্তা কেনেকুৱা?"), reply in fluent Assamese.

2. TACTICAL CORRIDOR KNOWLEDGE:
   - Key highways: NH-27 (East-West Corridor via Haflong / Dima Hasao), NH-10 (Siliguri - Gangtok lifeline), NH-29 (Dimapur - Kohima), NH-37 (Brahmaputra Valley), NH-102 (Imphal - Moreh border), NH-6 (Shillong - Silchar), Sela Pass road (Tawang).
   - High-risk choke points: Jatinga Ridge (Dima Hasao landslides), Rangpo gorge (Teesta floods), Kalsi bridge, Nongpoh ghats.

3. ACTIONABLE ANSWERS & FORMATTING:
   - Be concise, direct, and authoritative yet reassuring.
   - Use bold highlights, bullet points, and emergency emojis (🚧, ⛽, 🏥, ⚠️, 🚨, 🛣️).
   - If a specific hazard in the database is relevant, mention its location and severity clearly.
   - When suggesting safety SOPs for flash floods, rockfalls, or bridge collapses, give immediate tactical advice (e.g. avoid night transit in Dima Hasao, halt before swollen nullahs, maintain 50m vehicle spacing).

4. INTERACTIVE MAP ACTIONS:
   - When referencing a specific hazard from the database, you can optionally append: [action:hazard:{hazard_id}] or [action:hub:{hub_code}] so the UI can render an interactive quick-jump button.

Keep your response fast, crisp, helpful, and focused on logistics safety in the challenging terrain of Northeast India.
`;

    // Candidate model cascade for ultra-low latency (<1s response time)
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
    ];

    let replyText = null;
    let lastError = null;

    // Format chat history into contents array
    const contents = [];
    
    // Append previous dialogue turns if available
    const historySlice = messages.slice(-6);
    for (const msg of historySlice) {
      if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'model') {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content || msg.text || '' }]
        });
      }
    }

    // Ensure the latest user query is present
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: queryText }]
      });
    }

    // Execute generation with candidate model cascade
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            maxOutputTokens: 600,
            temperature: 0.3,
          }
        });

        if (response?.text) {
          replyText = response.text;
          break;
        }
      } catch (err) {
        console.warn(`Gemini chat model ${model} attempt failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!replyText) {
      throw lastError || new Error('Failed to generate AI chat response across available models.');
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: replyText,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.warn('AI Chat Endpoint Notice:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'AI Assistant is currently unavailable. Please try again.',
    }, { status: 500 });
  }
}
